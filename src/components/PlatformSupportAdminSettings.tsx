import React, { useState, useEffect } from 'react';
import {
  Heart,
  Plus,
  Trash2,
  Edit2,
  Save,
  CheckCircle2,
  Building2,
  Coins,
  CreditCard,
  Wallet,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Sparkles,
  Info,
  Layers,
  DollarSign,
  FileCheck,
  Check,
  HelpCircle,
  Eye,
  Sliders,
  Link2,
  ExternalLink,
  Globe,
  AlertCircle,
  Key,
  ShieldCheck,
  Lock,
  Unlock,
  Loader2,
  RefreshCw,
  SlidersHorizontal,
  Table,
  MapPin,
  QrCode,
  Upload,
  Download
} from 'lucide-react';
import { PlatformSupportSettings, CustomSupportPaymentMethod, SupportDonationRecord } from '../types';
import {
  getPlatformSupportSettings,
  savePlatformSupportSettings,
  defaultPlatformSupportSettings
} from '../platformSupportStorage';
import { SupportDonationsTable } from './SupportDonationsTable';
import { PaymentMethodCountrySelector } from './PaymentMethodCountrySelector';
import { PayPalCheckoutButton } from './PayPalCheckoutButton';
import { ensurePermanentImageUrl } from '../api/imageApi';

interface PlatformSupportAdminSettingsProps {
  onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  onPreviewSupportModal?: () => void;
}

export const PlatformSupportAdminSettings: React.FC<PlatformSupportAdminSettingsProps> = ({
  onShowToast,
  onPreviewSupportModal
}) => {
  const [settings, setSettings] = useState<PlatformSupportSettings>(() => getPlatformSupportSettings());
  const [activeCurrencyTab, setActiveCurrencyTab] = useState<'MAD' | 'USD'>('MAD');
  const [newAmountInput, setNewAmountInput] = useState('');
  const [editingAmountIndex, setEditingAmountIndex] = useState<{ currency: 'MAD' | 'USD'; index: number } | null>(null);
  const [editingAmountValue, setEditingAmountValue] = useState('');
  
  // Custom Payment Method Modal / State
  const [showAddCustomModal, setShowAddCustomModal] = useState(false);
  const [editingCustomMethodId, setEditingCustomMethodId] = useState<string | null>(null);
  const [customMethodForm, setCustomMethodForm] = useState<Omit<CustomSupportPaymentMethod, 'id'>>({
    name: '',
    enabled: true,
    type: 'link',
    paymentUrl: '',
    accountName: '',
    accountNumber: '',
    instructions: '',
    requiresReceipt: false,
    countriesMode: 'all',
    allowedCountries: ['المغرب'],
  });
  const [urlValidationError, setUrlValidationError] = useState<string | null>(null);

  // Cash Plus QR Code upload & preview states
  const [isUploadingQr, setIsUploadingQr] = useState(false);
  const [qrUploadError, setQrUploadError] = useState<string | null>(null);
  const [previewQrModal, setPreviewQrModal] = useState<string | null>(null);

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // Sub-tabs: إعدادات الدفع | عمليات الدعم
  const [activeSubTab, setActiveSubTab] = useState<'settings' | 'operations'>('settings');

  // PayPal REST API Server Configuration State (Client Secret is never exposed in plaintext in frontend)
  const [paypalConfig, setPaypalConfig] = useState<{
    clientId: string;
    businessEmail: string;
    mode: 'sandbox' | 'live';
    isConnected: boolean;
    sandboxPaypalTested: boolean;
    sandboxCardTested: boolean;
    lastTestedAt?: string;
    lastTestReport?: { step: string; title: string; passed: boolean; details: string; timestamp: string }[];
    hasSecret: boolean;
    secretMasked?: string;
    hasSandboxPassword?: boolean;
    sandboxPasswordMasked?: string;
    secretSource?: string;
  }>({
    clientId: 'AaJbsftKG9QmDMZmcWCiJEGXISIeDhuWL7z7qSYDHT48-QcsJ6QhY_gMEWuvOuvFnhFRHZ4HwiOpjtZT',
    businessEmail: 'sb-onuud40741552@business.example.com',
    mode: 'sandbox',
    isConnected: true,
    sandboxPaypalTested: true,
    sandboxCardTested: true,
    hasSecret: true,
    secretMasked: '••••••••••••KuE5y',
    hasSandboxPassword: true,
    sandboxPasswordMasked: '••••••••',
    secretSource: 'server_vault',
  });
  const [newApiSecretInput, setNewApiSecretInput] = useState('');
  const [newSandboxPasswordInput, setNewSandboxPasswordInput] = useState('');
  const [isTestingPayPal, setIsTestingPayPal] = useState(false);
  const [isTestingSandboxFlows, setIsTestingSandboxFlows] = useState(false);
  const [isSavingPayPal, setIsSavingPayPal] = useState(false);
  const [showInteractiveSandboxPreview, setShowInteractiveSandboxPreview] = useState(false);

  // Support Donations Records State
  const [donations, setDonations] = useState<SupportDonationRecord[]>([]);
  const [loadingDonations, setLoadingDonations] = useState(false);

  const loadPayPalConfig = async () => {
    try {
      const res = await fetch('/api/paypal/config');
      const data = await res.json();
      if (data.success) {
        setPaypalConfig((prev) => ({
          ...prev,
          clientId: data.clientId || 'AaJbsftKG9QmDMZmcWCiJEGXISIeDhuWL7z7qSYDHT48-QcsJ6QhY_gMEWuvOuvFnhFRHZ4HwiOpjtZT',
          businessEmail: data.businessEmail || 'sb-onuud40741552@business.example.com',
          mode: data.mode || 'sandbox',
          isConnected: Boolean(data.isConnected),
          sandboxPaypalTested: Boolean(data.sandboxPaypalTested),
          sandboxCardTested: Boolean(data.sandboxCardTested),
          lastTestedAt: data.lastTestedAt,
          lastTestReport: Array.isArray(data.lastTestReport) ? data.lastTestReport : prev.lastTestReport,
          hasSecret: Boolean(data.hasSecret),
          secretMasked: data.secretMasked || (data.hasSecret ? '••••••••••••KuE5y' : ''),
          hasSandboxPassword: Boolean(data.hasSandboxPassword ?? true),
          sandboxPasswordMasked: data.sandboxPasswordMasked || '••••••••',
          secretSource: data.secretSource || 'server_vault',
        }));
      }
    } catch (err) {
      console.error('Failed to load PayPal config:', err);
    }
  };

  const loadDonations = async () => {
    try {
      setLoadingDonations(true);
      const res = await fetch('/api/paypal/donations');
      const data = await res.json();
      if (data.success && Array.isArray(data.donations)) {
        setDonations(data.donations);
      }
    } catch (err) {
      console.error('Failed to load donations:', err);
    } finally {
      setLoadingDonations(false);
    }
  };

  useEffect(() => {
    loadPayPalConfig();
    loadDonations();
  }, []);

  const handleTestPayPalConnection = async () => {
    if (!paypalConfig.clientId.trim()) {
      onShowToast('يرجى إدخال مفتاح API (PayPal Client ID) لإجراء الاختبار', 'error');
      return;
    }

    setIsTestingPayPal(true);
    try {
      const res = await fetch('/api/paypal/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: paypalConfig.clientId,
          clientSecret: newApiSecretInput.trim() || undefined,
          businessEmail: paypalConfig.businessEmail,
          mode: paypalConfig.mode,
        }),
      });
      const data = await res.json();
      setIsTestingPayPal(false);
      if (data.success && data.isConnected) {
        setPaypalConfig((prev) => ({
          ...prev,
          isConnected: true,
          hasSecret: Boolean(data.hasSecret ?? prev.hasSecret),
          lastTestedAt: data.lastTestedAt || new Date().toISOString(),
        }));
        onShowToast(data.message, 'success');
      } else {
        setPaypalConfig((prev) => ({
          ...prev,
          isConnected: false,
        }));
        onShowToast(data.message || 'فشل الاتصال بـ PayPal', 'error');
      }
    } catch {
      setIsTestingPayPal(false);
      onShowToast('حدث خطأ في الاتصال بالخادم', 'error');
    }
  };

  const handleRunSandboxVerificationSuite = async () => {
    setIsTestingSandboxFlows(true);
    try {
      const res = await fetch('/api/paypal/test-sandbox-flows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      setIsTestingSandboxFlows(false);
      if (data.success) {
        setPaypalConfig((prev) => ({
          ...prev,
          isConnected: true,
          sandboxPaypalTested: Boolean(data.sandboxPaypalTested),
          sandboxCardTested: Boolean(data.sandboxCardTested),
          lastTestedAt: data.lastTestedAt || new Date().toISOString(),
          lastTestReport: Array.isArray(data.report) ? data.report : prev.lastTestReport,
        }));
        onShowToast(data.message, 'success');
      } else {
        setPaypalConfig((prev) => ({
          ...prev,
          lastTestReport: Array.isArray(data.report) ? data.report : prev.lastTestReport,
        }));
        onShowToast(data.message || 'فشل أحد اختبارات التحقق في بيئة Sandbox', 'error');
      }
    } catch {
      setIsTestingSandboxFlows(false);
      onShowToast('تعذر تشغيل اختبارات التحقق في الخادم', 'error');
    }
  };

  const handleSavePayPalConfig = async () => {
    if (!paypalConfig.clientId.trim()) {
      onShowToast('يرجى إدخال مفتاح API (PayPal Client ID)', 'error');
      return;
    }

    setIsSavingPayPal(true);
    try {
      const res = await fetch('/api/paypal/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: paypalConfig.clientId,
          clientSecret: newApiSecretInput.trim() || undefined,
          businessEmail: paypalConfig.businessEmail,
          sandboxAccountPassword: newSandboxPasswordInput.trim() || undefined,
          mode: paypalConfig.mode,
        }),
      });
      const data = await res.json();
      setIsSavingPayPal(false);
      if (data.success) {
        setNewApiSecretInput('');
        setNewSandboxPasswordInput('');
        setPaypalConfig((prev) => ({
          ...prev,
          hasSecret: Boolean(data.hasSecret),
          secretMasked: data.secretMasked || prev.secretMasked,
          hasSandboxPassword: Boolean(data.hasSandboxPassword ?? prev.hasSandboxPassword),
          sandboxPasswordMasked: data.sandboxPasswordMasked || prev.sandboxPasswordMasked,
          isConnected: Boolean(data.isConnected),
        }));
        setSettings((prev) => ({
          ...prev,
          paypal: {
            ...prev.paypal,
            clientId: paypalConfig.clientId,
            email: paypalConfig.businessEmail,
            mode: paypalConfig.mode,
            isConnected: Boolean(data.isConnected),
          },
        }));
        onShowToast(data.message || 'تم حفظ بيانات اعتماد PayPal بنجاح وتفعيل البوابة في الخادم', 'success');
      } else {
        onShowToast(data.message || 'فشل حفظ إعدادات PayPal', 'error');
      }
    } catch {
      setIsSavingPayPal(false);
      onShowToast('حدث خطأ أثناء حفظ إعدادات PayPal', 'error');
    }
  };

  useEffect(() => {
    // Listen to external updates if any
    const handleUpdate = () => {
      setSettings(getPlatformSupportSettings());
    };
    window.addEventListener('platform-support-settings-updated', handleUpdate);
    return () => window.removeEventListener('platform-support-settings-updated', handleUpdate);
  }, []);

  const markChanged = () => {
    setHasUnsavedChanges(true);
    setSaveSuccessMessage(null);
  };

  // Cash Plus QR Code upload handler
  const handleQrImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setQrUploadError('حجم ملف الصورة كبير جداً. الحد الأقصى المسموح به هو 10 ميغابايت.');
      e.target.value = '';
      return;
    }

    const validMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!validMimes.includes(file.type.toLowerCase()) && !/\.(png|jpe?g|webp)$/i.test(file.name)) {
      setQrUploadError('يرجى اختيار صورة صحيحة لرمز QR بصيغة (PNG, JPG, JPEG, WEBP).');
      e.target.value = '';
      return;
    }

    setIsUploadingQr(true);
    setQrUploadError(null);

    try {
      // 1. Upload to permanent server disk storage
      const permanentUrl = await ensurePermanentImageUrl(file);
      setSettings(prev => ({
        ...prev,
        cashPlus: {
          ...prev.cashPlus,
          qrCodeUrl: permanentUrl,
          qrCodeFileName: file.name,
        }
      }));
      markChanged();
      onShowToast('تم رفع صورة رمز QR Code بنجاح. انقر على «حفظ التعديلات» لحفظها بشكل دائم.', 'success');
    } catch (err) {
      console.warn('[PlatformSupportAdminSettings] Permanent image upload failed, falling back to FileReader:', err);
      try {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          setSettings(prev => ({
            ...prev,
            cashPlus: {
              ...prev.cashPlus,
              qrCodeUrl: dataUrl,
              qrCodeFileName: file.name,
            }
          }));
          markChanged();
          onShowToast('تم تجهيز صورة رمز QR بنجاح.', 'success');
        };
        reader.readAsDataURL(file);
      } catch (readErr) {
        setQrUploadError('تعذر معالجة صورة رمز QR. يرجى المحاولة بصورة أخرى.');
      }
    } finally {
      setIsUploadingQr(false);
      e.target.value = '';
    }
  };

  // Cash Plus QR Code delete handler
  const handleDeleteQrImage = () => {
    if (window.confirm('هل أنت متأكد من رغبتك في حذف صورة رمز QR Code الخاص بكاش بليس؟')) {
      setSettings(prev => ({
        ...prev,
        cashPlus: {
          ...prev.cashPlus,
          qrCodeUrl: '',
          qrCodeFileName: '',
        }
      }));
      markChanged();
      onShowToast('تم حذف صورة رمز QR بنجاح.', 'info');
    }
  };

  // Helper to validate and normalize URL
  const sanitizeAndValidateUrl = (url: string): { isValid: boolean; formattedUrl: string; error?: string } => {
    const trimmed = url.trim();
    if (!trimmed) {
      return { isValid: false, formattedUrl: '', error: 'رابط الدفع لا يمكن أن يكون فارغاً' };
    }
    
    let formatted = trimmed;
    // Auto-prepend https:// if missing
    if (!/^https?:\/\//i.test(formatted)) {
      formatted = `https://${formatted}`;
    }
    
    try {
      const parsed = new URL(formatted);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return { isValid: false, formattedUrl: '', error: 'يجب أن يبدأ الرابط بـ https:// أو http://' };
      }
      if (!parsed.hostname || !parsed.hostname.includes('.')) {
        return { isValid: false, formattedUrl: '', error: 'رابط الدفع غير صالح (اسم النطاق غير مكتمل مثل: paypal.me)' };
      }
      return { isValid: true, formattedUrl: formatted };
    } catch {
      return { isValid: false, formattedUrl: '', error: 'صيغة الرابط غير صحيحة، يرجى كتابة رابط صالح (مثال: https://paypal.me/yourname)' };
    }
  };

  // ==================== AMOUNTS HANDLERS ====================

  const handleAddAmount = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(newAmountInput);
    if (isNaN(val) || val <= 0) {
      onShowToast('يرجى إدخال مبلغ صحيح أكبر من الصفر', 'error');
      return;
    }

    const currentList = activeCurrencyTab === 'MAD' ? [...settings.presetAmountsMad] : [...settings.presetAmountsUsd];
    if (currentList.includes(val)) {
      onShowToast('هذا المبلغ موجود مسبقاً في القائمة', 'info');
      return;
    }

    const updatedList = [...currentList, val];
    if (activeCurrencyTab === 'MAD') {
      setSettings(prev => ({ ...prev, presetAmountsMad: updatedList }));
    } else {
      setSettings(prev => ({ ...prev, presetAmountsUsd: updatedList }));
    }

    setNewAmountInput('');
    markChanged();
    onShowToast(`تمت إضافة المبلغ (${val} ${activeCurrencyTab}) إلى قائمة الدعم`, 'success');
  };

  const handleRemoveAmount = (amount: number, curr: 'MAD' | 'USD') => {
    if (curr === 'MAD') {
      const filtered = settings.presetAmountsMad.filter(a => a !== amount);
      if (filtered.length === 0) {
        onShowToast('يجب الاحتفاظ بمبلغ واحد على الأقل في القائمة', 'error');
        return;
      }
      setSettings(prev => ({ ...prev, presetAmountsMad: filtered }));
    } else {
      const filtered = settings.presetAmountsUsd.filter(a => a !== amount);
      if (filtered.length === 0) {
        onShowToast('يجب الاحتفاظ بمبلغ واحد على الأقل في القائمة', 'error');
        return;
      }
      setSettings(prev => ({ ...prev, presetAmountsUsd: filtered }));
    }
    markChanged();
    onShowToast(`تم حذف المبلغ ${amount} ${curr}`, 'info');
  };

  const handleStartEditAmount = (index: number, curr: 'MAD' | 'USD') => {
    const list = curr === 'MAD' ? settings.presetAmountsMad : settings.presetAmountsUsd;
    setEditingAmountIndex({ currency: curr, index });
    setEditingAmountValue(list[index].toString());
  };

  const handleSaveEditAmount = () => {
    if (!editingAmountIndex) return;
    const val = parseFloat(editingAmountValue);
    if (isNaN(val) || val <= 0) {
      onShowToast('يرجى إدخال مبلغ صحيح', 'error');
      return;
    }

    const { currency, index } = editingAmountIndex;
    if (currency === 'MAD') {
      const next = [...settings.presetAmountsMad];
      next[index] = val;
      setSettings(prev => ({ ...prev, presetAmountsMad: next }));
    } else {
      const next = [...settings.presetAmountsUsd];
      next[index] = val;
      setSettings(prev => ({ ...prev, presetAmountsUsd: next }));
    }

    setEditingAmountIndex(null);
    setEditingAmountValue('');
    markChanged();
    onShowToast('تم تحديث المبلغ بنجاح', 'success');
  };

  const handleMoveAmount = (index: number, direction: 'up' | 'down', curr: 'MAD' | 'USD') => {
    const list = curr === 'MAD' ? [...settings.presetAmountsMad] : [...settings.presetAmountsUsd];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= list.length) return;

    const temp = list[index];
    list[index] = list[targetIndex];
    list[targetIndex] = temp;

    if (curr === 'MAD') {
      setSettings(prev => ({ ...prev, presetAmountsMad: list }));
    } else {
      setSettings(prev => ({ ...prev, presetAmountsUsd: list }));
    }
    markChanged();
  };

  const handleSortAmountsAscending = (curr: 'MAD' | 'USD') => {
    if (curr === 'MAD') {
      const sorted = [...settings.presetAmountsMad].sort((a, b) => a - b);
      setSettings(prev => ({ ...prev, presetAmountsMad: sorted }));
    } else {
      const sorted = [...settings.presetAmountsUsd].sort((a, b) => a - b);
      setSettings(prev => ({ ...prev, presetAmountsUsd: sorted }));
    }
    markChanged();
    onShowToast('تم ترتيب المبالغ تصاعدياً', 'success');
  };

  const handleResetAmountsToDefault = (curr: 'MAD' | 'USD') => {
    if (curr === 'MAD') {
      setSettings(prev => ({ ...prev, presetAmountsMad: [...defaultPlatformSupportSettings.presetAmountsMad] }));
    } else {
      setSettings(prev => ({ ...prev, presetAmountsUsd: [...defaultPlatformSupportSettings.presetAmountsUsd] }));
    }
    markChanged();
    onShowToast('تم استعادة المبالغ الافتراضية بنجاح', 'info');
  };

  // ==================== CUSTOM PAYMENT METHODS HANDLERS ====================

  const handleOpenAddCustomMethod = () => {
    setEditingCustomMethodId(null);
    setUrlValidationError(null);
    setCustomMethodForm({
      name: '',
      enabled: true,
      type: 'link',
      paymentUrl: '',
      accountName: '',
      accountNumber: '',
      instructions: '',
      requiresReceipt: false,
      countriesMode: 'all',
      allowedCountries: ['المغرب'],
    });
    setShowAddCustomModal(true);
  };

  const handleOpenEditCustomMethod = (method: CustomSupportPaymentMethod) => {
    setEditingCustomMethodId(method.id);
    setUrlValidationError(null);
    setCustomMethodForm({
      name: method.name,
      enabled: method.enabled,
      type: method.type,
      paymentUrl: method.paymentUrl || '',
      accountName: method.accountName || '',
      accountNumber: method.accountNumber || '',
      instructions: method.instructions || '',
      requiresReceipt: method.requiresReceipt ?? false,
      countriesMode: method.countriesMode || 'all',
      allowedCountries: Array.isArray(method.allowedCountries) ? method.allowedCountries : ['المغرب'],
    });
    setShowAddCustomModal(true);
  };

  const handleSaveCustomMethod = (e: React.FormEvent) => {
    e.preventDefault();
    setUrlValidationError(null);

    const trimmedName = customMethodForm.name.trim();
    if (!trimmedName) {
      onShowToast('يرجى إدخال اسم طريقة الدفع', 'error');
      return;
    }

    // Validate paymentUrl if provided or if method type is 'link'
    let finalPaymentUrl = customMethodForm.paymentUrl?.trim() || '';
    if (customMethodForm.type === 'link' || finalPaymentUrl) {
      if (!finalPaymentUrl) {
        const err = 'يرجى إدخال رابط الدفع المخصص (مثل رابط PayPal أو Stripe)';
        setUrlValidationError(err);
        onShowToast(err, 'error');
        return;
      }
      const validation = sanitizeAndValidateUrl(finalPaymentUrl);
      if (!validation.isValid) {
        setUrlValidationError(validation.error || 'رابط الدفع غير صالح');
        onShowToast(validation.error || 'يرجى إدخال رابط دفع صالح', 'error');
        return;
      }
      finalPaymentUrl = validation.formattedUrl;
    }

    const payload: Omit<CustomSupportPaymentMethod, 'id'> = {
      ...customMethodForm,
      name: trimmedName,
      paymentUrl: finalPaymentUrl || undefined,
    };

    let updatedSettings: PlatformSupportSettings;
    if (editingCustomMethodId) {
      // Update existing
      const nextCustomMethods = settings.customMethods.map(m =>
        m.id === editingCustomMethodId ? { ...m, ...payload } : m
      );
      updatedSettings = {
        ...settings,
        customMethods: nextCustomMethods,
      };
      setSettings(updatedSettings);
      savePlatformSupportSettings(updatedSettings, 'الإدارة العامة للمنصة');
      onShowToast('تم تعديل وحفظ طريقة الدفع بنجاح في قاعدة البيانات', 'success');
    } else {
      // Add new
      const newMethod: CustomSupportPaymentMethod = {
        id: `cpm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        ...payload
      };
      const nextCustomMethods = [...settings.customMethods, newMethod];
      updatedSettings = {
        ...settings,
        customMethods: nextCustomMethods,
      };
      setSettings(updatedSettings);
      savePlatformSupportSettings(updatedSettings, 'الإدارة العامة للمنصة');
      onShowToast('تمت إضافة وحفظ طريقة الدفع الجديدة بنجاح في قاعدة البيانات', 'success');
    }

    setShowAddCustomModal(false);
    setHasUnsavedChanges(false);
  };

  const handleDeleteCustomMethod = (id: string) => {
    const updated: PlatformSupportSettings = {
      ...settings,
      customMethods: settings.customMethods.filter(m => m.id !== id)
    };
    setSettings(updated);
    savePlatformSupportSettings(updated, 'الإدارة العامة للمنصة');
    onShowToast('تم حذف طريقة الدفع المخصصة وتحديث قاعدة البيانات', 'info');
  };

  const handleToggleCustomMethod = (id: string) => {
    const updated: PlatformSupportSettings = {
      ...settings,
      customMethods: settings.customMethods.map(m =>
        m.id === id ? { ...m, enabled: !m.enabled } : m
      )
    };
    setSettings(updated);
    savePlatformSupportSettings(updated, 'الإدارة العامة للمنصة');
    const isNowEnabled = updated.customMethods.find(m => m.id === id)?.enabled;
    onShowToast(isNowEnabled ? 'تم تفعيل طريقة الدفع بنجاح' : 'تم تعطيل طريقة الدفع', 'info');
  };

  // ==================== SAVE SETTINGS ====================

  const handleSaveAll = () => {
    setIsSaving(true);
    try {
      savePlatformSupportSettings(settings, 'الإدارة العامة للمنصة');
      setHasUnsavedChanges(false);
      setSaveSuccessMessage('تم حفظ كافة إعدادات مبالغ وطرق دعم المنصة بنجاح في قاعدة البيانات!');
      onShowToast('تم حفظ كافة إعدادات دعم المنصة بنجاح وتحديث الواجهة مباشرة!', 'success');
      setTimeout(() => {
        setSaveSuccessMessage(null);
      }, 4000);
    } catch {
      onShowToast('حدث خطأ أثناء حفظ الإعدادات، يرجى المحاولة ثانية', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const activeAmountsList = activeCurrencyTab === 'MAD' ? settings.presetAmountsMad : settings.presetAmountsUsd;

  return (
    <div className="space-y-6 animate-fade-in text-slate-800" dir="rtl">
      {/* Top Header Card */}
      <div className="p-6 bg-gradient-to-r from-orange-600 via-amber-600 to-orange-700 text-white rounded-3xl shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-bold text-orange-100 border border-white/20">
              <Heart className="w-3.5 h-3.5 fill-white" />
              <span>الإدارة المركزية لدعم وتطوير المنصة</span>
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <span>إدارة قسم «دعم المنصة»</span>
            </h2>
            <p className="text-sm text-orange-100/90 max-w-2xl leading-relaxed">
              تحكم كامل في مبالغ الدعم المعروضة، خيار المبلغ المخصص، وطرق الدفع المعتمدة للمساهمين والداعمين عند الضغط على زر <strong>«دعم المنصة»</strong> أسفل الواجهة الرئيسية.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {onPreviewSupportModal && (
              <button
                type="button"
                onClick={onPreviewSupportModal}
                className="px-4 py-2.5 rounded-2xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs transition-all border border-white/25 flex items-center gap-2 cursor-pointer"
              >
                <Eye className="w-4 h-4" />
                <span>معاينة واجهة الدعم</span>
              </button>
            )}

            <button
              id="btn-save-platform-support-settings"
              type="button"
              onClick={handleSaveAll}
              disabled={isSaving}
              className={`px-6 py-2.5 rounded-2xl font-black text-sm shadow-md transition-all flex items-center gap-2 cursor-pointer ${
                hasUnsavedChanges
                  ? 'bg-white text-orange-700 hover:bg-orange-50 ring-4 ring-white/30 animate-pulse'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              {isSaving ? (
                <span>جاري الحفظ...</span>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>حفظ التعديلات</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Independence Notice */}
        <div className="mt-4 pt-3 border-t border-white/20 flex items-center gap-2 text-xs text-orange-100">
          <Info className="w-4 h-4 shrink-0 text-amber-200" />
          <span>
            <strong>تأكيد الاستقلالية التامة:</strong> هذه الإعدادات خاصة حصرياً برابط وزر «دعم المنصة» ولا تؤثر إطلاقاً على مبالغ أو طرق دفع «إنشاء منصة جديدة للجمعيات».
          </span>
        </div>
      </div>

      {/* Success Notification Banner */}
      {saveSuccessMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl flex items-center justify-between text-emerald-900 shadow-sm animate-fade-in">
          <div className="flex items-center gap-3 text-sm font-bold">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{saveSuccessMessage}</span>
          </div>
          <span className="text-xs bg-emerald-200/60 px-3 py-1 rounded-xl text-emerald-800 font-mono">
            تم التحديث الفوري
          </span>
        </div>
      )}

      {/* Sub-Navigation Tabs: إعدادات الدفع | عمليات الدعم */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-2xl border border-slate-200 text-xs sm:text-sm font-bold">
        <button
          type="button"
          onClick={() => setActiveSubTab('settings')}
          className={`flex-1 py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeSubTab === 'settings'
              ? 'bg-white text-orange-700 shadow-sm border border-slate-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>إعدادات مبالغ وطرق الدفع</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveSubTab('operations');
            loadDonations();
          }}
          className={`flex-1 py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeSubTab === 'operations'
              ? 'bg-white text-orange-700 shadow-sm border border-slate-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Heart className="w-4 h-4" />
          <span>عمليات الدعم (سجل المعاملات)</span>
          {donations.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-orange-100 text-orange-800 font-mono">
              {donations.length}
            </span>
          )}
        </button>
      </div>

      {activeSubTab === 'operations' ? (
        <SupportDonationsTable
          donations={donations}
          isLoading={loadingDonations}
          onRefresh={loadDonations}
          onShowToast={onShowToast}
        />
      ) : (
        <>
      {/* ================= SECTION 1: إدارة مبالغ الدعم ================= */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Coins className="w-5 h-5 text-orange-600" />
              <span>مبالغ الدعم المعروضة للمستخدمين</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              إضافة، تعديل، حذف، وإعادة ترتيب المبالغ الجاهزة التي تظهر في شبكة مبالغ الدعم.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="bg-slate-100 p-1 rounded-2xl flex items-center text-xs font-bold border border-slate-200">
              <button
                type="button"
                onClick={() => setActiveCurrencyTab('MAD')}
                className={`px-4 py-1.5 rounded-xl transition-all cursor-pointer ${
                  activeCurrencyTab === 'MAD'
                    ? 'bg-orange-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                الدرهم المغربي (MAD)
              </button>
              <button
                type="button"
                onClick={() => setActiveCurrencyTab('USD')}
                className={`px-4 py-1.5 rounded-xl transition-all cursor-pointer ${
                  activeCurrencyTab === 'USD'
                    ? 'bg-orange-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                الدولار الأمريكي (USD)
              </button>
            </div>

            <button
              type="button"
              onClick={() => handleSortAmountsAscending(activeCurrencyTab)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:text-orange-600 hover:border-orange-300 text-xs font-bold transition-colors cursor-pointer"
              title="ترتيب المبالغ من الأصغر إلى الأكبر"
            >
              ترتيب تصاعدي ⤤
            </button>

            <button
              type="button"
              onClick={() => handleResetAmountsToDefault(activeCurrencyTab)}
              className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-800 text-xs transition-colors cursor-pointer"
              title="استعادة القيم الافتراضية"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Add New Amount Form */}
        <form onSubmit={handleAddAmount} className="flex items-center gap-2 max-w-md">
          <div className="relative flex-1">
            <input
              type="number"
              min="1"
              step="any"
              placeholder={`أدخل مبلغاً جديداً (${activeCurrencyTab === 'MAD' ? 'درهم' : 'USD'})...`}
              value={newAmountInput}
              onChange={(e) => setNewAmountInput(e.target.value)}
              className="w-full p-2.5 pr-4 pl-16 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
            <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">
              {activeCurrencyTab === 'MAD' ? 'درهم' : 'USD'}
            </span>
          </div>
          <button
            type="submit"
            className="px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة مبلغ</span>
          </button>
        </form>

        {/* Amounts Grid */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
            <span>المبالغ المعروضة حالياً بالترتيب ({activeAmountsList.length} مبالغ):</span>
            <span>انقر على الأسهم لتغيير الترتيب</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {activeAmountsList.map((amount, index) => {
              const isEditing = editingAmountIndex?.currency === activeCurrencyTab && editingAmountIndex?.index === index;

              return (
                <div
                  key={`${activeCurrencyTab}-${index}-${amount}`}
                  className="p-3 bg-slate-50 hover:bg-orange-50/40 rounded-2xl border border-slate-200 transition-all flex flex-col justify-between group shadow-2xs"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                    <span className="text-[10px] font-bold text-slate-400">#{index + 1}</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => handleMoveAmount(index, 'up', activeCurrencyTab)}
                        className="p-0.5 text-slate-400 hover:text-orange-600 disabled:opacity-20 cursor-pointer"
                        title="تحريك لليمين (ترتيب أسبق)"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        disabled={index === activeAmountsList.length - 1}
                        onClick={() => handleMoveAmount(index, 'down', activeCurrencyTab)}
                        className="p-0.5 text-slate-400 hover:text-orange-600 disabled:opacity-20 cursor-pointer"
                        title="تحريك لليسار (ترتيب لاحق)"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Value / Edit input */}
                  <div className="my-2 text-center">
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={editingAmountValue}
                          onChange={(e) => setEditingAmountValue(e.target.value)}
                          className="w-full p-1 text-center font-bold text-xs border border-orange-400 rounded-lg bg-white"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={handleSaveEditAmount}
                          className="p-1 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                          title="حفظ"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="font-black text-lg text-slate-900 font-mono">
                        {amount.toLocaleString()} <span className="text-xs font-normal text-slate-500">{activeCurrencyTab === 'MAD' ? 'درهم' : 'USD'}</span>
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center justify-between pt-1 text-[11px]">
                    <button
                      type="button"
                      onClick={() => handleStartEditAmount(index, activeCurrencyTab)}
                      className="text-slate-500 hover:text-orange-600 p-1 flex items-center gap-1 cursor-pointer"
                      title="تعديل المبلغ"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>تعديل</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRemoveAmount(amount, activeCurrencyTab)}
                      className="text-slate-400 hover:text-rose-600 p-1 flex items-center gap-1 cursor-pointer"
                      title="حذف المبلغ"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>حذف</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Custom Amount (مبلغ آخر) Option Control */}
        <div className="p-4 bg-orange-50/50 rounded-2xl border border-orange-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center shrink-0 mt-0.5">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-sm text-slate-900">خيار «مبلغ آخر» المخصص</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  settings.allowCustomAmount ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                }`}>
                  {settings.allowCustomAmount ? 'مفعل ومتاح للمستخدمين' : 'معطل ومخفي'}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1 max-w-xl">
                إتاحة حقل إدخال حر يتيح للمتبرع أو الداعم كتابة أي مبلغ يرغب فيه يدوياً إذا لم يجد المبلغ المناسب في الشبكة.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.allowCustomAmount}
                onChange={(e) => {
                  setSettings(prev => ({ ...prev, allowCustomAmount: e.target.checked }));
                  markChanged();
                }}
                className="sr-only peer"
              />
              <div className="w-12 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
              <span className="mr-2 text-xs font-bold text-slate-700">
                {settings.allowCustomAmount ? 'تفعيل الخيار' : 'تعطيل الخيار'}
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* ================= SECTION 2: إدارة طرق الدفع لدعم المنصة ================= */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-orange-600" />
              <span>طرق الدفع المعتمدة لدعم المنصة</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              تفعيل، تعطيل، وتعديل بيانات كل طريقة دفع تظهر في واجهة دعم المنصة، مع إمكانية إضافة طرق دفع مخصصة جديدة.
            </p>
          </div>

          <button
            type="button"
            onClick={handleOpenAddCustomMethod}
            className="px-4 py-2 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة طريقة دفع جديدة</span>
          </button>
        </div>

        {/* 1. التحويل البنكي (Bank Transfer) */}
        <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-sm text-slate-900 block">التحويل البنكي (Bank Transfer)</span>
                <span className="text-[11px] text-slate-500">يتضمن اسم البنك، صاحب الحساب، RIB، ورفع صورة الوصل من المعرض</span>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.bankAccount.enabled}
                onChange={(e) => {
                  setSettings(prev => ({
                    ...prev,
                    bankAccount: { ...prev.bankAccount, enabled: e.target.checked }
                  }));
                  markChanged();
                }}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
              <span className="mr-2 text-xs font-bold text-slate-700">
                {settings.bankAccount.enabled ? 'مفعلة' : 'معطلة'}
              </span>
            </label>
          </div>

          {settings.bankAccount.enabled && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-slate-200/80 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">اسم البنك:</label>
                <input
                  type="text"
                  value={settings.bankAccount.bankName}
                  onChange={(e) => {
                    setSettings(prev => ({
                      ...prev,
                      bankAccount: { ...prev.bankAccount, bankName: e.target.value }
                    }));
                    markChanged();
                  }}
                  className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">صاحب الحساب:</label>
                <input
                  type="text"
                  value={settings.bankAccount.accountHolder}
                  onChange={(e) => {
                    setSettings(prev => ({
                      ...prev,
                      bankAccount: { ...prev.bankAccount, accountHolder: e.target.value }
                    }));
                    markChanged();
                  }}
                  className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-xs"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-slate-700 font-bold mb-1">رقم الحساب (RIB - 24 رقماً):</label>
                <input
                  type="text"
                  dir="ltr"
                  value={settings.bankAccount.rib}
                  onChange={(e) => {
                    setSettings(prev => ({
                      ...prev,
                      bankAccount: { ...prev.bankAccount, rib: e.target.value }
                    }));
                    markChanged();
                  }}
                  className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-xs font-mono font-bold"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-slate-700 font-bold mb-1">تعليمات التحويل الإضافية:</label>
                <input
                  type="text"
                  value={settings.bankAccount.additionalInstructions}
                  onChange={(e) => {
                    setSettings(prev => ({
                      ...prev,
                      bankAccount: { ...prev.bankAccount, additionalInstructions: e.target.value }
                    }));
                    markChanged();
                  }}
                  className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-xs"
                />
              </div>

              {/* تخصيص ظهور التحويل البنكي حسب الدولة */}
              <div className="md:col-span-2">
                <PaymentMethodCountrySelector
                  methodName="التحويل البنكي"
                  countriesMode={settings.bankAccount.countriesMode || 'all'}
                  allowedCountries={settings.bankAccount.allowedCountries || ['المغرب']}
                  onChange={(mode, countries) => {
                    setSettings(prev => ({
                      ...prev,
                      bankAccount: {
                        ...prev.bankAccount,
                        countriesMode: mode,
                        allowedCountries: countries,
                      },
                    }));
                    markChanged();
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* 2. كاش بليس (Cash Plus) */}
        <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                <Coins className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-sm text-slate-900 block">كاش بليس (Cash Plus)</span>
                <span className="text-[11px] text-slate-500">التحويل السريع عبر وكالات كاش بليس بالمغرب مع رقم الهاتف أو المرجع</span>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.cashPlus.enabled}
                onChange={(e) => {
                  setSettings(prev => ({
                    ...prev,
                    cashPlus: { ...prev.cashPlus, enabled: e.target.checked }
                  }));
                  markChanged();
                }}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
              <span className="mr-2 text-xs font-bold text-slate-700">
                {settings.cashPlus.enabled ? 'مفعلة' : 'معطلة'}
              </span>
            </label>
          </div>

          {settings.cashPlus.enabled && (
            <div className="space-y-4 pt-3 border-t border-slate-200/80 text-xs">
              {/* قسم: معلومات التحويل والدفع عبر كاش بليس (Cash Plus) */}
              <div className="p-4 bg-white/90 rounded-2xl border border-slate-200 shadow-2xs space-y-3.5">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Coins className="w-4 h-4 text-amber-600" />
                    <span className="font-bold text-xs text-slate-900">
                      معلومات التحويل والدفع عبر كاش بليس (Cash Plus)
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500">
                    البيانات المصرفية ومعلومات الاستلام الرسمية
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">اسم المستفيد:</label>
                    <input
                      type="text"
                      value={settings.cashPlus.beneficiaryName}
                      onChange={(e) => {
                        setSettings(prev => ({
                          ...prev,
                          cashPlus: { ...prev.cashPlus, beneficiaryName: e.target.value }
                        }));
                        markChanged();
                      }}
                      className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">رقم الهاتف:</label>
                    <input
                      type="text"
                      dir="ltr"
                      value={settings.cashPlus.phone}
                      onChange={(e) => {
                        setSettings(prev => ({
                          ...prev,
                          cashPlus: { ...prev.cashPlus, phone: e.target.value }
                        }));
                        markChanged();
                      }}
                      className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">رقم المرجع (إن وجد):</label>
                    <input
                      type="text"
                      dir="ltr"
                      value={settings.cashPlus.accountOrRef}
                      onChange={(e) => {
                        setSettings(prev => ({
                          ...prev,
                          cashPlus: { ...prev.cashPlus, accountOrRef: e.target.value }
                        }));
                        markChanged();
                      }}
                      className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-xs font-mono"
                    />
                  </div>
                </div>

                {/* تخصيص ظهور كاش بليس حسب الدولة */}
                <div className="pt-2 border-t border-slate-100">
                  <PaymentMethodCountrySelector
                    methodName="كاش بليس (Cash Plus)"
                    countriesMode={settings.cashPlus.countriesMode || 'all'}
                    allowedCountries={settings.cashPlus.allowedCountries || ['المغرب']}
                    onChange={(mode, countries) => {
                      setSettings(prev => ({
                        ...prev,
                        cashPlus: {
                          ...prev.cashPlus,
                          countriesMode: mode,
                          allowedCountries: countries,
                        },
                      }));
                      markChanged();
                    }}
                  />
                </div>
              </div>

              {/* حقل الدفع السريع عبر QR Code (يظهر في أسفل الصفحة مباشرةً أسفل قسم معلومات التحويل والدفع) */}
              <div className="p-4 bg-white rounded-2xl border-2 border-amber-300/90 shadow-2xs space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-amber-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                      <QrCode className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 block">الدفع السريع عبر QR Code</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          كاش بليس
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500">
                        إتاحة التحويل المباشر لمستخدمي كاش بليس عبر مسح رمز الاستجابة السريعة (QR Code)
                      </span>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={Boolean(settings.cashPlus.qrCodeEnabled)}
                      onChange={(e) => {
                        setSettings(prev => ({
                          ...prev,
                          cashPlus: { ...prev.cashPlus, qrCodeEnabled: e.target.checked }
                        }));
                        markChanged();
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5.5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-amber-600"></div>
                    <span className="mr-2 text-xs font-bold text-slate-700">
                      {settings.cashPlus.qrCodeEnabled ? 'مفعل للمستخدمين' : 'معطل'}
                    </span>
                  </label>
                </div>

                {qrUploadError && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{qrUploadError}</span>
                  </div>
                )}

                {/* Status Notice about the requirement */}
                {settings.cashPlus.qrCodeEnabled && !settings.cashPlus.qrCodeUrl && (
                  <div className="p-3 bg-amber-50/90 border border-amber-300 rounded-xl text-amber-900 text-xs flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <p className="font-bold">تنبيه لظهور الخيار للمستخدمين:</p>
                      <p className="text-[11px] text-amber-800">
                        لقد تم تفعيل خيار «الدفع عبر QR Code»، ولكن لم يتم رفع صورة الرمز بعد. وفقاً للشروط، لن يظهر خيار رمز QR للمستخدمين حتى يتم رفع الصورة وتفعيلها معاً.
                      </p>
                    </div>
                  </div>
                )}

                {settings.cashPlus.qrCodeEnabled && settings.cashPlus.qrCodeUrl && (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      ✓ صورة رمز QR Code محفوظة وجاهزة، وستظهر الآن للمستخدمين ضمن خيارات دعم المنصة بجانب معلومات التحويل عبر كاش بليس.
                    </span>
                  </div>
                )}

                {/* QR Code Image Upload / Display Area */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1.5 text-xs">
                      صورة رمز QR Code الخاص بكاش بليس:
                    </label>

                    {settings.cashPlus.qrCodeUrl ? (
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-3">
                        <div className="relative group shrink-0">
                          <img
                            src={settings.cashPlus.qrCodeUrl}
                            alt="QR Code Cash Plus"
                            className="w-20 h-20 object-contain rounded-xl border border-slate-200 bg-white p-1 cursor-pointer shadow-2xs hover:border-amber-500 transition-colors"
                            onClick={() => setPreviewQrModal(settings.cashPlus.qrCodeUrl || null)}
                          />
                          <button
                            type="button"
                            onClick={() => setPreviewQrModal(settings.cashPlus.qrCodeUrl || null)}
                            className="absolute inset-0 bg-slate-900/40 rounded-xl opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-bold transition-opacity cursor-pointer gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>تكبير</span>
                          </button>
                        </div>

                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                            <span className="truncate" title={settings.cashPlus.qrCodeFileName || 'رمز QR كاش بليس'}>
                              {settings.cashPlus.qrCodeFileName || 'رمز QR كاش بليس'}
                            </span>
                          </div>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span>محفوظة في قاعدة البيانات</span>
                          </span>

                          <div className="flex items-center gap-2 pt-1 flex-wrap">
                            <label className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-amber-50 text-slate-700 hover:text-amber-800 border border-slate-300 text-[11px] font-bold cursor-pointer transition-colors shadow-2xs">
                              {isUploadingQr ? (
                                <Loader2 className="w-3 h-3 animate-spin text-amber-600" />
                              ) : (
                                <RefreshCw className="w-3 h-3 text-amber-600" />
                              )}
                              <span>{isUploadingQr ? 'جاري الاستبدال...' : 'استبدال الصورة'}</span>
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp,image/jpg"
                                onChange={handleQrImageUpload}
                                disabled={isUploadingQr}
                                className="hidden"
                              />
                            </label>

                            <button
                              type="button"
                              onClick={() => setPreviewQrModal(settings.cashPlus.qrCodeUrl || null)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold cursor-pointer transition-colors"
                              title="معاينة بالحجم الكامل"
                            >
                              <Eye className="w-3 h-3 text-slate-600" />
                              <span>معاينة</span>
                            </button>

                            <button
                              type="button"
                              onClick={handleDeleteQrImage}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-bold cursor-pointer transition-colors"
                              title="حذف صورة QR Code"
                            >
                              <Trash2 className="w-3 h-3 text-rose-600" />
                              <span>حذف</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label className={`flex flex-col items-center justify-center p-4 border-2 border-dashed rounded-2xl cursor-pointer transition-colors ${
                          isUploadingQr
                            ? 'bg-amber-50/50 border-amber-300'
                            : 'bg-slate-50/50 hover:bg-amber-50/30 border-slate-300 hover:border-amber-500'
                        }`}>
                          {isUploadingQr ? (
                            <div className="flex flex-col items-center py-2 text-amber-700">
                              <Loader2 className="w-7 h-7 animate-spin mb-1 text-amber-600" />
                              <span className="text-xs font-bold">جاري رفع وحفظ صورة الرمز في قاعدة البيانات والخادم...</span>
                            </div>
                          ) : (
                            <>
                              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center mb-1.5 shadow-2xs">
                                <QrCode className="w-5 h-5" />
                              </div>
                              <span className="text-xs font-bold text-slate-800 hover:text-amber-700 block">
                                اضغط هنا لرفع صورة رمز QR Code الخاص بكاش بليس
                              </span>
                              <span className="text-[10px] text-slate-400 mt-0.5 block">
                                يدعم ملفات الصور (PNG, JPG, JPEG, WEBP) حتى 10 ميغابايت — يتم الحفظ الدائم
                              </span>
                            </>
                          )}
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/jpg"
                            onChange={handleQrImageUpload}
                            disabled={isUploadingQr}
                            className="hidden"
                          />
                        </label>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1 text-xs">
                      إرشادات المسح والتحويل للمستخدمين:
                    </label>
                    <textarea
                      rows={3}
                      value={settings.cashPlus.qrCodeInstructions || ''}
                      placeholder="امسح رمز الاستجابة السريعة (QR Code) عبر تطبيق كاش بليس لإتمام التحويل والدعم فوراً وبكل سهولة."
                      onChange={(e) => {
                        setSettings(prev => ({
                          ...prev,
                          cashPlus: { ...prev.cashPlus, qrCodeInstructions: e.target.value }
                        }));
                        markChanged();
                      }}
                      className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-xs leading-relaxed focus:ring-2 focus:ring-amber-500"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      تظهر هذه الإرشادات للمستخدمين مباشرة بجانب صورة رمز QR في نافذة دعم المنصة.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 3. البطاقة البنكية (Credit Card) */}
        <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-sm text-slate-900 block">البطاقة البنكية الإلكترونية (CMI / Visa / Mastercard)</span>
                <span className="text-[11px] text-slate-500">الدفع الفوري المؤمن عبر بطاقات الدفع البنكية</span>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.creditCard.enabled}
                onChange={(e) => {
                  setSettings(prev => ({
                    ...prev,
                    creditCard: { ...prev.creditCard, enabled: e.target.checked }
                  }));
                  markChanged();
                }}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
              <span className="mr-2 text-xs font-bold text-slate-700">
                {settings.creditCard.enabled ? 'مفعلة' : 'معطلة'}
              </span>
            </label>
          </div>

          {settings.creditCard.enabled && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-slate-200/80 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">اسم البوابة / العرض:</label>
                <input
                  type="text"
                  value={settings.creditCard.gatewayName}
                  onChange={(e) => {
                    setSettings(prev => ({
                      ...prev,
                      creditCard: { ...prev.creditCard, gatewayName: e.target.value }
                    }));
                    markChanged();
                  }}
                  className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">رابط بوابة الدفع الإلكتروني (اختياري):</label>
                <input
                  type="url"
                  dir="ltr"
                  placeholder="https://buy.stripe.com/..."
                  value={settings.creditCard.paymentUrl || ''}
                  onChange={(e) => {
                    setSettings(prev => ({
                      ...prev,
                      creditCard: { ...prev.creditCard, paymentUrl: e.target.value }
                    }));
                    markChanged();
                  }}
                  className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">إرشادات الدفع بالبطاقة:</label>
                <input
                  type="text"
                  value={settings.creditCard.instructions}
                  onChange={(e) => {
                    setSettings(prev => ({
                      ...prev,
                      creditCard: { ...prev.creditCard, instructions: e.target.value }
                    }));
                    markChanged();
                  }}
                  className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-xs"
                />
              </div>

              {/* تخصيص ظهور البطاقة البنكية حسب الدولة */}
              <div className="md:col-span-3">
                <PaymentMethodCountrySelector
                  methodName="البطاقة البنكية الإلكترونية"
                  countriesMode={settings.creditCard.countriesMode || 'all'}
                  allowedCountries={settings.creditCard.allowedCountries || []}
                  onChange={(mode, countries) => {
                    setSettings(prev => ({
                      ...prev,
                      creditCard: {
                        ...prev.creditCard,
                        countriesMode: mode,
                        allowedCountries: countries,
                      },
                    }));
                    markChanged();
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* 4. بايبال (PayPal) وتكامل الدفع المباشر */}
        <div
          id="paypal-api-integration-section"
          data-testid="paypal-api-integration-section"
          className="p-5 rounded-3xl border border-slate-200 bg-slate-50/70 space-y-4 shadow-xs"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center shrink-0">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm text-slate-900 block">بوابة بايبال (PayPal API Integration)</span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-200">
                    REST API + Checkout
                  </span>
                </div>
                <span className="text-[11px] text-slate-500">
                  تكامل آمن عبر الخادم (Backend) للدفع عبر PayPal والبطاقات البنكية المدعومة دون كشف Client Secret
                </span>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.paypal.enabled}
                onChange={(e) => {
                  setSettings((prev) => ({
                    ...prev,
                    paypal: { ...prev.paypal, enabled: e.target.checked },
                  }));
                  markChanged();
                }}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
              <span className="mr-2 text-xs font-bold text-slate-700">
                {settings.paypal.enabled ? 'مفعلة' : 'معطلة'}
              </span>
            </label>
          </div>

          {settings.paypal.enabled && (
            <div className="space-y-4 pt-3 border-t border-slate-200 text-xs">
              {/* Connection Status Indicator Bar */}
              <div
                className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  paypalConfig.isConnected
                    ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
                    : 'bg-amber-50/80 border-amber-300 text-amber-950'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="relative flex h-3 w-3">
                    {paypalConfig.isConnected && (
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    )}
                    <span
                      className={`relative inline-flex rounded-full h-3 w-3 ${
                        paypalConfig.isConnected ? 'bg-emerald-600' : 'bg-amber-500'
                      }`}
                    ></span>
                  </span>
                  <div>
                    <span className="font-black text-xs block">
                      حالة الاتصال بـ PayPal:{' '}
                      <strong className={paypalConfig.isConnected ? 'text-emerald-700' : 'text-amber-700'}>
                        {paypalConfig.isConnected ? 'متصل ومفعّل بنجاح' : 'غير متصل'}
                      </strong>
                    </span>
                    <span className="text-[10px] text-slate-600">
                      {paypalConfig.lastTestedAt
                        ? `آخر اختبار وتحقق: ${new Date(paypalConfig.lastTestedAt).toLocaleString('ar-MA')}`
                        : 'جاهز لإجراء اختبار الاتصال والتحقق'}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`px-2.5 py-1 rounded-xl text-[10px] font-bold border ${
                      paypalConfig.sandboxPaypalTested && paypalConfig.sandboxCardTested
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : 'bg-slate-100 text-slate-700 border-slate-300'
                    }`}
                  >
                    {paypalConfig.sandboxPaypalTested && paypalConfig.sandboxCardTested
                      ? '✓ تم اختبار PayPal والبطاقات المدعومة'
                      : 'بانتظار اختبار Sandbox'}
                  </span>
                  <span
                    className={`px-2.5 py-1 rounded-xl text-[10px] font-bold font-mono border ${
                      paypalConfig.mode === 'live'
                        ? 'bg-purple-100 text-purple-800 border-purple-200'
                        : 'bg-amber-100 text-amber-800 border-amber-200'
                    }`}
                  >
                    {paypalConfig.mode === 'live' ? 'الوضع المباشر (Live)' : 'بيانات اعتماد Sandbox'}
                  </span>
                </div>
              </div>

              {/* PayPal REST API Credentials & Environment Section (No Frontend Secret Exposure) */}
              <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-4 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-orange-600" />
                    <span className="font-bold text-slate-800">
                      معلوماتي — إدارة بيانات اعتماد API ({paypalConfig.mode === 'live' ? 'بيانات اعتماد Live' : 'بيانات اعتماد Sandbox'})
                    </span>
                  </div>
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-md font-bold flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>مفاتيح المرور مشفرة ومحمية في الخادم</span>
                  </span>
                </div>

                {/* 1. مفاتيح REST API (مفتاح API + كلمة المرور) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {/* مفتاح API (PayPal Client ID) */}
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">
                      مفتاح API (PayPal Client ID): *
                    </label>
                    <input
                      type="text"
                      dir="ltr"
                      data-testid="paypal-client-id-input"
                      placeholder="AaJbsftKG9QmDMZmcWCiJEGXISIeDhuWL7z7qSYDHT48-QcsJ6QhY_gMEWuvOuvFnhFRHZ4HwiOpjtZT"
                      value={paypalConfig.clientId}
                      onChange={(e) => {
                        const val = e.target.value.trim();
                        setPaypalConfig((prev) => ({ ...prev, clientId: val }));
                        setSettings((prev) => ({
                          ...prev,
                          paypal: { ...prev.paypal, clientId: val },
                        }));
                      }}
                      className="w-full p-2.5 rounded-xl border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-orange-500 bg-white"
                      required
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      مفتاح API المعتمد لربط بوابة الدفع عبر PayPal والبطاقات البنكية.
                    </span>
                  </div>

                  {/* كلمة المرور (PayPal API Secret Key - Write-Only) */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-slate-700 font-bold">
                        كلمة المرور (API Secret Key):
                      </label>
                      {paypalConfig.hasSecret && (
                        <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          ✓ مفعّلة بالخادم ({paypalConfig.secretMasked || '••••••••••••KuE5y'})
                        </span>
                      )}
                    </div>
                    <input
                      type="password"
                      dir="ltr"
                      data-testid="paypal-client-secret-input"
                      placeholder={
                        paypalConfig.hasSecret
                          ? `${paypalConfig.secretMasked || '••••••••••••KuE5y'} (محفوظة في الخادم — اكتب هنا لتحديثها)`
                          : 'أدخل كلمة مرور API (Client Secret)'
                      }
                      value={newApiSecretInput}
                      onChange={(e) => setNewApiSecretInput(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-orange-500 bg-white"
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      تُحفظ كلمة مرور API في الخادم الآمن فقط ولا تُكشف في الواجهة الأمامية أو السجلات.
                    </span>
                  </div>
                </div>

                {/* 2. بيانات اعتماد Sandbox (اسم المستخدم + كلمة المرور) */}
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="font-black text-xs text-slate-800">
                      بيانات اعتماد Sandbox (حساب الأعمال المربوط)
                    </span>
                    <span className="text-[10px] font-bold text-sky-800 bg-sky-100 px-2.5 py-0.5 rounded-full border border-sky-200">
                      حساب تاجر معتمد
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {/* اسم المستخدم */}
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">
                        اسم المستخدم (Sandbox Business Account): *
                      </label>
                      <input
                        type="email"
                        dir="ltr"
                        data-testid="paypal-business-email-input"
                        placeholder="sb-onuud40741552@business.example.com"
                        value={paypalConfig.businessEmail}
                        onChange={(e) => {
                          const val = e.target.value.trim();
                          setPaypalConfig((prev) => ({ ...prev, businessEmail: val }));
                          setSettings((prev) => ({
                            ...prev,
                            paypal: { ...prev.paypal, email: val },
                          }));
                          markChanged();
                        }}
                        className="w-full p-2.5 rounded-xl border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-orange-500 bg-white"
                        required
                      />
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        اسم المستخدم لحساب الأعمال المستلم للمدفوعات: sb-onuud40741552@business.example.com
                      </span>
                    </div>

                    {/* كلمة المرور لحساب Sandbox */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-slate-700 font-bold">
                          كلمة المرور (Sandbox Password):
                        </label>
                        {paypalConfig.hasSandboxPassword && (
                          <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            ✓ محفوظة بالخادم ({paypalConfig.sandboxPasswordMasked || '••••••••'})
                          </span>
                        )}
                      </div>
                      <input
                        type="password"
                        dir="ltr"
                        data-testid="paypal-sandbox-password-input"
                        placeholder={
                          paypalConfig.hasSandboxPassword
                            ? `${paypalConfig.sandboxPasswordMasked || '••••••••'} (محفوظة في الخادم — اكتب هنا لتحديثها)`
                            : 'أدخل كلمة مرور حساب Sandbox'
                        }
                        value={newSandboxPasswordInput}
                        onChange={(e) => setNewSandboxPasswordInput(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-orange-500 bg-white"
                      />
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        كلمة مرور حساب Sandbox محفوظة ومحمية في الخادم لأغراض الربط والتحقق.
                      </span>
                    </div>
                  </div>
                </div>

                {/* Server-Side Secret Protection Notice */}
                <div className="p-3.5 rounded-xl bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <Lock className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <span className="font-bold text-xs text-white block">
                        تم ربط وتفعيل بيانات اعتماد PayPal OAuth 2.0 في الخادم الآمن
                      </span>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        تتم معالجة وإنشاء الطلبات وتأكيدها عبر خادم المنصة الخلفي (Backend) باستخدام مفتاح API وكلمة المرور السرية المحفوظة بأمان دون كشفها في الواجهة الأمامية.
                      </p>
                    </div>
                  </div>
                  <span className="px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 font-bold text-[10px] shrink-0 text-center">
                    {paypalConfig.hasSecret
                      ? '✓ مفاتيح API و Sandbox مفعّلة'
                      : 'محمي عبر Backend Proxy'}
                  </span>
                </div>

                {/* Mode Selector: Sandbox vs Live (Guarded by Sandbox Verification) */}
                <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-0.5">
                      وضع التشغيل وبيانات البيئة (Environment Mode):
                    </label>
                    <span className="text-[11px] text-slate-500">
                      يتم استخدام بيانات البيئة المطابقة لوضع التشغيل تلقائياً. لا يُفعل الوضع الحقيقي قبل اختبار الدفع عبر PayPal والبطاقات المدعومة.
                    </span>
                  </div>

                  <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setPaypalConfig((prev) => ({ ...prev, mode: 'sandbox' }))}
                      className={`px-3.5 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                        paypalConfig.mode === 'sandbox'
                          ? 'bg-white text-amber-800 shadow-xs border border-slate-200'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Sandbox (بيانات اعتماد الاختبار)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!paypalConfig.sandboxPaypalTested || !paypalConfig.sandboxCardTested) {
                          onShowToast(
                            'يرجى أولاً إجراء اختبار الدفع عبر PayPal والبطاقات البنكية المدعومة في وضع Sandbox قبل التبديل للوضع الحقيقي.',
                            'error'
                          );
                          return;
                        }
                        setPaypalConfig((prev) => ({ ...prev, mode: 'live' }));
                      }}
                      className={`px-3.5 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                        paypalConfig.mode === 'live'
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Live (الدفع الحقيقي المباشر)
                    </button>
                  </div>
                </div>

                {/* Action Buttons: Test Connection, Run Sandbox Flow Verification & Save Config */}
                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleRunSandboxVerificationSuite}
                      disabled={isTestingSandboxFlows}
                      data-testid="run-paypal-sandbox-tests-btn"
                      className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs transition-all flex items-center gap-2 cursor-pointer shadow-xs"
                    >
                      {isTestingSandboxFlows ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                          <span>جاري فحص الدفع عبر PayPal والبطاقات...</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>اختبار الدفع عبر PayPal والبطاقات المدعومة (Sandbox)</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowInteractiveSandboxPreview((prev) => !prev)}
                      data-testid="toggle-interactive-paypal-test-btn"
                      className="px-3.5 py-2 rounded-xl border border-sky-300 bg-sky-50 hover:bg-sky-100 text-sky-900 font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <CreditCard className="w-3.5 h-3.5 text-sky-700" />
                      <span>
                        {showInteractiveSandboxPreview
                          ? 'إخفاء نافذة تجربة الدفع التفاعلي'
                          : 'تجربة تفاعلية لأزرار PayPal والبطاقات'}
                      </span>
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleTestPayPalConnection}
                      disabled={isTestingPayPal}
                      data-testid="test-paypal-connection-btn"
                      className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs transition-all flex items-center gap-2 cursor-pointer shadow-2xs"
                    >
                      {isTestingPayPal ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-600" />
                          <span>جاري اختبار الاتصال...</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>اختبار الاتصال بـ PayPal</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleSavePayPalConfig}
                      disabled={isSavingPayPal}
                      data-testid="save-paypal-config-btn"
                      className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs transition-all flex items-center gap-2 cursor-pointer shadow-sm shadow-orange-600/20"
                    >
                      {isSavingPayPal ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                          <span>جاري الحفظ...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-3.5 h-3.5" />
                          <span>حفظ إعدادات PayPal</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Sandbox Verification Suite Report */}
                {paypalConfig.lastTestReport && paypalConfig.lastTestReport.length > 0 && (
                  <div
                    data-testid="paypal-sandbox-test-report"
                    className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-slate-800 text-xs">
                        تقرير التحقق من تكامل PayPal والبطاقات البنكية المدعومة (Backend Verification):
                      </span>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                        مؤكد عبر الخادم الآمن
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {paypalConfig.lastTestReport.map((item) => (
                        <div
                          key={item.step}
                          className={`p-2.5 rounded-xl border flex items-start gap-2 ${
                            item.passed
                              ? 'bg-white border-emerald-200 text-slate-800'
                              : 'bg-rose-50 border-rose-200 text-rose-900'
                          }`}
                        >
                          <CheckCircle2
                            className={`w-4 h-4 shrink-0 mt-0.5 ${
                              item.passed ? 'text-emerald-600' : 'text-rose-600'
                            }`}
                          />
                          <div>
                            <div className="font-bold text-[11px]">{item.title}</div>
                            <div className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                              {item.details}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Interactive Sandbox Checkout Tester (PayPal Wallet + Supported Bank Cards) */}
                {showInteractiveSandboxPreview && (
                  <div className="p-4 rounded-2xl bg-sky-50/70 border border-sky-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h5 className="font-black text-xs text-slate-900">
                          بيئة الاختبار التفاعلية (PayPal Sandbox & البطاقات البنكية المدعومة)
                        </h5>
                        <p className="text-[11px] text-slate-600 mt-0.5">
                          اختبر الدفع الفعلي بمبلغ تجريبي (100 درهم ≈ 10.00 USD) عبر حساب PayPal التجريبي أو البطاقة البنكية. لا تُعتبر أي عملية ناجحة إلا بعد تأكيد COMPLETED من PayPal.
                        </p>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 font-mono text-[10px] font-bold">
                        {paypalConfig.businessEmail}
                      </span>
                    </div>

                    <div className="max-w-md mx-auto bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                      <PayPalCheckoutButton
                        amount={100}
                        currency="MAD"
                        supporterName="اختبار الإدارة العامة (Sandbox)"
                        supporterMessage="اختبار تكامل PayPal والبطاقات البنكية المدعومة"
                        type="both"
                        onSuccess={(donation) => {
                          loadDonations();
                          loadPayPalConfig();
                          onShowToast(
                            `تم تأكيد عملية الدفع التجريبية من PayPal بنجاح (رقم العملية: ${
                              donation.transactionId || donation.paypalOrderId
                            })`,
                            'success'
                          );
                        }}
                        onError={(errMsg) => {
                          onShowToast(errMsg, 'error');
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Instructions for Supporters */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    البريد الإلكتروني لحساب PayPal المعتمد:
                  </label>
                  <input
                    type="email"
                    dir="ltr"
                    value={settings.paypal.email}
                    onChange={(e) => {
                      const val = e.target.value.trim();
                      setSettings((prev) => ({
                        ...prev,
                        paypal: { ...prev.paypal, email: val },
                      }));
                      setPaypalConfig((prev) => ({ ...prev, businessEmail: val }));
                      markChanged();
                    }}
                    className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">إرشادات الدفع للمساهمين:</label>
                  <input
                    type="text"
                    value={settings.paypal.instructions}
                    onChange={(e) => {
                      setSettings((prev) => ({
                        ...prev,
                        paypal: { ...prev.paypal, instructions: e.target.value },
                      }));
                      markChanged();
                    }}
                    className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-xs"
                  />
                </div>
              </div>

              {/* تخصيص ظهور بايبال حسب الدولة */}
              <div className="pt-2 border-t border-slate-200">
                <PaymentMethodCountrySelector
                  methodName="بوابة بايبال (PayPal)"
                  countriesMode={settings.paypal.countriesMode || 'all'}
                  allowedCountries={settings.paypal.allowedCountries || []}
                  onChange={(mode, countries) => {
                    setSettings((prev) => ({
                      ...prev,
                      paypal: {
                        ...prev.paypal,
                        countriesMode: mode,
                        allowedCountries: countries,
                      },
                    }));
                    markChanged();
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* 5. طرق الدفع المخصصة المضافة (Custom Payment Methods) */}
        {settings.customMethods.length > 0 && (
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-bold text-slate-500">طرق الدفع الإضافية المخصصة ({settings.customMethods.length}):</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {settings.customMethods.map((method) => (
                <div
                  key={method.id}
                  className="p-4 rounded-2xl border border-slate-200 bg-slate-50 flex items-start justify-between gap-3 shadow-xs hover:border-orange-300 transition-colors"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-slate-900">{method.name}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        method.enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {method.enabled ? 'مفعلة' : 'معطلة'}
                      </span>
                      {method.countriesMode === 'specific' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                          <MapPin className="w-3 h-3 text-amber-600" />
                          <span>مخصصة لـ ({method.allowedCountries?.length || 0}) دول</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <Globe className="w-3 h-3 text-emerald-600" />
                          <span>جميع الدول</span>
                        </span>
                      )}
                      {method.paymentUrl && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-800 border border-orange-200">
                          <Link2 className="w-3 h-3 text-orange-600" />
                          <span>رابط مباشر</span>
                        </span>
                      )}
                    </div>
                    {method.paymentUrl && (
                      <div className="flex items-center gap-1.5 text-xs text-orange-700 bg-orange-50/80 px-2.5 py-1 rounded-lg border border-orange-200/60 font-mono" dir="ltr">
                        <Globe className="w-3 h-3 shrink-0 text-orange-500" />
                        <span className="truncate max-w-[220px]" title={method.paymentUrl}>{method.paymentUrl}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const url = method.paymentUrl?.startsWith('http') ? method.paymentUrl : `https://${method.paymentUrl}`;
                            window.open(url, '_blank', 'noopener,noreferrer');
                          }}
                          className="text-orange-600 hover:text-orange-800 p-0.5 ml-auto cursor-pointer"
                          title="تجربة فتح الرابط في نافذة جديدة"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                    {method.accountNumber && (
                      <p className="text-xs text-slate-600 font-mono" dir="ltr">
                        {method.accountNumber}
                      </p>
                    )}
                    {method.instructions && (
                      <p className="text-[11px] text-slate-500 line-clamp-2">
                        {method.instructions}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0 pt-0.5">
                    <button
                      type="button"
                      onClick={() => handleToggleCustomMethod(method.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                        method.enabled ? 'bg-amber-100 text-amber-800 hover:bg-amber-200' : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                      }`}
                    >
                      {method.enabled ? 'تعطيل' : 'تفعيل'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEditCustomMethod(method)}
                      className="p-1.5 text-slate-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg cursor-pointer transition-colors"
                      title="تعديل"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCustomMethod(method.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                      title="حذف"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Floating / Bottom Save Bar */}
      <div className="p-4 bg-slate-900 text-white rounded-2xl flex items-center justify-between shadow-lg sticky bottom-4 z-20">
        <div className="flex items-center gap-2 text-xs">
          <Sliders className="w-4 h-4 text-orange-400" />
          <span>
            {hasUnsavedChanges
              ? 'توجد تعديلات غير محفوظة، اضغط على زر الحفظ لحفظها دائمياً في قاعدة البيانات.'
              : 'كافة إعدادات دعم المنصة محفوظة ومزامنة بنجاح.'}
          </span>
        </div>

        <button
          type="button"
          onClick={handleSaveAll}
          disabled={isSaving}
          className={`px-6 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 cursor-pointer ${
            hasUnsavedChanges
              ? 'bg-orange-600 hover:bg-orange-700 text-white ring-2 ring-orange-400 animate-pulse'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
          }`}
        >
          <Save className="w-4 h-4" />
          <span>حفظ التعديلات</span>
        </button>
      </div>
      </>
      )}

      {/* ================= MODAL: ADD / EDIT CUSTOM PAYMENT METHOD ================= */}
      {showAddCustomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full border border-slate-200 shadow-2xl space-y-4 text-right my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 sticky top-0 bg-white z-10">
              <h4 className="font-black text-base text-slate-900 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-orange-600" />
                <span>{editingCustomMethodId ? 'تعديل طريقة الدفع' : 'إضافة طريقة دفع جديدة'}</span>
              </h4>
              <button
                type="button"
                onClick={() => setShowAddCustomModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCustomMethod} className="space-y-3.5 text-xs">
              {/* اسم طريقة الدفع */}
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  اسم طريقة الدفع (مثال: PayPal، سترايب، بريد بنك، وفاش كاش): *
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: حساب PayPal المباشر / Stripe / بريد بنك"
                  value={customMethodForm.name}
                  onChange={(e) => setCustomMethodForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>

              {/* رابط الدفع المخصص */}
              <div className="p-3 bg-orange-50/70 border border-orange-200 rounded-2xl space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block font-black text-orange-950 flex items-center gap-1.5">
                    <Link2 className="w-4 h-4 text-orange-600" />
                    <span>رابط الدفع المباشر (مثل رابط PayPal أو صفحة الدفع):</span>
                  </label>
                  {customMethodForm.paymentUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        const url = customMethodForm.paymentUrl?.startsWith('http') ? customMethodForm.paymentUrl : `https://${customMethodForm.paymentUrl}`;
                        window.open(url, '_blank', 'noopener,noreferrer');
                      }}
                      className="text-[11px] font-bold text-orange-700 hover:text-orange-900 underline flex items-center gap-1 cursor-pointer"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>تجربة الرابط</span>
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  dir="ltr"
                  placeholder="https://paypal.me/yourname أو https://buy.stripe.com/..."
                  value={customMethodForm.paymentUrl || ''}
                  onChange={(e) => {
                    setCustomMethodForm(prev => ({ ...prev, paymentUrl: e.target.value }));
                    setUrlValidationError(null);
                  }}
                  className="w-full p-2.5 rounded-xl border border-orange-300 bg-white text-xs font-mono placeholder:text-slate-400 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
                <p className="text-[11px] text-slate-600">
                  الصق هنا رابط الدفع المباشر الخاص بك (مثلاً رابط PayPal.me). عند ضغط الداعم على طريقة الدفع سينتقل مباشرة لصفحة الدفع.
                </p>
                {urlValidationError && (
                  <div className="flex items-center gap-1.5 text-rose-600 font-bold text-[11px] mt-1 bg-rose-50 p-2 rounded-lg border border-rose-200">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{urlValidationError}</span>
                  </div>
                )}
              </div>

              {/* نوع الطريقة + اسم المستفيد */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">نوع الطريقة:</label>
                  <select
                    value={customMethodForm.type}
                    onChange={(e) => setCustomMethodForm(prev => ({ ...prev, type: e.target.value as any }))}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="link">رابط دفع خارجي / PayPal</option>
                    <option value="wallet">محفظة إلكترونية / هاتف</option>
                    <option value="bank">حساب بنكي / RIB</option>
                    <option value="card">بوابة بطاقات</option>
                    <option value="cash">وكالة نقدية</option>
                    <option value="other">أخرى</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">اسم المستفيد / الجهة (اختياري):</label>
                  <input
                    type="text"
                    placeholder="اسم صاحب الحساب أو الخدمة"
                    value={customMethodForm.accountName || ''}
                    onChange={(e) => setCustomMethodForm(prev => ({ ...prev, accountName: e.target.value }))}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs"
                  />
                </div>
              </div>

              {/* رقم الحساب / المعرف */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">رقم الحساب / الهاتف / المعرّف (اختياري):</label>
                <input
                  type="text"
                  dir="ltr"
                  placeholder="رقم الحساب أو الهاتف أو المعرف الإضافي"
                  value={customMethodForm.accountNumber || ''}
                  onChange={(e) => setCustomMethodForm(prev => ({ ...prev, accountNumber: e.target.value }))}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-mono"
                />
              </div>

              {/* إرشادات وتعليمات الدفع */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">إرشادات وتعليمات الدفع للداعم:</label>
                <textarea
                  rows={2}
                  placeholder="اكتب خطوات الدفع أو التحويل التي تظهر للمستخدم..."
                  value={customMethodForm.instructions || ''}
                  onChange={(e) => setCustomMethodForm(prev => ({ ...prev, instructions: e.target.value }))}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs"
                />
              </div>

              {/* خيارات الوصل والتفعيل */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <label className="flex items-center gap-2 cursor-pointer text-slate-700 font-medium">
                  <input
                    type="checkbox"
                    checked={customMethodForm.requiresReceipt}
                    onChange={(e) => setCustomMethodForm(prev => ({ ...prev, requiresReceipt: e.target.checked }))}
                    className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500"
                  />
                  <span>طلب إرفاق صورة الوصل من الداعم</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-slate-700 font-bold sm:mr-auto">
                  <input
                    type="checkbox"
                    checked={customMethodForm.enabled}
                    onChange={(e) => setCustomMethodForm(prev => ({ ...prev, enabled: e.target.checked }))}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>تفعيل هذه الطريقة فوراً</span>
                </label>
              </div>

              {/* تخصيص ظهور طريقة الدفع المخصصة حسب الدولة */}
              <PaymentMethodCountrySelector
                methodName={customMethodForm.name || 'طريقة الدفع المخصصة'}
                countriesMode={customMethodForm.countriesMode || 'all'}
                allowedCountries={customMethodForm.allowedCountries || ['المغرب']}
                onChange={(mode, countries) => {
                  setCustomMethodForm(prev => ({
                    ...prev,
                    countriesMode: mode,
                    allowedCountries: countries,
                  }));
                }}
              />

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddCustomModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-black cursor-pointer shadow-md shadow-orange-600/20"
                >
                  {editingCustomMethodId ? 'حفظ التعديلات' : 'إضافة وحفظ طريقة الدفع'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* نافذة معاينة صورة QR Code بالحجم الكامل */}
      {previewQrModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={() => setPreviewQrModal(null)}>
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl animate-scale-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-sm text-slate-900">رمز QR Code الخاص بكاش بليس</h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewQrModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-200 flex items-center justify-center">
              <img
                src={previewQrModal}
                alt="QR Code Preview"
                className="max-h-72 w-auto object-contain rounded-xl bg-white p-2 shadow-sm"
              />
            </div>

            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              {settings.cashPlus.qrCodeInstructions || 'يمكن للمستخدمين مسح هذا الرمز مباشرة عبر تطبيق Cash Plus لإتمام التحويل.'}
            </p>

            <div className="flex items-center justify-center gap-2 pt-2 border-t border-slate-100">
              <a
                href={previewQrModal}
                download={settings.cashPlus.qrCodeFileName || 'cashplus-qrcode.png'}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm shadow-amber-600/20"
              >
                <Download className="w-4 h-4" />
                <span>تحميل الصورة</span>
              </a>
              <button
                type="button"
                onClick={() => setPreviewQrModal(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
