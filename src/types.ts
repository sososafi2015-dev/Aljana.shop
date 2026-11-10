export type Language = 'ar' | 'fr' | 'en';
export type UserRole = 'member' | 'admin';

export type MemberStatus = 'active' | 'pending' | 'inactive' | 'honorary';

export type FieldType = 
  | 'text' 
  | 'phone' 
  | 'email' 
  | 'number' 
  | 'date' 
  | 'select' 
  | 'checkbox' 
  | 'password'
  | 'file' 
  | 'textarea';

export interface MemberRegistrationField {
  id: string; // unique key e.g. 'fullName', 'memberCode', 'phone', or 'custom_123'
  name: string;
  labelAr: string;
  labelFr: string;
  labelEn: string;
  placeholderAr?: string;
  placeholderFr?: string;
  placeholderEn?: string;
  type: FieldType;
  required: boolean;
  enabled: boolean;
  order: number;
  options?: string[]; // for select dropdown
  defaultValue?: any;
  isSystem?: boolean; // system default fields
  helpTextAr?: string;
  helpTextFr?: string;
  helpTextEn?: string;
}

export interface Member {
  id: string;
  memberCode: string;
  fullName: string;
  username?: string; // Unique alphanumeric username for member account login
  phone: string;
  email?: string;
  cin?: string; // National ID
  joinDate: string; // YYYY-MM-DD
  renewalDate: string;
  annualFee: number; // Subscription fee in MAD
  status: MemberStatus;
  notes?: string;
  avatarUrl?: string;
  isAnonymousInPublic?: boolean;
  customFields?: Record<string, any>; // Dynamic custom registration fields data
  passwordHash?: string; // Hashed password for member personal account login
  passwordSalt?: string; // Cryptographic salt
  lastLoginDate?: string; // ISO date of last login
  membershipPaymentMethod?: PaymentMethodType; // Chosen method for membership fee: 'bank_transfer' | 'cash' | 'check'
  proofImageUrl?: string; // رابط صورة إثبات الدفع (التحويل البنكي)
  receiptUrl?: string; // رابط إيصال أو صورة إثبات الدفع
}

export type ContributionStatus = 'completed' | 'pending' | 'approved' | 'unpaid' | 'rejected';
export type PaymentMethodType = 'bank_transfer' | 'cash' | 'check' | 'online' | 'other';
export type ContributionCategory = 
  | 'membership_fee' 
  | 'donation' 
  | 'project_support' 
  | 'initiative_proposal' 
  | 'charity_zakat' 
  | 'initiative_idea' 
  | 'other' 
  | (string & {});

export interface MemberContribution {
  id: string;
  memberId: string;
  memberCode: string;
  memberName: string;
  amount: number; // Amount in MAD (درهم مغربي)
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm:ss
  createdAt: string; // ISO datetime
  status: ContributionStatus;
  category: ContributionCategory;
  paymentMethod: PaymentMethodType;
  notes?: string;
  financialOperationId?: string; // Link to public ledger operation
  unpaidDeductionOperationId?: string; // Link to deduction operation when marked 'لم يتم الدفع'
  tenantId?: string; // Association ID (معرّف الجمعية المستفيدة)
  associationId?: string;
  associationName?: string;
  campaignId?: string;
  campaignTitle?: string;
  donorPhone?: string;
  isAnonymous?: boolean;
  contributionTypeId?: string;
  contributionTypeName?: string;
  isNegative?: boolean;
  amountSign?: '+' | '-';
  proofImageUrl?: string; // رابط صورة إثبات الدفع (التحويل البنكي)
  receiptUrl?: string;
}

export interface BoardMember {
  id: string; // unique board member entry ID e.g. 'bm-1'
  memberId: string; // Direct reference to Member.id
  roleAr: string; // e.g. 'رئيس الجمعية', 'الكاتب العام', 'أمين المال'
  roleFr?: string;
  roleEn?: string;
  order: number; // For custom ranking / hierarchy
  appointedDate?: string; // YYYY-MM-DD
  notes?: string;
}

export type OperationType = 'income' | 'expense';

export type ExpenseCategory = 
  | 'tree_planting' 
  | 'social_aid' 
  | 'equipment' 
  | 'education' 
  | 'health_caravan' 
  | 'maintenance' 
  | 'ramadan_aid' 
  | 'other';

export interface OperationRevision {
  id: string;
  timestamp: string; // ISO datetime
  performedBy: string; // Admin full name
  adminType?: 'super_admin' | 'sub_admin';
  adminPhone?: string;
  previousData: {
    title: string;
    description?: string;
    type: OperationType;
    category: string;
    amount: number;
    date: string;
    paymentMethod?: PaymentMethodType;
    memberName?: string;
    proofUrls?: string[];
  };
  newData: {
    title: string;
    description?: string;
    type: OperationType;
    category: string;
    amount: number;
    date: string;
    paymentMethod?: PaymentMethodType;
    memberName?: string;
    proofUrls?: string[];
  };
  changeSummary: string[];
}

export interface FinancialOperation {
  id: string;
  code: string;
  title: string;
  description: string;
  type: OperationType;
  category: ExpenseCategory | 'membership_fee' | 'donation' | 'sponsor' | 'aid' | (string & {});
  amount: number; // in MAD (درهم مغربي)
  date: string; // YYYY-MM-DD
  paymentMethod?: PaymentMethodType;
  memberId?: string;
  memberName?: string;
  proofUrls?: string[]; // Receipts, invoices, photos
  videoUrl?: string;
  balanceAfter?: number;
  addedBy: string;
  createdAt: string;
  updatedAt?: string;
  updatedBy?: string;
  revisions?: OperationRevision[];
  tenantId?: string; // Association ID
  associationId?: string;
  linkedContributionId?: string; // Linked contribution ID when this is an unpaid deduction
  isUnpaidContributionDeduction?: boolean; // True when this operation deducts an unpaid contribution
}

export interface ActivityProofAttachment {
  name: string;
  size: number; // Size in bytes
  type: 'image' | 'pdf' | 'word' | 'other';
  mimeType: string;
  url: string; // Base64 Data URL or remote URL
  uploadedAt?: string;
}

export interface ActivityVideoMetadata {
  id: string; // Video unique ID
  activityId?: string;
  storageKey?: string; // Key in Object Storage
  cdnUrl: string; // Stream/CDN URL (Blob URL or cached URL)
  thumbnailUrl?: string; // Extracted poster/thumbnail frame
  originalName?: string;
  duration: number; // Duration in seconds
  durationFormatted?: string; // e.g. "01:45"
  fileSize: number; // File size in bytes
  fileSizeFormatted?: string; // e.g. "12.5 ميجابايت"
  resolution?: string; // e.g. "1280x720 (HD)"
  width?: number;
  height?: number;
  mimeType: string;
  processingStatus: 'idle' | 'uploading' | 'processing' | 'ready' | 'error';
  isUploadedDirectly?: boolean;
  uploadedAt: string;
}

export interface VideoStorageSettings {
  maxFileSizeMB: number;
  maxDurationMinutes: number;
  preferredResolution: string;
  autoCompress: boolean;
  storageProvider: string;
  cdnDomain: string;
  totalStorageQuotaGB: number;
}

export interface VideoUploadSettings {
  enabled: boolean;
  maxFileSizeMB: number; // default: 100
  maxDurationMinutes: number; // default: 5
  allowedFormats: string[]; // ['mp4', 'mov', 'webm']
  quality: 'auto' | 'high' | 'medium' | 'low';
}

export interface ActivityItem {
  id: string;
  title: string;
  description: string;
  category: ExpenseCategory;
  date: string;
  location: string;
  spentAmount: number;
  beneficiariesCount?: number;
  coverImage: string;
  galleryImages: string[];
  videoUrl?: string; // Main / first video URL (backwards compatible)
  videoUrls?: string[]; // Multiple video URLs list
  videoMetadata?: ActivityVideoMetadata; // Detailed video metadata & object storage reference
  proofDocumentUrl?: string;
  proofAttachment?: ActivityProofAttachment;
  isFeatured: boolean;
  isActive?: boolean; // Controls public visibility (true = active / visible to users, false = hidden)
  financialOperationId?: string;
}

export type UIElementCategory = 
  | 'home_sections'
  | 'records_and_ledgers'
  | 'navigation'
  | 'banners_and_media'
  | 'footer_and_contact'
  | 'custom';

export interface UICustomContent {
  type?: 'banner' | 'card' | 'notice' | 'button' | 'highlight';
  titleAr?: string;
  titleFr?: string;
  titleEn?: string;
  bodyAr?: string;
  bodyFr?: string;
  bodyEn?: string;
  badgeTextAr?: string;
  buttonTextAr?: string;
  buttonAction?: 'donate' | 'join' | 'report' | 'contact' | 'link' | 'tab';
  buttonLink?: string;
  targetTab?: string;
  themeStyle?: 'emerald' | 'blue' | 'amber' | 'indigo' | 'slate' | 'gradient';
}

export interface UIElementConfig {
  id: string;
  nameAr: string;
  nameFr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionFr: string;
  descriptionEn: string;
  category: UIElementCategory;
  enabled: boolean;
  visibleToNonMembers?: boolean;
  order: number;
  iconName?: string;
  isCustom?: boolean;
  targetComponent?: string;
  page?: 'home' | 'activities' | 'members' | 'ledger' | 'campaigns' | 'voting' | 'footer' | 'all';
  customContent?: UICustomContent;
  updatedAt?: string;
}

export type MemberCardFieldType = 
  | 'text'          // regular dynamic text (e.g. fullName, cin, etc.)
  | 'phone'         // formatted phone number
  | 'email'         // email address
  | 'date'          // date formatting
  | 'currency'      // money amount with currency
  | 'status_badge'  // membership status badge
  | 'image'         // member photo / avatar
  | 'qr_code'       // dynamic verification QR code block
  | 'static_text'   // custom static notice or pledge
  | 'signature';    // stamp & signature block

export type CardFieldSection = 'hero' | 'body_grid' | 'notice' | 'footer';

export interface MemberCardField {
  id: string; // unique identifier e.g. 'card_field_fullName' or 'custom_card_field_123'
  key: string; // target field mapping: 'fullName' | 'memberCode' | 'cin' | 'phone' | 'email' | 'joinDate' | 'renewalDate' | 'annualFee' | 'status' | 'avatarUrl' | 'transparencyPledge' | 'qrCode' | 'stamp' | 'static' | custom key
  labelAr: string;
  labelFr: string;
  labelEn: string;
  type: MemberCardFieldType;
  section: CardFieldSection; // where to render on card: 'hero' | 'body_grid' | 'notice' | 'footer'
  enabled: boolean; // active/visible on card or hidden
  order: number;
  isSystem?: boolean; // system default fields
  gridWidth?: 'full' | 'half' | 'third'; // column span
  staticContentAr?: string; // for custom static text or notes
  staticContentFr?: string;
  staticContentEn?: string;
  iconName?: string; // Lucide icon
  helpNoteAr?: string;
}

export interface MemberCardSettings {
  titleAr: string; // "وصل وبطاقة انخراط رسمية"
  titleFr: string;
  titleEn: string;
  subtitleAr?: string;
  subtitleFr?: string;
  subtitleEn?: string;
  cardTheme: 'emerald' | 'slate' | 'navy' | 'gold' | 'rose' | 'indigo';
  showLogo: boolean;
  showHeaderKingdom: boolean;
  showLicenseInfo: boolean;
  showFooterBank: boolean;
  // Official Stamp (Independent Setting - الخاتم الرسمي)
  showStamp: boolean;
  stampImageUrl?: string;
  stampTitleAr?: string;
  // Official Signature (Independent Setting - التوقيع الرسمي للجمعية)
  showSignature?: boolean;
  signatureImageUrl?: string;
  signatureTitleAr?: string;
  signaturePlacement?: 'beside' | 'stacked' | 'overlap';
  showQrCode: boolean;
  fields: MemberCardField[];
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action: 'create' | 'update' | 'delete' | 'login' | 'logout' | 'export' | 'backup';
  targetType: 'member' | 'operation' | 'activity' | 'settings' | 'field' | 'ui_element' | 'poll' | 'card_template' | 'member_card' | 'sub_admin' | 'auth' | 'campaign' | 'campaign_contribution';
  description: string;
  performedBy: string;
  adminType?: 'super_admin' | 'sub_admin';
  adminPhone?: string;
}

export type AdminSectionKey = 
  | 'overview'
  | 'createAd'
  | 'donationsBenefit'
  | 'subscriptionRenewal'
  | 'platformTutorials'
  | 'platformSetupService'
  | 'campaigns'
  | 'operations'
  | 'official_registers'
  | 'members'
  | 'boardMembers'
  | 'contributions'
  | 'memberCard'
  | 'activities'
  | 'branding'
  | 'polls'
  | 'uiElements'
  | 'nonMemberVisibility'
  | 'fields'
  | 'accessControl'
  | 'subAdmins'
  | 'settings'
  | 'audit'
  | 'backup';

export type PermissionLevel = 
  | 'none'
  | 'view'
  | 'add'
  | 'edit'
  | 'delete'
  | 'view_add_edit'
  | 'full';

export interface SectionPermission {
  sectionKey: AdminSectionKey;
  canView: boolean;
  canAdd: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export interface SubAdmin {
  id: string;
  fullName: string;
  username?: string;
  phone: string;
  passwordHash: string;
  passwordSalt: string;
  plainPassword?: string;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt?: string;
  lastLoginAt?: string;
  permissions: Record<AdminSectionKey, SectionPermission>;
  notes?: string;
  tenantId?: string;
  associationId?: string;
}

export type PlatformPermissionKey =
  | 'associations_manage'
  | 'associations_view'
  | 'associations_toggle_status'
  | 'tenants_requests_manage'
  | 'subscriptions_renewals_manage'
  | 'ad_campaign_requests_manage'
  | 'ad_campaign_approve'
  | 'ad_campaigns_manage'
  | 'donations_manage'
  | 'contribution_types_manage'
  | 'users_manage'
  | 'content_manage'
  | 'portal_settings_manage'
  | 'media_manage'
  | 'reports_view'
  | 'payments_manage'
  | 'platform_support_manage'
  | 'association_sections_manage'
  | 'association_sections_view'
  | 'audit_logs_view';

export interface PlatformSubAdmin {
  id: string;
  fullName: string;
  username?: string;
  phone: string;
  passwordHash: string;
  passwordSalt: string;
  plainPassword?: string;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt?: string;
  lastLoginAt?: string;
  role: 'secondary_admin';
  permissions: Record<PlatformPermissionKey, boolean>;
  notes?: string;
}

export interface PlatformAdminAuditLog {
  id: string;
  timestamp: string;
  adminId: string;
  adminName: string;
  adminPhone?: string;
  adminRole: 'super_admin' | 'secondary_admin';
  action: string;
  actionKey: 'login' | 'tenant_edit' | 'tenant_toggle' | 'tenant_delete' | 'campaign_approve' | 'campaign_reject' | 'settings_edit' | 'content_delete' | 'permission_change' | 'admin_create' | 'admin_edit' | 'admin_delete' | 'admin_status' | 'platform_identity_edit';
  targetItem: string;
  result: 'success' | 'failed';
  details?: string;
}

export interface PlatformIdentitySettings {
  platformName: string;
  platformLogo: string;
  whatsapp?: string; // رقم واتساب الإدارة للتواصل المباشر
  associationsWhatsapp?: string; // رقم واتساب الجمعيات المعتمد في لوحات تحكم الجمعيات لزر «تواصل مع الإدارة»
  hasCustomPin: boolean;
  updatedAt?: string;
  updatedBy?: string;
}

export interface MasterAdminSession {
  isMaster: boolean;
  role: 'super_admin' | 'secondary_admin';
  id?: string;
  username?: string;
  fullName: string;
  phone?: string;
  permissions?: Partial<Record<PlatformPermissionKey, boolean>>;
}

export interface CurrentAdminSession {
  type: 'super_admin' | 'sub_admin';
  role?: 'main_admin' | 'secondary_admin';
  id?: string;
  username?: string;
  fullName: string;
  phone?: string;
  subAdmin?: SubAdmin;
  tenantId?: string; // ID of the association this admin belongs to
  isMasterPlatformAdmin?: boolean; // Super Admin of the entire platform
}

export type VoteChoice = 'for' | 'against';

export interface PollVote {
  memberId: string;
  memberCode: string;
  memberName: string;
  choice: VoteChoice;
  votedAt: string;
}

export type PollStatus = 'active' | 'paused' | 'closed';

export interface Poll {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  startDate?: string;
  endDate?: string;
  status: PollStatus;
  isVisibleInApp: boolean;
  allowVoteChange: boolean;
  votes: PollVote[];
  createdBy?: string;
}

export interface StoreThemeColors {
  primaryColor: string; // اللون الرئيسي
  secondaryColor: string; // اللون الثانوي
  buttonColor: string; // لون الأزرار
  headingColor: string; // لون العناوين
  textColor: string; // لون النصوص
  backgroundColor: string; // لون الخلفية
  linkColor: string; // لون الروابط
  bannerOverlayColor: string; // لون البانرات والتعتيم
  navbarColor: string; // ألوان القوائم
  cardColor: string; // ألوان البطاقات والعناصر
}

export interface AssociationSettings {
  name: string;
  nameFr: string;
  nameEn: string;
  tagline: string;
  taglineFr: string;
  taglineEn: string;
  description?: string;
  logoUrl?: string;
  bannerImageUrl?: string;
  ribBank: string;
  bankName: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  city?: string;
  licenseNumber: string;
  foundingYear: string;
  adminPin: string; // default e.g. "2025" or "1234"
  currency: string; // "د.م" or "DH"
  currencyFr: string;
  currencyEn: string;
  featuredActivityId?: string; // ID of the single activity displayed on the main store homepage
  featuredActivitiesHeroImage?: string; // Custom main cover/hero image for the featured activities section
  videoUploadSettings?: VideoUploadSettings; // Configurable video upload limits & quality
  showAdminLoginButton?: boolean; // إظهار زر الدخول إلى لوحة التحكم في واجهة المتجر (افتراضياً: false)
  enableTripleClickLogoLogin?: boolean; // الدخول عبر الضغط 3 مرات على شعار المتجر (افتراضياً: true)
  bannerDarknessOverlay?: number; // درجة اللون الداكن لصورة البانر (من 0% إلى 100%)
  heroBadgeText?: string; // نص عنوان الواجهة الرئيسية أعلى صورة الغلاف (افتراضياً: اسم الجمعية)
  heroBadgeTextFr?: string; // نص عنوان الواجهة الرئيسية بالفرنسية
  heroBadgeTextEn?: string; // نص عنوان الواجهة الرئيسية بالإنجليزية
  themeColors?: StoreThemeColors; // إدارة ألوان واجهة المتجر
  donationPresetAmounts?: number[]; // مبالغ التبرع السريعة الجاهزة (قابلة للإدارة والتعديل)
  enablePublicDonations?: boolean; // الاستفادة من التبرعات - ظهور بواجهة المنصة من أجل تلقي التبرعات (قسم «تبرع وشارك في مشاريع التنمية»)
}

export const DEFAULT_DONATION_PRESETS: number[] = [
  100, 200, 300, 400, 500, 700, 800, 1000, 1500, 2000, 3000, 4000, 5000, 6000, 8000, 10000, 15000, 20000
];

export type CampaignStatus = 'active' | 'paused' | 'completed';

export interface DonationCampaign {
  id: string;
  title: string;
  description: string;
  targetProject: string; // المشروع المستهدف من التبرعات
  targetAmount: number; // ميزانية المشروع / الهدف المالي (بالدرهم)
  collectedAmount: number; // المبلغ الذي تم جمعه - يُحسب تلقائياً من جميع المساهمات
  progressPercentage: number; // نسبة التقدم = (إجمالي المساهمات ÷ ميزانية المشروع) × 100
  coverImage: string; // صورة الحملة الرئيسية
  videoUrl?: string; // رابط الفيديو التعريفي أو الترويجي للحملة (يوتيوب أو فيميو أو رابط مباشر)
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  status: CampaignStatus; // نشطة / متوقفة / مكتملة
  allowOverfunding?: boolean; // السماح باستمرار التبرعات حتى لو تجاوز الهدف
  isVisibleOnStore?: boolean; // ظهور الحملة على واجهة المتجر (افتراضي: true)
  createdAt: string;
  updatedAt?: string;
  tenantId?: string; // Association ID
  associationId?: string;
  associationName?: string;
}

export interface DonationPresetConfig {
  id: string;
  amount: number;
  order: number;
  enabled: boolean;
  labelAr?: string;
  isPopular?: boolean;
  createdAt?: string;
}

export interface ContributionTypeConfig {
  id: string;
  nameAr: string;
  nameFr?: string;
  nameEn?: string;
  isFinancial: boolean; // هل المساهمة مالية؟ (افتراضي: true)
  isDefault?: boolean; // هل هو النوع الافتراضي المحدد تلقائياً
  enabled: boolean;
  order?: number; // ترتيب أنواع المساهمات كما تظهر للمستخدم
  showInStore?: boolean; // تحديد الأنواع التي تظهر في واجهة المساهمات والمتجر (افتراضي: true)
  descriptionAr?: string;
  descriptionFr?: string;
  descriptionEn?: string;
  isDeleted?: boolean; // هل تم حذفه منطقياً للحفاظ على السجلات التاريخية للتبرعات
  deletedAt?: string;
}

export interface CampaignContribution {
  id: string;
  campaignId: string; // ربط تلقائي بمعرف الحملة المحددة
  campaignTitle: string;
  donorName: string; // اسم المتبرع أو فاعل خير
  donorPhone?: string;
  isAnonymous: boolean;
  contributionTypeId: string;
  contributionTypeName: string; // اسم نوع المساهمة، مثلاً "تبرع ومساعدة خيرية"
  isFinancial: boolean;
  amount: number; // مبلغ المساهمة بالدرهم (يمنع صفر أو قيمة سالبة)
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm:ss
  createdAt: string; // ISO
  status: 'completed' | 'pending' | 'approved' | 'unpaid' | 'rejected';
  paymentMethod?: PaymentMethodType;
  notes?: string;
  tenantId?: string; // Association ID
  associationId?: string;
  associationName?: string;
  isNegative?: boolean;
  amountSign?: '+' | '-';
  proofImageUrl?: string; // رابط صورة إثبات الدفع (التحويل البنكي)
  receiptUrl?: string;
}

// ==================== MULTI-ASSOCIATION & MULTI-TENANT TYPES ====================

export type AssociationStatus = 'active' | 'inactive' | 'pending_subscription' | 'pending_activation';
export type SubscriptionTier = 'free' | 'basic' | 'pro' | 'enterprise';

export interface PaymentStatusHistoryItem {
  id?: string;
  status: string;
  statusLabel?: string;
  label?: string;
  timestamp: string;
  actor: string;
  notes?: string;
  note?: string;
}

export interface AssociationLegalDocument {
  fileUrl: string; // Base64 data URL or storage URL
  fileName: string; // e.g. "وصل_التصريح_المؤقت.pdf"
  fileType: string; // MIME type e.g. 'application/pdf', 'image/jpeg', 'image/png'
  fileSize: number; // File size in bytes
  fileSizeFormatted: string; // e.g. "1.2 MB" or "850 KB"
  uploadedAt: string; // ISO date string
  status?: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  verifiedAt?: string;
  verifiedBy?: string;
}

export interface AssociationTenant {
  id: string; // Unique tenant ID e.g. 'tenant_nour' or 'tenant_1725900000000_abc'
  name: string; // Association Name (اسم الجمعية)
  nameFr?: string;
  nameEn?: string;
  country: string; // الدولة (e.g. "المغرب")
  city: string; // المدينة (e.g. "الدار البيضاء")
  slug: string; // URL-safe identifier e.g. "nour"
  logoUrl?: string;
  bannerImageUrl?: string;
  legalDocument?: AssociationLegalDocument; // وثيقة إثبات ترخيص الجمعية (وصل نهائي/مؤقت، إيصال التصريح)
  ownerId: string; // Owner account ID
  ownerUsername?: string; // Owner unique username (اسم المستخدم لمدير الجمعية)
  ownerName: string; // Owner Full Name (اسم صاحب الجمعية)
  ownerPhone: string; // Owner Phone (رقم الهاتف)
  status: AssociationStatus; // 'active' (نشطة) | 'inactive' (معطلة)
  createdAt: string; // ISO creation date
  updatedAt?: string;
  tier: SubscriptionTier; // Subscription plan: 'free' | 'basic' | 'pro' | 'enterprise'
  monthlyFee: number; // Subscription price in MAD
  isTemplate?: boolean; // True for the Master Template "جمعية النور للتنمية والتضامن"
  isMasterTemplate?: boolean;
  isVisibleOnPublicPortal?: boolean; // الظهور في الواجهة العامة لمنصة الجمعيات الذكية (حصرياً للقالب الأساسي)
  enablePublicDonations?: boolean; // الاستفادة من التبرعات - ظهور بواجهة المنصة من أجل تلقي التبرعات (قسم «تبرع وشارك في مشاريع التنمية»)
  tagline?: string;
  description?: string; // الوصف الكامل للجمعية
  address?: string; // العنوان التفصيلي ومقر الجمعية
  email?: string; // البريد الإلكتروني للجمعية
  whatsapp?: string; // رقم الواتساب للتواصل
  phone?: string; // هاتف التواصل
  rib?: string; // الحساب البنكي RIB
  bankName?: string; // اسم البنك
  licenseNumber?: string; // رقم الترخيص أو الوصل
  stats?: {
    membersCount: number;
    activitiesCount: number;
    totalBalance: number;
    campaignsCount: number;
  };
  // Subscription Renewal & Expiration Fields
  subscriptionStartedAt?: string; // ISO date of subscription start
  subscriptionExpiresAt?: string; // ISO date of subscription expiration
  subscriptionStatus?: 'active' | 'expiring_soon' | 'expired'; // Subscription status
  activationPaymentId?: string; // ID of the activation payment
  activationFeePaid?: number; // Activation fee amount paid
  activationFeeCurrency?: string; // Activation fee currency (e.g. MAD)
  activationFeeDate?: string; // Activation fee date
  lastRenewalPaymentId?: string; // ID of the last confirmed renewal payment
  lastRenewalDate?: string; // Date of the last renewal
  paymentVerified?: boolean; // هل تم التحقق من الدفع وتأكيده
  paymentVerifiedAt?: string;
  paymentVerifiedBy?: string;
  activatedBy?: string;
  activatedAt?: string;
  subscriptionStatusHistory?: PaymentStatusHistoryItem[];
}

export interface AssociationOwner {
  id: string;
  username?: string;
  fullName: string;
  phone: string;
  passwordHash: string;
  passwordSalt: string;
  hasCustomPassword?: boolean;
  tenantId: string;
  status: 'active' | 'inactive';
  createdAt: string;
}

export interface PlatformMasterStats {
  totalAssociations: number;
  activeAssociations: number;
  disabledAssociations: number;
  totalUsers: number;
  totalProfits: number; // إجمالي الأرباح بالدرهم
  totalSubscribers: number; // إجمالي المشتركين في الباقات المدفوعة
  tierDistribution: Record<SubscriptionTier, number>;
}

// ==================== PLATFORM PORTAL UI SETTINGS (SUPER ADMIN ONLY) ====================

export interface PlatformPortalSectionsVisibility {
  announcementBar: boolean; // شريط الإعلانات العلوي
  mainHeader: boolean; // الترويسة الرئيسية وشعار المنصة وأزرار الدخول
  heroSection: boolean; // قسم الواجهة الترحيبية (Hero)
  heroMetrics: boolean; // الشارات الإحصائية السريعة في الهيرو
  masterTemplateShowcase: boolean; // قسم استعراض القالب الأساسي المعتمد (جمعية النور)
  catalogSection: boolean; // قسم دليل ونموذج الجمعيات المعتمد
  donationsSection?: boolean; // قسم تبرع وشارك في مشاريع التنمية
  searchFilter: boolean; // فلتر البحث بالاسم أو الكلمات الدلالية
  cityFilter: boolean; // فلتر التصفية حسب المدينة
  pillarsSection: boolean; // قسم ركائز ومميزات المنظومة
  footerSection: boolean; // تذييل المنصة وحقوق النشر
}

export interface PlatformPortalTextSettings {
  announcementBadge: string;
  announcementText: string;
  headerBrandName: string;
  headerBrandTagline: string;
  createAssociationButtonText: string;
  heroBadge: string;
  heroTitleLine1: string;
  heroTitleHighlight: string;
  heroDescription: string;
  heroCtaButtonText: string;
  heroPreviewTemplateButtonText: string;
  masterTemplateBadge: string;
  masterTemplateDescription: string;
  masterTemplateButtonText: string;
  catalogBadge: string;
  catalogTitle: string;
  catalogDescription: string;
  donationsSectionTitle?: string;
  donationsSectionDesc?: string;
  donationsSectionCoverImage?: string;
  donationsSectionCoverOverlayOpacity?: number; // 0 to 100 percentage
  platformLogoUrl?: string;
  heroBackgroundImage?: string;
  heroBackgroundOverlayOpacity?: number; // 0 to 100 percentage
  searchPlaceholder: string;
  pillarsTitle: string;
  pillarsSubtitle: string;
  pillar1Title: string;
  pillar1Desc: string;
  pillar2Title: string;
  pillar2Desc: string;
  pillar3Title: string;
  pillar3Desc: string;
  pillar4Title?: string;
  pillar4Desc?: string;
  pillar5Title?: string;
  pillar5Desc?: string;
  pillar6Title?: string;
  pillar6Desc?: string;
  footerBrandName: string;
  footerCopyrightText: string;
}

export interface PlatformPortalThemeSettings {
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  heroGradientStart?: string;
  heroGradientEnd?: string;
  cardBackground?: string;
  buttonColor?: string;
}

export interface WatchVideosSectionColorSettings {
  titleBgColor: string;
  badgeBgColor: string;
  badgeTextColor: string;
  outerSectionBgColor: string;
  cardBgColor: string;
  cardSecondaryBgColor: string;
  cardBorderColor: string;
  coverImageUrl: string;
  coverOverlayOpacity: number;
  mainTitleColor: string;
  subtitleColor: string;
  helperTextColor: string;
  buttonBgColor: string;
  buttonFrameBgColor: string;
  buttonTextColor: string;
  iconBoxBgColor: string;
  iconColor: string;
  interactiveAccentColor: string;
}

export interface PlatformPortalSettings {
  visibility: PlatformPortalSectionsVisibility;
  texts: PlatformPortalTextSettings;
  theme?: PlatformPortalThemeSettings;
  watchVideosColors?: WatchVideosSectionColorSettings;
  logoUrl?: string;
  lastUpdated?: string;
  updatedBy?: string;
}

// ==================== PLATFORM ACTIVATION & PAYMENT TYPES ====================

export type PaymentMethod = 'bank_transfer' | 'cash_plus' | 'credit_card' | 'paypal' | 'other' | (string & {});
export type PaymentStatus = 'pending' | 'verified' | 'confirmed' | 'rejected' | 'cancelled';
export type PaymentType = 'activation' | 'renewal' | 'ad_campaign' | 'platform_support';

export type SupportedCurrency = 'MAD' | 'USD' | 'EUR' | 'SAR' | 'AED' | 'DZD' | 'TND' | 'QAR' | 'KWD' | 'BHD' | 'OMR' | 'JOD' | 'EGP' | 'GBP' | 'CAD' | 'MRU' | string;

export interface TenantPaymentRecord {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantSlug?: string;
  ownerId: string;
  ownerName: string;
  ownerPhone: string;
  amount: number;
  currency: SupportedCurrency;
  country: string;
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  type?: PaymentType; // 'activation', 'renewal', or 'ad_campaign'
  periodStart?: string; // ISO date of the covered subscription period or ad start
  periodEnd?: string; // ISO date of the covered subscription period or ad end
  monthsCount?: number; // عدد أشهر الحملة الإعلانية (1، 2، 3، 6، 12 شهر...)
  adCampaignTitle?: string; // عنوان أو تفاصيل الحملة الإعلانية
  adCampaignId?: string; // معرف الحملة الإعلانية المرتبطة عند التفعيل
  adCampaignRequestId?: string; // معرف طلب تدشين الحملة المرتبط
  createdAt: string; // ISO string
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  rejectionReason?: string;
  transactionReference?: string;
  proofDocumentUrl?: string;
  proofFileName?: string;
  cardLast4?: string;
  adminNotes?: string;
  notes?: string;
  planName?: string;
  paymentVerified?: boolean; // تم التحقق من الدفع وتأكيده من طرف الإدارة
  paymentVerifiedAt?: string;
  paymentVerifiedBy?: string;
  platformActivated?: boolean; // تم تفعيل المنصة إدارياً
  platformActivatedAt?: string;
  platformActivatedBy?: string;
  statusHistory?: PaymentStatusHistoryItem[]; // سجل حالة كل عملية
}

export interface PlatformPaymentSettings {
  activationFeeMad: number; // default: 199
  activationFeeUsd: number; // default: 20
  activationNoticeText?: string; // نص تنبيه وتسديد الاشتراك في أعلى صفحة تفعيل المنصة
  adCreationFeeMad?: number; // default: 199 (مبلغ إنشاء وترويج الإعلان بالدرهم المغربي)
  adCreationFeeUsd?: number; // default: 20 (مبلغ إنشاء وترويج الإعلان بالدولار الأمريكي)
  exchangeRate: number; // default: 9.95 or 10
  bankAccount: {
    enabled: boolean;
    accountHolder: string;
    bankName: string;
    rib: string;
    iban: string;
    additionalInstructions: string;
  };
  cashPlus: {
    enabled: boolean;
    beneficiaryName: string;
    phone: string;
    accountOrRef: string;
    instructions: string;
  };
  creditCard: {
    enabled: boolean;
    gatewayName: string;
    instructions: string;
  };
  paypal: {
    enabled: boolean;
    email: string;
    instructions: string;
  };
  lastUpdated?: string;
  updatedBy?: string;
}

// ==================== PLATFORM SUPPORT SETTINGS (إعدادات قسم دعم المنصة) ====================

export interface CustomSupportPaymentMethod {
  id: string;
  name: string;
  enabled: boolean;
  type: 'bank' | 'wallet' | 'card' | 'link' | 'cash' | 'other';
  icon?: string;
  paymentUrl?: string; // رابط الدفع المباشر (مثل رابط بايبال، سترايب، أو بوابة دفع خارجية)
  accountName?: string;
  accountNumber?: string; // RIB, Phone number, Email, or Gateway Ref
  instructions?: string;
  requiresReceipt?: boolean;
  countriesMode?: 'all' | 'specific'; // 'all' (جميع الدول) | 'specific' (دول محددة فقط)
  allowedCountries?: string[]; // قائمة الدول المسموح بظهور طريقة الدفع فيها
}

export interface PlatformSupportSettings {
  presetAmountsMad: number[];
  presetAmountsUsd: number[];
  allowCustomAmount: boolean;
  minCustomAmountMad: number;
  minCustomAmountUsd: number;
  bankAccount: {
    enabled: boolean;
    accountHolder: string;
    bankName: string;
    rib: string;
    iban: string;
    additionalInstructions: string;
    countriesMode?: 'all' | 'specific';
    allowedCountries?: string[];
  };
  cashPlus: {
    enabled: boolean;
    beneficiaryName: string;
    phone: string;
    accountOrRef: string;
    instructions: string;
    countriesMode?: 'all' | 'specific';
    allowedCountries?: string[];
    qrCodeEnabled?: boolean; // تفعيل الدفع عبر رمز QR
    qrCodeUrl?: string; // رابط أو مسار صورة رمز QR الدائم
    qrCodeFileName?: string; // اسم ملف صورة QR
    qrCodeInstructions?: string; // إرشادات المسح بالرمز
  };
  creditCard: {
    enabled: boolean;
    gatewayName: string;
    paymentUrl?: string; // رابط مباشر لبوابة البطاقات البنكية إن وجد
    instructions: string;
    countriesMode?: 'all' | 'specific';
    allowedCountries?: string[];
  };
  paypal: {
    enabled: boolean;
    email: string;
    paymentUrl?: string; // رابط مباشر لـ PayPal مثل https://paypal.me/username
    instructions: string;
    // تكامل PayPal API الحقيقي
    clientId?: string;
    mode?: 'sandbox' | 'live';
    isConnected?: boolean;
    lastTestedAt?: string;
    countriesMode?: 'all' | 'specific';
    allowedCountries?: string[];
  };
  customMethods: CustomSupportPaymentMethod[];
  lastUpdated?: string;
  updatedBy?: string;
}

export interface SupportDonationRecord {
  id: string;
  type: 'platform_support' | 'support';
  donorName: string;
  donorPhone?: string;
  donorNote?: string;
  amount: number;
  currency: string;
  paidAmount?: number;
  paidCurrency?: string;
  paymentMethod: string;
  paypalOrderId?: string;
  transactionId?: string;
  status: 'confirmed' | 'pending' | 'failed' | 'cancelled';
  mode?: 'sandbox' | 'live';
  createdAt: string;
  submittedAt?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  notes?: string;
  proofDocumentUrl?: string;
  proofFileName?: string;
  cardLast4?: string;
  transactionReference?: string;
  country?: string;
  rejectionReason?: string;
}

// ==================== PLATFORM ADVERTISING CAMPAIGNS (الحملات الإعلانية وترتيب الظهور) ====================

export type AdCampaignStatus = 'scheduled' | 'active' | 'expired';

export interface PlatformAdCampaign {
  id: string; // Unique campaign ID e.g. "ad_camp_1725900000000_abc"
  tenantId: string; // Association ID (e.g. "tenant_nour" or any created tenant)
  tenantName: string; // Cached Association name for fast display
  tenantSlug?: string;
  tenantLogoUrl?: string;
  tenantCity?: string;
  tenantCountry?: string;
  priorityOrder: number; // ترتيب الظهور في الصفحات الأولى (1 = الأول، 2 = الثاني، 3 = الثالث...)
  startDate: string; // ISO datetime string e.g. "2026-09-17T10:00:00.000Z" or "2026-09-17T10:00"
  endDate: string; // ISO datetime string e.g. "2026-09-24T23:59:59.000Z" or "2026-09-24T23:59"
  title?: string; // Optional campaign title or label
  notes?: string; // Admin notes or payment details
  enabled: boolean; // Active toggle (true / false)
  createdAt: string; // ISO string
  updatedAt?: string; // ISO string
  createdBy?: string;
}

// ==================== CAMPAIGN LAUNCH REQUESTS (طلبات تدشين حملة جديدة) ====================

export type AdCampaignRequestStatus = 
  | 'pending_payment' // في انتظار الدفع
  | 'paid_pending_review' // تم الدفع – في انتظار المراجعة
  | 'under_review' // قيد المراجعة
  | 'approved' // تمت الموافقة
  | 'rejected' // مرفوض
  | 'correction_requested' // طلب استكمال/تصحيح المعلومات
  | 'cancelled'; // ملغى

export type AdCampaignPaymentStatus = 
  | 'unpaid' // لم يتم الدفع
  | 'pending_verification' // تم الدفع وفي انتظار التحقق
  | 'confirmed' // مؤكد
  | 'refunded' // مسترجع
  | 'failed'; // فشل الدفع

export interface AdCampaignRequest {
  id: string; // Unique request ID e.g. "ad_req_1725900000000_abc"
  tenantId: string; // ID of the association
  tenantName: string; // Name of the association
  tenantSlug?: string;
  tenantLogoUrl?: string;
  tenantCity?: string;
  tenantCountry?: string;
  ownerId?: string;
  ownerName?: string;
  ownerPhone?: string;
  
  // Campaign Info
  campaignTitle: string; // اسم الحملة
  campaignDescription?: string; // وصف مختصر للحملة
  campaignBannerUrl?: string; // صورة أو بنر الحملة المرفوعة من معرض الجهاز
  monthsCount: number; // مدة الحملة بالشهور (1، 2، 3، 6، 12...)
  startDate: string; // تاريخ بداية الحملة
  endDate: string; // تاريخ نهاية الحملة
  requestedPriorityOrder?: number; // ترتيب الظهور المطلوب
  
  // Financial & Pricing Info
  amount: number; // المبلغ المطلوب
  currency: SupportedCurrency; // العملة
  monthlyRate: number; // السعر الشهري المعتمد
  
  // Statuses
  status: AdCampaignRequestStatus; // حالة الطلب
  paymentStatus: AdCampaignPaymentStatus; // حالة الدفع
  
  // Payment Submission Info (when paid)
  paymentId?: string; // معرف سجل الدفع المرتبط
  paymentMethod?: PaymentMethod; // طريقة الدفع
  paymentReference?: string; // رقم أو مرجع العملية
  paymentSubmittedAt?: string; // تاريخ ووقت الدفع
  paymentAmount?: number; // المبلغ المدفوع
  paymentCurrency?: SupportedCurrency;
  proofDocumentUrl?: string; // إثبات الدفع (صورة الوصل أو PDF)
  proofFileName?: string;
  cardLast4?: string;
  
  // Admin Decisions & Review Notes
  rejectionReason?: string; // سبب الرفض
  correctionNotes?: string; // ملاحظات طلب التصحيح
  adminNotes?: string; // ملاحظات الإدارة الداخلية
  reviewedAt?: string;
  reviewedBy?: string;
  approvedCampaignId?: string; // معرف الحملة الإعلانية المفعلة في PlatformAdCampaign
  
  // Timestamps
  createdAt?: string;
  updatedAt?: string;
}

// ==================== ASSOCIATION SECTIONS CENTRAL CONFIG (أقسام الجمعيات) ====================

export type AssociationSectionCategory = 
  | 'overview' 
  | 'financial' 
  | 'activities' 
  | 'members' 
  | 'branding' 
  | 'marketing' 
  | 'governance' 
  | 'security';

export interface AssociationSectionDefinition {
  key: AdminSectionKey;
  nameAr: string;
  nameFr?: string;
  nameEn?: string;
  category: AssociationSectionCategory;
  categoryLabelAr: string;
  descriptionAr: string;
  iconName: string;
  isCore?: boolean; // If true, marked as fundamental component
  enabledByDefault?: boolean;
}

export type AssociationSectionsVisibilityMap = Record<AdminSectionKey, boolean>;

export interface AssociationSectionsConfig {
  sectionsVisibility: AssociationSectionsVisibilityMap;
  sectionTitles?: Partial<Record<AdminSectionKey, string>>;
  sectionBrandNames?: Partial<Record<AdminSectionKey, string>>;
  hideBoardMembersPublicContact?: boolean;
  lastUpdated: string;
  updatedBy: string;
  version: number;
}

export interface TutorialVideo {
  id: string;
  title: string;
  description?: string;
  sourceType: 'url' | 'upload';
  videoUrl: string;
  originalFilename?: string;
  fileSize?: number;
  duration?: string;
  thumbnailUrl?: string;
  createdAt: string;
  updatedAt: string;
  tenantId?: string;
  addedBy?: string;
  order?: number;
  aspectRatio?: 'portrait' | 'landscape' | 'auto';
}

// ==================== PLATFORM SETUP SERVICE (سنقوم بإعداد منصة جمعيتك نيابة عنك) ====================

export interface PlatformSetupServiceItem {
  id: string;
  title: string;
  description: string;
}

export interface PlatformSetupServiceConfig {
  serviceFeeMad: number; // default: 150
  currency: SupportedCurrency; // default: 'MAD'
  title: string; // 'سنقوم بإعداد منصة جمعيتك نيابة عنك'
  introText: string;
  servicesHeading: string; // 'تشمل خدمتنا:'
  serviceItems: PlatformSetupServiceItem[];
  goalText: string; // '🤝 هدفنا هو أن نوفّر عليك الوقت والجهد، ونجعل منصة جمعيتك جاهزة للانطلاق.'
  updatedAt: string;
  updatedBy: string;
  version: number;
}

export type SetupServicePaymentStatus = 'pending_review' | 'verified' | 'rejected';
export type SetupServiceExecutionStatus = 'pending_review' | 'in_progress' | 'completed' | 'rejected';

export interface PlatformSetupServiceRequest {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantSlug?: string;
  tenantCity?: string;
  tenantCountry?: string;
  ownerId?: string;
  ownerName: string;
  ownerPhone: string;
  amount: number;
  currency: SupportedCurrency;
  paymentMethod: PaymentMethod;
  paymentMethodLabel: string;
  proofDocumentUrl?: string;
  proofFileName?: string;
  transactionReference?: string;
  notes?: string;
  paymentStatus: SetupServicePaymentStatus; // 'pending_review' (قيد المراجعة) | 'verified' (تم التحقق من الدفع) | 'rejected' (مرفوض)
  serviceStatus: SetupServiceExecutionStatus; // 'pending_review' (قيد المراجعة) | 'in_progress' (قيد الإعداد والتنفيذ) | 'completed' (مكتمل - تم إعداد المنصة) | 'rejected' (مرفوض)
  submittedAt: string;
  createdAt: string;
  updatedAt?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  rejectionReason?: string;
  adminNotes?: string;
}

