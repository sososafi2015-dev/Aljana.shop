import React from 'react';
import { MessageCircle, Headphones, ExternalLink, ShieldCheck } from 'lucide-react';
import { usePlatformIdentity, getCachedPlatformIdentity } from '../api/platformIdentityApi';

// الرقم الافتراضي المعتمد في حال عدم توفر رقم مخصص في قاعدة البيانات
export const DEFAULT_PLATFORM_ADMIN_WHATSAPP = '00212718861646';

/**
 * تنظيف رقم الواتساب واستخراج الأرقام فقط المناسبة لـ wa.me
 */
export function sanitizeWhatsAppDigits(raw?: string): string {
  const num = (raw || '').trim() || DEFAULT_PLATFORM_ADMIN_WHATSAPP;
  // إزالة أي مسافات أو شرطات أو أقواس ونزع 00 أو + من البداية
  const cleaned = num.replace(/[\s\-\(\)\.]/g, '');
  return cleaned.replace(/^\+|^00/, '');
}

interface ContactPlatformAdminButtonProps {
  tenantName?: string;
  variant?: 'card' | 'banner' | 'compact';
  className?: string;
  customWhatsApp?: string;
}

/**
 * دالة مساعدة لفتح محادثة واتساب الرسمية مع إدارة المنصة
 */
export function openPlatformAdminWhatsApp(tenantName?: string, customWhatsApp?: string) {
  const currentIdentity = getCachedPlatformIdentity();
  const rawNumber = customWhatsApp || currentIdentity.associationsWhatsapp || currentIdentity.whatsapp || DEFAULT_PLATFORM_ADMIN_WHATSAPP;
  const digits = sanitizeWhatsAppDigits(rawNumber);
  const associationText = tenantName ? ` الخاصة بـ «${tenantName}»` : '';
  const message = encodeURIComponent(
    `السلام عليكم ورحمة الله وبركاته، نتواصل معكم من لوحة تحكم الجمعية${associationText} للاستفسار وطلب الدعم من إدارة المنصة.`
  );
  const whatsappUrl = `https://wa.me/${digits}?text=${message}`;
  window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
}

export const ContactPlatformAdminButton: React.FC<ContactPlatformAdminButtonProps> = ({
  tenantName,
  variant = 'card',
  className = '',
  customWhatsApp,
}) => {
  const { identity } = usePlatformIdentity();
  const platformTitle = identity.platformName || 'syoumax منصة العمل الجمعوي';
  const effectiveWhatsApp = customWhatsApp || identity.associationsWhatsapp || identity.whatsapp || DEFAULT_PLATFORM_ADMIN_WHATSAPP;

  const handleClick = () => {
    openPlatformAdminWhatsApp(tenantName, effectiveWhatsApp);
  };

  if (variant === 'compact') {
    return (
      <button
        type="button"
        id="btn-contact-platform-admin-compact"
        onClick={handleClick}
        className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md shadow-emerald-600/20 hover:shadow-emerald-600/30 transition-all cursor-pointer select-none ${className}`}
        title={`تواصل مع إدارة المنصة عبر واتساب (${effectiveWhatsApp})`}
      >
        <MessageCircle className="w-4 h-4 fill-white/20 shrink-0" />
        <span>تواصل مع الإدارة</span>
      </button>
    );
  }

  return (
    <div
      id="section-contact-platform-admin"
      className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
        variant === 'banner'
          ? 'bg-gradient-to-r from-emerald-900 via-emerald-800 to-slate-900 text-white p-5 sm:p-6 border-emerald-700/50 shadow-lg'
          : 'bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/60 p-5 sm:p-6 border-emerald-200/80 shadow-sm hover:shadow-md'
      } ${className}`}
      dir="rtl"
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Left / Text info */}
        <div className="flex items-start sm:items-center gap-3.5 sm:gap-4">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
              variant === 'banner'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                : 'bg-emerald-600 text-white shadow-emerald-600/20'
            }`}
          >
            <Headphones className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h4
                className={`font-black text-sm sm:text-base ${
                  variant === 'banner' ? 'text-white' : 'text-slate-900'
                }`}
              >
                تواصل مع الإدارة
              </h4>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${
                  variant === 'banner'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30'
                    : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                }`}
              >
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                <span>إدارة {platformTitle}</span>
              </span>
            </div>
            <p
              className={`text-xs leading-relaxed max-w-xl ${
                variant === 'banner' ? 'text-emerald-100/80' : 'text-slate-600'
              }`}
            >
              لأي استفسار، مساعدة تقنية، تفعيل الاشتراكات، أو الدعم الفني المباشر، يمكنك مراسلة الإدارة العامة للمنصة عبر واتساب على الرقم الموحد:{' '}
              <strong className="font-mono font-bold dir-ltr inline-block mx-1">
                {effectiveWhatsApp}
              </strong>
            </p>
          </div>
        </div>

        {/* Action Button */}
        <div className="w-full sm:w-auto shrink-0">
          <button
            type="button"
            id="btn-contact-platform-admin-main"
            onClick={handleClick}
            className={`w-full sm:w-auto px-5 py-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2.5 transition-all shadow-md active:scale-98 cursor-pointer select-none ${
              variant === 'banner'
                ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/30 hover:shadow-emerald-500/50'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/25 hover:shadow-emerald-600/35'
            }`}
            title={`مراسلة إدارة المنصة مباشرة على واتساب (${effectiveWhatsApp})`}
          >
            <MessageCircle className="w-5 h-5 fill-current shrink-0" />
            <span>تواصل مع الإدارة</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-80 shrink-0" />
          </button>
        </div>
      </div>
    </div>
  );
};
