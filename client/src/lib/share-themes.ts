/**
 * Share Page Theme Configuration
 *
 * Defines color themes, section styles, and layout options for CIM share pages.
 */

// Theme color definitions
export interface ThemeColors {
  primary: string;        // Main brand color (buttons, headers)
  primaryHover: string;   // Hover state for primary
  primaryLight: string;   // Light variant for backgrounds
  secondary: string;      // Secondary color for accents
  gradient: {
    from: string;
    to: string;
  };
  text: {
    primary: string;      // Main text
    secondary: string;    // Muted text
    onPrimary: string;    // Text on primary color backgrounds
  };
  border: string;
  cardBg: string;
  pageBg: string;
}

export type ThemeId = 'corporate-blue' | 'forest-green' | 'charcoal' | 'burgundy' | 'brand' | 'custom';
export type SectionStyle = 'cards' | 'minimal';
export type ContactPosition = 'sidebar' | 'bottom';

export interface DisplaySettings {
  theme: ThemeId;
  sectionStyle: SectionStyle;
  contactPosition: ContactPosition;
  customColor?: string; // User-selected primary custom color (hex)
  customColorSecondary?: string; // User-selected secondary custom color (hex)
}

export const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  theme: 'corporate-blue',
  sectionStyle: 'cards',
  contactPosition: 'sidebar'
};

// Preset themes
export const THEMES: Record<Exclude<ThemeId, 'brand'>, ThemeColors> = {
  'corporate-blue': {
    primary: '#2563eb',        // blue-600
    primaryHover: '#1d4ed8',   // blue-700
    primaryLight: '#dbeafe',   // blue-100
    secondary: '#64748b',      // slate-500
    gradient: {
      from: '#475569',         // slate-600
      to: '#2563eb'            // blue-600
    },
    text: {
      primary: '#1e293b',      // slate-800
      secondary: '#64748b',    // slate-500
      onPrimary: '#ffffff'
    },
    border: '#e2e8f0',         // slate-200
    cardBg: '#ffffff',
    pageBg: '#f8fafc'          // slate-50
  },
  'forest-green': {
    primary: '#047857',        // emerald-700
    primaryHover: '#065f46',   // emerald-800
    primaryLight: '#d1fae5',   // emerald-100
    secondary: '#78716c',      // stone-500
    gradient: {
      from: '#57534e',         // stone-600
      to: '#047857'            // emerald-700
    },
    text: {
      primary: '#1c1917',      // stone-900
      secondary: '#78716c',    // stone-500
      onPrimary: '#ffffff'
    },
    border: '#e7e5e4',         // stone-200
    cardBg: '#ffffff',
    pageBg: '#fafaf9'          // stone-50
  },
  'charcoal': {
    primary: '#262626',        // neutral-800
    primaryHover: '#171717',   // neutral-900
    primaryLight: '#e5e5e5',   // neutral-200
    secondary: '#737373',      // neutral-500
    gradient: {
      from: '#404040',         // neutral-700
      to: '#262626'            // neutral-800
    },
    text: {
      primary: '#171717',      // neutral-900
      secondary: '#737373',    // neutral-500
      onPrimary: '#ffffff'
    },
    border: '#e5e5e5',         // neutral-200
    cardBg: '#ffffff',
    pageBg: '#fafafa'          // neutral-50
  },
  'burgundy': {
    primary: '#9f1239',        // rose-800
    primaryHover: '#881337',   // rose-900
    primaryLight: '#ffe4e6',   // rose-100
    secondary: '#78716c',      // stone-500
    gradient: {
      from: '#57534e',         // stone-600
      to: '#9f1239'            // rose-800
    },
    text: {
      primary: '#1c1917',      // stone-900
      secondary: '#78716c',    // stone-500
      onPrimary: '#ffffff'
    },
    border: '#e7e5e4',         // stone-200
    cardBg: '#ffffff',
    pageBg: '#fafaf9'          // stone-50
  }
};

/**
 * Creates a theme from brand colors
 */
export function createBrandTheme(brandColors: string[]): ThemeColors {
  const primary = brandColors[0] || '#2563eb';
  const secondary = brandColors[1] || '#64748b';

  // Calculate darker shade for hover
  const primaryHover = adjustBrightness(primary, -15);
  // Calculate lighter shade for backgrounds
  const primaryLight = adjustBrightness(primary, 85);

  return {
    primary,
    primaryHover,
    primaryLight,
    secondary,
    gradient: {
      from: adjustBrightness(secondary, -10),
      to: primary
    },
    text: {
      primary: '#1e293b',
      secondary: '#64748b',
      onPrimary: getContrastColor(primary)
    },
    border: '#e2e8f0',
    cardBg: '#ffffff',
    pageBg: '#f8fafc'
  };
}

/**
 * Gets the theme colors based on settings
 */
export function getThemeColors(
  settings: DisplaySettings,
  brandColors?: string[] | null
): ThemeColors {
  if (settings.theme === 'brand' && brandColors && brandColors.length > 0) {
    return createBrandTheme(brandColors);
  }
  if (settings.theme === 'custom' && settings.customColor) {
    const colors = [settings.customColor];
    if (settings.customColorSecondary) {
      colors.push(settings.customColorSecondary);
    }
    return createBrandTheme(colors);
  }
  const themeKey = (settings.theme === 'brand' || settings.theme === 'custom') ? 'corporate-blue' : settings.theme;
  return THEMES[themeKey];
}

/**
 * Generates CSS variables for a theme
 */
export function getThemeCSSVariables(colors: ThemeColors): Record<string, string> {
  return {
    '--theme-primary': colors.primary,
    '--theme-primary-hover': colors.primaryHover,
    '--theme-primary-light': colors.primaryLight,
    '--theme-secondary': colors.secondary,
    '--theme-gradient-from': colors.gradient.from,
    '--theme-gradient-to': colors.gradient.to,
    '--theme-text-primary': colors.text.primary,
    '--theme-text-secondary': colors.text.secondary,
    '--theme-text-on-primary': colors.text.onPrimary,
    '--theme-border': colors.border,
    '--theme-card-bg': colors.cardBg,
    '--theme-page-bg': colors.pageBg,
  };
}

/**
 * Section style class mappings
 */
export const SECTION_STYLES: Record<SectionStyle, {
  wrapper: string;
  header: string;
  headerText: string;
  content: string;
  showIcon: boolean;
}> = {
  cards: {
    wrapper: 'bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden',
    header: 'px-6 py-4 bg-gradient-to-r',
    headerText: 'text-lg font-semibold text-white flex items-center gap-2',
    content: 'p-6',
    showIcon: true
  },
  minimal: {
    wrapper: 'bg-transparent',
    header: 'py-4',
    headerText: 'text-lg font-semibold flex items-center gap-2',
    content: 'py-4',
    showIcon: true
  }
};

/**
 * Theme metadata for UI display
 */
export const THEME_OPTIONS: Array<{
  id: ThemeId;
  name: string;
  description: string;
  preview: { primary: string; secondary: string };
}> = [
  {
    id: 'corporate-blue',
    name: 'Corporate Blue',
    description: 'Professional and trustworthy',
    preview: { primary: '#2563eb', secondary: '#475569' }
  },
  {
    id: 'forest-green',
    name: 'Forest Green',
    description: 'Natural and sustainable',
    preview: { primary: '#047857', secondary: '#57534e' }
  },
  {
    id: 'charcoal',
    name: 'Charcoal',
    description: 'Modern and minimal',
    preview: { primary: '#262626', secondary: '#404040' }
  },
  {
    id: 'burgundy',
    name: 'Burgundy',
    description: 'Luxurious and sophisticated',
    preview: { primary: '#9f1239', secondary: '#57534e' }
  },
  {
    id: 'brand',
    name: 'My Brand Colors',
    description: 'Use colors from your logo',
    preview: { primary: '#3b82f6', secondary: '#6b7280' }
  },
  {
    id: 'custom',
    name: 'Custom Color',
    description: 'Pick your own color',
    preview: { primary: '#8b5cf6', secondary: '#6b7280' }
  }
];

export const SECTION_STYLE_OPTIONS: Array<{
  id: SectionStyle;
  name: string;
  description: string;
}> = [
  {
    id: 'cards',
    name: 'Cards',
    description: 'Bold gradient headers with shadows'
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Modern minimal design with subtle borders'
  }
];

export const CONTACT_POSITION_OPTIONS: Array<{
  id: ContactPosition;
  name: string;
  description: string;
}> = [
  {
    id: 'sidebar',
    name: 'Sidebar',
    description: 'Contact info on the right side'
  },
  {
    id: 'bottom',
    name: 'Bottom',
    description: 'Full-width content, contact at bottom'
  }
];

// Utility functions

function adjustBrightness(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, Math.max(0, (num >> 16) + amt));
  const G = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amt));
  const B = Math.min(255, Math.max(0, (num & 0x0000ff) + amt));
  return `#${((1 << 24) | (R << 16) | (G << 8) | B).toString(16).slice(1)}`;
}

function getContrastColor(hex: string): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = num >> 16;
  const g = (num >> 8) & 0x00ff;
  const b = num & 0x0000ff;
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 128 ? '#000000' : '#ffffff';
}
