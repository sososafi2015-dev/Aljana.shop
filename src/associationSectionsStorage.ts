import { useState, useEffect } from 'react';
import { 
  AdminSectionKey, 
  AssociationSectionCategory, 
  AssociationSectionDefinition, 
  AssociationSectionsConfig, 
  AssociationSectionsVisibilityMap 
} from './types';

export const ASSOCIATION_SECTIONS_STORAGE_KEY = 'chayef_assoc_sections_central_config_v1';
export const ASSOCIATION_SECTIONS_CHANGED_EVENT = 'association-sections-changed';

function readConfigFromLocalStorage(fallback: AssociationSectionsConfig): AssociationSectionsConfig {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return fallback;
  }
  try {
    const raw = window.localStorage.getItem(ASSOCIATION_SECTIONS_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw) as AssociationSectionsConfig;
    }
  } catch {}
  return fallback;
}

function writeConfigToLocalStorage(data: AssociationSectionsConfig): void {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(ASSOCIATION_SECTIONS_STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

/**
 * Full catalogue of all 21 sections inside Association Admin Dashboard
 */
export const ALL_ASSOCIATION_SECTIONS: AssociationSectionDefinition[] = [
  // 1. Overview / Stats
  {
    key: 'overview',
    nameAr: 'نظرة عامة والإحصائيات العامة',
    nameFr: 'Aperçu et Statistiques',
    nameEn: 'Overview & Statistics',
    category: 'overview',
    categoryLabelAr: 'الإحصائيات والتقارير',
    descriptionAr: 'المؤشرات المالية والإحصائية السريعة: إجمالي المنخرطين، المداخيل، المصاريف، والرصيد المالي الحالي.',
    iconName: 'LayoutDashboard',
    isCore: true,
    enabledByDefault: true,
  },

  // 2. Financial Operations
  {
    key: 'operations',
    nameAr: 'جميع العمليات المالية (مداخيل ومصاريف)',
    nameFr: 'Opérations Financières',
    nameEn: 'Financial Operations',
    category: 'financial',
    categoryLabelAr: 'المالية والمحاسبة',
    descriptionAr: 'جدول المداخيل والمصاريف، البحث والتصفية، تعديل السجلات، رفع الفواتير وإعادة احتساب الرصيد.',
    iconName: 'TrendingUp',
    isCore: true,
    enabledByDefault: true,
  },

  // 3. Member Contributions
  {
    key: 'contributions',
    nameAr: 'سجل المساهمات والانخراطات',
    nameFr: 'Cotisations et Contributions',
    nameEn: 'Contributions & Dues',
    category: 'financial',
    categoryLabelAr: 'المالية والمحاسبة',
    descriptionAr: 'سجل مدفوعات الانخراطات السنوية والمساهمات، إصدار الوصولات الفورية، وإثباتات الأداء المرفقة.',
    iconName: 'Coins',
    isCore: true,
    enabledByDefault: true,
  },

  // 4. Donations Benefit
  {
    key: 'donationsBenefit',
    nameAr: 'اجعل منصتك ظاهرة للعموم للحصول على التبرعات المالية',
    nameFr: 'Rendre votre plateforme visible au public pour recevoir des dons financiers (syoumax)',
    nameEn: 'Make Your Platform Publicly Visible to Receive Financial Donations (syoumax)',
    category: 'financial',
    categoryLabelAr: 'المالية والمحاسبة',
    descriptionAr: 'تحكم في ظهور جمعيتكم بواجهة syoumax منصة العمل الجمعوي وضبط وتفعيل الحسابات البنكية وطرق الدفع لتلقي التبرعات المالية.',
    iconName: 'HeartHandshake',
    isCore: false,
    enabledByDefault: true,
  },

  // 5. Featured Activities
  {
    key: 'activities',
    nameAr: 'أبرز الأعمال والأنشطة الخيرية',
    nameFr: 'Activités et Projets',
    nameEn: 'Charitable Activities',
    category: 'activities',
    categoryLabelAr: 'الأنشطة والمشاريع',
    descriptionAr: 'نشر وإدارة الأنشطة والفعاليات الخيرية، معارض الصور، مقاطع الفيديو، والتقارير الميدانية المصورة.',
    iconName: 'Heart',
    isCore: true,
    enabledByDefault: true,
  },

  // 6. Donation Campaigns
  {
    key: 'campaigns',
    nameAr: 'حملة تبرع والمشاريع الخيرية',
    nameFr: 'Campagnes de Dons',
    nameEn: 'Donation Campaigns',
    category: 'activities',
    categoryLabelAr: 'الأنشطة والمشاريع',
    descriptionAr: 'إنشاء وإدارة حملات جمع التبرعات والمشاريع الخيرية، تتبع الأهداف المالية، والمساهمين.',
    iconName: 'HeartHandshake',
    isCore: false,
    enabledByDefault: true,
  },

  // 7. Members Directory
  {
    key: 'members',
    nameAr: 'إدارة وقائمة المنخرطين والاشتراكات',
    nameFr: 'Gestion des Adhérents',
    nameEn: 'Members Directory',
    category: 'members',
    categoryLabelAr: 'المنخرطون والمكتب المسير',
    descriptionAr: 'قائمة المنخرطين، تفعيل العضويات، تعديل البيانات، تتبع التجديد السنوي، وطباعة بطاقات الانخراط.',
    iconName: 'Users',
    isCore: true,
    enabledByDefault: true,
  },

  // 8. Board Members
  {
    key: 'boardMembers',
    nameAr: 'أعضاء مكتب الجمعية',
    nameFr: 'Membres du Bureau',
    nameEn: 'Board Members',
    category: 'members',
    categoryLabelAr: 'المنخرطون والمكتب المسير',
    descriptionAr: 'تعيين وتوزيع مناصب المكتب المسير وترتيب الهرم الإداري والقيادي للظهور في واجهة المنصة.',
    iconName: 'Award',
    isCore: true,
    enabledByDefault: true,
  },

  // 9. Registration Fields
  {
    key: 'fields',
    nameAr: 'إدارة حقول تسجيل المنخرطين',
    nameFr: 'Champs d\'Inscription',
    nameEn: 'Registration Fields',
    category: 'members',
    categoryLabelAr: 'المنخرطون والمكتب المسير',
    descriptionAr: 'تخصيص وترتيب حقول تسجيل المنخرطين، تحديد الحقول الإلزامية والاختيارية، وإضافة أو تعديل أو حذف الحقول.',
    iconName: 'SlidersHorizontal',
    isCore: false,
    enabledByDefault: true,
  },

  // 10. Branding & Identity
  {
    key: 'branding',
    nameAr: 'شعار التطبيق وغلاف البانر وألوان الهوية',
    nameFr: 'Identité Visuelle & Logo',
    nameEn: 'Branding & Identity',
    category: 'branding',
    categoryLabelAr: 'الهوية والتخصيص',
    descriptionAr: 'تغيير الشعار الرسمي للجمعية، بنر الغلاف العلوي، وألوان القالب ونظام التخصيص البصري.',
    iconName: 'ImageIcon',
    isCore: true,
    enabledByDefault: true,
  },

  // 11. Member Card Customization
  {
    key: 'memberCard',
    nameAr: 'تعديل وصل / بطاقة المنخرط',
    nameFr: 'Carte d\'Adhérent & Reçu',
    nameEn: 'Member Card & Receipt',
    category: 'branding',
    categoryLabelAr: 'الهوية والتخصيص',
    descriptionAr: 'تخصيص الهوية البصرية لبطاقة الانخراط ووصل المساهمة وتحديد الحقول المطبوعة والباركود.',
    iconName: 'CreditCard',
    isCore: false,
    enabledByDefault: true,
  },

  // 12. Public UI Elements
  {
    key: 'uiElements',
    nameAr: 'إدارة ظهور أقسام الواجهة العامة',
    nameFr: 'Éléments d\'Interface Publique',
    nameEn: 'Public UI Elements',
    category: 'branding',
    categoryLabelAr: 'الهوية والتخصيص',
    descriptionAr: 'التحكم في إظهار أو إخفاء أقسام واجهة المتجر العامة (البانر، الأنشطة، الأعضاء، المؤشرات...).',
    iconName: 'Eye',
    isCore: false,
    enabledByDefault: true,
  },

  // 13. Create & Promote Ad
  {
    key: 'createAd',
    nameAr: 'إنشاء إعلان وترويج الجمعية',
    nameFr: 'Création de Publicité',
    nameEn: 'Create Ad & Promotion',
    category: 'marketing',
    categoryLabelAr: 'التسويق والإعلام',
    descriptionAr: 'طلب تدشين حملات ترويجية مدفوعة لظهور الجمعية وأنشطتها بالصفحة الأولى في بوابة المنصة المركزية.',
    iconName: 'Megaphone',
    isCore: false,
    enabledByDefault: true,
  },

  // 14. Polls & Voting
  {
    key: 'polls',
    nameAr: 'التصويت والقرارات التشاركية',
    nameFr: 'Votes et Sondages',
    nameEn: 'Polls & Voting',
    category: 'governance',
    categoryLabelAr: 'الحكامة والقرارات',
    descriptionAr: 'طرح استطلاعات الرأي والتصويت الإلكتروني لأعضاء الجمعية على القرارات والمبادرات السنوية.',
    iconName: 'Vote',
    isCore: false,
    enabledByDefault: true,
  },

  // 15. Non-Member Visibility
  {
    key: 'nonMemberVisibility',
    nameAr: 'تحكم ظهور الأقسام لغير المنخرطين',
    nameFr: 'Visibilité Non-Adhérents',
    nameEn: 'Non-Member Visibility',
    category: 'governance',
    categoryLabelAr: 'الحكامة والقرارات',
    descriptionAr: 'تحديد صلاحيات الاطلاع على الأقسام والبيانات بين العموم والمنخرطين المسجلين فقط.',
    iconName: 'EyeOff',
    isCore: false,
    enabledByDefault: true,
  },

  // 16. Access Control
  {
    key: 'accessControl',
    nameAr: 'تحكم في الدخول إلى لوحة التحكم',
    nameFr: 'Contrôle d\'Accès Admin',
    nameEn: 'Admin Access Control',
    category: 'security',
    categoryLabelAr: 'الأمان والإدارة',
    descriptionAr: 'ضبط طرق تسجيل الدخول: إظهار أو إخفاء زر الإدارة، وتفعيل الدخول السري بالنقر ثلاث مرات على الشعار.',
    iconName: 'ShieldCheck',
    isCore: true,
    enabledByDefault: true,
  },

  // 17. Association Settings
  {
    key: 'settings',
    nameAr: 'بيانات الجمعية والإعدادات',
    nameFr: 'Paramètres de l\'Association',
    nameEn: 'Association Settings',
    category: 'security',
    categoryLabelAr: 'الأمان والإدارة',
    descriptionAr: 'البيانات الرسمية، العنوان، البريد الإلكتروني، أرقام التواصل، رقم الحساب البنكي RIB، ومواقع التواصل.',
    iconName: 'Settings',
    isCore: true,
    enabledByDefault: true,
  },

  // 18. Secondary Sub-Admins
  {
    key: 'subAdmins',
    nameAr: 'إدارة أدمن من الدرجة الثانية',
    nameFr: 'Gestion des Sous-Administrateurs',
    nameEn: 'Secondary Sub-Admins',
    category: 'security',
    categoryLabelAr: 'الأمان والإدارة',
    descriptionAr: 'إضافة وتعيين مسؤولي إدارة مساعدين وتحديد صلاحياتهم المخصصة (عرض، إضافة، تعديل، حذف) على الأقسام.',
    iconName: 'UserPlus',
    isCore: false,
    enabledByDefault: true,
  },

  // 19. Audit Logs
  {
    key: 'audit',
    nameAr: 'سجل التدقيق والرقابة الإدارية',
    nameFr: 'Journal d\'Audit',
    nameEn: 'Audit Trail',
    category: 'security',
    categoryLabelAr: 'الأمان والإدارة',
    descriptionAr: 'تتبع كافة العمليات والتعديلات والإجراءات المتخذة بالمنصة مع هوية المسؤول وتوقيت الإجراء بدقة.',
    iconName: 'History',
    isCore: false,
    enabledByDefault: true,
  },

  // 20. Backup & Restore
  {
    key: 'backup',
    nameAr: 'النسخ الاحتياطي واسترجاع البيانات',
    nameFr: 'Sauvegarde et Restauration',
    nameEn: 'Backup & Restore',
    category: 'security',
    categoryLabelAr: 'الأمان والإدارة',
    descriptionAr: 'تصدير نسخة احتياطية كاملة من قاعدة بيانات الجمعية بصيغة JSON واسترجاعها أو إعادة ضبط النظام.',
    iconName: 'Database',
    isCore: false,
    enabledByDefault: true,
  },

  // 21. Subscription Renewal
  {
    key: 'subscriptionRenewal',
    nameAr: 'تجديد الاشتراك ومعلومات المنظومة',
    nameFr: 'Renouvellement d\'Abonnement',
    nameEn: 'Subscription Renewal',
    category: 'security',
    categoryLabelAr: 'الأمان والإدارة',
    descriptionAr: 'متابعة فترة اشتراك منصة الجمعية، باقة الاشتراك المعتمدة، وتاريخ التجديد السنوي/الشهري.',
    iconName: 'RefreshCw',
    isCore: false,
    enabledByDefault: true,
  },

  // 22. Platform Tutorials (تعلم كيفية استخدام المنصة)
  {
    key: 'platformTutorials',
    nameAr: 'تعلم كيفية استخدام المنصة',
    nameFr: 'Apprendre à Utiliser la Plateforme',
    nameEn: 'Learn Platform Usage',
    category: 'security',
    categoryLabelAr: 'الأمان والإدارة',
    descriptionAr: 'فيديوهات وشروحات لكيفية إدارة أقسام المنصة، إضافة المنخرطين، تدبير العمليات المالية، وتدشين الحملات.',
    iconName: 'GraduationCap',
    isCore: false,
    enabledByDefault: true,
  },

  // 23. Platform Setup Service (سنقوم بإعداد منصة جمعيتك نيابة عنك)
  {
    key: 'platformSetupService',
    nameAr: 'سنقوم بإعداد منصة جمعيتك نيابة عنك',
    nameFr: 'Configuration Complète de Votre Plateforme',
    nameEn: 'We Will Set Up Your Association Platform For You',
    category: 'security',
    categoryLabelAr: 'الأمان والإدارة',
    descriptionAr: 'سنتولى إعداد وتجهيز واجهة منصة جمعيتك بعناية واحترافية، مع إدخال جميع معلوماتها وبياناتها الأساسية لتكون جاهزة للاستخدام.',
    iconName: 'Sparkles',
    isCore: false,
    enabledByDefault: true,
  },
];

/**
 * Builds the default visibility map where all sections are enabled
 */
export function getDefaultSectionsVisibilityMap(): AssociationSectionsVisibilityMap {
  const map: Partial<AssociationSectionsVisibilityMap> = {};
  for (const item of ALL_ASSOCIATION_SECTIONS) {
    map[item.key] = true;
  }
  return map as AssociationSectionsVisibilityMap;
}

export const defaultAssociationSectionsConfig: AssociationSectionsConfig = {
  sectionsVisibility: getDefaultSectionsVisibilityMap(),
  sectionTitles: {
    donationsBenefit: 'اجعل منصتك ظاهرة للعموم للحصول على التبرعات المالية',
  },
  sectionBrandNames: {
    donationsBenefit: 'syoumax',
  },
  lastUpdated: new Date().toISOString(),
  updatedBy: 'الإدارة العامة للمنصة',
  version: 1,
};

/**
 * Loads the current central sections configuration from persistent storage
 */
export function getAssociationSectionsConfig(): AssociationSectionsConfig {
  const loaded = readConfigFromLocalStorage(defaultAssociationSectionsConfig);

  // Guarantee every defined section key has a boolean entry (defaults to true if new section added)
  const mergedVisibility: AssociationSectionsVisibilityMap = {
    ...getDefaultSectionsVisibilityMap(),
    ...(loaded.sectionsVisibility || {}),
  };

  return {
    ...defaultAssociationSectionsConfig,
    ...loaded,
    sectionsVisibility: mergedVisibility,
    sectionTitles: {
      ...(loaded.sectionTitles || {}),
      donationsBenefit: 'اجعل منصتك ظاهرة للعموم للحصول على التبرعات المالية',
    },
    sectionBrandNames: {
      ...(loaded.sectionBrandNames || {}),
      donationsBenefit: 'syoumax',
    },
  };
}

/**
 * Checks if a specific section is centrally enabled by General Administration.
 * Applies across Al-Nour accredited template AND all other current and future tenants.
 */
export function isAssociationSectionEnabled(sectionKey: AdminSectionKey | string): boolean {
  const config = getAssociationSectionsConfig();
  const val = config.sectionsVisibility[sectionKey as AdminSectionKey];
  // Default to true if not explicitly set to false
  return val !== false;
}

let lastLocalMutationTime = 0;
let lastServerSyncTime = 0;
let inFlightSyncPromise: Promise<AssociationSectionsConfig> | null = null;

/**
 * Synchronizes the central sections configuration between browser storage and the permanent server database
 */
export async function syncAssociationSectionsFromServer(force = false): Promise<AssociationSectionsConfig> {
  if (typeof window === 'undefined') {
    return getAssociationSectionsConfig();
  }
  const now = Date.now();
  if (!force && inFlightSyncPromise) {
    return inFlightSyncPromise;
  }
  if (!force && now - lastServerSyncTime < 4000) {
    return getAssociationSectionsConfig();
  }

  const requestStartTime = now;
  inFlightSyncPromise = (async () => {
    try {
      const res = await fetch('/api/association-sections', {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        return getAssociationSectionsConfig();
      }
      const data = await res.json();
      lastServerSyncTime = Date.now();

      // Do not overwrite if a local save/toggle occurred while the GET request was in flight
      if (lastLocalMutationTime >= requestStartTime) {
        return getAssociationSectionsConfig();
      }

      if (data && data.success && data.config && data.config.sectionsVisibility) {
        const serverConfig: AssociationSectionsConfig = data.config;
        const localRaw = localStorage.getItem(ASSOCIATION_SECTIONS_STORAGE_KEY);
        const localConfig = getAssociationSectionsConfig();

        // If local had unsynced local mutations with higher version, push to server
        const localVersion = localConfig.version || 1;
        const serverVersion = serverConfig.version || 1;

        if (localRaw && localVersion > serverVersion) {
          await fetch('/api/association-sections', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ config: localConfig, updatedBy: localConfig.updatedBy }),
          }).catch(() => {});
          return localConfig;
        }

        const merged: AssociationSectionsConfig = {
          ...defaultAssociationSectionsConfig,
          ...serverConfig,
          sectionsVisibility: {
            ...getDefaultSectionsVisibilityMap(),
            ...(serverConfig.sectionsVisibility || {}),
          },
          sectionTitles: {
            ...(serverConfig.sectionTitles || {}),
            donationsBenefit: 'اجعل منصتك ظاهرة للعموم للحصول على التبرعات المالية',
          },
          sectionBrandNames: {
            ...(serverConfig.sectionBrandNames || {}),
            donationsBenefit: 'syoumax',
          },
        };

        writeConfigToLocalStorage(merged);
        window.dispatchEvent(
          new CustomEvent(ASSOCIATION_SECTIONS_CHANGED_EVENT, {
            detail: merged,
          })
        );
        return merged;
      }
    } catch {
      // Fallback to local configuration if network error
    } finally {
      inFlightSyncPromise = null;
    }
    return getAssociationSectionsConfig();
  })();

  return inFlightSyncPromise;
}

/**
 * Saves the updated configuration to persistent storage, syncs with backend database, and dispatches a broadcast event
 */
export async function saveAssociationSectionsConfig(
  config: AssociationSectionsConfig,
  updatedBy: string = 'الإدارة العامة'
): Promise<AssociationSectionsConfig> {
  lastLocalMutationTime = Date.now();
  const current = getAssociationSectionsConfig();
  const payload: AssociationSectionsConfig = {
    ...config,
    sectionsVisibility: {
      ...getDefaultSectionsVisibilityMap(),
      ...(config.sectionsVisibility || {}),
    },
    sectionTitles: {
      ...(current.sectionTitles || {}),
      ...(config.sectionTitles || {}),
      donationsBenefit: 'اجعل منصتك ظاهرة للعموم للحصول على التبرعات المالية',
    },
    sectionBrandNames: {
      ...(current.sectionBrandNames || {}),
      ...(config.sectionBrandNames || {}),
      donationsBenefit: 'syoumax',
    },
    lastUpdated: new Date().toISOString(),
    updatedBy,
    version: Math.max((current.version || 1), (config.version || 1)) + 1,
  };

  writeConfigToLocalStorage(payload);

  // Dispatch custom event immediately so all components update in real time without lag
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(ASSOCIATION_SECTIONS_CHANGED_EVENT, {
        detail: payload,
      })
    );

    try {
      await fetch('/api/association-sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: payload, updatedBy }),
      });
      lastServerSyncTime = Date.now();
    } catch (err) {
      console.warn('[AssociationSections] Failed to sync to server database:', err);
    }
  }

  return payload;
}

/**
 * Toggle a single section visibility and immediately persist to local & server storage
 */
export async function toggleAssociationSection(
  sectionKey: AdminSectionKey,
  updatedBy: string = 'الإدارة العامة'
): Promise<boolean> {
  const current = getAssociationSectionsConfig();
  const currentVal = current.sectionsVisibility[sectionKey] !== false;
  const nextVal = !currentVal;
  const updatedMap: AssociationSectionsVisibilityMap = {
    ...current.sectionsVisibility,
    [sectionKey]: nextVal,
  };
  await saveAssociationSectionsConfig(
    {
      ...current,
      sectionsVisibility: updatedMap,
    },
    updatedBy
  );
  return nextVal;
}

/**
 * Resets all association section visibilities to default (all enabled)
 */
export async function resetAssociationSectionsConfig(updatedBy: string = 'الإدارة العامة'): Promise<AssociationSectionsConfig> {
  lastLocalMutationTime = Date.now();
  const current = getAssociationSectionsConfig();
  const resetConfig: AssociationSectionsConfig = {
    sectionsVisibility: getDefaultSectionsVisibilityMap(),
    lastUpdated: new Date().toISOString(),
    updatedBy,
    version: (current.version || 1) + 1,
  };

  writeConfigToLocalStorage(resetConfig);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(ASSOCIATION_SECTIONS_CHANGED_EVENT, {
        detail: resetConfig,
      })
    );

    try {
      await fetch('/api/association-sections/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updatedBy }),
      });
      lastServerSyncTime = Date.now();
    } catch {}
  }
  return resetConfig;
}

/**
 * React hook for live reactive subscription to association sections configuration
 */
export function useAssociationSectionsConfig() {
  const [config, setConfig] = useState<AssociationSectionsConfig>(getAssociationSectionsConfig);

  useEffect(() => {
    let isMounted = true;

    const handleUpdate = (e?: any) => {
      if (!isMounted) return;
      if (e?.detail?.sectionsVisibility) {
        setConfig(e.detail);
      } else {
        setConfig(getAssociationSectionsConfig());
      }
    };

    window.addEventListener(ASSOCIATION_SECTIONS_CHANGED_EVENT, handleUpdate);
    window.addEventListener('storage', handleUpdate);

    // Initial server sync
    syncAssociationSectionsFromServer().then((synced) => {
      if (isMounted) setConfig(synced);
    }).catch(() => {});

    return () => {
      isMounted = false;
      window.removeEventListener(ASSOCIATION_SECTIONS_CHANGED_EVENT, handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const isEnabled = (sectionKey: AdminSectionKey | string): boolean => {
    const val = config.sectionsVisibility[sectionKey as AdminSectionKey];
    return val !== false;
  };

  return {
    config,
    isEnabled,
    reload: () => {
      setConfig(getAssociationSectionsConfig());
      syncAssociationSectionsFromServer(true).then((synced) => setConfig(synced)).catch(() => {});
    },
  };
}
