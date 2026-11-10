import React from 'react';

/**
 * Normalizes and formats any phone number into a standardized WhatsApp international number:
 * - Strips all spaces, hyphens, periods, parentheses, and invalid characters.
 * - Supports Moroccan formats (06..., 07..., 05... -> 2126..., 2127..., 2125...).
 * - Supports +212... and 00212... -> 212...
 * - Supports all international formats with country codes (+966, +33, +1, 00966, etc.).
 * - Returns pure digits suitable for https://wa.me/<digits>
 */
export function formatWhatsAppInternational(phone?: string | null): string {
  if (!phone) return '';
  let str = String(phone).trim();
  if (!str) return '';

  // Remove spaces, dashes, dots, parentheses, brackets
  str = str.replace(/[\s\-\.\(\)\[\]\/]/g, '');

  // Handle leading +
  if (str.startsWith('+')) {
    str = str.substring(1);
  } else if (str.startsWith('00')) {
    // 00212... -> 212...
    str = str.substring(2);
  }

  // Handle Moroccan local numbers (10 digits starting with 06, 07, 05)
  if (/^0[567]\d{8}$/.test(str)) {
    str = '212' + str.substring(1);
  } else if (/^2120[567]\d{8}$/.test(str)) {
    // Accidentally typed 21206... -> 2126...
    str = '212' + str.substring(4);
  }

  // Keep strictly digits
  return str.replace(/\D/g, '');
}

/**
 * Validates a WhatsApp phone number and returns detailed format status
 */
export function validateWhatsAppPhone(phone?: string | null): {
  valid: boolean;
  formatted: string;
  error?: string;
} {
  if (!phone || !phone.trim()) {
    return {
      valid: false,
      formatted: '',
      error: 'يرجى إدخال رقم واتساب الجمعية.',
    };
  }

  const formatted = formatWhatsAppInternational(phone);
  if (!formatted) {
    return {
      valid: false,
      formatted: '',
      error: 'رقم الهاتف غير صالح، يرجى التأكد من كتابة الأرقام بشكل صحيح.',
    };
  }

  // International phone numbers typically range from 8 to 15 digits
  if (formatted.length < 8) {
    return {
      valid: false,
      formatted,
      error: 'رقم الهاتف قصير جداً، يرجى كتابة الرقم كاملاً مع مفتاح الدولة أو رمز المدينة.',
    };
  }

  if (formatted.length > 16) {
    return {
      valid: false,
      formatted,
      error: 'رقم الهاتف طويل جداً، يرجى التحقق من صحة الرقم.',
    };
  }

  return {
    valid: true,
    formatted,
  };
}

/**
 * Builds a direct, cross-platform WhatsApp chat URL that works natively
 * on mobile devices (iOS/Android native WhatsApp app) and desktop (WhatsApp Web/App).
 */
export function buildWhatsAppChatUrl(phone?: string | null, text?: string): string {
  const formatted = formatWhatsAppInternational(phone);
  if (!formatted) return '';

  const baseUrl = `https://wa.me/${formatted}`;
  if (text && text.trim()) {
    return `${baseUrl}?text=${encodeURIComponent(text.trim())}`;
  }
  return baseUrl;
}

/**
 * Official WhatsApp SVG Logo Icon Component
 */
export const WhatsAppIcon: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ 
  className = 'w-5 h-5', 
  style 
}) => {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="currentColor" 
      className={className} 
      style={style} 
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
};
