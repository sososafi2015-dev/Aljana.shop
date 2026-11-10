import { StoreThemeColors } from '../types';
import { defaultStoreThemeColors } from '../initialData';

export interface ColorShades {
  50: string;
  100: string;
  200: string;
  300: string;
  400: string;
  500: string;
  600: string;
  700: string;
  800: string;
  900: string;
  950: string;
}

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface HSL {
  h: number;
  s: number;
  l: number;
}

/**
 * Sanitize and validate hex color format
 */
export function sanitizeHex(hex?: string, fallback = '#047857'): string {
  if (!hex || typeof hex !== 'string') return fallback;
  let clean = hex.trim();
  if (!clean.startsWith('#')) clean = '#' + clean;
  // Expand short 3-digit hex #abc to #aabbcc
  if (clean.length === 4) {
    clean = `#${clean[1]}${clean[1]}${clean[2]}${clean[2]}${clean[3]}${clean[3]}`;
  }
  const hexRegex = /^#([0-9a-fA-F]{6})$/;
  return hexRegex.test(clean) ? clean.toLowerCase() : fallback;
}

/**
 * Convert Hex to RGB
 */
export function hexToRgb(hex: string): RGB {
  const clean = sanitizeHex(hex);
  const r = parseInt(clean.slice(1, 3), 16);
  const g = parseInt(clean.slice(3, 5), 16);
  const b = parseInt(clean.slice(5, 7), 16);
  return { r, g, b };
}

/**
 * Convert RGB to HSL
 */
export function rgbToHsl(r: number, g: number, b: number): HSL {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/**
 * Convert Hex to HSL directly
 */
export function hexToHsl(hex: string): HSL {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHsl(r, g, b);
}

/**
 * Convert HSL to Hex
 */
export function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;

  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Calculate appropriate text color (white or dark slate) based on background luminance
 */
export function getContrastTextColor(bgHex: string): string {
  const { r, g, b } = hexToRgb(bgHex);
  // WCAG Relative Luminance
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 140 ? '#0f172a' : '#ffffff';
}

/**
 * Calculate hover color (slightly darker or lighter based on base luminance)
 */
export function getHoverColor(hex: string): string {
  const { h, s, l } = hexToHsl(hex);
  const newL = l > 40 ? Math.max(10, l - 9) : Math.min(90, l + 9);
  return hslToHex(h, s, newL);
}

/**
 * Generate full 11-step harmonious palette from any base Hex color
 */
export function generateColorPalette(baseHex: string): ColorShades {
  const validHex = sanitizeHex(baseHex);
  const { h, s, l } = hexToHsl(validHex);

  // Preserve base saturation with harmonious scaling for tints and deep shades
  return {
    50: hslToHex(h, Math.min(s, 75), 97),
    100: hslToHex(h, Math.min(s, 78), 93),
    200: hslToHex(h, Math.min(s, 80), 84),
    300: hslToHex(h, Math.min(s, 82), 72),
    400: hslToHex(h, Math.min(s, 85), 58),
    500: hslToHex(h, s, 48),
    600: validHex, // base color is 600
    700: hslToHex(h, s, Math.max(14, Math.round(l * 0.78))),
    800: hslToHex(h, s, Math.max(10, Math.round(l * 0.62))),
    900: hslToHex(h, Math.max(s - 10, 20), Math.max(8, Math.round(l * 0.46))),
    950: hslToHex(h, Math.max(s - 15, 20), Math.max(5, Math.round(l * 0.28))),
  };
}

const THEME_STYLE_TAG_ID = 'achayef-store-theme-styles';
export const ACTIVE_THEME_STORAGE_KEY = 'chayef_active_store_theme_colors';

/**
 * Apply store theme colors across the application:
 * 1. Sets CSS Custom Properties on document.documentElement
 * 2. Injects/Updates dynamic <style id="achayef-store-theme-styles"> with exact overrides
 * 3. Saves to fast-cache localStorage key for instant load on app start
 * 4. Dispatches window event for multi-tab synchronization
 */
export function applyStoreTheme(rawColors?: Partial<StoreThemeColors>): void {
  if (typeof document === 'undefined') return;

  try {
    const colors: StoreThemeColors = {
      ...defaultStoreThemeColors,
      ...(rawColors || {}),
    };

    const primary = sanitizeHex(colors.primaryColor, defaultStoreThemeColors.primaryColor);
    const secondary = sanitizeHex(colors.secondaryColor, defaultStoreThemeColors.secondaryColor);
    const button = sanitizeHex(colors.buttonColor, defaultStoreThemeColors.buttonColor);
    const heading = sanitizeHex(colors.headingColor, defaultStoreThemeColors.headingColor);
    let text = sanitizeHex(colors.textColor, defaultStoreThemeColors.textColor);
    const bg = sanitizeHex(colors.backgroundColor, defaultStoreThemeColors.backgroundColor);
    const link = sanitizeHex(colors.linkColor, defaultStoreThemeColors.linkColor);
    const overlay = sanitizeHex(colors.bannerOverlayColor, defaultStoreThemeColors.bannerOverlayColor);
    const navbar = sanitizeHex(colors.navbarColor, defaultStoreThemeColors.navbarColor);
    const card = sanitizeHex(colors.cardColor, defaultStoreThemeColors.cardColor);

    // Guard against invisible text (e.g. white text on white background)
    const bgL = hexToHsl(bg).l;
    const textL = hexToHsl(text).l;
    if (Math.abs(bgL - textL) < 30) {
      text = bgL > 50 ? '#1e293b' : '#f8fafc';
    }

    const primaryPalette = generateColorPalette(primary);
    const secondaryPalette = generateColorPalette(secondary);
    const primaryRgb = hexToRgb(primary);
    const secondaryRgb = hexToRgb(secondary);
    const buttonHover = getHoverColor(button);
    const buttonText = getContrastTextColor(button);
    const primaryText = getContrastTextColor(primary);
    const isDarkBg = hexToHsl(bg).l < 40;

    const root = document.documentElement;
    if (!root) return;

    // Set CSS Variables on :root
    root.style.setProperty('--store-primary', primary);
    root.style.setProperty('--store-primary-rgb', `${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}`);
    root.style.setProperty('--store-primary-hover', getHoverColor(primary));
    root.style.setProperty('--store-primary-text', primaryText);

    root.style.setProperty('--store-secondary', secondary);
    root.style.setProperty('--store-secondary-rgb', `${secondaryRgb.r}, ${secondaryRgb.g}, ${secondaryRgb.b}`);

    root.style.setProperty('--store-button', button);
    root.style.setProperty('--store-button-hover', buttonHover);
    root.style.setProperty('--store-button-text', buttonText);

    root.style.setProperty('--store-heading', heading);
    root.style.setProperty('--store-text', text);
    root.style.setProperty('--store-bg', bg);
    root.style.setProperty('--store-link', link);
    root.style.setProperty('--store-banner-overlay', overlay);
    root.style.setProperty('--store-navbar', navbar);
    root.style.setProperty('--store-card', card);

    // Directly map Tailwind v4 variables for emerald & teal to our dynamic palette
    root.style.setProperty('--color-emerald-50', primaryPalette[50]);
    root.style.setProperty('--color-emerald-100', primaryPalette[100]);
    root.style.setProperty('--color-emerald-200', primaryPalette[200]);
    root.style.setProperty('--color-emerald-300', primaryPalette[300]);
    root.style.setProperty('--color-emerald-400', primaryPalette[400]);
    root.style.setProperty('--color-emerald-500', primaryPalette[500]);
    root.style.setProperty('--color-emerald-600', primary);
    root.style.setProperty('--color-emerald-700', primaryPalette[700]);
    root.style.setProperty('--color-emerald-800', primaryPalette[800]);
    root.style.setProperty('--color-emerald-900', primaryPalette[900]);
    root.style.setProperty('--color-emerald-950', primaryPalette[950]);

    // Inject or update the dynamic style sheet to guarantee immediate visual reflection
    let styleTag = document.getElementById(THEME_STYLE_TAG_ID) as HTMLStyleElement | null;
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = THEME_STYLE_TAG_ID;
      const targetParent = document.head || document.documentElement || document.body;
      if (targetParent) {
        targetParent.appendChild(styleTag);
      }
    }


  styleTag.textContent = `
    /* =========================================================================
       DYNAMIC STOREFRONT THEME SYSTEM STYLES (Auto-generated by Admin)
       ========================================================================= */
    :root {
      --store-primary: ${primary};
      --store-primary-rgb: ${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b};
      --store-secondary: ${secondary};
      --store-secondary-rgb: ${secondaryRgb.r}, ${secondaryRgb.g}, ${secondaryRgb.b};
      --store-button: ${button};
      --store-button-hover: ${buttonHover};
      --store-button-text: ${buttonText};
      --store-heading: ${heading};
      --store-text: ${text};
      --store-bg: ${bg};
      --store-link: ${link};
      --store-banner-overlay: ${overlay};
      --store-navbar: ${navbar};
      --store-card: ${card};

      /* Tailwind Emerald Palette Override */
      --color-emerald-50: ${primaryPalette[50]};
      --color-emerald-100: ${primaryPalette[100]};
      --color-emerald-200: ${primaryPalette[200]};
      --color-emerald-300: ${primaryPalette[300]};
      --color-emerald-400: ${primaryPalette[400]};
      --color-emerald-500: ${primaryPalette[500]};
      --color-emerald-600: ${primary};
      --color-emerald-700: ${primaryPalette[700]};
      --color-emerald-800: ${primaryPalette[800]};
      --color-emerald-900: ${primaryPalette[900]};
      --color-emerald-950: ${primaryPalette[950]};
    }

    /* Overall App Background & Default Text */
    body {
      background-color: ${bg} !important;
      color: ${text} !important;
    }

    .storefront-root {
      background-color: ${bg} !important;
      color: ${text} !important;
    }

    /* Storefront Headings */
    .storefront-area h1:not(.keep-white),
    .storefront-area h2:not(.keep-white),
    .storefront-area h3:not(.keep-white),
    .storefront-area h4:not(.keep-white),
    .storefront-area h5:not(.keep-white),
    .storefront-area h6:not(.keep-white),
    .store-heading {
      color: ${heading} !important;
    }

    /* Storefront Interactive Links & Action Text */
    .storefront-area a.store-link,
    .storefront-area .store-link,
    .store-link {
      color: ${link} !important;
    }
    .storefront-area a.store-link:hover,
    .storefront-area .store-link:hover,
    .store-link:hover {
      opacity: 0.85;
      text-decoration: underline;
    }

    /* Storefront Primary Action Buttons */
    .storefront-area button.btn-store-primary,
    .storefront-area .btn-store-primary,
    .btn-store-primary {
      background-color: ${button} !important;
      color: ${buttonText} !important;
      border-color: transparent !important;
    }
    .storefront-area button.btn-store-primary:hover,
    .storefront-area .btn-store-primary:hover,
    .btn-store-primary:hover {
      background-color: ${buttonHover} !important;
    }

    /* Hero Banner Background Gradient (when using secondary and primary deepest shades) */
    .store-hero-gradient {
      background: linear-gradient(135deg, ${secondary} 0%, ${primaryPalette[950]} 50%, ${secondary} 100%) !important;
    }

    /* Card Backgrounds */
    .storefront-area .store-card,
    .store-card {
      background-color: ${card} !important;
    }

    /* Top Navbar Header */
    .store-navbar-header {
      background-color: ${navbar} !important;
    }

    /* Top Info strip */
    .store-top-info-bar {
      background-color: ${secondary} !important;
    }

    /* Mobile Bottom Navigation Active indicator */
    .store-bottom-nav-active {
      color: ${primary} !important;
    }
    .store-bottom-nav-indicator {
      background-color: ${primary} !important;
    }
  `;

  // Persist to fast-cache storage key
  try {
    localStorage.setItem(ACTIVE_THEME_STORAGE_KEY, JSON.stringify(colors));
  } catch (e) {
    // Ignore storage write quota exceptions
  }

  // Dispatch window event so any concurrent listeners can synchronize
  try {
    window.dispatchEvent(new CustomEvent('chayef-store-theme-applied', { detail: colors }));
  } catch (e) {
    // Ignore
  }
  } catch (err) {
    console.warn('[ThemeEngine] Safe fallback during applyStoreTheme:', err);
  }
}

/**
 * Load and apply stored theme directly on startup (can be called before React mounts)
 */
export function initStoreThemeOnStartup(): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(ACTIVE_THEME_STORAGE_KEY) || localStorage.getItem('chayef_assoc_settings_v1');
    if (raw) {
      const parsed = JSON.parse(raw);
      const themeColors = parsed.themeColors || (parsed.primaryColor ? parsed : null);
      if (themeColors) {
        applyStoreTheme(themeColors);
        return;
      }
    }
  } catch (e) {
    // Fallback to default
  }
  applyStoreTheme(defaultStoreThemeColors);
}
