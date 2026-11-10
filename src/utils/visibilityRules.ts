import { UIElementConfig } from '../types';

export interface SectionVisibilityItem {
  id: string;
  nameAr: string;
  nameFr: string;
  nameEn: string;
  descriptionAr: string;
  category: 'core_activities' | 'official_records' | 'board_and_governance' | 'campaigns_and_donations' | 'transparency_and_finance' | 'membership_and_cards' | 'voting_and_democracy' | 'store_showcase';
  iconName: string;
  isCoreRequirement: boolean; // highlighted as explicitly requested by admin
}

export const CANONICAL_SECTIONS: SectionVisibilityItem[] = [
  // 1. أبرز الأعمال والأنشطة الخيرية المنجزة
  {
    id: 'featured_activities',
    nameAr: 'أبرز الأعمال والأنشطة الخيرية المنجزة',
    nameFr: 'Activités caritatives et réalisations phares',
    nameEn: 'Featured Charity Activities & Achievements',
    descriptionAr: 'معرض الأنشطة الخيرية الميدانية في الصفحة الرئيسية وصفحة الأنشطة مع الصور والفيديوهات والتواريخ',
    category: 'core_activities',
    iconName: 'HeartHandshake',
    isCoreRequirement: true,
  },
  // 2. سجل المنخرطين والمشتركين
  {
    id: 'gateway_members',
    nameAr: 'سجل المنخرطين والمشتركين',
    nameFr: 'Registre des adhérents et membres',
    nameEn: 'Members & Subscribers Registry',
    descriptionAr: 'قاعدة بيانات المنخرطين والمشتركين، أرقام العضوية، وحالة تسوية الاشتراكات والبطاقات',
    category: 'official_records',
    iconName: 'Users',
    isCoreRequirement: true,
  },
  // 3. أعضاء مجلس الجمعية
  {
    id: 'board_members',
    nameAr: 'أعضاء مجلس الجمعية',
    nameFr: 'Membres du bureau de l\'association',
    nameEn: 'Board Members & Executive Committee',
    descriptionAr: 'تشكيلة وأعضاء مجلس وإدارة الجمعية وتوزيع المهام والمسؤوليات الإدارية والقانونية',
    category: 'board_and_governance',
    iconName: 'Award',
    isCoreRequirement: true,
  },
  // 4. حملات التبرع والمشاريع الخيرية
  {
    id: 'campaigns_section',
    nameAr: 'حملات التبرع والمشاريع الخيرية',
    nameFr: 'Campagnes de collecte et projets ciblés',
    nameEn: 'Targeted Donation Campaigns & Projects',
    descriptionAr: 'عرض حملات التبرع المخصصة لتمويل مشاريع خيرية محددة مع نسبة التقدم وشريط التبرعات وسندات الدعم',
    category: 'campaigns_and_donations',
    iconName: 'Coins',
    isCoreRequirement: true,
  },
  // 5. بوابة السجل الشفافية المباشر
  {
    id: 'gateway_ledger',
    nameAr: 'بوابة السجل الشفافية المباشر',
    nameFr: 'Grand livre de transparence en direct',
    nameEn: 'Live Transparency Ledger',
    descriptionAr: 'سجل العمليات المالية والمداخيل والمصاريف الموثقة مع سندات الأداء والوصولات المعتمدة',
    category: 'transparency_and_finance',
    iconName: 'FileSpreadsheet',
    isCoreRequirement: true,
  },
  // 6. معاينة وثيقة وفاتورة الإثبات
  {
    id: 'proof_document_preview',
    nameAr: 'معاينة وثيقة وفاتورة الإثبات',
    nameFr: 'Aperçu des pièces justificatives et factures des réalisations',
    nameEn: 'Proof Document & Invoice Preview in Featured Activities',
    descriptionAr: 'التحكم في إمكانية مشاهدة أو تحميل معاينة وثيقة أو فاتورة الإثبات المرتبطة بالأنشطة والأعمال الخيرية المنجزة للزوار والغير المنخرطين مع إبقائها محفوظة في النظام ومتاحة للمنخرطين والإدارة',
    category: 'core_activities',
    iconName: 'FileText',
    isCoreRequirement: true,
  },
  // 7. الرصيد المالي الحالي
  {
    id: 'current_financial_balance',
    nameAr: 'الرصيد المالي الحالي',
    nameFr: 'Solde financier actuel',
    nameEn: 'Current Financial Balance',
    descriptionAr: 'التحكم في ظهور أو إخفاء رقم وقيمة الرصيد المالي اللحظي للجمعية في المكان المخصص له بواجهة المتجر وشريط التنقل للغير المنخرطين مع الحفاظ على القيمة الحقيقية للرصيد دون أي تعديل',
    category: 'transparency_and_finance',
    iconName: 'Coins',
    isCoreRequirement: true,
  },
  // 9. التصويت والقرارات
  {
    id: 'members_voting_section',
    nameAr: 'التصويت والقرارات (المشاركة الديمقراطية)',
    nameFr: 'Votes et résolutions des adhérents',
    nameEn: 'Voting & Resolutions System',
    descriptionAr: 'عرض قرارات وتصويتات الجمعية في واجهة المتجر الرئيسية وتمكين الأعضاء من الإدلاء بآرائهم',
    category: 'voting_and_democracy',
    iconName: 'Vote',
    isCoreRequirement: true,
  },
  // 10. بطاقة الانخراط
  {
    id: 'member_card',
    nameAr: 'بطاقة الانخراط ومعاينة العضوية',
    nameFr: 'Carte d\'adhésion et aperçu',
    nameEn: 'Membership Card & Preview',
    descriptionAr: 'معاينة وتحميل وصل وبطاقة الانخراط الرسمية المعتمدة بختم وإمضاء الجمعية والباركود',
    category: 'membership_and_cards',
    iconName: 'CreditCard',
    isCoreRequirement: true,
  },
  // 11. البانر التعريفي
  {
    id: 'hero_banner',
    nameAr: 'البانر التعريفي الرئيسي وصورة الغلاف',
    nameFr: 'Bannière d\'accueil principale',
    nameEn: 'Main Hero Banner & Cover',
    descriptionAr: 'البطاقة التعريفية العلوية بالجمعية، الشعار المؤسسي، نص الإشهار والأزرار التفاعلية',
    category: 'store_showcase',
    iconName: 'Sparkles',
    isCoreRequirement: false,
  },
  // 12. ميثاق الشفافية
  {
    id: 'transparency_pledge',
    nameAr: 'ميثاق الشفافية والمسؤولية المجتمعية',
    nameFr: 'Charte de transparence',
    nameEn: 'Transparency & Governance Pledge',
    descriptionAr: 'إعلان التزام الجمعية بالشفافية الكاملة ونشر السجلات المالية المعتمدة للعموم',
    category: 'store_showcase',
    iconName: 'ShieldCheck',
    isCoreRequirement: false,
  },
  // 14. القسم السفلي للسجلات
  {
    id: 'bottom_records_section',
    nameAr: 'القسم السفلي المخصص للسجلات والحسابات',
    nameFr: 'Section inférieure des registres',
    nameEn: 'Bottom Dedicated Records Section',
    descriptionAr: 'الكتلة السفلية المخصصة في الصفحة الرئيسية التي تضم بطاقات بوابات السجلات والشفافية والحسابات',
    category: 'official_records',
    iconName: 'Layers',
    isCoreRequirement: false,
  },
  // 15. الحساب البنكي RIB
  {
    id: 'bank_rib_card',
    nameAr: 'بطاقة الحساب البنكي للتبرع والمساهمات (RIB)',
    nameFr: 'Coordonnées bancaires RIB',
    nameEn: 'Bank RIB & Account Details',
    descriptionAr: 'عرض رقم الحساب البنكي الرسمي ومعلومات التحويل المالي للمساهمات في الواجهة والفوتر',
    category: 'transparency_and_finance',
    iconName: 'CreditCard',
    isCoreRequirement: false,
  },
  // 16. زر استخراج الكشف المالي
  {
    id: 'nav_report_button',
    nameAr: 'زر استخراج الكشف المالي الرسمي (الشريط العلوي)',
    nameFr: 'Bouton du rapport financier officiel',
    nameEn: 'Official Financial Report Button',
    descriptionAr: 'زر طباعة وتحميل التقرير المالي المعتمد بختم وإمضاء الجمعية في شريط التنقل العلوي',
    category: 'transparency_and_finance',
    iconName: 'FileCheck',
    isCoreRequirement: false,
  },
];

// The 7 unified primary transparency and feature sections for non-members
export const PRIMARY_TRANSPARENCY_SECTION_IDS = [
  'featured_activities',
  'gateway_members',
  'board_members',
  'campaigns_section',
  'gateway_ledger',
  'proof_document_preview',
  'current_financial_balance',
] as const;

// Alias mapping between navigation tabs / component identifiers and canonical section IDs
export const SECTION_ALIASES: Record<string, string> = {
  // Activities aliases
  'activities': 'featured_activities',
  'activity': 'featured_activities',
  'nav_tab_activities': 'featured_activities',
  'featured_activity': 'featured_activities',
  
  // Members aliases
  'members': 'gateway_members',
  'member': 'gateway_members',
  'nav_tab_members': 'gateway_members',
  
  // Board members aliases
  'board-members': 'board_members',
  'boardMembers': 'board_members',
  'board_member': 'board_members',
  
  // Campaigns aliases
  'campaigns': 'campaigns_section',
  'campaign': 'campaigns_section',
  'donations': 'campaigns_section',
  'nav_tab_campaigns': 'campaigns_section',
  
  // Ledger aliases
  'ledger': 'gateway_ledger',
  'expenses': 'gateway_ledger',
  'nav_tab_ledger': 'gateway_ledger',
  
  // Financials aliases
  'financials': 'gateway_financials',
  'balance': 'gateway_financials',
  'dashboard': 'gateway_financials',
  'nav_tab_financials': 'gateway_financials',
  
  // Balance aliases
  'current_balance': 'current_financial_balance',
  'currentBalance': 'current_financial_balance',
  'nav_balance_badge': 'current_financial_balance',
  'balance_badge': 'current_financial_balance',

  // Proof Document Preview aliases
  'proof_document': 'proof_document_preview',
  'proof_preview': 'proof_document_preview',
  'activity_proof_preview': 'proof_document_preview',
  'activity_proof': 'proof_document_preview',
  
  // Voting aliases
  'voting': 'members_voting_section',
  'polls': 'members_voting_section',
  'poll': 'members_voting_section',
  'resolutions': 'members_voting_section',
  
  // Member card aliases
  'memberCard': 'member_card',
  'member_cards': 'member_card',
  'card': 'member_card',
  'card_preview': 'member_card',

  // Announcements aliases
  'announcements': 'announcements_banner',
  'announcement': 'announcements_banner',
  'news_ticker': 'announcements_banner',

  // Quick actions
  'actions': 'quick_actions',
  'quick_action_bar': 'quick_actions',

  // Goals
  'goals': 'association_goals',
  'pillars': 'association_goals',

  // Join CTA
  'join_cta': 'join_cta_banner',
  'join_banner': 'join_cta_banner',

  // Recent operations
  'recent_ops': 'recent_operations_preview',
  'recent_operations': 'recent_operations_preview',

  // Contact
  'contact': 'contact_card',
  'office': 'contact_card',

  // Footer & Social
  'social_links': 'footer_social_links',
  'social': 'footer_social_links',
  'footer_links': 'footer_quick_links',
  'footer_contact': 'footer_contact_info',
};

/**
 * Resolves any alias to its canonical section ID
 */
export function resolveCanonicalSectionId(sectionOrAlias: string): string {
  if (SECTION_ALIASES[sectionOrAlias]) {
    return SECTION_ALIASES[sectionOrAlias];
  }
  return sectionOrAlias;
}

/**
 * Central security & display authority for whether a section is visible to a user.
 * 
 * Rules:
 * 1. Super Admins & Sub-Admins: All enabled sections are visible.
 * 2. Logged-in Members: All enabled sections are visible (unrestricted view as requested).
 * 3. Non-Members / Visitors: An enabled section is ONLY visible if `visibleToNonMembers !== false`.
 */
export function isSectionVisibleForUser(
  sectionIdOrOptions:
    | string
    | {
        sectionId: string;
        uiElements?: UIElementConfig[];
        isMember?: boolean;
        isAdmin?: boolean;
      },
  options?: {
    uiElements?: UIElementConfig[];
    isMember?: boolean;
    isAdmin?: boolean;
  }
): boolean {
  let sectionId: string;
  let uiElements: UIElementConfig[];
  let isMember: boolean;
  let isAdmin: boolean;

  if (typeof sectionIdOrOptions === 'string') {
    sectionId = sectionIdOrOptions;
    uiElements = options?.uiElements || [];
    isMember = !!options?.isMember;
    isAdmin = !!options?.isAdmin;
  } else {
    sectionId = sectionIdOrOptions.sectionId;
    uiElements = sectionIdOrOptions.uiElements || [];
    isMember = !!sectionIdOrOptions.isMember;
    isAdmin = !!sectionIdOrOptions.isAdmin;
  }

  const canonicalId = resolveCanonicalSectionId(sectionId);
  if (
    canonicalId === 'pillars_section' ||
    sectionId === 'pillars_section' ||
    canonicalId === 'gateway_financials' ||
    sectionId === 'gateway_financials' ||
    sectionId === 'financials' ||
    sectionId === 'nav_tab_financials'
  ) {
    return false;
  }

  // Current financial balance is strictly visible ONLY to logged-in members and admins, and hidden from visitors/non-members
  if (canonicalId === 'current_financial_balance') {
    return Boolean(isAdmin || isMember);
  }

  const element = uiElements.find((e) => e.id === canonicalId || e.id === sectionId);

  // If element not registered in system, default to visible
  if (!element) {
    return true;
  }

  // If element is globally disabled by admin, no one sees it in the store
  if (element.enabled === false) {
    return false;
  }

  // Logged-in Members and Admins see all enabled sections without any non-member restriction
  if (isAdmin || isMember) {
    return true;
  }

  // Non-members / Visitors: only see sections explicitly enabled for non-members
  return element.visibleToNonMembers !== false;
}

/**
 * Extract a simple dictionary { [canonicalSectionId]: boolean } from UIElementConfig[]
 */
export function getNonMemberVisibilityMap(uiElements: UIElementConfig[]): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  
  // Start with canonical defaults
  CANONICAL_SECTIONS.forEach((section) => {
    map[section.id] = section.id === 'current_financial_balance' ? false : true;
  });

  // Overlay with uiElements configuration
  uiElements.forEach((el) => {
    map[el.id] = el.id === 'current_financial_balance' ? false : (el.visibleToNonMembers !== false);
  });

  map['current_financial_balance'] = false;

  return map;
}

/**
 * Apply a visibility dictionary to an existing UIElementConfig[] array
 */
export function applyVisibilityMapToUIElements(
  uiElements: UIElementConfig[],
  visibilityMap: Record<string, boolean>
): UIElementConfig[] {
  return uiElements.map((el) => {
    if (el.id === 'current_financial_balance') {
      return {
        ...el,
        enabled: true,
        visibleToNonMembers: false,
      };
    }
    const isVisible = visibilityMap[el.id];
    return {
      ...el,
      visibleToNonMembers: isVisible !== undefined ? isVisible : (el.visibleToNonMembers !== false),
    };
  });
}

/**
 * Checks specifically whether proof/invoice previews in featured activities are visible to the user.
 * - Admin or Logged-in Members: Always visible (full access).
 * - Non-Members / Visitors: Visible ONLY if `proof_document_preview` is enabled.
 */
export function isProofPreviewVisibleForUser(options: {
  uiElements?: UIElementConfig[];
  isMember?: boolean;
  isAdmin?: boolean;
}): boolean {
  return isSectionVisibleForUser('proof_document_preview', options);
}

/**
 * Checks specifically whether the current financial balance is visible to the user.
 * - Admin or Logged-in Members: Always visible (full access).
 * - Non-Members / Visitors: Completely hidden.
 */
export function isCurrentBalanceVisibleForUser(options: {
  uiElements?: UIElementConfig[];
  isMember?: boolean;
  isAdmin?: boolean;
}): boolean {
  return Boolean(options.isAdmin || options.isMember);
}

