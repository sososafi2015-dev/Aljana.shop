import { PlatformPortalSettings, PlatformPortalThemeSettings, WatchVideosSectionColorSettings } from './types';
import { ensurePermanentImageUrl } from './api/imageApi';
import { db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export const PORTAL_SETTINGS_STORAGE_KEY = 'smart_platform_portal_ui_settings_v1';
export const PORTAL_SETTINGS_EVENT = 'portal-settings-changed';

export const DEFAULT_DONATIONS_COVER_IMAGE =
  'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=1600&q=80';
export const DEFAULT_DONATIONS_COVER_OPACITY = 85; // 85% opacity overlay

export const DEFAULT_WATCH_VIDEOS_COVER_IMAGE =
  'https://images.unsplash.com/photo-1551434678-e076c223a692?auto=format&fit=crop&w=1400&q=80';

export const DEFAULT_WATCH_VIDEOS_COLORS: WatchVideosSectionColorSettings = {
  titleBgColor: '#064e3b',
  badgeBgColor: '#065f46',
  badgeTextColor: '#a7f3d0',
  outerSectionBgColor: '#f8fafc',
  cardBgColor: '#022c22',
  cardSecondaryBgColor: '#064e3b',
  cardBorderColor: '#059669',
  coverImageUrl: DEFAULT_WATCH_VIDEOS_COVER_IMAGE,
  coverOverlayOpacity: 88,
  mainTitleColor: '#ffffff',
  subtitleColor: '#ecfdf5',
  helperTextColor: '#d1fae5',
  buttonBgColor: '#dc2626',
  buttonFrameBgColor: '#009b3a',
  buttonTextColor: '#ffffff',
  iconBoxBgColor: '#059669',
  iconColor: '#ffffff',
  interactiveAccentColor: '#ff6b00',
};

function normalizeWatchVideosColors(
  colors?: Partial<WatchVideosSectionColorSettings>
): WatchVideosSectionColorSettings {
  const merged: WatchVideosSectionColorSettings = {
    ...DEFAULT_WATCH_VIDEOS_COLORS,
    ...(colors || {}),
  };
  if (!merged.buttonBgColor || merged.buttonBgColor.toLowerCase() === '#ff6b00') {
    merged.buttonBgColor = '#dc2626';
  }
  if (!merged.buttonTextColor) {
    merged.buttonTextColor = '#ffffff';
  }
  return merged;
}

export const DEFAULT_PORTAL_THEME: PlatformPortalThemeSettings = {
  primaryColor: '#059669',
  secondaryColor: '#0f172a',
  accentColor: '#0d9488',
  backgroundColor: '#f8fafc',
  heroGradientStart: '#0f172a',
  heroGradientEnd: '#064e3b',
  cardBackground: '#ffffff',
  buttonColor: '#059669',
};

/**
 * Safely writes to localStorage, handling quota limits gracefully:
 */
function safeSetLocalStorage(key: string, settings: PlatformPortalSettings): void {
  try {
    const raw = JSON.stringify(settings);
    localStorage.setItem(key, raw);
  } catch (quotaError: any) {
    console.warn('[PortalSettingsStorage] localStorage.setItem notice:', quotaError);
    try {
      localStorage.setItem(key, JSON.stringify(settings));
    } catch {
      // Ignore silently if storage is totally full to avoid app crash
    }
  }
}

export const DEFAULT_PORTAL_SETTINGS: PlatformPortalSettings = {
  visibility: {
    announcementBar: true,
    mainHeader: true,
    heroSection: true,
    heroMetrics: false,
    masterTemplateShowcase: false,
    catalogSection: true,
    donationsSection: true,
    searchFilter: true,
    cityFilter: true,
    pillarsSection: true,
    footerSection: true,
  },
  texts: {
    announcementBadge: 'SaaS Multi-Tenant',
    announcementText: 'المنصة السحابية الموحدة لإدارة الجمعيات بنظام استقلال البيانات التام والصلاحيات المتعددة',
    headerBrandName: 'syoumax منصة العمل الجمعوي',
    headerBrandTagline: 'منظومة رقمية شاملة لإدارة وتطوير العمل الجمعوي',
    createAssociationButtonText: 'إنشاء منصة احترافية للجمعية',
    heroBadge: 'نظام مستقل لكل جمعية • Multi-Tenant & Multi-User Architecture',
    heroTitleLine1: 'أنشئ منصة رقمية متكاملة لجمعيتك',
    heroTitleHighlight: 'خلال دقيقة واحدة فقط',
    heroDescription: 'المنصة تتيح لأي جمعية الحصول فوراً على نسخة إلكترونية مستقلة بالكامل مبنية على هيكل وتصميم قالب «جمعية النور للتنمية والتضامن»، مع لوحة تحكم إدارية خاصة، إدارة مالية شفافة، بطاقات منخرطين، وعزل تام لقواعد البيانات.',
    heroCtaButtonText: 'إنشاء منصة احترافية للجمعية الآن',
    heroPreviewTemplateButtonText: 'معاينة القالب النموذجي (جمعية النور)',
    masterTemplateBadge: 'القالب الأساسي المعتمد (Master Template)',
    masterTemplateDescription: 'هذا هو النموذج والتصميم الذي يُستنسخ منه هيكل كل جمعية جديدة تسجل في المنصة. يحتوي على أقسام الأنشطة الميدانية، الدفتر المالي للشفافية، بطاقات الانخراط برمز QR، وحملات التبرع.',
    masterTemplateButtonText: 'معاينة وتصفح القالب الأساسي',
    catalogBadge: 'القالب الأساسي المعتمد • Master Template',
    catalogTitle: 'النموذج المعتمد بالواجهة العامة للمنصة',
    catalogDescription: 'تُعرض حصريًا «جمعية النور للتنمية والتضامن» كقالب أساسي معتمد، بينما تبقى منصات الجمعيات المنشأة من طرف المستخدمين خاصة ومستقلة وتُدار حصريًا عبر الإدارة العامة (Super Admin).',
    donationsSectionTitle: 'تبرع وشارك في مشاريع التنمية',
    donationsSectionDesc: 'ساهم وشارك في الخير. تبرع وساهم في دعم مشاريع الجمعيات ومبادراتها الخيرية والتنموية، وكن جزءًا من صناعة أثر إيجابي في المجتمع.',
    donationsSectionCoverImage: DEFAULT_DONATIONS_COVER_IMAGE,
    donationsSectionCoverOverlayOpacity: DEFAULT_DONATIONS_COVER_OPACITY,
    platformLogoUrl: '',
    heroBackgroundImage: '',
    heroBackgroundOverlayOpacity: 85,
    searchPlaceholder: 'ابحث عن جمعية بالاسم أو المدينة...',
    pillarsTitle: 'ماذا تحصل كل جمعية عند إنشائها؟',
    pillarsSubtitle: 'كل جمعية تنضم للمنصة تحصل تلقائياً على نسخة مستقلة كاملة من كافة وظائف قالب جمعية النور',
    pillar1Title: 'إدارة مالية شفافة بالكامل',
    pillar1Desc: 'لوحة تحكم للمصاريف والمداخيل، إيصالات الدفع، إثباتات الفواتير، ومتابعة الرصيد المالي المباشر مع عزل تام عن سائر الجمعيات.',
    pillar2Title: 'سجلات الأعضاء والاشتراكات',
    pillar2Desc: 'استمارة تسجيل قابلة للتخصيص، نظام اشتراكات شهرية، وبطاقات عضوية ذكية قابلة للطباعة برمز QR.',
    pillar3Title: 'أدمن بدرجات وصلاحيات دقيقة',
    pillar3Desc: 'صاحب الجمعية (Super Admin) يمتلك الصلاحية الكاملة لإضافة أدمن من الدرجة الثانية مع تحديد الصلاحيات لكل قسم بشكل مستقل.',
    pillar4Title: 'إنشاء حملات التبرع',
    pillar4Desc: 'إمكانية إنشاء وإدارة حملات التبرع لتمويل المشاريع الخيرية وجمع المساهمات الداعمة بكل سهولة وشفافية من خلال لوحة التحكم الخاصة بكل جمعية.',
    pillar5Title: 'عرض جميع الأعمال والأنشطة',
    pillar5Desc: 'قسم مخصص لعرض وتوثيق كافة الأعمال والأنشطة الخيرية والتنموية بالصور والتفاصيل أمام الزوار والمنخرطين بطريقة منظمة واحترافية.',
    pillar6Title: 'إستفادة من تبرعات مالية',
    pillar6Desc: 'استفد من تبرعات مالية ومساهمات المنخرطين الجدد والمحسنين، واستقطب دعم القطاع الخاص والجالية المقيمة بالخارج، لبناء شراكات وتمويل مشاريعك الخيرية والتنموية وتحقيق أثر أكبر في المجتمع.',
    footerBrandName: 'syoumax منصة العمل الجمعوي - Smart Multi-Association Platform',
    footerCopyrightText: 'جميع الحقوق محفوظة © • القالب المعتمد: جمعية النور للتنمية والتضامن',
  },
  theme: DEFAULT_PORTAL_THEME,
  watchVideosColors: { ...DEFAULT_WATCH_VIDEOS_COLORS },
  logoUrl: '',
  lastUpdated: new Date().toISOString(),
  updatedBy: 'Super Admin',
};

// In-memory runtime cache
let cachedPortalSettings: PlatformPortalSettings | null = null;

function normalizePortalTexts(texts: any): PlatformPortalSettings['texts'] {
  const merged = {
    ...DEFAULT_PORTAL_SETTINGS.texts,
    ...(texts || {}),
  };
  if (merged.headerBrandName) {
    merged.headerBrandName = merged.headerBrandName
      .replace(/منظومة الجنى الرقمية للعمل الجمعوي/g, 'syoumax منصة العمل الجمعوي')
      .replace(/\byoux\b/gi, 'syoumax')
      .replace(/\bAljana\b/gi, 'syoumax');
  }
  if (merged.footerBrandName) {
    merged.footerBrandName = merged.footerBrandName
      .replace(/منظومة الجنى الرقمية للعمل الجمعوي/g, 'syoumax منصة العمل الجمعوي')
      .replace(/\byoux\b/gi, 'syoumax')
      .replace(/\bAljana\b/gi, 'syoumax');
  }
  return merged;
}

/**
 * Reads settings synchronously from memory or localStorage
 */
export function getPortalSettings(): PlatformPortalSettings {
  if (cachedPortalSettings) {
    return cachedPortalSettings;
  }

  try {
    const raw = localStorage.getItem(PORTAL_SETTINGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        cachedPortalSettings = {
          visibility: {
            ...DEFAULT_PORTAL_SETTINGS.visibility,
            ...(parsed.visibility || {}),
          },
          texts: normalizePortalTexts(parsed.texts),
          theme: {
            ...DEFAULT_PORTAL_THEME,
            ...(parsed.theme || {}),
          },
          watchVideosColors: normalizeWatchVideosColors(parsed.watchVideosColors),
          logoUrl: parsed.logoUrl || parsed.texts?.platformLogoUrl || '',
          lastUpdated: parsed.lastUpdated || new Date().toISOString(),
          updatedBy: parsed.updatedBy || 'Super Admin',
        };
        return cachedPortalSettings;
      }
    }
  } catch (e) {
    console.warn('[PortalSettingsStorage] Failed to read from localStorage:', e);
  }

  cachedPortalSettings = { ...DEFAULT_PORTAL_SETTINGS };
  return cachedPortalSettings;
}

/**
 * Reconciles and merges incoming settings over existing settings without losing custom modifications
 */
function reconcileSettings(base: PlatformPortalSettings, fresh: any): PlatformPortalSettings {
  return {
    visibility: {
      ...base.visibility,
      ...(fresh.visibility || {}),
    },
    texts: normalizePortalTexts({
      ...base.texts,
      ...(fresh.texts || {}),
    }),
    theme: {
      ...(base.theme || DEFAULT_PORTAL_THEME),
      ...(fresh.theme || {}),
    },
    watchVideosColors: normalizeWatchVideosColors({
      ...(base.watchVideosColors || {}),
      ...(fresh.watchVideosColors || {}),
    }),
    logoUrl: fresh.logoUrl ?? fresh.texts?.platformLogoUrl ?? base.logoUrl ?? '',
    lastUpdated: fresh.lastUpdated || fresh._updatedAt || base.lastUpdated || new Date().toISOString(),
    updatedBy: fresh.updatedBy || base.updatedBy || 'Super Admin',
  };
}

/**
 * Fetches settings from both backend database and Firestore to ensure freshness and persistence across sessions
 */
export async function fetchPortalSettings(): Promise<PlatformPortalSettings> {
  let backendSettings: PlatformPortalSettings | null = null;
  let firestoreSettings: any = null;

  // 1. Fetch from persistent backend disk database
  try {
    const res = await fetch(`/api/portal-settings?_t=${Date.now()}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
      cache: 'no-store',
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.success && data.settings) {
        backendSettings = reconcileSettings(DEFAULT_PORTAL_SETTINGS, data.settings);
      }
    }
  } catch (err) {
    console.warn('[PortalSettingsStorage] Backend fetch warning:', err);
  }

  // 2. Fetch from Firestore for cross-device & cloud synchronization
  try {
    const docRef = doc(db, 'portal_settings', 'main');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      firestoreSettings = snap.data();
    }
  } catch (fsErr) {
    console.warn('[PortalSettingsStorage] Firestore fetch warning:', fsErr);
  }

  // 3. Reconcile backend disk and Firestore
  let authoritative: PlatformPortalSettings = backendSettings || getPortalSettings();
  if (!backendSettings && firestoreSettings) {
    authoritative = reconcileSettings(DEFAULT_PORTAL_SETTINGS, firestoreSettings);
  } else if (backendSettings && firestoreSettings && firestoreSettings.lastUpdated) {
    const fsTime = new Date(firestoreSettings.lastUpdated || firestoreSettings._updatedAt || 0).getTime();
    const diskTime = backendSettings.lastUpdated ? new Date(backendSettings.lastUpdated).getTime() : 0;

    if (fsTime > diskTime && firestoreSettings.watchVideosColors) {
      authoritative = reconcileSettings(backendSettings, firestoreSettings);
      // Sync back to backend disk silently so local files stay up-to-date
      fetch('/api/portal-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-session': encodeURIComponent(JSON.stringify({ isMasterPlatformAdmin: true, type: 'super_admin' })),
        },
        body: JSON.stringify({ settings: authoritative, updatedBy: authoritative.updatedBy || 'Super Admin' }),
      }).catch(console.warn);
    } else if (diskTime > fsTime) {
      // Sync disk forward to Firestore
      try {
        const docRef = doc(db, 'portal_settings', 'main');
        setDoc(docRef, { ...backendSettings, _updatedAt: new Date().toISOString() }, { merge: true }).catch(console.warn);
      } catch {}
    }
  } else if (backendSettings && !firestoreSettings) {
    // Seed Firestore from disk
    try {
      const docRef = doc(db, 'portal_settings', 'main');
      setDoc(docRef, { ...backendSettings, _updatedAt: new Date().toISOString() }, { merge: true }).catch(console.warn);
    } catch {}
  }

  cachedPortalSettings = authoritative;
  safeSetLocalStorage(PORTAL_SETTINGS_STORAGE_KEY, authoritative);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PORTAL_SETTINGS_EVENT, { detail: authoritative }));
  }

  return authoritative;
}

/**
 * Saves settings to backend database and Firestore permanently with verified read-back
 */
export async function savePortalSettings(settings: PlatformPortalSettings): Promise<PlatformPortalSettings> {
  // 1. Offload all images permanently before writing to database
  let coverImage =
    settings.texts?.donationsSectionCoverImage !== undefined
      ? settings.texts.donationsSectionCoverImage
      : DEFAULT_DONATIONS_COVER_IMAGE;
  if (coverImage && coverImage.startsWith('data:image/')) {
    try {
      coverImage = await ensurePermanentImageUrl(coverImage, { category: 'portal_covers' });
    } catch (e) {
      console.warn('[PortalSettingsStorage] Cover image storage upload notice:', e);
    }
  }

  let logoUrl = settings.logoUrl ?? settings.texts?.platformLogoUrl ?? '';
  if (logoUrl && logoUrl.startsWith('data:image/')) {
    try {
      logoUrl = await ensurePermanentImageUrl(logoUrl, { category: 'portal_logos' });
    } catch (e) {
      console.warn('[PortalSettingsStorage] Logo storage upload notice:', e);
    }
  }

  let heroBackgroundImage = settings.texts?.heroBackgroundImage || '';
  if (heroBackgroundImage && heroBackgroundImage.startsWith('data:image/')) {
    try {
      heroBackgroundImage = await ensurePermanentImageUrl(heroBackgroundImage, { category: 'portal_hero' });
    } catch (e) {
      console.warn('[PortalSettingsStorage] Hero background upload notice:', e);
    }
  }

  let watchVideosCoverImage =
    settings.watchVideosColors?.coverImageUrl !== undefined
      ? settings.watchVideosColors.coverImageUrl
      : DEFAULT_WATCH_VIDEOS_COLORS.coverImageUrl;
  if (watchVideosCoverImage && watchVideosCoverImage.startsWith('data:image/')) {
    try {
      watchVideosCoverImage = await ensurePermanentImageUrl(watchVideosCoverImage, {
        category: 'portal_watch_videos_covers',
      });
    } catch (e) {
      console.warn('[PortalSettingsStorage] Watch videos cover image upload notice:', e);
    }
  }

  const nowIso = new Date().toISOString();
  const payloadToSave: PlatformPortalSettings = {
    visibility: {
      ...DEFAULT_PORTAL_SETTINGS.visibility,
      ...(settings.visibility || {}),
    },
    texts: {
      ...DEFAULT_PORTAL_SETTINGS.texts,
      ...(settings.texts || {}),
      donationsSectionCoverImage: coverImage,
      platformLogoUrl: logoUrl,
      heroBackgroundImage: heroBackgroundImage,
    },
    theme: {
      ...DEFAULT_PORTAL_THEME,
      ...(settings.theme || {}),
    },
    watchVideosColors: {
      ...DEFAULT_WATCH_VIDEOS_COLORS,
      ...(settings.watchVideosColors || {}),
      coverImageUrl: watchVideosCoverImage,
    },
    logoUrl: logoUrl,
    lastUpdated: nowIso,
    updatedBy: 'Super Admin',
  };

  // Update optimistic cache and broadcast immediately so all components reflect the new colors without delay
  cachedPortalSettings = payloadToSave;
  safeSetLocalStorage(PORTAL_SETTINGS_STORAGE_KEY, payloadToSave);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PORTAL_SETTINGS_EVENT, { detail: payloadToSave }));
  }

  // 2. Synchronize with backend disk database FIRST and verify HTTP success
  const res = await fetch('/api/portal-settings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'x-admin-session': encodeURIComponent(JSON.stringify({ isMasterPlatformAdmin: true, type: 'super_admin' })),
    },
    body: JSON.stringify({ settings: payloadToSave, watchVideosColors: payloadToSave.watchVideosColors, updatedBy: 'Super Admin' }),
  });

  if (!res.ok) {
    let errorMsg = `فشل حفظ التعديلات على الخادم (رمز الاستجابة: ${res.status})`;
    try {
      const errData = await res.json();
      if (errData && errData.error) errorMsg = errData.error;
    } catch {}
    throw new Error(errorMsg);
  }

  const data = await res.json();
  if (!data || !data.success || !data.settings) {
    throw new Error(data?.error || 'استجابة غير متوقعة من خادم قاعدة البيانات');
  }

  const serverSavedSettings = reconcileSettings(DEFAULT_PORTAL_SETTINGS, data.settings);

  // 3. Synchronize with Firestore database
  try {
    const docRef = doc(db, 'portal_settings', 'main');
    await setDoc(
      docRef,
      {
        ...serverSavedSettings,
        lastUpdated: serverSavedSettings.lastUpdated || nowIso,
        _updatedAt: serverSavedSettings.lastUpdated || nowIso,
      },
      { merge: true }
    );
  } catch (fsErr) {
    console.warn('[PortalSettingsStorage] Firestore write notice (relying on server database):', fsErr);
  }

  // 4. MANDATORY VERIFICATION READ-BACK: Confirm persistence by reading back from the server
  const verifyRes = await fetch(`/api/portal-settings?_t=${Date.now()}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
    cache: 'no-store',
  });

  if (!verifyRes.ok) {
    throw new Error('فشل التحقق من حفظ التعديلات في قاعدة البيانات بعد الكتابة');
  }

  const verifyData = await verifyRes.json();
  if (!verifyData || !verifyData.success || !verifyData.settings) {
    throw new Error('تعذر قراءة التعديلات المحفوظة من قاعدة البيانات للتحقق منها');
  }

  const verifiedSettings = reconcileSettings(DEFAULT_PORTAL_SETTINGS, verifyData.settings);

  // 5. Update runtime cache and localStorage with verified server record
  cachedPortalSettings = verifiedSettings;
  safeSetLocalStorage(PORTAL_SETTINGS_STORAGE_KEY, verifiedSettings);

  // 6. Broadcast event so UI updates instantly across all mounted views
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PORTAL_SETTINGS_EVENT, { detail: verifiedSettings }));
  }

  return verifiedSettings;
}

/**
 * Resets settings to default values both on backend and in local storage
 */
export async function resetPortalSettingsToDefaults(): Promise<PlatformPortalSettings> {
  const res = await fetch('/api/portal-settings/reset', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'x-admin-session': encodeURIComponent(JSON.stringify({ isMasterPlatformAdmin: true, type: 'super_admin' })),
    },
    body: JSON.stringify({}),
  });

  if (!res.ok) {
    let errorMsg = `فشل في استعادة الإعدادات الافتراضية على الخادم (${res.status})`;
    try {
      const errData = await res.json();
      if (errData && errData.error) errorMsg = errData.error;
    } catch {}
    throw new Error(errorMsg);
  }

  const data = await res.json();
  if (!data || !data.success || !data.settings) {
    throw new Error(data?.error || 'فشل في استعادة الإعدادات الافتراضية من قاعدة البيانات');
  }

  const nowIso = new Date().toISOString();
  const defaultClone = reconcileSettings(DEFAULT_PORTAL_SETTINGS, {
    ...data.settings,
    lastUpdated: nowIso,
    updatedBy: 'Super Admin (Reset to Defaults)',
  });

  // Also reset in Firestore
  try {
    const docRef = doc(db, 'portal_settings', 'main');
    await setDoc(docRef, { ...defaultClone, _updatedAt: nowIso }, { merge: true });
  } catch (fsErr) {
    console.warn('[PortalSettingsStorage] Firestore reset notice:', fsErr);
  }

  cachedPortalSettings = defaultClone;
  safeSetLocalStorage(PORTAL_SETTINGS_STORAGE_KEY, defaultClone);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PORTAL_SETTINGS_EVENT, { detail: defaultClone }));
  }

  return defaultClone;
}

/**
 * Dedicated helper to save ONLY the color settings of the «شاهد شرح بالفيديو كيفية استخدام المنصة» section
 * permanently to the backend database and Cloud Firestore without modifying any other portal section.
 */
export async function saveWatchVideosSectionColors(
  colors: WatchVideosSectionColorSettings
): Promise<PlatformPortalSettings> {
  const current = getPortalSettings();
  const mergedWatchColors: WatchVideosSectionColorSettings = {
    ...DEFAULT_WATCH_VIDEOS_COLORS,
    ...(current.watchVideosColors || {}),
    ...colors,
  };
  return savePortalSettings({
    ...current,
    watchVideosColors: mergedWatchColors,
  });
}

/**
 * Dedicated helper to restore ONLY the color settings of the «شاهد شرح بالفيديو كيفية استخدام المنصة» section
 * to their default reference values and save them permanently to the database.
 */
export async function resetWatchVideosSectionColors(): Promise<PlatformPortalSettings> {
  const current = getPortalSettings();
  return savePortalSettings({
    ...current,
    watchVideosColors: { ...DEFAULT_WATCH_VIDEOS_COLORS },
  });
}

