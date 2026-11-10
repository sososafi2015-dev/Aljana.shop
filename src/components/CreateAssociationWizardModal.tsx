import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  ArrowRight, 
  ArrowLeft, 
  User, 
  Phone, 
  Lock, 
  Eye, 
  EyeOff, 
  Building2, 
  MapPin, 
  Globe, 
  CheckCircle2, 
  Sparkles, 
  AlertCircle,
  ShieldCheck,
  ChevronDown,
  Search,
  Check,
  UploadCloud,
  FileText,
  Image as ImageIcon,
  Trash2,
  Paperclip,
  Download,
  RefreshCw,
  CreditCard,
  Clock
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  createAssociationPlatform,
  CreateAssociationInput,
  validateOwnerUsernameFormat,
  isOwnerUsernameTaken,
  checkOwnerUsernameAvailability,
} from '../tenantStorage';
import { calculateTenantFee } from '../paymentStorage';
import { AssociationTenant, AssociationLegalDocument } from '../types';
import { 
  apiFetchCitiesForCountry, 
  isCityValidForCountry, 
  searchCitiesInCountry, 
  getCitiesForCountry, 
  CityInfo 
} from '../api/geoApi';
import { uploadImageToServer } from '../api/imageApi';
import { optimizeInvoiceImage } from '../utils/documentOptimizer';

export interface CountryDialCode {
  id: string;
  name: string;
  code: string;
  flag: string;
  placeholder: string;
  minDigits: number;
  maxDigits: number;
  validator?: (digits: string) => boolean;
}

export const COUNTRIES_LIST: CountryDialCode[] = [
  {
    id: 'MA',
    name: 'المغرب',
    code: '+212',
    flag: '🇲🇦',
    placeholder: '+212 6 XX XX XX XX',
    minDigits: 9,
    maxDigits: 9,
    validator: (d) => /^[567]\d{8}$/.test(d),
  },
  {
    id: 'DZ',
    name: 'الجزائر',
    code: '+213',
    flag: '🇩🇿',
    placeholder: '+213 5/6/7 XX XX XX XX',
    minDigits: 9,
    maxDigits: 9,
    validator: (d) => /^[567]\d{8}$/.test(d),
  },
  {
    id: 'TN',
    name: 'تونس',
    code: '+216',
    flag: '🇹🇳',
    placeholder: '+216 XX XX XX XX',
    minDigits: 8,
    maxDigits: 8,
  },
  {
    id: 'MR',
    name: 'موريتانيا',
    code: '+222',
    flag: '🇲🇷',
    placeholder: '+222 XX XX XX XX',
    minDigits: 8,
    maxDigits: 8,
  },
  {
    id: 'LY',
    name: 'ليبيا',
    code: '+218',
    flag: '🇱🇾',
    placeholder: '+218 9X XXX XXXX',
    minDigits: 9,
    maxDigits: 9,
  },
  {
    id: 'EG',
    name: 'مصر',
    code: '+20',
    flag: '🇪🇬',
    placeholder: '+20 1X XXXX XXXX',
    minDigits: 10,
    maxDigits: 10,
  },
  {
    id: 'SA',
    name: 'السعودية',
    code: '+966',
    flag: '🇸🇦',
    placeholder: '+966 5X XXX XXXX',
    minDigits: 9,
    maxDigits: 9,
  },
  {
    id: 'AE',
    name: 'الإمارات',
    code: '+971',
    flag: '🇦🇪',
    placeholder: '+971 5X XXX XXXX',
    minDigits: 9,
    maxDigits: 9,
  },
  {
    id: 'QA',
    name: 'قطر',
    code: '+974',
    flag: '🇶🇦',
    placeholder: '+974 XX XXX XXX',
    minDigits: 8,
    maxDigits: 8,
  },
  {
    id: 'KW',
    name: 'الكويت',
    code: '+965',
    flag: '🇰🇼',
    placeholder: '+965 XX XXX XXX',
    minDigits: 8,
    maxDigits: 8,
  },
  {
    id: 'BH',
    name: 'البحرين',
    code: '+973',
    flag: '🇧🇭',
    placeholder: '+973 XX XXX XXX',
    minDigits: 8,
    maxDigits: 8,
  },
  {
    id: 'OM',
    name: 'عُمان',
    code: '+968',
    flag: '🇴🇲',
    placeholder: '+968 9X XXX XXX',
    minDigits: 8,
    maxDigits: 8,
  },
  {
    id: 'JO',
    name: 'الأردن',
    code: '+962',
    flag: '🇯🇴',
    placeholder: '+962 7X XXX XXXX',
    minDigits: 9,
    maxDigits: 9,
  },
  {
    id: 'LB',
    name: 'لبنان',
    code: '+961',
    flag: '🇱🇧',
    placeholder: '+961 XX XXX XXX',
    minDigits: 8,
    maxDigits: 8,
  },
  {
    id: 'IQ',
    name: 'العراق',
    code: '+964',
    flag: '🇮🇶',
    placeholder: '+964 7XX XXX XXXX',
    minDigits: 10,
    maxDigits: 10,
  },
  {
    id: 'PS',
    name: 'فلسطين',
    code: '+970',
    flag: '🇵🇸',
    placeholder: '+970 5X XXX XXXX',
    minDigits: 9,
    maxDigits: 9,
  },
  {
    id: 'SD',
    name: 'السودان',
    code: '+249',
    flag: '🇸🇩',
    placeholder: '+249 9X XXX XXXX',
    minDigits: 9,
    maxDigits: 9,
  },
  {
    id: 'YE',
    name: 'اليمن',
    code: '+967',
    flag: '🇾🇪',
    placeholder: '+967 7XX XXX XXX',
    minDigits: 9,
    maxDigits: 9,
  },
  {
    id: 'FR',
    name: 'فرنسا',
    code: '+33',
    flag: '🇫🇷',
    placeholder: '+33 6/7 XX XX XX XX',
    minDigits: 9,
    maxDigits: 9,
  },
  {
    id: 'ES',
    name: 'إسبانيا',
    code: '+34',
    flag: '🇪🇸',
    placeholder: '+34 6/7XX XXX XXX',
    minDigits: 9,
    maxDigits: 9,
  },
  {
    id: 'IT',
    name: 'إيطاليا',
    code: '+39',
    flag: '🇮🇹',
    placeholder: '+39 3XX XXX XXXX',
    minDigits: 10,
    maxDigits: 10,
  },
  {
    id: 'BE',
    name: 'بلجيكا',
    code: '+32',
    flag: '🇧🇪',
    placeholder: '+32 4XX XX XX XX',
    minDigits: 9,
    maxDigits: 9,
  },
  {
    id: 'DE',
    name: 'ألمانيا',
    code: '+49',
    flag: '🇩🇪',
    placeholder: '+49 15X XXXXXXX',
    minDigits: 10,
    maxDigits: 11,
  },
  {
    id: 'NL',
    name: 'هولندا',
    code: '+31',
    flag: '🇳🇱',
    placeholder: '+31 6 XX XX XX XX',
    minDigits: 9,
    maxDigits: 9,
  },
  {
    id: 'GB',
    name: 'المملكة المتحدة',
    code: '+44',
    flag: '🇬🇧',
    placeholder: '+44 7XXX XXXXXX',
    minDigits: 10,
    maxDigits: 10,
  },
  {
    id: 'US',
    name: 'الولايات المتحدة',
    code: '+1',
    flag: '🇺🇸',
    placeholder: '+1 (XXX) XXX-XXXX',
    minDigits: 10,
    maxDigits: 10,
  },
  {
    id: 'CA',
    name: 'كندا',
    code: '+1',
    flag: '🇨🇦',
    placeholder: '+1 (XXX) XXX-XXXX',
    minDigits: 10,
    maxDigits: 10,
  },
  {
    id: 'TR',
    name: 'تركيا',
    code: '+90',
    flag: '🇹🇷',
    placeholder: '+90 5XX XXX XXXX',
    minDigits: 10,
    maxDigits: 10,
  },
  {
    id: 'CH',
    name: 'سويسرا',
    code: '+41',
    flag: '🇨🇭',
    placeholder: '+41 7X XXX XX XX',
    minDigits: 9,
    maxDigits: 9,
  },
  {
    id: 'SE',
    name: 'السويد',
    code: '+46',
    flag: '🇸🇪',
    placeholder: '+46 7X XXX XX XX',
    minDigits: 9,
    maxDigits: 9,
  },
];

export function getCountryFlag(countryName: string): string {
  if (!countryName) return '🇲🇦';
  const clean = countryName.trim().toLowerCase();
  const match = COUNTRIES_LIST.find(
    c => c.name.toLowerCase() === clean || c.id.toLowerCase() === clean
  );
  return match ? match.flag : '🌐';
}

interface CreateAssociationWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAssociationCreated: (tenant: AssociationTenant) => void;
}

export const CreateAssociationWizardModal: React.FC<CreateAssociationWizardModalProps> = ({
  isOpen,
  onClose,
  onAssociationCreated,
}) => {
  // Stage tracking: 1 | 2 | 3
  const [stage, setStage] = useState<1 | 2 | 3>(1);

  // Form inputs
  const [ownerFullName, setOwnerFullName] = useState('');
  const [ownerUsername, setOwnerUsername] = useState('');
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<CountryDialCode>(COUNTRIES_LIST[0]);
  const [rawPhoneNumber, setRawPhoneNumber] = useState('');
  const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);
  const [countrySearchQuery, setCountrySearchQuery] = useState('');
  const countryDropdownRef = useRef<HTMLDivElement>(null);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [associationName, setAssociationName] = useState('');
  const [associationNameFr, setAssociationNameFr] = useState('');
  const [country, setCountry] = useState('المغرب');
  const [isStep2CountryDropdownOpen, setIsStep2CountryDropdownOpen] = useState(false);
  const [step2CountrySearchQuery, setStep2CountrySearchQuery] = useState('');
  const step2CountryDropdownRef = useRef<HTMLDivElement>(null);
  const [city, setCity] = useState('');
  const [citiesList, setCitiesList] = useState<CityInfo[]>(() => getCitiesForCountry('المغرب'));
  const [isLoadingCities, setIsLoadingCities] = useState(false);
  const [citiesError, setCitiesError] = useState<string | null>(null);
  const [isCityDropdownOpen, setIsCityDropdownOpen] = useState(false);
  const [citySearchQuery, setCitySearchQuery] = useState('');
  const cityDropdownRef = useRef<HTMLDivElement>(null);

  // Legal Document state (Step 2: رفع وثيقة تثبت ترخيص الجمعية)
  const [legalDocument, setLegalDocument] = useState<AssociationLegalDocument | null>(null);
  const [legalDocUploadError, setLegalDocUploadError] = useState<string | null>(null);
  const [legalDocUploadSuccess, setLegalDocUploadSuccess] = useState<string | null>(null);
  const [isUploadingLegalDoc, setIsUploadingLegalDoc] = useState(false);
  const [isLegalDocDragOver, setIsLegalDocDragOver] = useState(false);
  const [previewingLegalDoc, setPreviewingLegalDoc] = useState<AssociationLegalDocument | null>(null);
  const legalDocGalleryInputRef = useRef<HTMLInputElement>(null);

  // Storage key for keeping draft intact across refresh or session toggles
  const WIZARD_DRAFT_KEY = 'chayef_assoc_wizard_draft_v2';

  // Restore draft on mount if available
  useEffect(() => {
    try {
      const raw = localStorage.getItem(WIZARD_DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft.legalDocument && !legalDocument) setLegalDocument(draft.legalDocument);
        if (draft.ownerFullName && !ownerFullName) setOwnerFullName(draft.ownerFullName);
        if (draft.ownerUsername && !ownerUsername) setOwnerUsername(draft.ownerUsername);
        if (draft.rawPhoneNumber && !rawPhoneNumber) setRawPhoneNumber(draft.rawPhoneNumber);
        if (draft.associationName && !associationName) setAssociationName(draft.associationName);
        if (draft.associationNameFr && !associationNameFr) setAssociationNameFr(draft.associationNameFr);
        if (draft.country && !country) setCountry(draft.country);
        if (draft.city && !city) setCity(draft.city);
        if (draft.stage && draft.stage > 1) setStage(draft.stage);
      }
    } catch {}
  }, []);

  // Sync draft to localStorage so user doesn't lose inputs or document if page reloads
  useEffect(() => {
    if (legalDocument || associationName || city || ownerFullName || ownerUsername) {
      try {
        const safeLegalDoc =
          legalDocument && legalDocument.fileUrl && legalDocument.fileUrl.startsWith('data:') && legalDocument.fileUrl.length > 150000
            ? { ...legalDocument, fileUrl: '' }
            : legalDocument;
        const draft = {
          legalDocument: safeLegalDoc,
          ownerFullName,
          ownerUsername,
          rawPhoneNumber,
          associationName,
          associationNameFr,
          country,
          city,
          stage,
        };
        localStorage.setItem(WIZARD_DRAFT_KEY, JSON.stringify(draft));
      } catch {}
    }
  }, [legalDocument, ownerFullName, ownerUsername, rawPhoneNumber, associationName, associationNameFr, country, city, stage]);

  // Load cities automatically whenever the selected country changes (Requirement 1, 3, 6)
  useEffect(() => {
    let isActive = true;
    setIsLoadingCities(true);
    setCitiesError(null);

    apiFetchCitiesForCountry(country)
      .then((res) => {
        if (!isActive) return;
        setCitiesList(res.cities || []);
        setIsLoadingCities(false);
        if ((!res.cities || res.cities.length === 0) && !res.success) {
          setCitiesError(res.error || 'تعذر تحميل قائمة المدن لهذه الدولة.');
        }
      })
      .catch((err) => {
        if (!isActive) return;
        console.warn('Cities API failed, falling back to local geo database:', err);
        const fallback = getCitiesForCountry(country);
        setCitiesList(fallback);
        setIsLoadingCities(false);
        if (fallback.length === 0) {
          setCitiesError('تعذر تحميل قائمة المدن لهذه الدولة حالياً.');
        }
      });

    return () => {
      isActive = false;
    };
  }, [country]);

  // Validation errors
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Close country & city dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(event.target as Node)) {
        setIsCountryDropdownOpen(false);
      }
      if (step2CountryDropdownRef.current && !step2CountryDropdownRef.current.contains(event.target as Node)) {
        setIsStep2CountryDropdownOpen(false);
      }
      if (cityDropdownRef.current && !cityDropdownRef.current.contains(event.target as Node)) {
        setIsCityDropdownOpen(false);
      }
    };
    if (isCountryDropdownOpen || isStep2CountryDropdownOpen || isCityDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isCountryDropdownOpen, isStep2CountryDropdownOpen, isCityDropdownOpen]);

  // Format full international phone number
  const formatFullPhone = (c: CountryDialCode, digits: string): string => {
    if (!digits) return '';
    if (c.id === 'MA') {
      if (digits.length === 9) {
        return `${c.code} ${digits[0]} ${digits.slice(1, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 7)} ${digits.slice(7, 9)}`;
      }
      return `${c.code} ${digits}`;
    }
    return `${c.code} ${digits}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;

    // Handle user pasting with '+' or international prefix e.g. +212 or 00212
    const cleanDial = selectedCountry.code.replace('+', '');
    if (val.startsWith('+') || val.startsWith('00')) {
      val = val.replace(/^\+/, '').replace(/^00/, '');
      if (val.startsWith(cleanDial)) {
        val = val.substring(cleanDial.length);
      }
    }

    // Strictly keep digits only
    let digits = val.replace(/\D/g, '');

    // For Morocco (+212) or other countries where local numbers start with 0 (e.g. 06...), strip leading zero
    if ((selectedCountry.id === 'MA' || selectedCountry.id === 'FR' || selectedCountry.id === 'DZ') && digits.startsWith('0')) {
      digits = digits.substring(1);
    }

    // Truncate to max digits
    if (selectedCountry.maxDigits && digits.length > selectedCountry.maxDigits) {
      digits = digits.slice(0, selectedCountry.maxDigits);
    }

    setRawPhoneNumber(digits);
  };

  const handleSelectCountry = (c: CountryDialCode) => {
    setSelectedCountry(c);
    setIsCountryDropdownOpen(false);
    setCountrySearchQuery('');
    // If phone number had leading 0 and switched to Morocco or France, clean it
    if ((c.id === 'MA' || c.id === 'FR' || c.id === 'DZ') && rawPhoneNumber.startsWith('0')) {
      setRawPhoneNumber(rawPhoneNumber.substring(1));
    }
  };

  const filteredCountries = COUNTRIES_LIST.filter(c => {
    const q = countrySearchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      c.code.includes(q) ||
      c.id.toLowerCase().includes(q)
    );
  });

  const filteredStep2Countries = COUNTRIES_LIST.filter(c => {
    const q = step2CountrySearchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      c.id.toLowerCase().includes(q)
    );
  });

  const handleSelectStep2Country = (countryName: string) => {
    if (countryName !== country) {
      setCountry(countryName);
      setCity(''); // Clear previously selected city when country changes (Requirement 3)
      setCitySearchQuery('');
      setIsCityDropdownOpen(true); // Automatically open city dropdown for seamless user experience
    }
    setIsStep2CountryDropdownOpen(false);
    setStep2CountrySearchQuery('');
  };

  if (!isOpen) return null;

  // Validation for Stage 1
  const handleProceedStage1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!ownerFullName.trim()) {
      setError('يرجى إدخال الاسم الكامل لصاحب ومسؤول الجمعية.');
      return;
    }

    const usernameValidation = validateOwnerUsernameFormat(ownerUsername);
    if (!usernameValidation.valid) {
      setError(usernameValidation.error || 'يجب أن يتكون اسم المستخدم من 4 حروف على الأقل ورقمين على الأقل، ويجب الجمع بين الحروف والأرقام.');
      return;
    }

    if (isOwnerUsernameTaken(ownerUsername)) {
      setError('اسم المستخدم هذا مستخدم بالفعل لجمعية أخرى. يرجى اختيار اسم مستخدم فريد.');
      return;
    }

    const cleanDigits = rawPhoneNumber.replace(/\D/g, '');
    if (!cleanDigits) {
      setError('يرجى إدخال رقم الهاتف.');
      return;
    }

    if (selectedCountry.id === 'MA') {
      if (cleanDigits.length !== 9 || !/^[567]/.test(cleanDigits)) {
        setError('يرجى إدخال رقم هاتف مغربي صالح مكون من 9 أرقام يبدأ بـ 6 أو 7 أو 5 (مثال: 612345678).');
        return;
      }
    } else if (selectedCountry.validator) {
      if (!selectedCountry.validator(cleanDigits)) {
        setError(`يرجى إدخال رقم هاتف صالح لدولة ${selectedCountry.name}.`);
        return;
      }
    } else {
      if (cleanDigits.length < selectedCountry.minDigits || cleanDigits.length > selectedCountry.maxDigits) {
        setError(`يرجى إدخال رقم هاتف صالح لدولة ${selectedCountry.name} (بين ${selectedCountry.minDigits} و ${selectedCountry.maxDigits} أرقام).`);
        return;
      }
    }

    if (password.length < 6) {
      setError('كلمة المرور يجب أن تتكون من 6 أحرف أو أرقام على الأقل.');
      return;
    }
    if (password !== confirmPassword) {
      setError('كلمة المرور وتأكيد كلمة المرور غير متطابقين.');
      return;
    }

    setIsCheckingUsername(true);
    try {
      const availability = await checkOwnerUsernameAvailability(ownerUsername);
      if (!availability.available) {
        setError(availability.error || 'اسم المستخدم هذا مستخدم بالفعل لجمعية أخرى. يرجى اختيار اسم مستخدم فريد.');
        setIsCheckingUsername(false);
        return;
      }
    } catch {}
    setIsCheckingUsername(false);

    setStage(2);
  };

  // File Upload Handlers for Legal Document (Step 2 - صور الوثيقة من معرض الصور فقط)
  const processLegalDocumentFile = (file: File) => {
    setLegalDocUploadError(null);
    setLegalDocUploadSuccess(null);

    // Validate supported image types: JPG/JPEG, PNG, WEBP only
    const fileNameLower = file.name.toLowerCase();
    const isSupportedImage = 
      file.type === 'image/jpeg' || 
      file.type === 'image/jpg' || 
      file.type === 'image/png' || 
      file.type === 'image/webp' ||
      /\.(jpg|jpeg|png|webp)$/i.test(fileNameLower);

    if (!isSupportedImage) {
      setLegalDocUploadError('صيغة غير مدعومة. يرجى اختيار صورة وثيقة الترخيص من معرض الصور بصيغة JPG أو PNG أو WEBP.');
      return;
    }

    // Validate file size: max 15MB
    const maxSizeBytes = 15 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      setLegalDocUploadError('حجم الصورة يتجاوز الحد الأقصى المسموح به (15 ميجابايت). يرجى اختيار صورة أصغر.');
      return;
    }

    setIsUploadingLegalDoc(true);

    (async () => {
      try {
        let finalUrl = '';
        try {
          finalUrl = await uploadImageToServer(file);
        } catch {
          try {
            const optimized = await optimizeInvoiceImage(file);
            finalUrl = optimized.dataUrl;
          } catch {
            finalUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = () => reject(new Error('Read error'));
              reader.readAsDataURL(file);
            });
          }
        }

        const formattedSize = file.size >= 1024 * 1024 
          ? `${(file.size / (1024 * 1024)).toFixed(1)} ميجابايت`
          : `${Math.max(1, Math.round(file.size / 1024))} كيلوبايت`;

        const doc: AssociationLegalDocument = {
          fileUrl: finalUrl,
          fileName: file.name,
          fileType: file.type || 'image/jpeg',
          fileSize: file.size,
          fileSizeFormatted: formattedSize,
          uploadedAt: new Date().toISOString(),
          status: 'pending',
        };

        setLegalDocument(doc);
        setIsUploadingLegalDoc(false);
        setLegalDocUploadSuccess(`تم اختيار وحفظ صورة الوثيقة «${file.name}» بنجاح.`);
      } catch {
        setIsUploadingLegalDoc(false);
        setLegalDocUploadError('حدث خطأ أثناء قراءة صورة الوثيقة. يرجى المحاولة مجددًا.');
      }
    })();
  };

  const handleLegalDocumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processLegalDocumentFile(file);
    if (legalDocGalleryInputRef.current) {
      legalDocGalleryInputRef.current.value = '';
    }
  };

  const handleRemoveLegalDocument = () => {
    setLegalDocument(null);
    setLegalDocUploadSuccess(null);
    setLegalDocUploadError(null);
    if (legalDocGalleryInputRef.current) {
      legalDocGalleryInputRef.current.value = '';
    }
  };

  const handleLegalDocDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsLegalDocDragOver(true);
  };

  const handleLegalDocDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsLegalDocDragOver(false);
  };

  const handleLegalDocDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsLegalDocDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processLegalDocumentFile(file);
    }
  };

  // Validation for Stage 2
  const handleProceedStage2 = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!associationName.trim()) {
      setError('يرجى إدخال اسم الجمعية باللغة العربية (حقل إلزامي).');
      return;
    }
    if (!associationNameFr.trim()) {
      setError('يرجى إدخال اسم الجمعية باللغة الفرنسية (حقل إلزامي).');
      return;
    }
    if (!country.trim()) {
      setError('يرجى تحديد دولة المقر الرئيسي للجمعية.');
      return;
    }
    if (!city.trim()) {
      setError('يرجى اختيار مدينة مقر الجمعية من قائمة المدن المعتمدة (حقل إلزامي).');
      return;
    }
    if (!isCityValidForCountry(city, country)) {
      setError(`المدينة المحددة «${city}» لا تتبع لدولة «${country}». يرجى اختيار إحدى المدن المعتمدة التابعة للدولة من القائمة.`);
      return;
    }

    setStage(3);
  };

  // Final Confirmation & Creation (Stage 3)
  const handleFinalConfirmAndCreate = () => {
    setError(null);
    setIsSubmitting(true);

    if (!isCityValidForCountry(city, country)) {
      setError(`المدينة المحددة «${city}» غير صالحة لدولة «${country}». يرجى العودة للخطوة 2 واختيار مدينة معتمدة.`);
      setIsSubmitting(false);
      return;
    }

    try {
      const cleanDigits = rawPhoneNumber.replace(/\D/g, '');
      const fullPhone = formatFullPhone(selectedCountry, cleanDigits);

      const input: CreateAssociationInput = {
        ownerFullName: ownerFullName.trim(),
        ownerUsername: ownerUsername.trim(),
        ownerPhone: fullPhone,
        password,
        associationName: associationName.trim(),
        associationNameFr: associationNameFr.trim(),
        country: country.trim(),
        city: city.trim(),
        legalDocument: legalDocument || undefined,
      };

      // Clear cached draft BEFORE saving new association so localStorage has maximum free space
      try {
        localStorage.removeItem(WIZARD_DRAFT_KEY);
      } catch {}

      const result = createAssociationPlatform(input);

      // Launch celebration confetti
      try {
        confetti({
          particleCount: 90,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch {}

      // Notify parent and switch immediately to the new association platform
      onAssociationCreated(result.tenant);
      onClose();
    } catch (err: any) {
      console.error('Failed to create association platform:', err);
      setError(err?.message || 'حدث خطأ غير متوقع أثناء إنشاء منصة الجمعية. يرجى المحاولة مرة أخرى.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto animate-fade-in" dir="rtl">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden my-8">
        {/* Header with gradient bar */}
        <div className="bg-gradient-to-l from-emerald-600 to-teal-700 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-5 left-5 text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
            title="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 mb-2">
            <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center text-white border border-white/20">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black">إنشاء منصة إلكترونية مستقلة لجمعيتك</h2>
              <p className="text-emerald-100 text-xs mt-0.5">
                نسخة مخصصة مبنية على قالب جمعية النور النموذجي مع عزل تام للبيانات
              </p>
            </div>
          </div>

          {/* Stepper Indicator */}
          <div className="mt-6 pt-4 border-t border-white/15 flex items-center justify-between">
            {/* Step 1 */}
            <div className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  stage >= 1
                    ? 'bg-white text-emerald-700 shadow-md ring-4 ring-emerald-400/30'
                    : 'bg-white/20 text-white'
                }`}
              >
                1
              </div>
              <span className={`text-xs font-medium hidden sm:inline ${stage >= 1 ? 'text-white font-bold' : 'text-emerald-200'}`}>
                حساب صاحب الجمعية
              </span>
            </div>

            <div className={`h-0.5 flex-1 mx-3 rounded transition-all ${stage >= 2 ? 'bg-white' : 'bg-white/20'}`} />

            {/* Step 2 */}
            <div className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  stage >= 2
                    ? 'bg-white text-emerald-700 shadow-md ring-4 ring-emerald-400/30'
                    : 'bg-white/20 text-white'
                }`}
              >
                2
              </div>
              <span className={`text-xs font-medium hidden sm:inline ${stage >= 2 ? 'text-white font-bold' : 'text-emerald-200'}`}>
                معلومات الجمعية
              </span>
            </div>

            <div className={`h-0.5 flex-1 mx-3 rounded transition-all ${stage === 3 ? 'bg-white' : 'bg-white/20'}`} />

            {/* Step 3 */}
            <div className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  stage === 3
                    ? 'bg-white text-emerald-700 shadow-md ring-4 ring-emerald-400/30'
                    : 'bg-white/20 text-white'
                }`}
              >
                3
              </div>
              <span className={`text-xs font-medium hidden sm:inline ${stage === 3 ? 'text-white font-bold' : 'text-emerald-200'}`}>
                مراجعة وتأكيد
              </span>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 md:p-8">
          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl flex items-center gap-3 text-sm animate-shake">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* ================= STAGE 1: Owner Account ================= */}
          {stage === 1 && (
            <form onSubmit={handleProceedStage1} className="space-y-5">
              <div>
                <h3 className="text-base font-bold text-slate-800 mb-1 flex items-center gap-2">
                  <User className="w-5 h-5 text-emerald-600" />
                  بيانات صاحب ومسؤول الجمعية (Super Admin)
                </h3>
                <p className="text-xs text-slate-500">
                  سيكون هذا الحساب هو المسؤول الأول عن المنصة مع كامل الصلاحيات لإدارة الجمعية وإضافة الأدمن.
                </p>
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  الاسم الكامل <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-5 h-5" />
                  </div>
                  <input
                    type="text"
                    required
                    value={ownerFullName}
                    onChange={(e) => setOwnerFullName(e.target.value)}
                    placeholder="مثال: يوسف الإدريسي"
                    className="w-full pl-4 pr-11 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all outline-none"
                  />
                </div>
              </div>

              {/* Username (Directly between Full Name and Phone) */}
              <div>
                <div className="flex flex-wrap items-center justify-between gap-1 mb-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    اسم المستخدم <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                    إلزامي: 4 حروف ورقمين على الأقل
                  </span>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  </div>
                  <input
                    type="text"
                    required
                    value={ownerUsername}
                    onChange={(e) => {
                      setOwnerUsername(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="مثال: nour2024 أو ahmed24"
                    className="w-full pl-4 pr-11 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all outline-none"
                  />
                </div>
                <div className="mt-1.5 flex flex-col gap-1">
                  <p className="text-[11px] font-medium text-slate-500 leading-relaxed">
                    يجب أن يتكون اسم المستخدم من 4 حروف على الأقل ورقمين على الأقل، ويجب الجمع بين الحروف والأرقام.
                  </p>
                  {ownerUsername.trim().length > 0 && (
                    <div className="text-[11px] font-bold flex items-center gap-1.5">
                      {!validateOwnerUsernameFormat(ownerUsername).valid ? (
                        <span className="text-amber-700 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          {validateOwnerUsernameFormat(ownerUsername).error}
                        </span>
                      ) : isOwnerUsernameTaken(ownerUsername) ? (
                        <span className="text-rose-600 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          اسم المستخدم هذا مستخدم بالفعل لجمعية أخرى، يرجى اختيار اسم مستخدم آخر.
                        </span>
                      ) : (
                        <span className="text-emerald-700 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          اسم المستخدم صالح ومتاح للتسجيل.
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Phone Field */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  رقم الهاتف <span className="text-rose-500">*</span>
                </label>

                <div className="relative" ref={countryDropdownRef}>
                  <div className="flex items-stretch bg-slate-50 border border-slate-200 rounded-xl focus-within:bg-white focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-500/10 transition-all">
                    {/* Country Selector Button */}
                    <button
                      type="button"
                      onClick={() => setIsCountryDropdownOpen(!isCountryDropdownOpen)}
                      className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-3 bg-slate-100 hover:bg-slate-200/80 text-slate-800 text-xs font-bold border-l border-slate-200 rounded-r-xl transition-colors shrink-0 focus:outline-none select-none"
                      dir="ltr"
                      title="اختيار رمز الدولة الدولي"
                    >
                      <span className="text-base sm:text-lg leading-none" role="img" aria-label={selectedCountry.name}>
                        {selectedCountry.flag}
                      </span>
                      <span className="font-mono text-xs font-bold text-slate-800">
                        {selectedCountry.code}
                      </span>
                      <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${isCountryDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Digits Input */}
                    <div className="relative flex-1 flex items-center min-w-0">
                      <input
                        type="tel"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        required
                        dir="ltr"
                        value={rawPhoneNumber}
                        onChange={handlePhoneChange}
                        onKeyDown={(e) => {
                          if (['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
                            return;
                          }
                          if (e.ctrlKey || e.metaKey) {
                            return;
                          }
                          if (!/^[0-9]$/.test(e.key)) {
                            e.preventDefault();
                          }
                        }}
                        placeholder={selectedCountry.placeholder}
                        className="w-full px-3.5 py-3 text-sm font-mono text-slate-800 bg-transparent outline-none placeholder:text-slate-400 placeholder:font-sans"
                      />
                      {rawPhoneNumber && (
                        <button
                          type="button"
                          onClick={() => setRawPhoneNumber('')}
                          className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors mr-2 shrink-0"
                          title="مسح"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Dropdown Menu */}
                  {isCountryDropdownOpen && (
                    <div className="absolute top-full right-0 mt-1.5 w-72 max-w-[calc(100vw-3rem)] bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-50">
                      {/* Search in Dropdown */}
                      <div className="relative mb-2">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={countrySearchQuery}
                          onChange={(e) => setCountrySearchQuery(e.target.value)}
                          placeholder="ابحث عن دولة أو رمز (+212)..."
                          className="w-full pl-3 pr-8 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-emerald-500 focus:bg-white transition-all text-right"
                          autoFocus
                        />
                      </div>

                      {/* Scrollable list */}
                      <div className="max-h-56 overflow-y-auto space-y-0.5 text-xs">
                        {filteredCountries.length > 0 ? (
                          filteredCountries.map((c) => {
                            const isSelected = c.id === selectedCountry.id;
                            return (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => handleSelectCountry(c)}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors text-right ${
                                  isSelected
                                    ? 'bg-emerald-50 text-emerald-800 font-bold'
                                    : 'hover:bg-slate-50 text-slate-700'
                                }`}
                              >
                                <div className="flex items-center gap-2 truncate">
                                  <span className="text-base shrink-0">{c.flag}</span>
                                  <span className="truncate">{c.name}</span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className="font-mono text-[11px] font-semibold text-slate-500" dir="ltr">
                                    {c.code}
                                  </span>
                                  {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                                </div>
                              </button>
                            );
                          })
                        ) : (
                          <div className="py-4 text-center text-xs text-slate-400">
                            لا توجد نتائج مطابقة
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Sub-label info & live international indicator */}
                <div className="mt-1.5 flex items-center justify-between text-[11px]">
                  {rawPhoneNumber ? (
                    <div className="text-emerald-700 font-medium flex items-center gap-1">
                      <span className="text-slate-400">الصيغة الدولية:</span>
                      <span className="font-mono font-bold" dir="ltr">
                        {formatFullPhone(selectedCountry, rawPhoneNumber)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-slate-400">
                      {selectedCountry.id === 'MA' 
                        ? 'مثال: +212 6 XX XX XX XX (أدخل أرقام الهاتف بدون الصفر الأول)' 
                        : `أدخل رقم الهاتف وفق رمز الدولة ${selectedCountry.code}`}
                    </span>
                  )}
                </div>
              </div>

              {/* Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    كلمة المرور <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-5 h-5" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="6 أحرف على الأقل"
                      className="w-full pl-10 pr-11 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    تأكيد كلمة المرور <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-5 h-5" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="أعد كتابة كلمة المرور"
                      className="w-full pl-4 pr-11 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={isCheckingUsername}
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-bold rounded-xl shadow-lg shadow-emerald-600/20 hover:shadow-emerald-600/30 transition-all flex items-center gap-2 group"
                >
                  <span>{isCheckingUsername ? 'جارٍ التحقق من اسم المستخدم...' : 'متابعة'}</span>
                  <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                </button>
              </div>
            </form>
          )}

          {/* ================= STAGE 2: Association Details ================= */}
          {stage === 2 && (
            <form onSubmit={handleProceedStage2} className="space-y-5">
              <div>
                <h3 className="text-base font-bold text-slate-800 mb-1 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-emerald-600" />
                  المعلومات الأساسية للجمعية
                </h3>
                <p className="text-xs text-slate-500">
                  أدخل اسم الجمعية ومقرها. سيتم تخصيص الواجهة والشعار والوثائق بناءً على هذه البيانات.
                </p>
              </div>

              {/* Association Name (Arabic) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  اسم الجمعية بالعربية <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <input
                    type="text"
                    required
                    value={associationName}
                    onChange={(e) => setAssociationName(e.target.value)}
                    placeholder="مثال: جمعية الأفق للتنمية والتضامن"
                    className="w-full pl-4 pr-11 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all outline-none"
                    dir="rtl"
                  />
                </div>
              </div>

              {/* Association Name (French) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  اسم الجمعية بالفرنسية <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <input
                    type="text"
                    required
                    value={associationNameFr}
                    onChange={(e) => setAssociationNameFr(e.target.value)}
                    placeholder="Ex: Association Al Oufouk pour le Développement et la Solidarité"
                    className="w-full pl-4 pr-11 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all outline-none text-left font-sans"
                    dir="ltr"
                  />
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  يُعتمد هذا الاسم تلقائيًا في الواجهات باللغة الفرنسية والإنجليزية، وفي الوثائق والبطاقات الرسمية.
                </span>
              </div>

              {/* Country & City */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Country */}
                <div className="relative" ref={step2CountryDropdownRef}>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    الدولة <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsStep2CountryDropdownOpen(!isStep2CountryDropdownOpen)}
                    className="w-full flex items-center justify-between px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl hover:bg-white focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all text-right group select-none"
                    title="تحديد أو تغيير الدولة"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <span className="text-xl leading-none shrink-0" role="img" aria-label={country}>
                        {getCountryFlag(country)}
                      </span>
                      <span className="text-sm font-bold text-slate-800 truncate">
                        {country || 'المغرب'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-400 group-hover:text-slate-600 shrink-0">
                      <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isStep2CountryDropdownOpen ? 'rotate-180 text-emerald-600' : ''}`} />
                    </div>
                  </button>

                  {/* Step 2 Country Dropdown Menu */}
                  {isStep2CountryDropdownOpen && (
                    <div className="absolute top-full right-0 mt-1.5 w-full min-w-[280px] bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-50">
                      {/* Search in Dropdown */}
                      <div className="relative mb-2">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={step2CountrySearchQuery}
                          onChange={(e) => setStep2CountrySearchQuery(e.target.value)}
                          placeholder="ابحث عن دولة..."
                          className="w-full pl-3 pr-8 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-emerald-500 focus:bg-white transition-all text-right"
                          autoFocus
                        />
                      </div>

                      {/* Scrollable list of countries */}
                      <div className="max-h-56 overflow-y-auto space-y-0.5 text-xs">
                        {filteredStep2Countries.length > 0 ? (
                          filteredStep2Countries.map((c) => {
                            const isSelected = c.name === country;
                            return (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => handleSelectStep2Country(c.name)}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors text-right ${
                                  isSelected
                                    ? 'bg-emerald-50 text-emerald-800 font-bold'
                                    : 'hover:bg-slate-50 text-slate-700'
                                }`}
                              >
                                <div className="flex items-center gap-2 truncate">
                                  <span className="text-base shrink-0">{c.flag}</span>
                                  <span className="truncate">{c.name}</span>
                                </div>
                                {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                              </button>
                            );
                          })
                        ) : (
                          <div className="p-3 text-center text-xs text-slate-500">
                            <p className="mb-2">لم يتم العثور على هذه الدولة في القائمة</p>
                            {step2CountrySearchQuery.trim() && (
                              <button
                                type="button"
                                onClick={() => handleSelectStep2Country(step2CountrySearchQuery.trim())}
                                className="w-full px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5"
                              >
                                <span>استخدام:</span>
                                <span className="font-bold">"{step2CountrySearchQuery.trim()}"</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* City (Searchable, Linked to Country with Automatic Loading) */}
                <div className="relative" ref={cityDropdownRef}>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      المدينة <span className="text-rose-500">*</span>
                    </label>
                    {isLoadingCities ? (
                      <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1 animate-pulse">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span>جاري تحميل المدن...</span>
                      </span>
                    ) : citiesList.length > 0 ? (
                      <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                        {citiesList.length} مدينة متاحة
                      </span>
                    ) : null}
                  </div>

                  <div className="relative">
                    <button
                      type="button"
                      disabled={isLoadingCities}
                      onClick={() => {
                        setIsCityDropdownOpen(!isCityDropdownOpen);
                        setCitySearchQuery('');
                      }}
                      className={`w-full flex items-center justify-between pl-3 pr-10 py-3 bg-slate-50 border rounded-xl hover:bg-white focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all text-right select-none disabled:opacity-60 cursor-pointer ${
                        !city 
                          ? 'border-slate-200 text-slate-400' 
                          : 'border-emerald-400 bg-emerald-50/20 text-slate-800 ring-2 ring-emerald-500/10'
                      }`}
                      title={`اختيار المدينة التابعة لدولة ${country}`}
                    >
                      <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                        <MapPin className={`w-5 h-5 ${city ? 'text-emerald-600' : 'text-slate-400'}`} />
                      </div>

                      <div className="flex-1 truncate pr-2">
                        {city ? (
                          <div className="flex items-center gap-2 truncate">
                            <span className="font-bold text-sm text-slate-900">{city}</span>
                            {(() => {
                              const found = citiesList.find(c => c.name === city);
                              return found?.region ? (
                                <span className="text-[11px] text-slate-500 truncate">({found.region})</span>
                              ) : null;
                            })()}
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400">
                            {isLoadingCities ? 'جاري جلب المدن...' : `اختر المدينة من قائمة مدن ${country}...`}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {city && (
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              setCity('');
                              setCitySearchQuery('');
                              setIsCityDropdownOpen(true);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.stopPropagation();
                                setCity('');
                                setIsCityDropdownOpen(true);
                              }
                            }}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors mr-1 cursor-pointer"
                            title="مسح واختيار مدينة أخرى"
                          >
                            <X className="w-3.5 h-3.5" />
                          </span>
                        )}
                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isCityDropdownOpen ? 'rotate-180 text-emerald-600' : ''}`} />
                      </div>
                    </button>
                  </div>

                  {/* City Dropdown Menu */}
                  {isCityDropdownOpen && (
                    <div className="absolute top-full right-0 mt-1.5 w-full min-w-[280px] bg-white rounded-2xl shadow-xl border border-slate-200 p-2.5 z-50 animate-scale-in">
                      {/* Search Box */}
                      <div className="relative mb-2">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={citySearchQuery}
                          onChange={(e) => setCitySearchQuery(e.target.value)}
                          placeholder={`ابحث في مدن ${country} (عربي / فرنسي / اللاتينية)...`}
                          className="w-full pl-7 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-emerald-500 focus:bg-white transition-all text-right"
                          autoFocus
                        />
                        {citySearchQuery && (
                          <button
                            type="button"
                            onClick={() => setCitySearchQuery('')}
                            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            title="مسح البحث"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Header bar */}
                      <div className="px-2 py-1 text-[11px] font-semibold text-slate-500 flex items-center justify-between border-b border-slate-100 mb-1">
                        <span>مدن دولة {country} المعتمدة</span>
                        <span className="font-mono text-emerald-700 font-bold">
                          {searchCitiesInCountry(country, citySearchQuery).length} / {citiesList.length}
                        </span>
                      </div>

                      {/* Loading State */}
                      {isLoadingCities && (
                        <div className="py-6 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-2">
                          <RefreshCw className="w-5 h-5 text-emerald-600 animate-spin" />
                          <span>جاري تحميل المدن المعتمدة لدولة {country}...</span>
                        </div>
                      )}

                      {/* Error State with Retry Button */}
                      {!isLoadingCities && citiesError && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-2 my-1">
                          <div className="flex items-center gap-1.5 font-bold">
                            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>{citiesError}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setIsLoadingCities(true);
                              apiFetchCitiesForCountry(country).then((res) => {
                                setCitiesList(res.cities || []);
                                setIsLoadingCities(false);
                              });
                            }}
                            className="w-full py-1.5 bg-amber-200/70 hover:bg-amber-200 text-amber-900 font-bold rounded-lg transition-colors text-center"
                          >
                            إعادة المحاولة
                          </button>
                        </div>
                      )}

                      {/* Scrollable list of cities */}
                      {!isLoadingCities && (
                        <div className="max-h-60 overflow-y-auto space-y-1 text-xs pr-0.5">
                          {(() => {
                            const filtered = searchCitiesInCountry(country, citySearchQuery);
                            if (filtered.length === 0) {
                              return (
                                <div className="p-4 text-center text-xs text-slate-500 space-y-1">
                                  <p className="font-bold text-slate-700">
                                    لم يتم العثور على مدينة مطابقة باسم «{citySearchQuery}»
                                  </p>
                                  <p className="text-[11px] text-slate-400">
                                    يُشترط اختيار مدينة تابعة لدولة {country} من القائمة المعتمدة
                                  </p>
                                </div>
                              );
                            }
                            return filtered.map((c) => {
                              const isSelected = c.name === city;
                              return (
                                <button
                                  key={c.name}
                                  type="button"
                                  onClick={() => {
                                    setCity(c.name);
                                    setIsCityDropdownOpen(false);
                                    setCitySearchQuery('');
                                    setError(null);
                                  }}
                                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all text-right group cursor-pointer ${
                                    isSelected
                                      ? 'bg-emerald-50 text-emerald-900 font-bold border border-emerald-300 shadow-sm'
                                      : 'hover:bg-slate-100 text-slate-800'
                                  }`}
                                >
                                  <div className="flex flex-col min-w-0 pr-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-slate-900 text-xs">{c.name}</span>
                                      {c.nameFr && (
                                        <span className="text-[11px] text-slate-400 font-sans" dir="ltr">
                                          {c.nameFr}
                                        </span>
                                      )}
                                    </div>
                                    {c.region && (
                                      <span className="text-[10px] text-slate-500 truncate mt-0.5">
                                        {c.region}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0 mr-2">
                                    {isSelected ? (
                                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                                    ) : (
                                      <MapPin className="w-3.5 h-3.5 text-slate-300 group-hover:text-emerald-500 transition-colors shrink-0" />
                                    )}
                                  </div>
                                </button>
                              );
                            });
                          })()}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* New Field: رفع وثيقة تثبت ترخيص الجمعية */}
              <div className="space-y-2.5 pt-1">
                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                  <div>
                    <label className="block text-xs font-bold text-slate-800">
                      رفع وثيقة تثبت ترخيص الجمعية
                    </label>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                      وصل نهائي/مؤقت، إيصال التصريح
                    </p>
                  </div>
                  {legalDocument && (
                    <span className="self-start sm:self-auto inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>تم إرفاق الوثيقة</span>
                    </span>
                  )}
                </div>

                {/* Hidden native image input for photo gallery selection - explicitly without capture attribute so device opens photo gallery */}
                <input
                  ref={legalDocGalleryInputRef}
                  id="legal-doc-gallery-input"
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  className="hidden"
                  onChange={handleLegalDocumentChange}
                />

                {!legalDocument ? (
                  /* Photo Gallery Selection Box */
                  <div
                    onDragOver={handleLegalDocDragOver}
                    onDragLeave={handleLegalDocDragLeave}
                    onDrop={handleLegalDocDrop}
                    onClick={() => legalDocGalleryInputRef.current?.click()}
                    className={`relative border-2 border-dashed rounded-2xl p-5 sm:p-6 text-center cursor-pointer transition-all duration-200 ${
                      isLegalDocDragOver
                        ? 'border-emerald-500 bg-emerald-50/80 scale-[1.005]'
                        : 'border-slate-300 hover:border-emerald-500 bg-slate-50/60 hover:bg-emerald-50/30'
                    }`}
                  >
                    <div className="flex flex-col items-center justify-center gap-3">
                      {/* Primary Gallery Selection Button */}
                      <button
                        id="btn-choose-doc-from-gallery"
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          legalDocGalleryInputRef.current?.click();
                        }}
                        className="w-full max-w-sm p-4 bg-white hover:bg-emerald-50/70 border border-slate-200 hover:border-emerald-400 rounded-2xl transition-all shadow-xs flex flex-col items-center text-center gap-2.5 group cursor-pointer"
                      >
                        <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition-colors flex items-center justify-center shadow-xs">
                          <ImageIcon className="w-6 h-6" />
                        </div>
                        <div>
                          <span className="block text-sm font-bold text-slate-800 group-hover:text-emerald-700 transition-colors">
                            اختيار صورة الوثيقة من معرض الصور
                          </span>
                          <span className="block text-xs text-slate-500 mt-1">
                            ألبوم وصور الجهاز (JPG, PNG, WEBP)
                          </span>
                        </div>
                      </button>

                      <p className="text-[11px] text-slate-400">
                        انقر لاختيار الصورة من ألبوم الهاتف أو الكمبيوتر • الحد الأقصى: 15 ميجابايت
                      </p>
                    </div>
                  </div>
                ) : (
                  /* Attached Document Card */
                  <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 transition-all shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div 
                          onClick={() => setPreviewingLegalDoc(legalDocument)}
                          className="relative w-12 h-12 rounded-xl overflow-hidden border border-emerald-300 flex-shrink-0 bg-white shadow-xs cursor-pointer group"
                          title="انقر للمعاينة والتكبير"
                        >
                          <img
                            src={legalDocument.fileUrl}
                            alt={legalDocument.fileName}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 truncate">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                            <span className="truncate" title={legalDocument.fileName}>{legalDocument.fileName}</span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                            <span className="font-semibold text-slate-700">{legalDocument.fileSizeFormatted}</span>
                            <span>•</span>
                            <span className="text-emerald-700 font-semibold">
                              صورة من معرض الصور
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => setPreviewingLegalDoc(legalDocument)}
                          className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-xs cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-emerald-600" />
                          <span>معاينة</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => legalDocGalleryInputRef.current?.click()}
                          className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-xs cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                          <span>استبدال الصورة</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleRemoveLegalDocument}
                          className="p-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 rounded-xl transition-all cursor-pointer"
                          title="حذف الوثيقة"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Upload Success Alert */}
                {legalDocUploadSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span>{legalDocUploadSuccess}</span>
                  </div>
                )}

                {/* Upload Error Alert */}
                {legalDocUploadError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                    <span>{legalDocUploadError}</span>
                  </div>
                )}
              </div>

              {/* Information Note */}
              <div className="p-4 bg-emerald-50/60 border border-emerald-100 rounded-2xl flex items-start gap-3 text-xs text-emerald-900">
                <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong>هيكل متكامل جاهز:</strong> ستتلقى منصتك فوراً هيكلاً مطابقاً لقالب «جمعية النور» (لوحة تحكم مالية، سجلات منخرطين، بطاقات العضوية الرقمية، وتوثيق الأنشطة) بمساحة بيانات جديدة وفارغة خاصة بجمعيتك وحدها.
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStage(1)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition-colors flex items-center gap-1.5"
                >
                  <ArrowRight className="w-4 h-4" />
                  <span>السابق</span>
                </button>

                <button
                  type="submit"
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-emerald-600/20 hover:shadow-emerald-600/30 transition-all flex items-center gap-2 group"
                >
                  <span>متابعة</span>
                  <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                </button>
              </div>
            </form>
          )}

          {/* ================= STAGE 3: Review Information ================= */}
          {stage === 3 && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h3 className="text-base font-bold text-slate-800 mb-1 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  مراجعة المعلومات وتأكيد إنشاء المنصة
                </h3>
                <p className="text-xs text-slate-500">
                  يرجى التأكد من صحة البيانات أدناه قبل إطلاق منصة جمعيتك رسمياً.
                </p>
              </div>

              {/* Summary Card */}
              <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <span className="text-xs font-bold text-slate-500">اسم صاحب ومسؤول الجمعية:</span>
                  <span className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    <User className="w-4 h-4 text-emerald-600" />
                    {ownerFullName}
                  </span>
                </div>

                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <span className="text-xs font-bold text-slate-500">اسم المستخدم لمدير الجمعية:</span>
                  <span className="text-sm font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    {ownerUsername}
                  </span>
                </div>

                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <span className="text-xs font-bold text-slate-500">رقم الهاتف:</span>
                  <span className="text-sm font-mono font-bold text-slate-800 flex items-center gap-1.5" dir="ltr">
                    <Phone className="w-4 h-4 text-emerald-600" />
                    {formatFullPhone(selectedCountry, rawPhoneNumber)}
                  </span>
                </div>

                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <span className="text-xs font-bold text-slate-500">اسم الجمعية بالعربية:</span>
                  <span className="text-sm font-bold text-emerald-700 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-emerald-600" />
                    {associationName}
                  </span>
                </div>

                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <span className="text-xs font-bold text-slate-500">اسم الجمعية بالفرنسية:</span>
                  <span className="text-sm font-bold text-teal-700 flex items-center gap-1.5 font-sans" dir="ltr">
                    <Building2 className="w-4 h-4 text-teal-600" />
                    {associationNameFr}
                  </span>
                </div>

                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <span className="text-xs font-bold text-slate-500">الدولة:</span>
                  <span className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                    <span className="text-base">{getCountryFlag(country)}</span>
                    {country}
                  </span>
                </div>

                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <span className="text-xs font-bold text-slate-500">المدينة والمقر:</span>
                  <span className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-emerald-600" />
                    {city}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">وثيقة إثبات الترخيص:</span>
                  {legalDocument ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-emerald-700 flex items-center gap-1.5 truncate max-w-[200px]">
                        {legalDocument.fileType.startsWith('image/') ? (
                          <ImageIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <FileText className="w-4 h-4 text-rose-600 shrink-0" />
                        )}
                        <span className="truncate">{legalDocument.fileName}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setPreviewingLegalDoc(legalDocument)}
                        className="text-[11px] font-bold text-emerald-600 hover:text-emerald-800 underline cursor-pointer"
                      >
                        (معاينة)
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-amber-700 font-medium bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      لم يتم إرفاق وثيقة
                    </span>
                  )}
                </div>
              </div>

              {/* Guarantees & Subscription Requirement Badge */}
              <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4 text-xs text-amber-950 leading-relaxed space-y-1.5">
                <div className="font-bold flex items-center gap-1.5 text-amber-900">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  نظام الدفع والتفعيل الإلزامي للمنصة:
                </div>
                <p>
                  عند الضغط على «تأكيد وإنشاء المنصة»، ستُنشأ منصة جمعيتك <strong>«{associationName}»</strong> بحالة <strong>«في انتظار الدفع»</strong>، ولا يُسمح بالدخول إلى لوحة التحكم أو عرض المنصة للعموم قبل تسديد مبلغ الاشتراك المطلوب. بعد تأكيد الدفع تنتقل المنصة إلى حالة <strong>«في انتظار التفعيل»</strong>، وبعد التحقق من صحة الدفع وموافقة الإدارة العامة تتغير حالتها إلى <strong>«مفعّلة»</strong> ويُسمح بالدخول إلى لوحة إدارتها واستخدام جميع الأقسام المصرح بها.
                </p>
              </div>

              {/* The Two Mandatory Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
                {/* Button 1: Edit Information */}
                <button
                  type="button"
                  onClick={() => setStage(2)}
                  disabled={isSubmitting}
                  className="w-full sm:w-auto px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  <ArrowRight className="w-4 h-4" />
                  <span>تعديل المعلومات</span>
                </button>

                {/* Button 2: Confirm and Create Platform */}
                <button
                  type="button"
                  onClick={handleFinalConfirmAndCreate}
                  disabled={isSubmitting}
                  className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-sm font-black rounded-xl shadow-xl shadow-emerald-600/30 hover:shadow-emerald-600/40 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span>جارٍ إنشاء المنصة...</span>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>تأكيد وإنشاء المنصة</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Document Preview Modal */}
      {previewingLegalDoc && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm" dir="rtl">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-5 shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <ImageIcon className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 truncate max-w-sm sm:max-w-md">
                    {previewingLegalDoc.fileName}
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    {previewingLegalDoc.fileSizeFormatted} • صورة وثيقة الترخيص
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewingLegalDoc(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-4 flex-1 overflow-auto flex items-center justify-center bg-slate-100/70 rounded-2xl p-2 min-h-[280px]">
              {previewingLegalDoc.fileType.startsWith('image/') ? (
                <img
                  src={previewingLegalDoc.fileUrl}
                  alt={previewingLegalDoc.fileName}
                  className="max-h-[60vh] max-w-full object-contain rounded-xl shadow-sm"
                />
              ) : (
                <iframe
                  src={previewingLegalDoc.fileUrl}
                  title={previewingLegalDoc.fileName}
                  className="w-full h-[60vh] rounded-xl border border-slate-200 bg-white"
                />
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <a
                href={previewingLegalDoc.fileUrl}
                download={previewingLegalDoc.fileName}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>تحميل الملف</span>
              </a>
              <button
                type="button"
                onClick={() => setPreviewingLegalDoc(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
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
