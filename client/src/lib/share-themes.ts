/**
 * Share Page Theme Configuration
 *
 * Defines color themes, section styles, layout options, fonts,
 * header styles, dividers, density, and style presets for CIM share pages.
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

// New customization types
export type HeaderStyle = 'gradient' | 'underline' | 'boxed' | 'left-accent' | 'pill' | 'editorial';
export type FontPreset = 'modern-sans' | 'classic-serif' | 'clean-geometric' | 'editorial-mix';
export type DividerStyle = 'none' | 'line' | 'dotted' | 'decorative';
export type LayoutDensity = 'compact' | 'standard' | 'spacious';
export type StylePresetId = 'corporate' | 'modern' | 'editorial' | 'clean' | 'bold' | 'custom';

export interface DisplaySettings {
  theme: ThemeId;
  sectionStyle: SectionStyle;
  contactPosition: ContactPosition;
  customColor?: string;
  customColorSecondary?: string;
  // New settings
  headerStyle?: HeaderStyle;
  fontPreset?: FontPreset;
  dividerStyle?: DividerStyle;
  layoutDensity?: LayoutDensity;
  stylePreset?: StylePresetId;
}

export const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  theme: 'corporate-blue',
  sectionStyle: 'cards',
  contactPosition: 'sidebar',
  headerStyle: 'gradient',
  fontPreset: 'modern-sans',
  dividerStyle: 'none',
  layoutDensity: 'standard',
  stylePreset: 'corporate'
};

/**
 * Resolves the effective header style from display settings.
 * Maps legacy sectionStyle to headerStyle for backward compatibility.
 */
export function resolveHeaderStyle(settings: DisplaySettings): HeaderStyle {
  if (settings.headerStyle) return settings.headerStyle;
  // Legacy mapping
  return settings.sectionStyle === 'minimal' ? 'underline' : 'gradient';
}

// Preset themes
export const THEMES: Record<Exclude<ThemeId, 'brand' | 'custom'>, ThemeColors> = {
  'corporate-blue': {
    primary: '#2563eb',
    primaryHover: '#1d4ed8',
    primaryLight: '#dbeafe',
    secondary: '#64748b',
    gradient: { from: '#475569', to: '#2563eb' },
    text: { primary: '#1e293b', secondary: '#64748b', onPrimary: '#ffffff' },
    border: '#e2e8f0',
    cardBg: '#ffffff',
    pageBg: '#f8fafc'
  },
  'forest-green': {
    primary: '#047857',
    primaryHover: '#065f46',
    primaryLight: '#d1fae5',
    secondary: '#78716c',
    gradient: { from: '#57534e', to: '#047857' },
    text: { primary: '#1c1917', secondary: '#78716c', onPrimary: '#ffffff' },
    border: '#e7e5e4',
    cardBg: '#ffffff',
    pageBg: '#fafaf9'
  },
  'charcoal': {
    primary: '#262626',
    primaryHover: '#171717',
    primaryLight: '#e5e5e5',
    secondary: '#737373',
    gradient: { from: '#404040', to: '#262626' },
    text: { primary: '#171717', secondary: '#737373', onPrimary: '#ffffff' },
    border: '#e5e5e5',
    cardBg: '#ffffff',
    pageBg: '#fafafa'
  },
  'burgundy': {
    primary: '#9f1239',
    primaryHover: '#881337',
    primaryLight: '#ffe4e6',
    secondary: '#78716c',
    gradient: { from: '#57534e', to: '#9f1239' },
    text: { primary: '#1c1917', secondary: '#78716c', onPrimary: '#ffffff' },
    border: '#e7e5e4',
    cardBg: '#ffffff',
    pageBg: '#fafaf9'
  }
};

/**
 * Creates a theme from brand colors
 */
export function createBrandTheme(brandColors: string[]): ThemeColors {
  const primary = brandColors[0] || '#2563eb';
  const secondary = brandColors[1] || '#64748b';
  const primaryHover = adjustBrightness(primary, -15);
  const primaryLight = adjustBrightness(primary, 85);

  return {
    primary,
    primaryHover,
    primaryLight,
    secondary,
    gradient: { from: adjustBrightness(secondary, -10), to: primary },
    text: { primary: '#1e293b', secondary: '#64748b', onPrimary: getContrastColor(primary) },
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
    if (settings.customColorSecondary) colors.push(settings.customColorSecondary);
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
 * Section style class mappings (legacy, kept for backward compatibility)
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

// ============================================================
// Header Style Rendering
// ============================================================

export interface HeaderRendering {
  sectionWrapper: string;
  sectionWrapperStyle?: Record<string, string>;
  headerContainer: string;
  headerContainerStyle?: Record<string, string>;
  titleText: string;
  titleTextStyle?: Record<string, string>;
  showUnderline: boolean;
  showTopRule: boolean;
  contentArea: string;
}

export function getHeaderStyleClasses(
  headerStyle: HeaderStyle,
  themeColors: ThemeColors
): HeaderRendering {
  switch (headerStyle) {
    case 'gradient':
      return {
        sectionWrapper: 'bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden',
        headerContainer: 'px-6 py-4',
        headerContainerStyle: {
          background: `linear-gradient(to right, ${themeColors.gradient.from}, ${themeColors.gradient.to})`
        },
        titleText: 'text-lg font-semibold text-white flex items-center gap-2',
        showUnderline: false,
        showTopRule: false,
        contentArea: 'p-6'
      };

    case 'underline':
      return {
        sectionWrapper: '',
        headerContainer: 'py-4 px-1',
        titleText: 'text-lg font-semibold flex items-center gap-2',
        titleTextStyle: { color: themeColors.primary },
        showUnderline: true,
        showTopRule: false,
        contentArea: 'py-4 px-1'
      };

    case 'boxed':
      return {
        sectionWrapper: 'border rounded-lg relative pt-8 mt-4',
        sectionWrapperStyle: { borderColor: themeColors.primary + '50' },
        headerContainer: 'absolute -top-3.5 left-4 px-3',
        headerContainerStyle: { backgroundColor: themeColors.pageBg || '#f8fafc' },
        titleText: 'text-base font-semibold flex items-center gap-2',
        titleTextStyle: { color: themeColors.primary },
        showUnderline: false,
        showTopRule: false,
        contentArea: 'p-6 pt-2'
      };

    case 'left-accent':
      return {
        sectionWrapper: 'bg-white rounded-lg shadow-sm border-l-4',
        sectionWrapperStyle: { borderLeftColor: themeColors.primary },
        headerContainer: 'px-6 py-4',
        titleText: 'text-lg font-bold flex items-center gap-2',
        titleTextStyle: { color: themeColors.text.primary },
        showUnderline: false,
        showTopRule: false,
        contentArea: 'px-6 pb-6'
      };

    case 'pill':
      return {
        sectionWrapper: '',
        headerContainer: 'py-4',
        titleText: 'inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold',
        titleTextStyle: {
          backgroundColor: themeColors.primary,
          color: themeColors.text.onPrimary
        },
        showUnderline: false,
        showTopRule: false,
        contentArea: 'py-4'
      };

    case 'editorial':
      return {
        sectionWrapper: '',
        headerContainer: 'pt-8 pb-3',
        titleText: 'text-2xl font-bold tracking-tight flex items-center gap-2',
        titleTextStyle: { color: themeColors.text.primary },
        showUnderline: false,
        showTopRule: true,
        contentArea: 'py-4'
      };
  }
}

// ============================================================
// Font Presets
// ============================================================

export interface FontPresetConfig {
  name: string;
  description: string;
  headingFamily: string;
  bodyFamily: string;
  googleFontUrl?: string;
}

export const FONT_PRESETS: Record<FontPreset, FontPresetConfig> = {
  'modern-sans': {
    name: 'Modern Sans',
    description: 'Clean and professional',
    headingFamily: "Inter, system-ui, -apple-system, sans-serif",
    bodyFamily: "Inter, system-ui, -apple-system, sans-serif",
  },
  'classic-serif': {
    name: 'Classic Serif',
    description: 'Financial gravitas',
    headingFamily: "'Lora', Georgia, 'Times New Roman', serif",
    bodyFamily: "Inter, system-ui, -apple-system, sans-serif",
    googleFontUrl: "https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600;700&display=swap"
  },
  'clean-geometric': {
    name: 'Clean Geometric',
    description: 'Modern startup feel',
    headingFamily: "'DM Sans', system-ui, sans-serif",
    bodyFamily: "'DM Sans', system-ui, sans-serif",
    googleFontUrl: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap"
  },
  'editorial-mix': {
    name: 'Editorial',
    description: 'Magazine / annual report',
    headingFamily: "'Playfair Display', Georgia, serif",
    bodyFamily: "Inter, system-ui, -apple-system, sans-serif",
    googleFontUrl: "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&display=swap"
  }
};

export const FONT_PRESET_OPTIONS: Array<{
  id: FontPreset;
  name: string;
  description: string;
  sampleText: string;
}> = [
  { id: 'modern-sans', name: 'Modern Sans', description: 'Clean and professional', sampleText: 'Aa Bb Cc' },
  { id: 'classic-serif', name: 'Classic Serif', description: 'Financial gravitas', sampleText: 'Aa Bb Cc' },
  { id: 'clean-geometric', name: 'Clean Geometric', description: 'Modern startup feel', sampleText: 'Aa Bb Cc' },
  { id: 'editorial-mix', name: 'Editorial', description: 'Magazine / annual report', sampleText: 'Aa Bb Cc' }
];

// ============================================================
// Divider Styles
// ============================================================

export const DIVIDER_STYLE_OPTIONS: Array<{
  id: DividerStyle;
  name: string;
  description: string;
}> = [
  { id: 'none', name: 'None', description: 'No dividers between sections' },
  { id: 'line', name: 'Line', description: 'Thin line between sections' },
  { id: 'dotted', name: 'Dotted', description: 'Dotted line separator' },
  { id: 'decorative', name: 'Decorative', description: 'Centered ornament divider' }
];

// ============================================================
// Layout Density
// ============================================================

export interface DensityConfig {
  sectionGap: string;
  contentPadding: string;
  headerPadding: string;
  pageSpacing: string;
}

export const DENSITY_CONFIGS: Record<LayoutDensity, DensityConfig> = {
  compact: {
    sectionGap: 'mb-3',
    contentPadding: 'p-4',
    headerPadding: 'px-4 py-2',
    pageSpacing: 'py-4'
  },
  standard: {
    sectionGap: 'mb-5',
    contentPadding: 'p-6',
    headerPadding: 'px-6 py-4',
    pageSpacing: 'py-8'
  },
  spacious: {
    sectionGap: 'mb-8',
    contentPadding: 'p-8',
    headerPadding: 'px-8 py-6',
    pageSpacing: 'py-12'
  }
};

export const DENSITY_OPTIONS: Array<{
  id: LayoutDensity;
  name: string;
  description: string;
}> = [
  { id: 'compact', name: 'Compact', description: 'Tighter spacing, more content per screen' },
  { id: 'standard', name: 'Standard', description: 'Balanced spacing (default)' },
  { id: 'spacious', name: 'Spacious', description: 'Airy, premium feel with more whitespace' }
];

// ============================================================
// Style Presets (one-click transformations)
// ============================================================

export interface StylePreset {
  id: StylePresetId;
  name: string;
  description: string;
  settings: {
    headerStyle: HeaderStyle;
    fontPreset: FontPreset;
    layoutDensity: LayoutDensity;
    dividerStyle: DividerStyle;
    theme: ThemeId;
  };
}

export const STYLE_PRESETS: StylePreset[] = [
  {
    id: 'corporate',
    name: 'Corporate',
    description: 'Professional and structured',
    settings: {
      headerStyle: 'gradient',
      fontPreset: 'modern-sans',
      layoutDensity: 'standard',
      dividerStyle: 'none',
      theme: 'corporate-blue'
    }
  },
  {
    id: 'modern',
    name: 'Modern',
    description: 'Sleek and contemporary',
    settings: {
      headerStyle: 'left-accent',
      fontPreset: 'clean-geometric',
      layoutDensity: 'spacious',
      dividerStyle: 'none',
      theme: 'charcoal'
    }
  },
  {
    id: 'editorial',
    name: 'Editorial',
    description: 'Magazine-style layout',
    settings: {
      headerStyle: 'editorial',
      fontPreset: 'editorial-mix',
      layoutDensity: 'spacious',
      dividerStyle: 'decorative',
      theme: 'charcoal'
    }
  },
  {
    id: 'clean',
    name: 'Clean',
    description: 'Minimal and refined',
    settings: {
      headerStyle: 'underline',
      fontPreset: 'modern-sans',
      layoutDensity: 'standard',
      dividerStyle: 'line',
      theme: 'corporate-blue'
    }
  },
  {
    id: 'bold',
    name: 'Bold',
    description: 'Eye-catching and dynamic',
    settings: {
      headerStyle: 'pill',
      fontPreset: 'clean-geometric',
      layoutDensity: 'standard',
      dividerStyle: 'none',
      theme: 'burgundy'
    }
  }
];

// ============================================================
// UI Option Arrays
// ============================================================

export const THEME_OPTIONS: Array<{
  id: ThemeId;
  name: string;
  description: string;
  preview: { primary: string; secondary: string };
}> = [
  { id: 'corporate-blue', name: 'Corporate Blue', description: 'Professional and trustworthy', preview: { primary: '#2563eb', secondary: '#475569' } },
  { id: 'forest-green', name: 'Forest Green', description: 'Natural and sustainable', preview: { primary: '#047857', secondary: '#57534e' } },
  { id: 'charcoal', name: 'Charcoal', description: 'Modern and minimal', preview: { primary: '#262626', secondary: '#404040' } },
  { id: 'burgundy', name: 'Burgundy', description: 'Luxurious and sophisticated', preview: { primary: '#9f1239', secondary: '#57534e' } },
  { id: 'brand', name: 'My Brand Colors', description: 'Use colors from your logo', preview: { primary: '#3b82f6', secondary: '#6b7280' } },
  { id: 'custom', name: 'Custom Color', description: 'Pick your own color', preview: { primary: '#8b5cf6', secondary: '#6b7280' } }
];

export const HEADER_STYLE_OPTIONS: Array<{
  id: HeaderStyle;
  name: string;
  description: string;
}> = [
  { id: 'gradient', name: 'Gradient Bar', description: 'Full-width colored background' },
  { id: 'underline', name: 'Underline', description: 'Colored text with line beneath' },
  { id: 'boxed', name: 'Boxed', description: 'Border frame with floating title' },
  { id: 'left-accent', name: 'Left Accent', description: 'Bold vertical side bar' },
  { id: 'pill', name: 'Pill', description: 'Title in rounded badge' },
  { id: 'editorial', name: 'Editorial', description: 'Large bold type with rule above' }
];

export const SECTION_STYLE_OPTIONS: Array<{
  id: SectionStyle;
  name: string;
  description: string;
}> = [
  { id: 'cards', name: 'Cards', description: 'Bold gradient headers with shadows' },
  { id: 'minimal', name: 'Minimal', description: 'Modern minimal design with subtle borders' }
];

export const CONTACT_POSITION_OPTIONS: Array<{
  id: ContactPosition;
  name: string;
  description: string;
}> = [
  { id: 'sidebar', name: 'Sidebar', description: 'Contact info on the right side' },
  { id: 'bottom', name: 'Bottom', description: 'Full-width content, contact at bottom' }
];

// ============================================================
// Utility functions
// ============================================================

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
