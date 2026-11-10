import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { 
  X, 
  UserPlus, 
  UserCheck, 
  Shield, 
  Phone, 
  Mail, 
  CreditCard, 
  Sparkles, 
  UploadCloud, 
  Calendar, 
  Hash, 
  Type, 
  CheckSquare, 
  ListFilter, 
  AlignLeft,
  FileCheck,
  Camera,
  Smartphone,
  Image as ImageIcon,
  Trash2,
  AlertCircle,
  CheckCircle2,
  FolderOpen,
  Building2,
  Landmark,
  Banknote,
  Receipt,
  Copy,
  Check,
  User,
  Lock,
  Eye,
  EyeOff,
  Upload,
  RefreshCw
} from 'lucide-react';
import { Member, MemberStatus, Language, MemberRegistrationField, PaymentMethodType, AssociationSettings } from '../types';
import { translations } from '../translations';
import { getStoredSettings, getStoredRegistrationFields, ensureMandatoryPasswordFields } from '../storage';
import {
  generateSalt,
  hashPasswordWithSalt,
  validateMemberUsernameFormat,
  isMemberUsernameTaken,
} from '../security';
import { ensurePermanentImageUrl } from '../api/imageApi';
import { initialRegistrationFields } from '../initialData';

export interface MemberFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (member: Omit<Member, 'id'>, plainPassword?: string) => void | Promise<void>;
  editingMember?: Member | null;
  existingMembersCount: number;
  members?: Member[];
  lang: Language;
  registrationFields: MemberRegistrationField[];
  isPublicRegistration?: boolean;
  associationName?: string;
  settings?: AssociationSettings;
  onOpenLoginModal?: () => void;
}

/**
 * Resizes and compresses an image client-side to ensure:
 * 1. Safe localStorage persistence (keeps file under 150KB Base64)
 * 2. Instant phone gallery & camera upload support across iOS/Android/Desktop
 * 3. Sharp visual fidelity for ID cards, receipts, and member tables
 */
const compressAvatarImage = (
  file: File, 
  maxWidth = 480, 
  maxHeight = 480, 
  quality = 0.85
): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      return reject(new Error('الملف المختار ليس صورة صالحة (يرجى اختيار JPG, PNG, WebP)'));
    }

    if (file.size > 15 * 1024 * 1024) {
      return reject(new Error('حجم ملف الصورة كبير جدًا (الحد الأقصى 15 ميجابايت)'));
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('تعذر إنشاء سياق معالجة الصورة'));
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        const outputFormat = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        const dataUrl = canvas.toDataURL(outputFormat, quality);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('تعذر قراءة بيانات ملف الصورة'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('خطأ أثناء قراءة الملف من الهاتف'));
    reader.readAsDataURL(file);
  });
};

export const MemberFormModal: React.FC<MemberFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingMember,
  existingMembersCount,
  members,
  lang,
  registrationFields,
  isPublicRegistration = false,
  associationName,
  settings: propSettings,
  onOpenLoginModal,
}) => {
  const t = translations[lang];

  const defaultCode = `ACH-${String(existingMembersCount + 1).padStart(3, '0')}`;

  const [copiedRib, setCopiedRib] = useState(false);

  // Auto compute 1-year renewal date
  const nextYearDate = new Date();
  nextYearDate.setFullYear(nextYearDate.getFullYear() + 1);

  // Standard Form States
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [memberCode, setMemberCode] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [cin, setCin] = useState('');
  const [joinDate, setJoinDate] = useState('');
  const [renewalDate, setRenewalDate] = useState('');
  const [annualFee, setAnnualFee] = useState<number | ''>(1000);
  const [membershipPaymentMethod, setMembershipPaymentMethod] = useState<PaymentMethodType>('bank_transfer');
  const [status, setStatus] = useState<MemberStatus>('active');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [isAnonymousInPublic, setIsAnonymousInPublic] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordMatchError, setPasswordMatchError] = useState<string | null>(null);

  // Validation & Submission States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Custom Dynamic Fields State
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});

  // Image Upload Processing States
  const [isProcessingAvatar, setIsProcessingAvatar] = useState(false);
  const [avatarUploadError, setAvatarUploadError] = useState<string | null>(null);
  const [avatarUploadSuccess, setAvatarUploadSuccess] = useState(false);
  const avatarFileInputRef = useRef<HTMLInputElement>(null);

  // Bank Transfer Payment Proof Upload States («إرفاق صورة إثبات الدفع»)
  const [membershipProofImageUrl, setMembershipProofImageUrl] = useState<string>('');
  const [membershipProofImagePreview, setMembershipProofImagePreview] = useState<string>('');
  const [membershipProofFileName, setMembershipProofFileName] = useState<string>('');
  const [isUploadingMembershipProof, setIsUploadingMembershipProof] = useState<boolean>(false);
  const [membershipProofUploadProgress, setMembershipProofUploadProgress] = useState<number | null>(null);
  const membershipProofFileInputRef = useRef<HTMLInputElement>(null);

  // Sync state whenever modal opens or editingMember changes
  useEffect(() => {
    if (editingMember) {
      setFullName(editingMember.fullName || '');
      setUsername(editingMember.username || '');
      setUsernameError(null);
      setMemberCode(editingMember.memberCode || defaultCode);
      setPhone(editingMember.phone || '');
      setEmail(editingMember.email || '');
      setCin(editingMember.cin || '');
      setJoinDate(editingMember.joinDate || new Date().toISOString().slice(0, 10));
      setRenewalDate(editingMember.renewalDate || nextYearDate.toISOString().slice(0, 10));
      setAnnualFee(editingMember.annualFee ?? 1000);
      setMembershipPaymentMethod(editingMember.membershipPaymentMethod || 'bank_transfer');
      setStatus(editingMember.status || 'active');
      setAvatarUrl(editingMember.avatarUrl || '');
      setNotes(editingMember.notes || '');
      setIsAnonymousInPublic(editingMember.isAnonymousInPublic ?? false);
      setPassword('');
      setConfirmPassword('');
      setShowPassword(false);
      setShowConfirmPassword(false);
      setPasswordMatchError(null);
      setCustomFieldValues(editingMember.customFields ? { ...editingMember.customFields } : {});
      setMembershipProofImageUrl(editingMember.proofImageUrl || editingMember.receiptUrl || '');
      setMembershipProofImagePreview(editingMember.proofImageUrl || editingMember.receiptUrl || '');
      setMembershipProofFileName(editingMember.proofImageUrl || editingMember.receiptUrl ? 'إثبات الدفع المرفق' : '');
    } else {
      setFullName('');
      setUsername('');
      setUsernameError(null);
      setMemberCode(defaultCode);
      setPhone('');
      setEmail('');
      setCin('');
      setJoinDate(new Date().toISOString().slice(0, 10));
      setRenewalDate(nextYearDate.toISOString().slice(0, 10));
      setAnnualFee(1000);
      setMembershipPaymentMethod('bank_transfer');
      setStatus('active');
      setAvatarUrl('');
      setNotes('');
      setIsAnonymousInPublic(false);
      setPassword('');
      setConfirmPassword('');
      setShowPassword(false);
      setShowConfirmPassword(false);
      setPasswordMatchError(null);
      setCustomFieldValues({});
      setMembershipProofImageUrl('');
      setMembershipProofImagePreview('');
      setMembershipProofFileName('');
    }
    setIsSubmitting(false);
    setValidationError(null);
    setAvatarUploadError(null);
    setAvatarUploadSuccess(false);
    setIsProcessingAvatar(false);
    setIsUploadingMembershipProof(false);
    setMembershipProofUploadProgress(null);
  }, [editingMember, isOpen, existingMembersCount]);

  if (!isOpen) return null;

  const presetAvatars = [
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
    'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=200&q=80',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
    'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=200&q=80',
    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=200&q=80',
  ];

  // Mobile / Device avatar file selection & compression handler
  const handleAvatarFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingAvatar(true);
    setAvatarUploadError(null);
    setAvatarUploadSuccess(false);

    try {
      const optimizedDataUrl = await compressAvatarImage(file, 480, 480, 0.85);
      const permanentUrl = await ensurePermanentImageUrl(optimizedDataUrl);
      setAvatarUrl(permanentUrl);
      setAvatarUploadSuccess(true);
      setTimeout(() => setAvatarUploadSuccess(false), 4000);
    } catch (err: any) {
      console.error('Error processing member avatar:', err);
      setAvatarUploadError(err.message || t.memberPhotoError || 'حدث خطأ أثناء معالجة صورة المنخرط');
    } finally {
      setIsProcessingAvatar(false);
      // Reset input value to allow selecting the same file again if desired
      if (avatarFileInputRef.current) {
        avatarFileInputRef.current.value = '';
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, fieldId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith('image/')) {
      try {
        const compressed = await compressAvatarImage(file, 800, 800, 0.82);
        const permanentUrl = await ensurePermanentImageUrl(compressed);
        if (fieldId === 'avatarUrl') {
          setAvatarUrl(permanentUrl);
        } else {
          setCustomFieldValues((prev) => ({ ...prev, [fieldId]: permanentUrl }));
        }
      } catch {
        const reader = new FileReader();
        reader.onload = async () => {
          if (typeof reader.result === 'string') {
            const permanentUrl = await ensurePermanentImageUrl(reader.result);
            if (fieldId === 'avatarUrl') {
              setAvatarUrl(permanentUrl);
            } else {
              setCustomFieldValues((prev) => ({ ...prev, [fieldId]: permanentUrl }));
            }
          }
        };
        reader.readAsDataURL(file);
      }
    } else {
      const reader = new FileReader();
      reader.onload = async () => {
        if (typeof reader.result === 'string') {
          const permanentUrl = await ensurePermanentImageUrl(reader.result);
          setCustomFieldValues((prev) => ({ ...prev, [fieldId]: permanentUrl }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Compute active fields directly from saved registrationFields settings, respecting enabled/disabled toggles for every field
  const activeFields = (() => {
    const sourceList =
      Array.isArray(registrationFields) && registrationFields.length > 0
        ? registrationFields
        : getStoredRegistrationFields();
    const normalized = ensureMandatoryPasswordFields(sourceList);
    return normalized
      .filter((f) => f && f.enabled !== false && (f as any).enabled !== 'false')
      .sort((a, b) => a.order - b.order);
  })();

  const getLocalizedFieldLabel = (field: MemberRegistrationField) => {
    if (lang === 'ar') return field.labelAr || field.name;
    if (lang === 'fr') return field.labelFr || field.labelAr || field.name;
    return field.labelEn || field.labelAr || field.name;
  };

  const getLocalizedPlaceholder = (field: MemberRegistrationField) => {
    if (lang === 'ar') return field.placeholderAr;
    if (lang === 'fr') return field.placeholderFr;
    return field.placeholderEn;
  };

  const getLocalizedHelpText = (field: MemberRegistrationField) => {
    if (lang === 'ar') return field.helpTextAr;
    if (lang === 'fr') return field.helpTextFr;
    return field.helpTextEn;
  };

  // Payment Proof Handlers
  const handleOpenMembershipProofPicker = () => {
    if (membershipProofFileInputRef.current) {
      membershipProofFileInputRef.current.value = '';
      membershipProofFileInputRef.current.click();
    }
  };

  const handleRemoveMembershipProof = () => {
    setMembershipProofImageUrl('');
    setMembershipProofImagePreview('');
    setMembershipProofFileName('');
    setIsUploadingMembershipProof(false);
    setMembershipProofUploadProgress(null);
    if (membershipProofFileInputRef.current) {
      membershipProofFileInputRef.current.value = '';
    }
  };

  const handleMembershipProofFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const validExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
    const lowerName = (file.name || '').toLowerCase();
    const hasValidExt = validExtensions.some((ext) => lowerName.endsWith(ext));
    const hasValidMime = validMimeTypes.includes((file.type || '').toLowerCase());

    if (!hasValidMime && !hasValidExt) {
      setValidationError('يرجى اختيار صورة بصيغة مدعومة فقط: JPG أو JPEG أو PNG أو WEBP.');
      if (e.target) e.target.value = '';
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setValidationError('حجم الصورة كبير جداً، يرجى اختيار صورة أقل من 20 ميجابايت.');
      if (e.target) e.target.value = '';
      return;
    }

    setValidationError(null);
    setMembershipProofFileName(file.name);

    // Immediate local preview via FileReader
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setMembershipProofImagePreview(reader.result);
      }
    };
    reader.readAsDataURL(file);

    // Upload permanently to Firebase Storage / server disk
    const currentAssociationSettings: AssociationSettings = propSettings || getStoredSettings();
    const targetTenantId = (currentAssociationSettings as any)?.id || (currentAssociationSettings as any)?.tenantId || 'tenant_nour';
    setIsUploadingMembershipProof(true);
    setMembershipProofUploadProgress(15);
    try {
      const permanentUrl = await ensurePermanentImageUrl(file, {
        category: 'membership_proofs',
        tenantId: targetTenantId,
        fileName: file.name || 'member-bank-transfer-proof.jpg',
        recordId: editingMember?.id || memberCode,
        onProgress: (pct) => setMembershipProofUploadProgress(pct),
      });
      setMembershipProofImageUrl(permanentUrl);
      setMembershipProofImagePreview(permanentUrl);
    } catch (err: any) {
      console.warn('[MemberFormModal] Proof image upload warning:', err);
    } finally {
      setIsUploadingMembershipProof(false);
      setMembershipProofUploadProgress(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (isSubmitting) return;

    // 1. Validate required fields according to active configuration in admin panel
    for (const field of activeFields) {
      if (!field.required) continue;
      const label = getLocalizedFieldLabel(field);

      if (field.id === 'fullName') {
        if (!fullName.trim()) {
          setValidationError(`يرجى ملء الحقل الإجباري: ${label}`);
          return;
        }
      } else if (field.id === 'username') {
        if (!username.trim()) {
          setUsernameError('يرجى إدخال اسم المستخدم (يتكون من حروف وأرقام فقط)');
          setValidationError(`يرجى ملء الحقل الإجباري: ${label}`);
          return;
        }
      } else if (field.id === 'memberCode') {
        if (!memberCode.trim()) {
          setValidationError(`يرجى ملء الحقل الإجباري: ${label}`);
          return;
        }
      } else if (field.id === 'phone') {
        if (!phone.trim()) {
          setValidationError(`يرجى ملء الحقل الإجباري: ${label}`);
          return;
        }
      } else if (field.id === 'email') {
        if (!email.trim()) {
          setValidationError(`يرجى ملء الحقل الإجباري: ${label}`);
          return;
        }
      } else if (field.id === 'cin') {
        if (!cin.trim()) {
          setValidationError(`يرجى ملء الحقل الإجباري: ${label}`);
          return;
        }
      } else if (field.id === 'annualFee') {
        if (annualFee === '' || annualFee === undefined || isNaN(Number(annualFee))) {
          setValidationError(`يرجى ملء الحقل الإجباري: ${label}`);
          return;
        }
      } else if (field.id === 'status') {
        if (!status) {
          setValidationError(`يرجى اختيار: ${label}`);
          return;
        }
      } else if (field.id === 'joinDate') {
        if (!joinDate) {
          setValidationError(`يرجى تحديد: ${label}`);
          return;
        }
      } else if (field.id === 'renewalDate') {
        if (!renewalDate) {
          setValidationError(`يرجى تحديد: ${label}`);
          return;
        }
      } else if (field.id === 'avatarUrl') {
        if (!avatarUrl) {
          setValidationError(`يرجى رفع أو اختيار صورة لـ: ${label}`);
          return;
        }
      } else if (field.id === 'password') {
        if (!editingMember && !password.trim()) {
          setPasswordMatchError('يرجى إدخال كلمة المرور الخاصة بحساب المنخرط');
          setValidationError(`يرجى ملء الحقل الإجباري: ${label}`);
          return;
        }
      } else if (field.id === 'confirmPassword') {
        if (!editingMember && !confirmPassword.trim()) {
          setPasswordMatchError('يرجى إعادة إدخال كلمة المرور لتأكيدها');
          setValidationError(`يرجى ملء الحقل الإجباري: ${label}`);
          return;
        }
      } else if (field.id === 'notes') {
        if (!notes.trim()) {
          setValidationError(`يرجى ملء الحقل الإجباري: ${label}`);
          return;
        }
      } else if (!field.isSystem) {
        const val = customFieldValues[field.id];
        if (val === undefined || val === null || val === '' || (field.type === 'checkbox' && !val)) {
          setValidationError(`يرجى ملء الحقل الإجباري: ${label}`);
          return;
        }
      }
    }

    // Validate username if the username field is enabled in activeFields (or fallback if hidden/optional)
    const activeUsernameField = activeFields.find((f) => f.id === 'username' || f.name === 'username');
    let cleanUsername = username.trim();
    if (activeUsernameField) {
      if (!cleanUsername && activeUsernameField.required) {
        setUsernameError('حقل «اسم المستخدم» إلزامي لإتمام التسجيل.');
        setValidationError('حقل «اسم المستخدم» إلزامي لإتمام التسجيل. يجب أن يتكون اسم المستخدم من 4 حروف على الأقل ورقمين على الأقل، ويجب الجمع بين الحروف والأرقام.');
        return;
      }
      if (cleanUsername) {
        const usernameFormatCheck = validateMemberUsernameFormat(cleanUsername);
        if (!usernameFormatCheck.valid) {
          setUsernameError(usernameFormatCheck.error || 'يجب أن يتكون اسم المستخدم من 4 حروف على الأقل ورقمين على الأقل، ويجب الجمع بين الحروف والأرقام.');
          setValidationError(usernameFormatCheck.error || 'يجب أن يتكون اسم المستخدم من 4 حروف على الأقل ورقمين على الأقل، ويجب الجمع بين الحروف والأرقام.');
          return;
        }
        if (isMemberUsernameTaken(cleanUsername, members || [], editingMember?.id)) {
          const takenMsg = `اسم المستخدم (${cleanUsername}) مستخدم بالفعل من طرف منخرط آخر ضمن النظام المعتمد. يرجى اختيار اسم مستخدم فريد.`;
          setUsernameError(takenMsg);
          setValidationError(takenMsg);
          return;
        }
      }
    }
    if (!cleanUsername) {
      cleanUsername =
        editingMember?.username ||
        `member${phone.replace(/\D/g, '').slice(-4) || String(Date.now()).slice(-4)}`;
    }

    // Validate password & confirmPassword matching only if enabled in activeFields
    const activePasswordField = activeFields.find((f) => f.id === 'password' || f.name === 'password');
    const activeConfirmPasswordField = activeFields.find((f) => f.id === 'confirmPassword' || f.name === 'confirmPassword');
    const isSettingNewPassword =
      Boolean(activePasswordField) &&
      ((!editingMember && activePasswordField.required) || password.trim().length > 0 || confirmPassword.trim().length > 0);
    if (isSettingNewPassword) {
      if (!password.trim()) {
        setPasswordMatchError('يرجى إدخال كلمة المرور الخاصة بحساب المنخرط');
        setValidationError('حقل «كلمة المرور» إلزامي لإنشاء حساب المنخرط.');
        return;
      }
      if (activeConfirmPasswordField) {
        if (!confirmPassword.trim()) {
          setPasswordMatchError('يرجى إعادة إدخال كلمة المرور لتأكيدها');
          setValidationError('حقل «تأكيد كلمة المرور» إلزامي للتحقق من تطابق كلمة المرور.');
          return;
        }
        if (password !== confirmPassword) {
          setPasswordMatchError('كلمتا المرور غير متطابقتين. يرجى التأكد من إدخال نفس كلمة المرور في الحقلين.');
          setValidationError('كلمتا المرور غير متطابقتين! يرجى التأكد من تطابق «كلمة المرور» و«تأكيد كلمة المرور» قبل إتمام التسجيل.');
          return;
        }
      }
      if (password.trim().length < 4) {
        setPasswordMatchError('يجب أن تتكون كلمة المرور من 4 أحرف أو أرقام على الأقل');
        setValidationError('يجب أن تتكون كلمة المرور من 4 أحرف أو أرقام على الأقل.');
        return;
      }
    }

    // Validate mandatory payment method if fee is greater than 0
    if (Number(annualFee) > 0 && !membershipPaymentMethod) {
      setValidationError('يرجى اختيار طريقة دفع الانخراط (الحساب البنكي، نقدًا، أو شيك بنكي).');
      return;
    }

    // 2. Uniqueness verification in current tenant
    if (phone.trim() && members && members.length > 0) {
      const cleanDigits = phone.replace(/\D/g, '').slice(-9);
      if (cleanDigits.length >= 8) {
        const duplicatePhone = members.find(
          (m) => m.id !== editingMember?.id && (m.phone || '').replace(/\D/g, '').slice(-9) === cleanDigits
        );
        if (duplicatePhone) {
          setValidationError(`رقم الهاتف (${phone}) مسجل بالفعل لمنخرط آخر في الجمعية (${duplicatePhone.fullName}). يرجى استخدام رقم هاتف مختلف.`);
          return;
        }
      }
    }

    if (!editingMember && memberCode.trim() && members && members.length > 0) {
      const duplicateCode = members.find(
        (m) => m.memberCode.trim().toLowerCase() === memberCode.trim().toLowerCase()
      );
      if (duplicateCode) {
        setValidationError(`رقم العضوية (${memberCode}) مستخدم بالفعل للمنخرط (${duplicateCode.fullName}). تم تحديث الرقم تلقائيًا.`);
        setMemberCode(`ACH-${String(existingMembersCount + 2).padStart(3, '0')}`);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      // Server-side uniqueness check across all associations on the platform
      try {
        const checkRes = await fetch('/api/tenants/check-member-username', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: cleanUsername,
            excludeMemberId: editingMember?.id,
          }),
        });
        if (checkRes.ok) {
          const checkData = await checkRes.json();
          if (checkData && checkData.available === false) {
            const errMsg = checkData.error || `اسم المستخدم (${cleanUsername}) مستخدم بالفعل من طرف منخرط آخر ضمن النظام المعتمد.`;
            setUsernameError(errMsg);
            setValidationError(errMsg);
            setIsSubmitting(false);
            return;
          }
        }
      } catch {
        // Proceed if offline or local check already passed
      }
      let finalHash = editingMember?.passwordHash;
      let finalSalt = editingMember?.passwordSalt;

      if (isSettingNewPassword && password.trim()) {
        finalSalt = generateSalt(16);
        finalHash = await hashPasswordWithSalt(password.trim(), finalSalt);
      } else if (!editingMember && !finalHash) {
        const defaultPass = phone.trim() || '123456';
        finalSalt = generateSalt(16);
        finalHash = await hashPasswordWithSalt(defaultPass, finalSalt);
      }

      // Ensure customFieldValues never contains plaintext password
      const sanitizedCustomFields = { ...customFieldValues };
      delete sanitizedCustomFields.password;
      delete sanitizedCustomFields.confirmPassword;

      await onSave({
        fullName: fullName.trim(),
        username: cleanUsername,
        memberCode: memberCode.trim(),
        phone: phone.trim() || '0600000000',
        email: email.trim() || undefined,
        cin: cin.trim() || undefined,
        joinDate: joinDate || new Date().toISOString().slice(0, 10),
        renewalDate: renewalDate || nextYearDate.toISOString().slice(0, 10),
        annualFee: Number(annualFee) || 0,
        membershipPaymentMethod: membershipPaymentMethod || 'bank_transfer',
        status,
        avatarUrl: avatarUrl || undefined,
        proofImageUrl: membershipProofImageUrl || membershipProofImagePreview || undefined,
        receiptUrl: membershipProofImageUrl || membershipProofImagePreview || undefined,
        notes: notes.trim() || undefined,
        isAnonymousInPublic,
        customFields: Object.keys(sanitizedCustomFields).length > 0 ? sanitizedCustomFields : undefined,
        passwordHash: finalHash,
        passwordSalt: finalSalt,
        lastLoginDate: editingMember?.lastLoginDate,
      });

      onClose();
    } catch (err: any) {
      setValidationError(err?.message || 'حدث خطأ أثناء حفظ البيانات.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Section: طريقة دفع واجب الانخراط
  const renderPaymentMethodSection = () => {
    const isFeeSpecified = Number(annualFee) > 0;
    const currentAssociationSettings: AssociationSettings = propSettings || getStoredSettings();
    const effectiveAssociationName = associationName || currentAssociationSettings.name || 'الجمعية';
    const effectiveRib = currentAssociationSettings.ribBank ? currentAssociationSettings.ribBank.trim() : '';
    const effectiveBankName = currentAssociationSettings.bankName ? currentAssociationSettings.bankName.trim() : 'الحساب البنكي المعتمد للجمعية';
    const effectiveLocation = currentAssociationSettings.city || currentAssociationSettings.address || '';

    const handleCopyRib = () => {
      if (!effectiveRib) return;
      navigator.clipboard.writeText(effectiveRib.replace(/\s+/g, ''));
      setCopiedRib(true);
      setTimeout(() => setCopiedRib(false), 2500);
    };

    return (
      <div className="p-4 sm:p-5 bg-gradient-to-br from-slate-50 via-white to-emerald-50/20 rounded-2xl border-2 border-emerald-500/25 shadow-xs space-y-4 my-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <Landmark className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-1.5">
                <span>طريقة دفع واجب الانخراط</span>
                {isFeeSpecified && (
                  <span className="text-rose-500 font-bold text-xs" title="حقل إلزامي عند تحديد وجود مبلغ واجب للانخراط">*</span>
                )}
              </h4>
              <p className="text-[11px] text-slate-500">
                اختر الطريقة التي ترغب في استخدامها لأداء مبلغ واجب الانخراط
              </p>
            </div>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100/90 text-emerald-800 border border-emerald-200">
            خيار واحد فقط
          </span>
        </div>

        {/* 3 Payment Options (الحساب البنكي / نقدًا / شيك بنكي) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {/* 1. الحساب البنكي: الدفع عن طريق التحويل البنكي (Default Option) */}
          <button
            type="button"
            onClick={() => setMembershipPaymentMethod('bank_transfer')}
            className={`relative p-3.5 rounded-xl text-right rtl:text-right transition-all cursor-pointer flex flex-col justify-between gap-2.5 border-2 ${
              membershipPaymentMethod === 'bank_transfer'
                ? 'border-emerald-600 bg-emerald-50/70 shadow-sm ring-2 ring-emerald-500/20'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                membershipPaymentMethod === 'bank_transfer'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-600'
              }`}>
                <Landmark className="w-4 h-4" />
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  الافتراضي
                </span>
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  membershipPaymentMethod === 'bank_transfer'
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : 'border-slate-300 bg-white'
                }`}>
                  {membershipPaymentMethod === 'bank_transfer' && (
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  )}
                </div>
              </div>
            </div>

            <div>
              <div className="text-xs sm:text-sm font-bold text-slate-900">
                الحساب البنكي
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                الدفع عن طريق التحويل البنكي
              </p>
            </div>
          </button>

          {/* 2. نقدًا: الدفع مباشرة لدى الجمعية */}
          <button
            type="button"
            onClick={() => setMembershipPaymentMethod('cash')}
            className={`relative p-3.5 rounded-xl text-right rtl:text-right transition-all cursor-pointer flex flex-col justify-between gap-2.5 border-2 ${
              membershipPaymentMethod === 'cash'
                ? 'border-emerald-600 bg-emerald-50/70 shadow-sm ring-2 ring-emerald-500/20'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                membershipPaymentMethod === 'cash'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-600'
              }`}>
                <Banknote className="w-4 h-4" />
              </div>
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                membershipPaymentMethod === 'cash'
                  ? 'border-emerald-600 bg-emerald-600 text-white'
                  : 'border-slate-300 bg-white'
              }`}>
                {membershipPaymentMethod === 'cash' && (
                  <div className="w-1.5 h-1.5 rounded-full bg-white" />
                )}
              </div>
            </div>

            <div>
              <div className="text-xs sm:text-sm font-bold text-slate-900">
                نقدًا
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                الدفع مباشرة لدى الجمعية
              </p>
            </div>
          </button>

          {/* 3. شيك بنكي: الدفع بواسطة شيك بنكي */}
          <button
            type="button"
            onClick={() => setMembershipPaymentMethod('check')}
            className={`relative p-3.5 rounded-xl text-right rtl:text-right transition-all cursor-pointer flex flex-col justify-between gap-2.5 border-2 ${
              membershipPaymentMethod === 'check'
                ? 'border-emerald-600 bg-emerald-50/70 shadow-sm ring-2 ring-emerald-500/20'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                membershipPaymentMethod === 'check'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-600'
              }`}>
                <Receipt className="w-4 h-4" />
              </div>
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                membershipPaymentMethod === 'check'
                  ? 'border-emerald-600 bg-emerald-600 text-white'
                  : 'border-slate-300 bg-white'
              }`}>
                {membershipPaymentMethod === 'check' && (
                  <div className="w-1.5 h-1.5 rounded-full bg-white" />
                )}
              </div>
            </div>

            <div>
              <div className="text-xs sm:text-sm font-bold text-slate-900">
                شيك بنكي
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                الدفع بواسطة شيك بنكي
              </p>
            </div>
          </button>
        </div>

        {/* Bank Account Details Display (Active when Bank Transfer is selected) */}
        {membershipPaymentMethod === 'bank_transfer' && (
          <div className="p-3.5 sm:p-4 bg-emerald-50/70 border border-emerald-300 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="font-bold text-xs sm:text-sm text-slate-800 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>الحساب البنكي الرسمي للجمعية ({effectiveBankName}):</span>
              </span>
              {effectiveRib && (
                <button
                  type="button"
                  onClick={handleCopyRib}
                  className="flex items-center gap-1.5 text-emerald-700 hover:text-emerald-800 text-xs font-bold px-2.5 py-1 bg-white border border-emerald-300 rounded-lg shadow-xs hover:bg-emerald-50 transition-colors cursor-pointer"
                >
                  {copiedRib ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedRib ? 'تم النسخ!' : 'نسخ رقم الحساب (RIB)'}</span>
                </button>
              )}
            </div>

            {/* Official Monospace RIB Box */}
            <div className="font-mono font-bold text-slate-900 text-sm sm:text-base bg-white p-2.5 sm:p-3 rounded-lg border border-emerald-300 tracking-wider text-center select-all shadow-xs">
              {effectiveRib || 'رقم الحساب البنكي (RIB) غير مسجل حاليًا في إعدادات الجمعية'}
            </div>

            {/* Bank details grid: Account Holder Name, Bank Name, City/Office */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1 border-t border-emerald-200/80 text-slate-700">
              <div>
                <span className="font-bold text-slate-900">صاحب الحساب: </span>
                <span>{effectiveAssociationName}</span>
              </div>
              <div>
                <span className="font-bold text-slate-900">اسم البنك: </span>
                <span>{effectiveBankName}</span>
              </div>
              {effectiveLocation && (
                <div className="sm:col-span-2">
                  <span className="font-bold text-slate-900">المقر / المدينة: </span>
                  <span>{effectiveLocation}</span>
                </div>
              )}
            </div>

            <p className="text-[11px] text-emerald-800/90 leading-relaxed font-medium">
              يرجى تحويل مبلغ الانخراط إلى رقم الحساب البنكي أعلاه مع ذكر اسم المنخرط في بيان التحويل أو إرسال إشعار التحويل لإدارة الجمعية.
            </p>

            {/* إرفاق صورة إثبات الدفع (اختياري) - Optional Bank Transfer Proof Field */}
            <div className="pt-2 mt-2 border-t border-emerald-200/90 space-y-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <label className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>إرفاق صورة إثبات الدفع (اختياري)</span>
                </label>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-white text-slate-600 border border-slate-200">
                  JPG, JPEG, PNG, WEBP
                </span>
              </div>

              <p className="text-[11px] text-slate-600 leading-relaxed">
                يمكنك إرفاق صورة وصل التحويل البنكي من معرض الصور أو ملفات جهازك لتوثيق أداء واجب الانخراط، أو إتمام التسجيل مباشرة دون إرفاق صورة.
              </p>

              {/* Hidden File Picker Input - Strictly NO capture attribute so it opens File Manager / Gallery directly */}
              <input
                ref={membershipProofFileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                onChange={handleMembershipProofFileChange}
                className="hidden"
              />

              {!membershipProofImagePreview ? (
                <button
                  type="button"
                  onClick={handleOpenMembershipProofPicker}
                  disabled={isUploadingMembershipProof}
                  className="w-full py-2.5 px-4 rounded-xl border-2 border-dashed border-emerald-400 hover:border-emerald-600 bg-white hover:bg-emerald-50/70 text-emerald-700 font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                >
                  <Upload className="w-4 h-4 text-emerald-600" />
                  <span>رفع صورة</span>
                </button>
              ) : (
                <div className="space-y-2.5 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="relative rounded-lg overflow-hidden border border-slate-200 bg-slate-50 max-h-48 flex items-center justify-center">
                    <img
                      src={membershipProofImagePreview}
                      alt="معاينة إثبات الدفع"
                      className="max-h-48 w-auto object-contain mx-auto"
                    />
                    {isUploadingMembershipProof && (
                      <div className="absolute inset-0 bg-black/50 backdrop-blur-2xs flex flex-col items-center justify-center text-white text-xs font-bold gap-1.5">
                        <span>جاري حفظ الصورة... {membershipProofUploadProgress ? `${membershipProofUploadProgress}%` : ''}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                    <span className="text-[11px] text-emerald-700 font-semibold truncate flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{membershipProofFileName || 'تم إرفاق صورة إثبات الدفع'}</span>
                    </span>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={handleOpenMembershipProofPicker}
                        disabled={isUploadingMembershipProof}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>تغيير الصورة</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleRemoveMembershipProof}
                        disabled={isUploadingMembershipProof}
                        className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold flex items-center gap-1 transition cursor-pointer border border-rose-200"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>حذف الصورة</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Cash payment instructions */}
        {membershipPaymentMethod === 'cash' && (
          <div className="p-3.5 bg-emerald-50/70 border border-emerald-300 rounded-xl space-y-1.5 text-xs text-slate-800">
            <div className="font-bold text-slate-900 flex items-center gap-1.5">
              <Banknote className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>الدفع نقدًا مباشرة لدى الجمعية:</span>
            </div>
            <p className="text-[11px] text-slate-700 leading-relaxed">
              يمكنك أداء مبلغ واجب الانخراط نقدًا لدى إدارة الجمعية أو أمين المال بمقر {effectiveAssociationName} {effectiveLocation ? `(${effectiveLocation})` : ''} واستلام وصل رسمي فوري يثبت الأداء.
            </p>
          </div>
        )}

        {/* Check payment instructions */}
        {membershipPaymentMethod === 'check' && (
          <div className="p-3.5 bg-emerald-50/70 border border-emerald-300 rounded-xl space-y-1.5 text-xs text-slate-800">
            <div className="font-bold text-slate-900 flex items-center gap-1.5">
              <Receipt className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>الدفع بواسطة شيك بنكي:</span>
            </div>
            <p className="text-[11px] text-slate-700 leading-relaxed">
              يُحرر الشيك البنكي لأمر <strong className="text-slate-900 font-bold">«{effectiveAssociationName}»</strong> ويُسلم مباشرة للإدارة أو أمين المال بمقر الجمعية، ويتم تسليم وصل إيداع الشيك فورًا.
            </p>
          </div>
        )}

        {/* Informative status note */}
        <div className="p-2.5 rounded-xl bg-slate-100/90 border border-slate-200/90 text-[11px] text-slate-700 flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>
            {membershipPaymentMethod === 'bank_transfer' && 'طريقة الدفع المعتمدة: الحساب البنكي (تحويل بنكي مباشر لحساب الجمعية).'}
            {membershipPaymentMethod === 'cash' && 'طريقة الدفع المعتمدة: نقدًا (تسليم مباشر لدى الإدارة أو أمين المال مع وصل استلام).'}
            {membershipPaymentMethod === 'check' && 'طريقة الدفع المعتمدة: شيك بنكي (تحرير شيك باسم الجمعية وتسليمه للإدارة).'}
          </span>
        </div>
      </div>
    );
  };

  // Helper to render individual dynamic or standard field
  const renderField = (field: MemberRegistrationField) => {
    const label = getLocalizedFieldLabel(field);
    const placeholder = getLocalizedPlaceholder(field);
    const helpText = getLocalizedHelpText(field);

    // 1. Full Name
    if (field.id === 'fullName') {
      return (
        <div key={field.id} className="space-y-1">
          <label className="block text-xs sm:text-sm font-bold text-slate-700">
            {label} {field.required && <span className="text-rose-500">*</span>}
          </label>
          <input
            type="text"
            required={field.required}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder={placeholder || 'مثال: عبد الرحيم المرابط'}
            className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm focus:border-emerald-600 focus:bg-white outline-hidden transition-all"
          />
          {helpText && <p className="text-[11px] text-slate-400">{helpText}</p>}
        </div>
      );
    }

    // 1b. Username (اسم المستخدم)
    if (field.id === 'username') {
      const cleanVal = username.trim();
      const formatCheck = cleanVal ? validateMemberUsernameFormat(cleanVal) : null;
      const isDuplicate = cleanVal && formatCheck?.valid ? isMemberUsernameTaken(cleanVal, members || [], editingMember?.id) : false;
      const activeErr =
        usernameError ||
        (cleanVal && formatCheck && !formatCheck.valid ? formatCheck.error : null) ||
        (isDuplicate ? 'اسم المستخدم هذا مستخدم بالفعل من طرف منخرط آخر ضمن النظام المعتمد.' : null);
      const isValidUsername = Boolean(cleanVal && formatCheck?.valid && !isDuplicate && !usernameError);

      return (
        <div key={field.id} className="space-y-1">
          <label className="block text-xs sm:text-sm font-bold text-slate-700">
            {label || 'اسم المستخدم'} {field.required && <span className="text-rose-500">*</span>}
          </label>
          <div className="relative">
            <input
              type="text"
              required={field.required}
              value={username}
              onChange={(e) => {
                const val = e.target.value;
                setUsername(val);
                setUsernameError(null);
                if (validationError) setValidationError(null);
              }}
              placeholder={placeholder || 'مثال: ahmed24'}
              autoComplete="username"
              className={`w-full bg-slate-50 border ${
                activeErr
                  ? 'border-rose-400 focus:border-rose-600'
                  : isValidUsername
                  ? 'border-emerald-500 focus:border-emerald-600'
                  : 'border-slate-300 focus:border-emerald-600'
              } rounded-xl p-3 pl-9 rtl:pl-4 rtl:pr-9 text-sm focus:bg-white outline-hidden transition-all`}
            />
            <User className="w-4 h-4 text-slate-400 absolute top-3.5 right-3 ltr:right-auto ltr:left-3 pointer-events-none" />
          </div>
          <p className="text-[11px] font-medium text-slate-500">
            يجب أن يتكون اسم المستخدم من 4 حروف على الأقل ورقمين على الأقل، ويجب الجمع بين الحروف والأرقام.
          </p>
          {activeErr && (
            <p className="text-[11px] font-bold text-rose-600 flex items-center gap-1 mt-0.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{activeErr}</span>
            </p>
          )}
          {isValidUsername && (
            <p className="text-[11px] font-bold text-emerald-600 flex items-center gap-1 mt-0.5">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>اسم المستخدم صالح ومتاح للاستخدام</span>
            </p>
          )}
        </div>
      );
    }

    // 2. Member Code
    if (field.id === 'memberCode') {
      return (
        <div key={field.id} className="space-y-1">
          <label className="block text-xs sm:text-sm font-bold text-slate-700">
            {label} {field.required && <span className="text-rose-500">*</span>}
          </label>
          <input
            type="text"
            required={field.required}
            value={memberCode}
            onChange={(e) => setMemberCode(e.target.value)}
            placeholder={placeholder || 'ACH-009'}
            className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm font-mono font-bold focus:border-emerald-600 focus:bg-white outline-hidden transition-all"
          />
          {helpText && <p className="text-[11px] text-slate-400">{helpText}</p>}
        </div>
      );
    }

    // 3. Annual Fee
    if (field.id === 'annualFee') {
      return (
        <div key={field.id} className="space-y-1">
          <label className="block text-xs sm:text-sm font-bold text-slate-700">
            {label} {field.required && <span className="text-rose-500">*</span>}
          </label>
          <div className="relative">
            <input
              type="number"
              required={field.required}
              min="0"
              value={annualFee}
              onChange={(e) => setAnnualFee(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder={placeholder || '1000'}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm font-mono font-bold focus:border-emerald-600 focus:bg-white outline-hidden transition-all"
            />
            <span className="absolute top-3 left-3 rtl:left-auto rtl:right-3 text-xs font-semibold text-slate-400 pointer-events-none">
              {t.currencyShort}
            </span>
          </div>
          {helpText && <p className="text-[11px] text-slate-400">{helpText}</p>}
        </div>
      );
    }

    // 4. Status
    if (field.id === 'status') {
      return (
        <div key={field.id} className="space-y-1">
          <label className="block text-xs sm:text-sm font-bold text-slate-700">
            {label} {field.required && <span className="text-rose-500">*</span>}
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as MemberStatus)}
            className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm focus:border-emerald-600 focus:bg-white outline-hidden transition-all"
          >
            <option value="active">{t.statusActive}</option>
            <option value="pending">{t.statusPending}</option>
            <option value="inactive">{t.statusInactive}</option>
            <option value="honorary">{t.statusHonorary}</option>
          </select>
          {helpText && <p className="text-[11px] text-slate-400">{helpText}</p>}
        </div>
      );
    }

    // 5. Phone
    if (field.id === 'phone') {
      return (
        <div key={field.id} className="space-y-1">
          <label className="block text-xs sm:text-sm font-bold text-slate-700">
            {label} {field.required && <span className="text-rose-500">*</span>}
          </label>
          <div className="relative">
            <input
              type="tel"
              required={field.required}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={placeholder || '0661234567'}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm font-mono focus:border-emerald-600 focus:bg-white outline-hidden transition-all"
            />
            <Phone className="w-4 h-4 text-slate-400 absolute top-3.5 left-3 rtl:left-auto rtl:right-3 pointer-events-none" />
          </div>
          {helpText && <p className="text-[11px] text-slate-400">{helpText}</p>}
        </div>
      );
    }

    // 5b. Password (كلمة المرور)
    if (field.id === 'password') {
      const isReq = !editingMember ? Boolean(field.required) : false;
      return (
        <div key={field.id} className="space-y-1">
          <label className="block text-xs sm:text-sm font-bold text-slate-700">
            {label} {isReq && <span className="text-rose-500">*</span>}
            {editingMember && (
              <span className="text-[11px] font-normal text-slate-400 mr-1.5">
                (اتركه فارغًا للإبقاء على كلمة المرور الحالية)
              </span>
            )}
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              required={isReq}
              value={password}
              onChange={(e) => {
                const nextVal = e.target.value;
                setPassword(nextVal);
                if (confirmPassword && nextVal !== confirmPassword) {
                  setPasswordMatchError('كلمتا المرور غير متطابقتين');
                } else {
                  setPasswordMatchError(null);
                }
              }}
              placeholder={placeholder || 'أدخل كلمة المرور الخاصة بحساب المنخرط'}
              autoComplete="new-password"
              className={`w-full bg-slate-50 border ${
                passwordMatchError ? 'border-rose-400 focus:border-rose-600' : 'border-slate-300 focus:border-emerald-600'
              } rounded-xl p-3 pl-10 rtl:pl-10 rtl:pr-9 text-sm focus:bg-white outline-hidden transition-all`}
            />
            <Lock className="w-4 h-4 text-slate-400 absolute top-3.5 right-3 ltr:right-auto ltr:left-3 pointer-events-none" />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute top-3 left-3 rtl:left-3 rtl:right-auto ltr:right-3 ltr:left-auto text-slate-400 hover:text-emerald-600 transition-colors cursor-pointer p-0.5"
              title={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {helpText && <p className="text-[11px] text-slate-400">{helpText}</p>}
        </div>
      );
    }

    // 5c. Confirm Password (تأكيد كلمة المرور)
    if (field.id === 'confirmPassword') {
      const isReq = !editingMember ? Boolean(field.required) : password.trim().length > 0;
      const isMatched = password.length > 0 && confirmPassword.length > 0 && password === confirmPassword;
      const isMismatched = confirmPassword.length > 0 && password !== confirmPassword;
      return (
        <div key={field.id} className="space-y-1">
          <label className="block text-xs sm:text-sm font-bold text-slate-700">
            {label} {isReq && <span className="text-rose-500">*</span>}
          </label>
          <div className="relative">
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              required={isReq}
              value={confirmPassword}
              onChange={(e) => {
                const nextVal = e.target.value;
                setConfirmPassword(nextVal);
                if (nextVal && password !== nextVal) {
                  setPasswordMatchError('كلمتا المرور غير متطابقتين');
                } else {
                  setPasswordMatchError(null);
                }
              }}
              placeholder={placeholder || 'أعد إدخال كلمة المرور للتأكيد'}
              autoComplete="new-password"
              className={`w-full bg-slate-50 border ${
                isMismatched || passwordMatchError
                  ? 'border-rose-400 focus:border-rose-600'
                  : isMatched
                  ? 'border-emerald-500 focus:border-emerald-600'
                  : 'border-slate-300 focus:border-emerald-600'
              } rounded-xl p-3 pl-10 rtl:pl-10 rtl:pr-9 text-sm focus:bg-white outline-hidden transition-all`}
            />
            <Lock className="w-4 h-4 text-slate-400 absolute top-3.5 right-3 ltr:right-auto ltr:left-3 pointer-events-none" />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              className="absolute top-3 left-3 rtl:left-3 rtl:right-auto ltr:right-3 ltr:left-auto text-slate-400 hover:text-emerald-600 transition-colors cursor-pointer p-0.5"
              title={showConfirmPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
            >
              {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {(isMismatched || passwordMatchError) && (
            <p className="text-[11px] font-bold text-rose-600 flex items-center gap-1 mt-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{passwordMatchError || 'كلمتا المرور غير متطابقتين'}</span>
            </p>
          )}
          {isMatched && !passwordMatchError && (
            <p className="text-[11px] font-bold text-emerald-600 flex items-center gap-1 mt-1">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>كلمتا المرور متطابقتان</span>
            </p>
          )}
          {helpText && !isMismatched && !passwordMatchError && !isMatched && (
            <p className="text-[11px] text-slate-400">{helpText}</p>
          )}
        </div>
      );
    }

    // 6. CIN
    if (field.id === 'cin') {
      return (
        <div key={field.id} className="space-y-1">
          <label className="block text-xs sm:text-sm font-bold text-slate-700">
            {label} {field.required && <span className="text-rose-500">*</span>}
          </label>
          <div className="relative">
            <input
              type="text"
              required={field.required}
              value={cin}
              onChange={(e) => setCin(e.target.value)}
              placeholder={placeholder || 'AB123456'}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm font-mono focus:border-emerald-600 focus:bg-white outline-hidden transition-all"
            />
            <CreditCard className="w-4 h-4 text-slate-400 absolute top-3.5 left-3 rtl:left-auto rtl:right-3 pointer-events-none" />
          </div>
          {helpText && <p className="text-[11px] text-slate-400">{helpText}</p>}
        </div>
      );
    }

    // 7. Join Date
    if (field.id === 'joinDate') {
      return (
        <div key={field.id} className="space-y-1">
          <label className="block text-xs sm:text-sm font-bold text-slate-700">
            {label} {field.required && <span className="text-rose-500">*</span>}
          </label>
          <input
            type="date"
            required={field.required}
            value={joinDate}
            onChange={(e) => setJoinDate(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm focus:border-emerald-600 focus:bg-white outline-hidden transition-all"
          />
          {helpText && <p className="text-[11px] text-slate-400">{helpText}</p>}
        </div>
      );
    }

    // 8. Renewal Date
    if (field.id === 'renewalDate') {
      return (
        <div key={field.id} className="space-y-1">
          <label className="block text-xs sm:text-sm font-bold text-slate-700">
            {label} {field.required && <span className="text-rose-500">*</span>}
          </label>
          <input
            type="date"
            required={field.required}
            value={renewalDate}
            onChange={(e) => setRenewalDate(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm focus:border-emerald-600 focus:bg-white outline-hidden transition-all"
          />
          {helpText && <p className="text-[11px] text-slate-400">{helpText}</p>}
        </div>
      );
    }

    // 9. Email
    if (field.id === 'email') {
      return (
        <div key={field.id} className="space-y-1">
          <label className="block text-xs sm:text-sm font-bold text-slate-700">
            {label} {field.required && <span className="text-rose-500">*</span>}
          </label>
          <div className="relative">
            <input
              type="email"
              required={field.required}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={placeholder || 'member@email.com'}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm focus:border-emerald-600 focus:bg-white outline-hidden transition-all"
            />
            <Mail className="w-4 h-4 text-slate-400 absolute top-3.5 left-3 rtl:left-auto rtl:right-3 pointer-events-none" />
          </div>
          {helpText && <p className="text-[11px] text-slate-400">{helpText}</p>}
        </div>
      );
    }

    // 10. Avatar / Profile Picture (رفع صورة المنخرط من الهاتف أو المعرض)
    if (field.id === 'avatarUrl') {
      return (
        <div key={field.id} className="space-y-2.5 p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200">
          <div className="flex items-center justify-between">
            <label className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-emerald-600" />
              <span>{label}</span> {field.required && <span className="text-rose-500">*</span>}
            </label>
            <span className="text-[11px] text-slate-500 flex items-center gap-1 font-medium">
              <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
              <span>معرض الهاتف / الكاميرا</span>
            </span>
          </div>

          {/* Hidden Native File Input for Mobile Gallery / Camera / Device Files */}
          <input
            type="file"
            ref={avatarFileInputRef}
            accept="image/jpeg,image/png,image/webp,image/gif,image/*"
            onChange={handleAvatarFileSelected}
            className="hidden"
            id="member-avatar-file-input"
          />

          {/* Active Preview View (when avatarUrl is present) */}
          {avatarUrl ? (
            <div className="p-3 bg-white rounded-xl border border-emerald-200 shadow-xs flex flex-col sm:flex-row items-center gap-4">
              <div className="relative group shrink-0">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border-2 border-emerald-500 shadow-md bg-slate-100">
                  <img
                    src={avatarUrl}
                    alt={fullName || 'Member Avatar'}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="absolute -bottom-1 -right-1 bg-emerald-600 text-white p-1 rounded-full shadow-xs">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
              </div>

              <div className="flex-1 text-center sm:text-right rtl:sm:text-right ltr:sm:text-left space-y-2 w-full">
                <div>
                  <div className="flex items-center justify-center sm:justify-start gap-1.5 text-xs font-bold text-emerald-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>{t.memberPhotoPreview || 'تم تجهيز ومعاينة صورة المنخرط'}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {t.photoSelectedSuccess || 'الصورة محسنة ومحفوظة بدقة عالية ومناسبة للبطاقة والوصل.'}
                  </p>
                </div>

                <div className="flex items-center justify-center sm:justify-start gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => avatarFileInputRef.current?.click()}
                    disabled={isProcessingAvatar}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>{t.changeMemberPhoto || 'تغيير الصورة'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAvatarUrl('');
                      setAvatarUploadSuccess(false);
                      setAvatarUploadError(null);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{t.removeMemberPhoto || 'حذف الصورة'}</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Upload Action Box (when no avatar is selected) */
            <div
              onClick={() => !isProcessingAvatar && avatarFileInputRef.current?.click()}
              className={`p-4 sm:p-5 rounded-xl border-2 border-dashed transition-all cursor-pointer text-center group ${
                isProcessingAvatar
                  ? 'bg-emerald-50/50 border-emerald-300 pointer-events-none'
                  : 'bg-white hover:bg-emerald-50/40 border-slate-300 hover:border-emerald-500 shadow-xs'
              }`}
            >
              <div className="flex flex-col items-center justify-center gap-2">
                <div className="w-12 h-12 rounded-full bg-emerald-100/70 text-emerald-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                  {isProcessingAvatar ? (
                    <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <UploadCloud className="w-6 h-6" />
                  )}
                </div>

                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-800 group-hover:text-emerald-700 transition-colors">
                    {isProcessingAvatar
                      ? 'جارٍ ضغط ومعالجة الصورة من الهاتف...'
                      : t.chooseMemberPhoto || 'اضغط هنا لرفع صورة المنخرط من الهاتف أو المعرض'}
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
                    {helpText || t.memberPhotoHelp || 'يدعم اختيار الصور من معرض الهاتف، الكاميرا، أو الملفات (JPG, PNG, WebP) مع تحسين تلقائي للحفظ الدائم.'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    avatarFileInputRef.current?.click();
                  }}
                  className="mt-1 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>{t.uploadMemberPhoto || 'رفع صورة من الهاتف / الجهاز'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Feedback & Alerts */}
          {avatarUploadError && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{avatarUploadError}</span>
            </div>
          )}

          {avatarUploadSuccess && (
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{t.photoSelectedSuccess || 'تم تحميل ومعالجة صورة المنخرط بنجاح وبأعلى جودة.'}</span>
            </div>
          )}

          {/* Quick Presets Options as Alternative */}
          <div className="pt-1 border-t border-slate-200/80">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>{t.orChoosePresetAvatar || 'أو اختر صورة رمزية جاهزة:'}</span>
              </span>

              <div className="flex items-center gap-1.5">
                {presetAvatars.map((url, idx) => (
                  <button
                    key={idx}
                    type="button"
                    title={`نموذج ${idx + 1}`}
                    onClick={() => {
                      setAvatarUrl(url);
                      setAvatarUploadError(null);
                      setAvatarUploadSuccess(true);
                      setTimeout(() => setAvatarUploadSuccess(false), 3000);
                    }}
                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden border-2 transition-all hover:scale-110 ${
                      avatarUrl === url
                        ? 'border-emerald-600 ring-2 ring-emerald-400'
                        : 'border-slate-200 hover:border-emerald-400 opacity-80 hover:opacity-100'
                    }`}
                  >
                    <img src={url} alt={`Preset ${idx}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    }

    // 11. Privacy Toggle
    if (field.id === 'isAnonymousInPublic') {
      return (
        <div key={field.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-2.5">
          <input
            type="checkbox"
            id="isAnonModal"
            checked={isAnonymousInPublic}
            onChange={(e) => setIsAnonymousInPublic(e.target.checked)}
            className="w-4 h-4 mt-0.5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
          />
          <label htmlFor="isAnonModal" className="text-xs text-slate-700">
            <span className="font-bold block text-slate-900">{label}</span>
            {helpText ||
              'حجب الاسم العلني في قائمة الشفافية العامة وعرضه كـ "فاعل خير / مساهم معفى" مع حفظ البيانات للإدارة.'}
          </label>
        </div>
      );
    }

    // 12. Notes (ملاحظات ومعلومات إضافية)
    if (field.id === 'notes') {
      return (
        <div key={field.id} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-xs sm:text-sm font-bold text-slate-700">
              {label} {field.required && <span className="text-rose-500">*</span>}
            </label>
            <textarea
              rows={2}
              required={field.required}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={placeholder || 'مهام العضو، مساهمات سابقة، ملاحظات إدارية...'}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm focus:border-emerald-600 focus:bg-white outline-hidden transition-all"
            />
            {helpText && <p className="text-[11px] text-slate-400">{helpText}</p>}
          </div>

          {/* قسم طريقة دفع واجب الانخراط مباشرة أسفل حقل ملاحظات ومعلومات إضافية */}
          {renderPaymentMethodSection()}
        </div>
      );
    }

    // ---------------- CUSTOM DYNAMIC FIELDS ----------------
    const customValue = customFieldValues[field.id] || '';

    const handleCustomChange = (val: any) => {
      setCustomFieldValues((prev) => ({
        ...prev,
        [field.id]: val,
      }));
    };

    if (field.type === 'text') {
      return (
        <div key={field.id} className="space-y-1">
          <label className="block text-xs sm:text-sm font-bold text-slate-700">
            {label} {field.required && <span className="text-rose-500">*</span>}
          </label>
          <input
            type="text"
            required={field.required}
            value={customValue}
            onChange={(e) => handleCustomChange(e.target.value)}
            placeholder={placeholder || `أدخل ${label}...`}
            className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm focus:border-emerald-600 focus:bg-white outline-hidden transition-all"
          />
          {helpText && <p className="text-[11px] text-slate-400">{helpText}</p>}
        </div>
      );
    }

    if (field.type === 'phone') {
      return (
        <div key={field.id} className="space-y-1">
          <label className="block text-xs sm:text-sm font-bold text-slate-700">
            {label} {field.required && <span className="text-rose-500">*</span>}
          </label>
          <div className="relative">
            <input
              type="tel"
              required={field.required}
              value={customValue}
              onChange={(e) => handleCustomChange(e.target.value)}
              placeholder={placeholder || '0600000000'}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm font-mono focus:border-emerald-600 focus:bg-white outline-hidden transition-all"
            />
            <Phone className="w-4 h-4 text-slate-400 absolute top-3.5 left-3 rtl:left-auto rtl:right-3 pointer-events-none" />
          </div>
          {helpText && <p className="text-[11px] text-slate-400">{helpText}</p>}
        </div>
      );
    }

    if (field.type === 'email') {
      return (
        <div key={field.id} className="space-y-1">
          <label className="block text-xs sm:text-sm font-bold text-slate-700">
            {label} {field.required && <span className="text-rose-500">*</span>}
          </label>
          <div className="relative">
            <input
              type="email"
              required={field.required}
              value={customValue}
              onChange={(e) => handleCustomChange(e.target.value)}
              placeholder={placeholder || 'user@example.com'}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm focus:border-emerald-600 focus:bg-white outline-hidden transition-all"
            />
            <Mail className="w-4 h-4 text-slate-400 absolute top-3.5 left-3 rtl:left-auto rtl:right-3 pointer-events-none" />
          </div>
          {helpText && <p className="text-[11px] text-slate-400">{helpText}</p>}
        </div>
      );
    }

    if (field.type === 'number') {
      return (
        <div key={field.id} className="space-y-1">
          <label className="block text-xs sm:text-sm font-bold text-slate-700">
            {label} {field.required && <span className="text-rose-500">*</span>}
          </label>
          <input
            type="number"
            required={field.required}
            value={customValue}
            onChange={(e) => handleCustomChange(e.target.value)}
            placeholder={placeholder || '0'}
            className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm font-mono focus:border-emerald-600 focus:bg-white outline-hidden transition-all"
          />
          {helpText && <p className="text-[11px] text-slate-400">{helpText}</p>}
        </div>
      );
    }

    if (field.type === 'date') {
      return (
        <div key={field.id} className="space-y-1">
          <label className="block text-xs sm:text-sm font-bold text-slate-700">
            {label} {field.required && <span className="text-rose-500">*</span>}
          </label>
          <input
            type="date"
            required={field.required}
            value={customValue}
            onChange={(e) => handleCustomChange(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm focus:border-emerald-600 focus:bg-white outline-hidden transition-all"
          />
          {helpText && <p className="text-[11px] text-slate-400">{helpText}</p>}
        </div>
      );
    }

    if (field.type === 'select') {
      return (
        <div key={field.id} className="space-y-1">
          <label className="block text-xs sm:text-sm font-bold text-slate-700">
            {label} {field.required && <span className="text-rose-500">*</span>}
          </label>
          <select
            required={field.required}
            value={customValue}
            onChange={(e) => handleCustomChange(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm focus:border-emerald-600 focus:bg-white outline-hidden transition-all"
          >
            <option value="">-- اختر {label} --</option>
            {field.options?.map((opt, i) => (
              <option key={i} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          {helpText && <p className="text-[11px] text-slate-400">{helpText}</p>}
        </div>
      );
    }

    if (field.type === 'checkbox') {
      return (
        <div key={field.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-2.5">
          <input
            type="checkbox"
            id={`chk_${field.id}`}
            checked={!!customValue}
            onChange={(e) => handleCustomChange(e.target.checked)}
            className="w-4 h-4 mt-0.5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
          />
          <label htmlFor={`chk_${field.id}`} className="text-xs text-slate-700">
            <span className="font-bold block text-slate-900">{label}</span>
            {helpText && <span className="text-slate-500">{helpText}</span>}
          </label>
        </div>
      );
    }

    if (field.type === 'file') {
      return (
        <div key={field.id} className="space-y-1.5">
          <label className="block text-xs sm:text-sm font-bold text-slate-700">
            {label} {field.required && <span className="text-rose-500">*</span>}
          </label>
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={customValue}
              onChange={(e) => handleCustomChange(e.target.value)}
              placeholder={placeholder || 'رابط الملف / الصورة أو اضغط لاختيار ملف'}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs sm:text-sm focus:border-emerald-600 focus:bg-white outline-hidden transition-all"
            />
            <label className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold whitespace-nowrap cursor-pointer transition-colors shrink-0">
              <span>اختيار ملف</span>
              <input
                type="file"
                className="hidden"
                onChange={(e) => handleFileUpload(e, field.id)}
              />
            </label>
          </div>
          {helpText && <p className="text-[11px] text-slate-400">{helpText}</p>}
        </div>
      );
    }

    if (field.type === 'textarea') {
      return (
        <div key={field.id} className="space-y-1">
          <label className="block text-xs sm:text-sm font-bold text-slate-700">
            {label} {field.required && <span className="text-rose-500">*</span>}
          </label>
          <textarea
            rows={2}
            required={field.required}
            value={customValue}
            onChange={(e) => handleCustomChange(e.target.value)}
            placeholder={placeholder || `اكتب ${label}...`}
            className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm focus:border-emerald-600 focus:bg-white outline-hidden transition-all"
          />
          {helpText && <p className="text-[11px] text-slate-400">{helpText}</p>}
        </div>
      );
    }

    return null;
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
        <div className={`flex items-center justify-between p-5 text-white ${
          isPublicRegistration 
            ? 'bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800' 
            : 'bg-slate-900'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              isPublicRegistration ? 'bg-white/15 text-white' : 'bg-slate-800 text-emerald-400'
            }`}>
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base sm:text-lg">
                  {editingMember ? t.editMember : (isPublicRegistration ? 'تسجيل منخرط جديد' : t.addMember)}
                </h3>
                {isPublicRegistration && (
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/25 border border-emerald-400/30 text-[11px] font-bold text-emerald-100">
                    استمارة معتمدة
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300">
                {isPublicRegistration 
                  ? (associationName ? `طلب انخراط رسمي لدى ${associationName}` : 'يرجى إدخال البيانات الرسمية للانضمام إلى الجمعية')
                  : (editingMember ? 'تعديل السجل الإداري للمنخرط' : 'إضافة منخرط جديد إلى قاعدة بيانات الجمعية')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dynamic Fields Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Validation Error Banner */}
          {validationError && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm font-semibold flex items-center gap-2.5 shadow-xs"
            >
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
              <span className="flex-1">{validationError}</span>
              <button
                type="button"
                onClick={() => setValidationError(null)}
                className="text-rose-400 hover:text-rose-600 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {/* Render All Active Configured Fields in Exact Order */}
          {activeFields.map((field) => renderField(field))}

          {/* ضمان ظهور قسم طريقة دفع واجب الانخراط في حال كان حقل الملاحظات غير مفعّل في الإعدادات */}
          {!activeFields.some((f) => f.id === 'notes') && renderPaymentMethodSection()}

          {/* Submit Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t border-slate-200">
            {isPublicRegistration && onOpenLoginModal ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenLoginModal();
                }}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline text-center sm:text-right cursor-pointer"
              >
                لديك حساب بالفعل في الجمعية؟ تسجيل الدخول
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-medium text-sm hover:bg-slate-50 transition-colors cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-sm shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>جارٍ حفظ البيانات...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isPublicRegistration ? 'تأكيد وإرسال طلب الانخراط' : t.save}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
