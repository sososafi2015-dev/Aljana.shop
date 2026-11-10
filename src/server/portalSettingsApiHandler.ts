import type { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import path from 'path';
import type { PlatformPortalSettings, WatchVideosSectionColorSettings } from '../types';
import { writeJsonFileAtomicSync, readLargeJsonBody } from './storageEngine';
import { saveDocToFirebaseServer } from './firebaseServerStorage';

export const DEFAULT_DONATIONS_COVER_IMAGE =
  'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=1600&q=80';
export const DEFAULT_DONATIONS_COVER_OPACITY = 85;

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
  watchVideosColors: { ...DEFAULT_WATCH_VIDEOS_COLORS },
  lastUpdated: new Date().toISOString(),
  updatedBy: 'Super Admin',
};

const DB_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'portal_settings_database.json');

// In-memory cache
let inMemoryPortalSettings: PlatformPortalSettings | null = null;

export function loadPortalSettingsDatabase(forceFresh = false): PlatformPortalSettings {
  if (!forceFresh && inMemoryPortalSettings) {
    return inMemoryPortalSettings;
  }

  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }

    // Check platform identity name if available
    let currentPlatformName = '';
    try {
      const identityFile = path.join(DB_DIR, 'platform_identity_database.json');
      if (fs.existsSync(identityFile)) {
        const idData = JSON.parse(fs.readFileSync(identityFile, 'utf-8'));
        if (idData && idData.platformName) {
          currentPlatformName = idData.platformName.trim();
        }
      }
    } catch {}

    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const loadedTexts = {
          ...DEFAULT_PORTAL_SETTINGS.texts,
          ...(parsed.texts || {}),
        };
        if (currentPlatformName && !parsed.texts?.headerBrandName) {
          loadedTexts.headerBrandName = currentPlatformName;
        }
        if (loadedTexts.headerBrandName) {
          loadedTexts.headerBrandName = loadedTexts.headerBrandName
            .replace(/منظومة الجنى الرقمية للعمل الجمعوي/g, 'syoumax منصة العمل الجمعوي')
            .replace(/\byoux\b/gi, 'syoumax')
            .replace(/\bAljana\b/gi, 'syoumax');
        }
        if (loadedTexts.footerBrandName) {
          loadedTexts.footerBrandName = loadedTexts.footerBrandName
            .replace(/منظومة الجنى الرقمية للعمل الجمعوي/g, 'syoumax منصة العمل الجمعوي')
            .replace(/\byoux\b/gi, 'syoumax')
            .replace(/\bAljana\b/gi, 'syoumax');
        }

        const rawWatchColors = {
          ...DEFAULT_WATCH_VIDEOS_COLORS,
          ...(parsed.watchVideosColors || {}),
        };
        if (!rawWatchColors.buttonBgColor || rawWatchColors.buttonBgColor.toLowerCase() === '#ff6b00') {
          rawWatchColors.buttonBgColor = '#dc2626';
        }
        if (!rawWatchColors.buttonTextColor) {
          rawWatchColors.buttonTextColor = '#ffffff';
        }

        inMemoryPortalSettings = {
          visibility: {
            ...DEFAULT_PORTAL_SETTINGS.visibility,
            ...(parsed.visibility || {}),
          },
          texts: loadedTexts,
          theme: parsed.theme || DEFAULT_PORTAL_SETTINGS.theme,
          watchVideosColors: rawWatchColors,
          logoUrl: parsed.logoUrl || '',
          lastUpdated: parsed.lastUpdated || new Date().toISOString(),
          updatedBy: parsed.updatedBy || 'Super Admin',
        };
        return inMemoryPortalSettings;
      }
    }
  } catch (err) {
    console.error('[PortalSettingsDB] Error loading database:', err);
  }

  inMemoryPortalSettings = { ...DEFAULT_PORTAL_SETTINGS };
  savePortalSettingsDatabase(inMemoryPortalSettings);
  return inMemoryPortalSettings;
}

export function savePortalSettingsDatabase(settings: PlatformPortalSettings): void {
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    const sanitized = writeJsonFileAtomicSync(DB_FILE, settings, 'portal_cover');
    inMemoryPortalSettings = sanitized;
  } catch (err) {
    console.error('[PortalSettingsDB] Error saving to disk:', err);
    throw new Error('تعذر حفظ بيانات إعدادات واجهة المنصة على القرص الدائم');
  }
}

function readBody(req: IncomingMessage): Promise<any> {
  return readLargeJsonBody(req, 100 * 1024 * 1024);
}

function sendJson(res: ServerResponse, statusCode: number, data: any) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-session');
  res.end(JSON.stringify(data));
}

// Helper to save base64 image data URL to disk permanently
function saveBase64Image(dataUrl: string, prefix: string, imagesDir: string): string {
  if (!dataUrl || !dataUrl.startsWith('data:image/')) return dataUrl;
  try {
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return dataUrl;
    const mimeType = match[1];
    const base64Data = match[2];
    let ext = '.jpg';
    if (mimeType.includes('png')) ext = '.png';
    else if (mimeType.includes('webp')) ext = '.webp';
    else if (mimeType.includes('svg')) ext = '.svg';

    const filename = `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}${ext}`;
    const diskPath = path.join(imagesDir, filename);
    fs.writeFileSync(diskPath, Buffer.from(base64Data, 'base64'));
    return `/api/images/${filename}`;
  } catch (err) {
    console.error(`[PortalSettingsDB] Error saving ${prefix} to disk:`, err);
    return dataUrl;
  }
}

export async function handlePortalSettingsApi(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = req.url || '';
  if (!url.startsWith('/api/portal-settings')) {
    return false;
  }

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return true;
  }

  const currentSettings = loadPortalSettingsDatabase(true);

  // 1. GET /api/portal-settings - retrieve current settings
  if (req.method === 'GET') {
    sendJson(res, 200, {
      success: true,
      settings: currentSettings,
      lastUpdated: currentSettings.lastUpdated,
    });
    return true;
  }

  // 2. POST /api/portal-settings/reset - reset to default configuration
  if (req.method === 'POST' && (url === '/api/portal-settings/reset' || url.startsWith('/api/portal-settings/reset?'))) {
    try {
      const resetSettings: PlatformPortalSettings = {
        visibility: { ...DEFAULT_PORTAL_SETTINGS.visibility },
        texts: { ...DEFAULT_PORTAL_SETTINGS.texts },
        theme: { ...DEFAULT_PORTAL_SETTINGS.theme },
        watchVideosColors: { ...DEFAULT_WATCH_VIDEOS_COLORS },
        logoUrl: '',
        lastUpdated: new Date().toISOString(),
        updatedBy: 'Super Admin (Reset to Defaults)',
      };

      savePortalSettingsDatabase(resetSettings);
      await saveDocToFirebaseServer('portal_settings', 'main', {
        ...resetSettings,
        _updatedAt: resetSettings.lastUpdated,
      }).catch(() => {});

      sendJson(res, 200, {
        success: true,
        message: 'تمت استعادة الإعدادات الافتراضية لواجهة المنصة العامة بنجاح',
        settings: resetSettings,
      });
      return true;
    } catch (err: any) {
      console.error('[PortalSettingsDB] Error resetting settings:', err);
      sendJson(res, 500, { success: false, error: err.message || 'فشل في استعادة الإعدادات الافتراضية' });
      return true;
    }
  }

  // 3. POST or PUT /api/portal-settings - save custom settings
  if (req.method === 'POST' || req.method === 'PUT') {
    try {
      const body = await readBody(req);
      const incoming = body.settings || body;

      if (!incoming || typeof incoming !== 'object') {
        sendJson(res, 400, { success: false, error: 'بيانات إعدادات واجهة المنصة غير صالحة' });
        return true;
      }

      const incomingWatchColors =
        body.watchVideosColors && typeof body.watchVideosColors === 'object'
          ? body.watchVideosColors
          : incoming.watchVideosColors;

      // Ensure images directory exists
      const imagesDir = path.join(path.resolve(process.cwd(), 'data'), 'images');
      if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
      }

      // Offload all media files (cover image, logo, hero background) to permanent disk storage
      let coverImage = incoming.texts?.donationsSectionCoverImage ?? currentSettings.texts.donationsSectionCoverImage;
      if (typeof coverImage === 'string' && coverImage.startsWith('data:image/')) {
        coverImage = saveBase64Image(coverImage, 'portal-cover', imagesDir);
      }

      let logoUrl = incoming.logoUrl ?? incoming.texts?.platformLogoUrl ?? currentSettings.logoUrl ?? '';
      if (typeof logoUrl === 'string' && logoUrl.startsWith('data:image/')) {
        logoUrl = saveBase64Image(logoUrl, 'portal-logo', imagesDir);
      }

      let heroBackgroundImage = incoming.texts?.heroBackgroundImage ?? currentSettings.texts?.heroBackgroundImage ?? '';
      if (typeof heroBackgroundImage === 'string' && heroBackgroundImage.startsWith('data:image/')) {
        heroBackgroundImage = saveBase64Image(heroBackgroundImage, 'portal-hero-bg', imagesDir);
      }

      let watchVideosCoverImage =
        incomingWatchColors?.coverImageUrl !== undefined
          ? incomingWatchColors.coverImageUrl
          : currentSettings.watchVideosColors?.coverImageUrl ??
            DEFAULT_WATCH_VIDEOS_COLORS.coverImageUrl;
      if (typeof watchVideosCoverImage === 'string' && watchVideosCoverImage.startsWith('data:image/')) {
        watchVideosCoverImage = saveBase64Image(watchVideosCoverImage, 'portal-watch-videos-cover', imagesDir);
      }

      const incomingBrandName = incoming.texts?.headerBrandName?.trim();
      const resolvedHeaderBrandName = incomingBrandName || currentSettings.texts.headerBrandName;

      const updatedSettings: PlatformPortalSettings = {
        visibility: {
          ...currentSettings.visibility,
          ...(incoming.visibility || {}),
        },
        texts: {
          ...currentSettings.texts,
          ...(incoming.texts || {}),
          headerBrandName: resolvedHeaderBrandName,
          donationsSectionCoverImage: coverImage,
          platformLogoUrl: logoUrl,
          heroBackgroundImage: heroBackgroundImage,
        },
        theme: {
          ...(currentSettings.theme || {}),
          ...(incoming.theme || {}),
        },
        watchVideosColors: {
          ...DEFAULT_WATCH_VIDEOS_COLORS,
          ...(currentSettings.watchVideosColors || {}),
          ...(incomingWatchColors || {}),
          coverImageUrl: watchVideosCoverImage,
        },
        logoUrl: logoUrl,
        lastUpdated: new Date().toISOString(),
        updatedBy: body.updatedBy || incoming.updatedBy || 'Super Admin',
      };

      savePortalSettingsDatabase(updatedSettings);
      const verifiedSaved = loadPortalSettingsDatabase(true);

      // Mirror authoritative settings to Cloud Firestore (portal_settings/main)
      await saveDocToFirebaseServer('portal_settings', 'main', {
        ...verifiedSaved,
        _updatedAt: verifiedSaved.lastUpdated,
      }).catch(() => {});

      // Also sync brand name & logo to platform identity if appropriate
      try {
        const { loadPlatformIdentityDatabase, savePlatformIdentityDatabase } = await import('./platformIdentityApiHandler');
        const idDb = loadPlatformIdentityDatabase(true);
        let idChanged = false;
        if (incomingBrandName && idDb.platformName !== incomingBrandName) {
          idDb.platformName = incomingBrandName;
          idChanged = true;
        }
        if (logoUrl && idDb.platformLogo !== logoUrl) {
          idDb.platformLogo = logoUrl;
          idChanged = true;
        }
        if (idChanged) {
          idDb.updatedAt = new Date().toISOString();
          idDb.updatedBy = body.updatedBy || 'Super Admin';
          savePlatformIdentityDatabase(idDb);
        }
      } catch (idSyncErr) {
        console.warn('[PortalSettingsDB] Notice: Could not sync identity database:', idSyncErr);
      }

      sendJson(res, 200, {
        success: true,
        message: 'تم حفظ إعدادات واجهة المنصة العامة بنجاح في قاعدة البيانات الدائمة',
        settings: verifiedSaved,
      });
      return true;
    } catch (err: any) {
      console.error('[PortalSettingsDB] Error saving portal settings:', err);
      sendJson(res, 500, { success: false, error: err.message || 'خطأ أثناء حفظ إعدادات واجهة المنصة' });
      return true;
    }
  }

  return false;
}
