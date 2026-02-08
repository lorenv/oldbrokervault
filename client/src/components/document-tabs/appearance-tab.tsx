import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Palette,
  PanelRight,
  PanelBottom,
  Star,
  Type,
  LayoutGrid,
  Paintbrush,
  SlidersHorizontal
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  DisplaySettings,
  DEFAULT_DISPLAY_SETTINGS,
  THEME_OPTIONS,
  CONTACT_POSITION_OPTIONS,
  ThemeId,
  ContactPosition,
  HeaderStyle,
  FontPreset,
  DividerStyle,
  LayoutDensity,
  StylePresetId,
  HEADER_STYLE_OPTIONS,
  FONT_PRESET_OPTIONS,
  FONT_PRESETS,
  DIVIDER_STYLE_OPTIONS,
  DENSITY_OPTIONS,
  STYLE_PRESETS
} from "@/lib/share-themes";

interface DocumentAppearanceTabProps {
  cimDocument: any;
  user: any;
}

// -------------------------------------------------------------------
// Mini-preview components for header styles
// -------------------------------------------------------------------

function GradientBarPreview() {
  return (
    <div className="w-full h-16 bg-white rounded border border-gray-200 overflow-hidden">
      <div className="mx-2 mt-2 rounded-sm overflow-hidden">
        <div className="bg-gradient-to-r from-slate-600 to-blue-600 px-2 py-1.5">
          <div className="text-white text-[8px] font-semibold">Section Title</div>
        </div>
        <div className="p-1.5">
          <div className="h-1 bg-gray-200 rounded w-full mb-0.5" />
          <div className="h-1 bg-gray-200 rounded w-3/4" />
        </div>
      </div>
    </div>
  );
}

function UnderlinePreview() {
  return (
    <div className="w-full h-16 bg-white rounded border border-gray-200 overflow-hidden p-2">
      <div className="text-blue-600 text-[8px] font-semibold">Section Title</div>
      <div className="h-[1.5px] bg-blue-600 mt-0.5 w-8 rounded" />
      <div className="mt-1.5">
        <div className="h-1 bg-gray-200 rounded w-full mb-0.5" />
        <div className="h-1 bg-gray-200 rounded w-3/4" />
      </div>
    </div>
  );
}

function BoxedPreview() {
  return (
    <div className="w-full h-16 bg-white rounded border border-gray-200 overflow-hidden p-2 pt-4 relative">
      <div className="border border-blue-300 rounded-sm relative pt-2 px-1.5 pb-1">
        <div className="absolute -top-1.5 left-2 bg-white px-1">
          <span className="text-blue-600 text-[7px] font-semibold">Section Title</span>
        </div>
        <div className="h-1 bg-gray-200 rounded w-full mb-0.5" />
        <div className="h-1 bg-gray-200 rounded w-2/3" />
      </div>
    </div>
  );
}

function LeftAccentPreview() {
  return (
    <div className="w-full h-16 bg-white rounded border border-gray-200 overflow-hidden p-2">
      <div className="border-l-[3px] border-blue-600 pl-2 bg-white rounded-sm shadow-sm py-1 px-1.5">
        <div className="text-gray-900 text-[8px] font-bold">Section Title</div>
        <div className="mt-1">
          <div className="h-1 bg-gray-200 rounded w-full mb-0.5" />
          <div className="h-1 bg-gray-200 rounded w-3/4" />
        </div>
      </div>
    </div>
  );
}

function PillPreview() {
  return (
    <div className="w-full h-16 bg-white rounded border border-gray-200 overflow-hidden p-2">
      <div className="inline-block bg-blue-600 text-white text-[7px] font-semibold px-2 py-0.5 rounded-full">
        Section Title
      </div>
      <div className="mt-2">
        <div className="h-1 bg-gray-200 rounded w-full mb-0.5" />
        <div className="h-1 bg-gray-200 rounded w-3/4" />
      </div>
    </div>
  );
}

function EditorialPreview() {
  return (
    <div className="w-full h-16 bg-white rounded border border-gray-200 overflow-hidden p-2 pt-3">
      <div className="h-[1px] bg-gray-300 w-6 mb-1" />
      <div className="text-gray-900 text-[10px] font-bold tracking-tight">Section Title</div>
      <div className="mt-1.5">
        <div className="h-1 bg-gray-200 rounded w-full mb-0.5" />
        <div className="h-1 bg-gray-200 rounded w-3/4" />
      </div>
    </div>
  );
}

const HEADER_STYLE_PREVIEWS: Record<HeaderStyle, React.FC> = {
  gradient: GradientBarPreview,
  underline: UnderlinePreview,
  boxed: BoxedPreview,
  'left-accent': LeftAccentPreview,
  pill: PillPreview,
  editorial: EditorialPreview,
};

// -------------------------------------------------------------------
// Style Preset mini-preview
// -------------------------------------------------------------------

function PresetPreview({ preset }: { preset: typeof STYLE_PRESETS[number] }) {
  const hs = preset.settings.headerStyle;
  switch (hs) {
    case 'gradient':
      return (
        <div className="w-full h-10 rounded-sm overflow-hidden">
          <div className="bg-gradient-to-r from-slate-600 to-blue-600 px-2 py-1">
            <div className="text-white text-[7px] font-semibold">Title</div>
          </div>
          <div className="p-1"><div className="h-0.5 bg-gray-200 rounded w-full" /></div>
        </div>
      );
    case 'left-accent':
      return (
        <div className="w-full h-10 rounded-sm overflow-hidden p-1">
          <div className="border-l-2 border-gray-700 pl-1.5">
            <div className="text-gray-900 text-[7px] font-bold">Title</div>
            <div className="h-0.5 bg-gray-200 rounded w-full mt-0.5" />
          </div>
        </div>
      );
    case 'editorial':
      return (
        <div className="w-full h-10 rounded-sm overflow-hidden p-1 pt-2">
          <div className="h-[1px] bg-gray-300 w-4 mb-0.5" />
          <div className="text-gray-900 text-[8px] font-bold tracking-tight">Title</div>
          <div className="h-0.5 bg-gray-200 rounded w-full mt-0.5" />
        </div>
      );
    case 'underline':
      return (
        <div className="w-full h-10 rounded-sm overflow-hidden p-1">
          <div className="text-blue-600 text-[7px] font-semibold">Title</div>
          <div className="h-[1px] bg-blue-600 w-5 mt-0.5" />
          <div className="h-0.5 bg-gray-200 rounded w-full mt-1" />
        </div>
      );
    case 'pill':
      return (
        <div className="w-full h-10 rounded-sm overflow-hidden p-1">
          <span className="inline-block bg-rose-700 text-white text-[6px] font-semibold px-1.5 py-0.5 rounded-full">
            Title
          </span>
          <div className="h-0.5 bg-gray-200 rounded w-full mt-1.5" />
        </div>
      );
    default:
      return (
        <div className="w-full h-10 rounded-sm overflow-hidden p-1">
          <div className="text-gray-700 text-[7px] font-semibold">Title</div>
          <div className="h-0.5 bg-gray-200 rounded w-full mt-1" />
        </div>
      );
  }
}

// -------------------------------------------------------------------
// Preset configuration tooltip
// -------------------------------------------------------------------

function PresetConfigTooltip({ preset }: { preset: typeof STYLE_PRESETS[number] }) {
  const header = HEADER_STYLE_OPTIONS.find(o => o.id === preset.settings.headerStyle)?.name || preset.settings.headerStyle;
  const font = FONT_PRESET_OPTIONS.find(o => o.id === preset.settings.fontPreset)?.name || preset.settings.fontPreset;
  const density = DENSITY_OPTIONS.find(o => o.id === preset.settings.layoutDensity)?.name || preset.settings.layoutDensity;
  const divider = DIVIDER_STYLE_OPTIONS.find(o => o.id === preset.settings.dividerStyle)?.name || preset.settings.dividerStyle;
  const theme = THEME_OPTIONS.find(o => o.id === preset.settings.theme)?.name || preset.settings.theme;

  const rows = [
    { label: 'Header', value: header },
    { label: 'Font', value: font },
    { label: 'Density', value: density },
    { label: 'Dividers', value: divider },
    { label: 'Theme', value: theme },
  ];

  return (
    <div className="text-xs space-y-1 py-1">
      <div className="font-semibold text-gray-900 mb-1.5">{preset.name} Configuration</div>
      {rows.map(r => (
        <div key={r.label} className="flex justify-between gap-4">
          <span className="text-gray-500">{r.label}</span>
          <span className="font-medium text-gray-800">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

// -------------------------------------------------------------------
// Current settings summary badges
// -------------------------------------------------------------------

function SettingSummary({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
      <span className="text-gray-500">{label}:</span>
      <span className="font-medium">{value}</span>
    </span>
  );
}

// -------------------------------------------------------------------
// Main Component
// -------------------------------------------------------------------

export function DocumentAppearanceTab({ cimDocument, user }: DocumentAppearanceTabProps) {
  const { toast } = useToast();

  const [displaySettings, setDisplaySettings] = useState<DisplaySettings>(() => {
    const saved = cimDocument.displaySettings;
    return saved ? { ...DEFAULT_DISPLAY_SETTINGS, ...saved } : DEFAULT_DISPLAY_SETTINGS;
  });
  const [isUpdatingDisplay, setIsUpdatingDisplay] = useState(false);
  const [setAsDefault, setSetAsDefault] = useState(false);
  const [isSavingDefault, setIsSavingDefault] = useState(false);

  // Save handlers (unchanged)
  const updateDisplaySettings = async () => {
    if (!cimDocument.id) return;
    setIsUpdatingDisplay(true);
    try {
      const response = await apiRequest('PATCH', `/api/cim/${cimDocument.id}`, {
        body: { displaySettings }
      });
      if (response.ok) {
        if (setAsDefault) await saveAsDefault();
        toast({
          title: "Appearance settings updated",
          description: setAsDefault
            ? "Your share page appearance has been customized and saved as default for new documents"
            : "Your share page appearance has been customized",
        });
      } else {
        throw new Error('Failed to update display settings');
      }
    } catch (error) {
      toast({
        title: "Error updating appearance settings",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive",
      });
    } finally {
      setIsUpdatingDisplay(false);
    }
  };

  const saveAsDefault = async () => {
    setIsSavingDefault(true);
    try {
      const response = await apiRequest('PUT', '/api/user/default-display-settings', {
        body: displaySettings
      });
      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      } else {
        throw new Error('Failed to save default settings');
      }
    } catch (error) {
      toast({
        title: "Error saving defaults",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive",
      });
    } finally {
      setIsSavingDefault(false);
    }
  };

  // Preset & setting updaters
  const applyPreset = (presetId: StylePresetId) => {
    const preset = STYLE_PRESETS.find(p => p.id === presetId);
    if (preset) {
      setDisplaySettings(prev => ({
        ...prev,
        headerStyle: preset.settings.headerStyle,
        fontPreset: preset.settings.fontPreset,
        layoutDensity: preset.settings.layoutDensity,
        dividerStyle: preset.settings.dividerStyle,
        theme: preset.settings.theme,
        stylePreset: preset.id,
        sectionStyle: ['gradient'].includes(preset.settings.headerStyle) ? 'cards' : 'minimal',
      }));
    }
  };

  const updateHeaderStyle = (value: HeaderStyle) => {
    setDisplaySettings(prev => ({
      ...prev, headerStyle: value, stylePreset: 'custom' as StylePresetId,
      sectionStyle: ['gradient'].includes(value) ? 'cards' : 'minimal',
    }));
  };

  const updateFontPreset = (value: FontPreset) => {
    setDisplaySettings(prev => ({ ...prev, fontPreset: value, stylePreset: 'custom' as StylePresetId }));
  };

  const updateDividerStyle = (value: DividerStyle) => {
    setDisplaySettings(prev => ({ ...prev, dividerStyle: value, stylePreset: 'custom' as StylePresetId }));
  };

  const updateLayoutDensity = (value: LayoutDensity) => {
    setDisplaySettings(prev => ({ ...prev, layoutDensity: value, stylePreset: 'custom' as StylePresetId }));
  };

  const updateTheme = (value: ThemeId) => {
    setDisplaySettings(prev => ({ ...prev, theme: value, stylePreset: 'custom' as StylePresetId }));
  };

  // Friendly labels for summary badges
  const headerLabel = HEADER_STYLE_OPTIONS.find(o => o.id === (displaySettings.headerStyle || 'gradient'))?.name || 'Gradient Bar';
  const fontLabel = FONT_PRESET_OPTIONS.find(o => o.id === (displaySettings.fontPreset || 'modern-sans'))?.name || 'Modern Sans';
  const themeLabel = THEME_OPTIONS.find(o => o.id === displaySettings.theme)?.name || 'Corporate Blue';
  const densityLabel = DENSITY_OPTIONS.find(o => o.id === (displaySettings.layoutDensity || 'standard'))?.name || 'Standard';
  const dividerLabel = DIVIDER_STYLE_OPTIONS.find(o => o.id === (displaySettings.dividerStyle || 'none'))?.name || 'None';

  return (
    <div className="space-y-6">
      <Card className="border rounded-xl bg-white shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-r from-pink-500 to-rose-500 rounded-lg">
              <Palette className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl text-gray-900">Share Page Appearance</CardTitle>
              <CardDescription className="text-gray-600">Customize how your shared document looks to viewers</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* ============================================= */}
          {/* Style Presets — always visible */}
          {/* ============================================= */}
          <div className="space-y-3">
            <Label className="text-base font-medium text-gray-900">Style Presets</Label>
            <p className="text-sm text-gray-600">
              Pick a curated look — or fine-tune individual settings below.
            </p>
            <TooltipProvider delayDuration={300}>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {STYLE_PRESETS.map((preset) => {
                  const isSelected = displaySettings.stylePreset === preset.id;
                  return (
                    <Tooltip key={preset.id}>
                      <TooltipTrigger asChild>
                        <div
                          className={`border-2 rounded-lg p-3 cursor-pointer transition-all ${
                            isSelected
                              ? 'border-blue-500 bg-blue-50 shadow-sm'
                              : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                          }`}
                          onClick={() => applyPreset(preset.id)}
                        >
                          <div className="bg-gray-50 rounded border border-gray-100 overflow-hidden mb-2">
                            <PresetPreview preset={preset} />
                          </div>
                          <div className="text-sm font-semibold text-gray-900">{preset.name}</div>
                          <div className="text-xs text-gray-600">{preset.description}</div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="w-52 p-3">
                        <PresetConfigTooltip preset={preset} />
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
                {/* Custom indicator */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={`border-2 rounded-lg p-3 cursor-default transition-all ${
                        displaySettings.stylePreset === 'custom'
                          ? 'border-blue-500 bg-blue-50 shadow-sm'
                          : 'border-gray-200 opacity-60'
                      }`}
                    >
                      <div className="bg-gray-50 rounded border border-gray-100 overflow-hidden mb-2 flex items-center justify-center h-10">
                        <SlidersHorizontal className="h-3.5 w-3.5 text-gray-400" />
                      </div>
                      <div className="text-sm font-semibold text-gray-900">Custom</div>
                      <div className="text-xs text-gray-600">Manually configured</div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="w-52 p-3">
                    <p className="text-xs text-gray-700">
                      Automatically selected when you change any individual setting below. Start from a preset, then fine-tune to make it yours.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          </div>

          <Separator />

          {/* ============================================= */}
          {/* Customize — Accordion groups */}
          {/* ============================================= */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Label className="text-base font-medium text-gray-900">Customize</Label>
              <span className="text-xs text-gray-500">Fine-tune individual settings</span>
            </div>

            <Accordion type="multiple" className="w-full">
              {/* ---- Style Accordion ---- */}
              <AccordionItem value="style" className="border-b-0 border rounded-lg mb-2 px-1">
                <AccordionTrigger className="hover:no-underline py-3 px-3">
                  <div className="flex items-center gap-3 text-left">
                    <div className="p-1.5 bg-purple-100 rounded-md">
                      <Paintbrush className="h-4 w-4 text-purple-600" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-gray-900">Style & Colors</div>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        <SettingSummary label="Header" value={headerLabel} />
                        <SettingSummary label="Font" value={fontLabel} />
                        <SettingSummary label="Theme" value={themeLabel} />
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-3 space-y-6">
                  {/* Header Style */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium text-gray-800">Header Style</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {HEADER_STYLE_OPTIONS.map((option) => {
                        const isSelected = (displaySettings.headerStyle || 'gradient') === option.id;
                        const PreviewComponent = HEADER_STYLE_PREVIEWS[option.id];
                        return (
                          <div
                            key={option.id}
                            className={`border-2 rounded-lg p-2.5 cursor-pointer transition-all ${
                              isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                            }`}
                            onClick={() => updateHeaderStyle(option.id)}
                          >
                            <PreviewComponent />
                            <div className="mt-1.5 flex items-center gap-1.5">
                              <div className={`w-2.5 h-2.5 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-blue-500' : 'border-gray-300'}`}>
                                {isSelected && <div className="w-1 h-1 rounded-full bg-blue-500" />}
                              </div>
                              <span className="text-xs font-medium text-gray-900">{option.name}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <Separator />

                  {/* Typography */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium text-gray-800">Typography</Label>
                    <div className="grid grid-cols-2 gap-2.5">
                      {FONT_PRESET_OPTIONS.map((option) => {
                        const isSelected = (displaySettings.fontPreset || 'modern-sans') === option.id;
                        const fontConfig = FONT_PRESETS[option.id];
                        return (
                          <div
                            key={option.id}
                            className={`border-2 rounded-lg p-3 cursor-pointer transition-all ${
                              isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                            }`}
                            onClick={() => updateFontPreset(option.id)}
                          >
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <div className={`w-2.5 h-2.5 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-blue-500' : 'border-gray-300'}`}>
                                {isSelected && <div className="w-1 h-1 rounded-full bg-blue-500" />}
                              </div>
                              <span className="text-xs font-medium text-gray-900">{option.name}</span>
                            </div>
                            <div className="text-base text-gray-800 leading-tight" style={{ fontFamily: fontConfig.headingFamily }}>
                              {option.name}
                            </div>
                            <div className="text-[11px] text-gray-600 mt-0.5" style={{ fontFamily: fontConfig.bodyFamily }}>
                              {option.description}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <Separator />

                  {/* Color Theme */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium text-gray-800">Color Theme</Label>
                    <RadioGroup
                      value={displaySettings.theme}
                      onValueChange={(value) => updateTheme(value as ThemeId)}
                      className="grid grid-cols-1 gap-2"
                    >
                      {THEME_OPTIONS.map((theme) => {
                        const getPreviewColor = () => {
                          if (theme.id === 'brand' && user?.brandColors?.[0]) return user.brandColors[0];
                          if (theme.id === 'custom' && displaySettings.customColor) return displaySettings.customColor;
                          return theme.preview.primary;
                        };
                        const getSecondaryColor = () => {
                          if (theme.id === 'brand' && user?.brandColors?.[1]) return user.brandColors[1];
                          if (theme.id === 'custom' && displaySettings.customColorSecondary) return displaySettings.customColorSecondary;
                          return theme.preview.secondary;
                        };
                        return (
                          <div key={theme.id} className="flex items-center space-x-3">
                            <RadioGroupItem value={theme.id} id={`theme-${theme.id}`} />
                            <Label htmlFor={`theme-${theme.id}`} className="flex items-center gap-3 cursor-pointer flex-1">
                              <div className="flex gap-1">
                                <div className="w-4 h-4 rounded-full border border-gray-200" style={{ backgroundColor: getPreviewColor() }} />
                                <div className="w-4 h-4 rounded-full border border-gray-200" style={{ backgroundColor: getSecondaryColor() }} />
                              </div>
                              <div className="flex-1">
                                <span className="font-medium text-gray-900 text-sm">{theme.name}</span>
                                <span className="text-xs text-gray-600 ml-1.5">{theme.description}</span>
                              </div>
                              {theme.id === 'custom' && displaySettings.theme === 'custom' && (
                                <div className="flex items-center gap-2">
                                  <div className="flex flex-col items-center">
                                    <input
                                      type="color"
                                      value={displaySettings.customColor || '#8b5cf6'}
                                      onChange={(e) => setDisplaySettings(prev => ({ ...prev, customColor: e.target.value, stylePreset: 'custom' as StylePresetId }))}
                                      className="w-7 h-7 rounded cursor-pointer border border-gray-300"
                                      onClick={(e) => e.stopPropagation()}
                                      title="Primary color"
                                    />
                                    <span className="text-[9px] text-gray-500 mt-0.5">Primary</span>
                                  </div>
                                  <div className="flex flex-col items-center">
                                    <input
                                      type="color"
                                      value={displaySettings.customColorSecondary || '#64748b'}
                                      onChange={(e) => setDisplaySettings(prev => ({ ...prev, customColorSecondary: e.target.value, stylePreset: 'custom' as StylePresetId }))}
                                      className="w-7 h-7 rounded cursor-pointer border border-gray-300"
                                      onClick={(e) => e.stopPropagation()}
                                      title="Secondary color"
                                    />
                                    <span className="text-[9px] text-gray-500 mt-0.5">Secondary</span>
                                  </div>
                                </div>
                              )}
                            </Label>
                          </div>
                        );
                      })}
                    </RadioGroup>
                    {displaySettings.theme === 'brand' && !user?.brandColors?.length && (
                      <p className="text-sm text-amber-600 bg-amber-50 p-2 rounded">
                        Upload a business logo in your profile to extract brand colors
                      </p>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* ---- Layout Accordion ---- */}
              <AccordionItem value="layout" className="border-b-0 border rounded-lg mb-2 px-1">
                <AccordionTrigger className="hover:no-underline py-3 px-3">
                  <div className="flex items-center gap-3 text-left">
                    <div className="p-1.5 bg-teal-100 rounded-md">
                      <LayoutGrid className="h-4 w-4 text-teal-600" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-gray-900">Layout & Spacing</div>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        <SettingSummary label="Density" value={densityLabel} />
                        <SettingSummary label="Dividers" value={dividerLabel} />
                        <SettingSummary label="Contact" value={displaySettings.contactPosition === 'sidebar' ? 'Sidebar' : 'Bottom'} />
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-3 space-y-6">
                  {/* Layout Density */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium text-gray-800">Layout Density</Label>
                    <div className="grid grid-cols-3 gap-2.5">
                      {DENSITY_OPTIONS.map((option) => {
                        const isSelected = (displaySettings.layoutDensity || 'standard') === option.id;
                        return (
                          <div
                            key={option.id}
                            className={`border-2 rounded-lg p-3 cursor-pointer transition-all text-center ${
                              isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                            }`}
                            onClick={() => updateLayoutDensity(option.id)}
                          >
                            <div className="h-10 flex flex-col items-center justify-center mb-1.5">
                              {option.id === 'compact' && (
                                <div className="space-y-0.5 w-full px-3">
                                  <div className="h-1 bg-gray-400 rounded w-full" />
                                  <div className="h-1 bg-gray-300 rounded w-3/4" />
                                  <div className="h-1 bg-gray-400 rounded w-full" />
                                  <div className="h-1 bg-gray-300 rounded w-2/3" />
                                  <div className="h-1 bg-gray-400 rounded w-full" />
                                </div>
                              )}
                              {option.id === 'standard' && (
                                <div className="space-y-1 w-full px-3">
                                  <div className="h-1 bg-gray-400 rounded w-full" />
                                  <div className="h-1 bg-gray-300 rounded w-3/4" />
                                  <div className="h-1 bg-gray-400 rounded w-full" />
                                  <div className="h-1 bg-gray-300 rounded w-2/3" />
                                </div>
                              )}
                              {option.id === 'spacious' && (
                                <div className="space-y-2 w-full px-3">
                                  <div className="h-1 bg-gray-400 rounded w-full" />
                                  <div className="h-1 bg-gray-300 rounded w-3/4" />
                                  <div className="h-1 bg-gray-400 rounded w-full" />
                                </div>
                              )}
                            </div>
                            <div className="flex items-center justify-center gap-1.5">
                              <div className={`w-2.5 h-2.5 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-blue-500' : 'border-gray-300'}`}>
                                {isSelected && <div className="w-1 h-1 rounded-full bg-blue-500" />}
                              </div>
                              <span className="text-xs font-medium text-gray-900">{option.name}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <Separator />

                  {/* Section Dividers */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium text-gray-800">Section Dividers</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {DIVIDER_STYLE_OPTIONS.map((option) => {
                        const isSelected = (displaySettings.dividerStyle || 'none') === option.id;
                        return (
                          <div
                            key={option.id}
                            className={`border-2 rounded-lg p-2.5 cursor-pointer transition-all text-center ${
                              isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                            }`}
                            onClick={() => updateDividerStyle(option.id)}
                          >
                            <div className="h-6 flex items-center justify-center mb-1">
                              {option.id === 'none' && <span className="text-[10px] text-gray-500 italic">None</span>}
                              {option.id === 'line' && <div className="w-full px-1"><div className="h-[1px] bg-gray-400 w-full" /></div>}
                              {option.id === 'dotted' && <div className="w-full px-1"><div className="border-t border-dotted border-gray-400 w-full" /></div>}
                              {option.id === 'decorative' && (
                                <div className="flex items-center gap-0.5 text-gray-500">
                                  <div className="h-[1px] bg-gray-300 w-3" />
                                  <span className="text-[8px]">&diams;</span>
                                  <span className="text-[6px]">&bull;</span>
                                  <span className="text-[8px]">&diams;</span>
                                  <div className="h-[1px] bg-gray-300 w-3" />
                                </div>
                              )}
                            </div>
                            <span className="text-xs font-medium text-gray-900">{option.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <Separator />

                  {/* Contact Position */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium text-gray-800">Contact Section Position</Label>
                    <RadioGroup
                      value={displaySettings.contactPosition}
                      onValueChange={(value) => setDisplaySettings(prev => ({ ...prev, contactPosition: value as ContactPosition }))}
                      className="grid grid-cols-2 gap-2.5"
                    >
                      {CONTACT_POSITION_OPTIONS.map((position) => (
                        <div
                          key={position.id}
                          className={`flex flex-col items-center p-3 border-2 rounded-lg cursor-pointer transition-all ${
                            displaySettings.contactPosition === position.id
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                          onClick={() => setDisplaySettings(prev => ({ ...prev, contactPosition: position.id }))}
                        >
                          {position.id === 'sidebar' ? (
                            <PanelRight className="h-6 w-6 text-gray-600 mb-1.5" />
                          ) : (
                            <PanelBottom className="h-6 w-6 text-gray-600 mb-1.5" />
                          )}
                          <span className="font-medium text-xs text-gray-900">{position.name}</span>
                          <span className="text-[11px] text-gray-600 text-center mt-0.5">{position.description}</span>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          {/* ============================================= */}
          {/* Footer: Set as Default + Save */}
          {/* ============================================= */}
          <div className="flex items-center space-x-2 pt-2">
            <Checkbox
              id="setAsDefault"
              checked={setAsDefault}
              onCheckedChange={(checked) => setSetAsDefault(checked === true)}
            />
            <label
              htmlFor="setAsDefault"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex items-center gap-1.5 text-gray-900"
            >
              <Star className="h-3.5 w-3.5 text-amber-500" />
              Also set as default for new documents
            </label>
          </div>

          <Button
            onClick={updateDisplaySettings}
            disabled={isUpdatingDisplay || isSavingDefault}
            className="w-full bg-gradient-to-r from-pink-500 to-rose-500 text-white hover:from-pink-600 hover:to-rose-600"
          >
            {isUpdatingDisplay || isSavingDefault ? "Saving..." : "Save Appearance Settings"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
