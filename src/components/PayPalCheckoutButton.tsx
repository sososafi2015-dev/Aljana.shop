import React, { useEffect, useRef, useState } from 'react';
import { ShieldCheck, AlertCircle, Loader2, Lock } from 'lucide-react';
import { SupportDonationRecord } from '../types';

export interface PayPalCheckoutButtonProps {
  amount: number;
  currency: 'MAD' | 'USD';
  supporterName?: string;
  supporterPhone?: string;
  supporterMessage?: string;
  donorName?: string;
  donorPhone?: string;
  donorNote?: string;
  purpose?: 'platform_support' | 'ad_campaign' | 'setup_service' | 'activation' | 'renewal';
  tenantId?: string;
  tenantName?: string;
  type?: 'paypal' | 'card' | 'both';
  onSuccess: (donation: SupportDonationRecord) => void;
  onError: (errorMessage: string) => void;
  onCancel?: () => void;
}

declare global {
  interface Window {
    paypal?: any;
  }
}

export const PayPalCheckoutButton: React.FC<PayPalCheckoutButtonProps> = ({
  amount,
  currency,
  supporterName,
  supporterPhone,
  supporterMessage,
  donorName,
  donorPhone,
  donorNote,
  purpose = 'platform_support',
  tenantId,
  tenantName,
  type = 'both',
  onSuccess,
  onError,
  onCancel,
}) => {
  const effectiveName = (supporterName || donorName || '').trim();
  const effectivePhone = (supporterPhone || donorPhone || '').trim();
  const effectiveNote = (supporterMessage || donorNote || '').trim();
  const containerRef = useRef<HTMLDivElement>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [config, setConfig] = useState<{
    clientId: string;
    businessEmail: string;
    mode: 'sandbox' | 'live';
    isConnected: boolean;
    hasSecret: boolean;
  } | null>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [sdkError, setSdkError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  const activeOrderSessionRef = useRef<{
    serverOrderToken?: string;
    paypalAmount: number;
    paypalCurrency: string;
    orderSource?: string;
  } | null>(null);

  // 1. Fetch public PayPal configuration from server (Client Secret is never exposed)
  useEffect(() => {
    let isMounted = true;
    const fetchConfig = async () => {
      try {
        setLoadingConfig(true);
        const res = await fetch('/api/paypal/config');
        const data = await res.json();
        if (isMounted) {
          if (data.success && data.clientId) {
            setConfig({
              clientId: data.clientId,
              businessEmail: data.businessEmail || 'sb-onuud40741552@business.example.com',
              mode: data.mode || 'sandbox',
              isConnected: Boolean(data.isConnected),
              hasSecret: Boolean(data.hasSecret),
            });
          } else {
            setConfig(null);
          }
          setLoadingConfig(false);
        }
      } catch {
        if (isMounted) {
          setLoadingConfig(false);
        }
      }
    };

    fetchConfig();
    return () => {
      isMounted = false;
    };
  }, []);

  // Calculate PayPal currency & amount (MAD is converted to USD for PayPal processing)
  // Calculate PayPal currency & amount (MAD is converted to USD for PayPal processing)
  const targetCurrency = currency === 'MAD' ? 'USD' : currency;
  const targetAmount = currency === 'MAD' ? Math.max(1, parseFloat((amount / 10).toFixed(2))) : amount;

  // 2. Load PayPal JS SDK dynamically
  useEffect(() => {
    if (!config?.clientId) return;

    let isCancelled = false;
    setSdkError(null);

    // If window.paypal.Buttons is already ready, use it immediately
    if (window.paypal && typeof window.paypal.Buttons === 'function') {
      setSdkReady(true);
      return;
    }

    const scriptId = `paypal-sdk-${config.clientId}-${targetCurrency}`;
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(
        config.clientId
      )}&currency=${targetCurrency}&components=buttons&intent=capture&enable-funding=card`;
      script.async = true;

      script.onload = () => {
        if (!isCancelled) {
          if (window.paypal && typeof window.paypal.Buttons === 'function') {
            setSdkReady(true);
          } else {
            setSdkError('تعذر تهيئة مكتبة PayPal Buttons. يرجى المحاولة مرة أخرى.');
          }
        }
      };

      script.onerror = () => {
        if (!isCancelled) {
          setSdkError('فشل تحميل واجهة الدفع من PayPal. يرجى التحقق من اتصال الإنترنت.');
        }
      };

      document.head.appendChild(script);
    } else {
      if (window.paypal && typeof window.paypal.Buttons === 'function') {
        setSdkReady(true);
      } else {
        script.addEventListener('load', () => {
          if (!isCancelled && window.paypal?.Buttons) {
            setSdkReady(true);
          }
        });
      }
    }

    return () => {
      isCancelled = true;
    };
  }, [config?.clientId, targetCurrency]);

  // 3. Render PayPal & Supported Bank Card Buttons when SDK and container are ready
  useEffect(() => {
    if (!sdkReady || !window.paypal?.Buttons || !containerRef.current || !config?.clientId) return;

    let isMounted = true;
    containerRef.current.innerHTML = '';

    try {
      const buttonOptions: any = {
        style: {
          layout: 'vertical',
          color: type === 'card' ? 'black' : 'gold',
          shape: 'rect',
          label: type === 'card' ? 'pay' : 'paypal',
          height: 46,
        },
        createOrder: async (_data: any, actions: any) => {
          try {
            const res = await fetch('/api/paypal/create-order', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                amount,
                currency,
                donorName: effectiveName,
                donorPhone: effectivePhone,
                donorNote: effectiveNote,
                fundingSource: type,
                purpose,
                tenantId,
                tenantName,
              }),
            });

            const orderRes = await res.json();
            if (!orderRes.success || !orderRes.orderId) {
              const msg = orderRes.message || 'تعذر إنشاء طلب الدفع في الخادم الآمن.';
              onError(msg);
              throw new Error(msg);
            }

            activeOrderSessionRef.current = {
              serverOrderToken: orderRes.serverOrderToken,
              paypalAmount: orderRes.paypalAmount,
              paypalCurrency: orderRes.paypalCurrency,
              orderSource: orderRes.orderSource,
            };

            // Return the official order ID created on PayPal REST API v2
            if (orderRes.orderId && !orderRes.orderId.startsWith('PENDING_')) {
              return orderRes.orderId;
            }

            // Fallback for Sandbox client-side creation if REST orderId is pending
            if (actions?.order?.create) {
              return await actions.order.create({
                intent: 'CAPTURE',
                purchase_units: [
                  {
                    description:
                      purpose === 'setup_service'
                        ? 'تسديد مبلغ خدمة إعداد منصة الجمعية'
                        : purpose === 'renewal'
                        ? 'تجديد اشتراك منصة الجمعية'
                        : purpose === 'activation'
                        ? 'أداء رسوم تفعيل اشتراك منصة الجمعية'
                        : purpose === 'ad_campaign'
                        ? 'تسديد رسوم الحملة الإعلانية'
                        : 'دعم وتطوير syoumax منصة العمل الجمعوي',
                    amount: {
                      currency_code: orderRes.paypalCurrency || targetCurrency,
                      value: Number(orderRes.paypalAmount || targetAmount).toFixed(2),
                    },
                    ...(orderRes.businessEmail
                      ? {
                          payee: {
                            email_address: orderRes.businessEmail,
                          },
                        }
                      : {}),
                  },
                ],
              });
            }

            return orderRes.orderId;
          } catch (err: any) {
            onError(err?.message || 'لم تكتمل عملية إنشاء طلب الدفع. يرجى المحاولة مرة أخرى.');
            throw err;
          }
        },
        onApprove: async (data: any, actions: any) => {
          setIsCapturing(true);
          try {
            const sessionInfo = activeOrderSessionRef.current;
            let sdkCaptureDetails: any = null;

            if (sessionInfo?.orderSource === 'paypal_sandbox_sdk_verified' && actions?.order?.capture) {
              sdkCaptureDetails = await actions.order.capture();
            }

            const res = await fetch('/api/paypal/capture-order', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                orderId: data.orderID,
                serverOrderToken: sessionInfo?.serverOrderToken,
                paypalCaptureDetails: sdkCaptureDetails,
                expectedAmount: sessionInfo?.paypalAmount || targetAmount,
                expectedCurrency: sessionInfo?.paypalCurrency || targetCurrency,
                originalAmount: amount,
                originalCurrency: currency,
                donorName: effectiveName,
                donorPhone: effectivePhone,
                donorNote: effectiveNote,
                paymentMethod:
                  data.fundingSource === 'card' || type === 'card' ? 'card' : 'paypal',
                purpose,
                tenantId,
                tenantName,
              }),
            });

            const result = await res.json();
            if (isMounted) setIsCapturing(false);

            // STRICT REQUIREMENT: Never treat as successful unless backend confirmed COMPLETED with PayPal
            if (result.success && result.verifiedByPayPal && result.record) {
              onSuccess(result.record);
            } else {
              onError(
                result.message ||
                  'لم يتم تأكيد عملية الدفع من PayPal. لم يتم احتساب العملية ناجحة.'
              );
            }
          } catch {
            if (isMounted) setIsCapturing(false);
            onError('تعذر التحقق من تأكيد الدفع من PayPal. لم يتم احتساب العملية ناجحة.');
          }
        },
        onCancel: () => {
          if (isMounted) setIsCapturing(false);
          if (onCancel) onCancel();
          onError('تم إلغاء عملية الدفع قبل تأكيدها من PayPal.');
        },
        onError: (err: any) => {
          if (isMounted) setIsCapturing(false);
          console.warn('[PayPal SDK Button Error]:', err);
          onError('حدث خطأ أثناء معالجة الدفع عبر PayPal. يرجى التأكد من بيانات الحساب أو استخدام البطاقة البنكية.');
        },
      };

      if (type === 'card' && window.paypal.FUNDING?.CARD) {
        buttonOptions.fundingSource = window.paypal.FUNDING.CARD;
      } else if (type === 'paypal' && window.paypal.FUNDING?.PAYPAL) {
        buttonOptions.fundingSource = window.paypal.FUNDING.PAYPAL;
      }

      const buttons = window.paypal.Buttons(buttonOptions);

      if (buttons.isEligible()) {
        buttons.render(containerRef.current);
      } else {
        const fallbackButtons = window.paypal.Buttons({
          ...buttonOptions,
          fundingSource: undefined,
        });
        fallbackButtons.render(containerRef.current);
      }
    } catch (err: any) {
      console.warn('[PayPal Buttons render error]:', err);
      setSdkError('حدث خطأ أثناء إعداد أزرار الدفع. يرجى إعادة المحاولة.');
    }

    return () => {
      isMounted = false;
    };
  }, [
    sdkReady,
    type,
    amount,
    currency,
    purpose,
    tenantId,
    tenantName,
    config?.clientId,
  ]);

  if (loadingConfig) {
    return (
      <div className="p-5 text-center flex flex-col items-center justify-center gap-2 bg-white rounded-2xl border border-slate-200">
        <Loader2 className="w-6 h-6 animate-spin text-orange-600" />
        <span className="text-xs text-slate-600 font-medium">جاري فحص اتصال بوابة PayPal الآمنة...</span>
      </div>
    );
  }

  if (!config?.clientId) {
    return (
      <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 space-y-2">
        <div className="flex items-center gap-2 font-bold text-xs">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>بوابة PayPal تتطلب التهيئة من الإدارة العامة</span>
        </div>
        <p className="text-[11px] text-amber-800 leading-relaxed">
          يرجى من المشرف التوجه إلى: <strong>الإدارة العامة ← دعم المنصة ← بوابة بايبال (PayPal API Integration)</strong> للتحقق من إعدادات الاتصال.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="paypal-checkout-widget">
      {/* Security & Mode Badge */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] bg-white px-3.5 py-2 rounded-xl border border-slate-200">
        <div className="flex items-center gap-1.5 text-slate-700">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>تحقق آمن عبر الخادم (Backend) — لا تُعتمد العملية إلا بعد تأكيد PayPal</span>
        </div>
        <span
          className={`px-2.5 py-0.5 rounded-md font-bold text-[10px] ${
            config.mode === 'live'
              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
              : 'bg-amber-100 text-amber-900 border border-amber-200'
          }`}
        >
          {config.mode === 'live' ? 'وضع حقيقي (Live)' : 'وضع تجريبي (Sandbox)'}
        </span>
      </div>

      {currency === 'MAD' && (
        <div className="p-2.5 bg-sky-50 rounded-xl border border-sky-200 text-[11px] text-sky-900 flex items-center justify-between">
          <span>
            المبلغ المطلوب: <strong>{amount} درهم مغربي</strong>
          </span>
          <span className="text-sky-700 font-bold" dir="ltr">
            ≈ {targetAmount.toFixed(2)} USD
          </span>
        </div>
      )}

      {!sdkReady && !sdkError && (
        <div className="p-4 text-center flex flex-col items-center justify-center gap-2 bg-white rounded-2xl border border-slate-200">
          <Loader2 className="w-5 h-5 animate-spin text-orange-600" />
          <span className="text-xs text-slate-600">
            جاري تحميل واجهة الدفع الآمنة (PayPal & البطاقات البنكية المدعومة)...
          </span>
        </div>
      )}

      {sdkError && (
        <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{sdkError}</span>
        </div>
      )}

      {isCapturing && (
        <div className="p-4 bg-orange-50 border border-orange-200 rounded-2xl text-center space-y-2 animate-pulse">
          <div className="flex items-center justify-center gap-2 text-orange-800 font-bold text-xs">
            <Loader2 className="w-4 h-4 animate-spin text-orange-600" />
            <span>جاري تأكيد عملية الدفع والتحقق منها في خادم PayPal...</span>
          </div>
          <p className="text-[10px] text-orange-700">
            لا يتم اعتبار العملية ناجحة إلا بعد استلام تأكيد COMPLETED ومطابقة المبلغ والعملة على الخادم.
          </p>
        </div>
      )}

      {/* PayPal & Supported Bank Cards Button Container */}
      <div
        ref={containerRef}
        className={`w-full min-h-[46px] transition-opacity ${
          isCapturing ? 'opacity-30 pointer-events-none' : 'opacity-100'
        }`}
      />

      <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400 pt-1">
        <Lock className="w-3 h-3 text-slate-400" />
        <span>تتم معالجة الدفع عبر PayPal والبطاقات البنكية المدعومة دون كشف مفاتيح الاعتماد السرية</span>
      </div>
    </div>
  );
};
