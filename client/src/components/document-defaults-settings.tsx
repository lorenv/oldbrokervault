import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { PanelRight, PanelBottom } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  DisplaySettings,
  DEFAULT_DISPLAY_SETTINGS,
  THEME_OPTIONS,
  ThemeId,
} from "@/lib/share-themes";

interface DocumentDefaultsSettingsProps {
  user: any;
}

export function DocumentDefaultsSettings({ user }: DocumentDefaultsSettingsProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  // Initialize display settings from user's defaults or system defaults
  const [displaySettings, setDisplaySettings] = useState<DisplaySettings>(() => {
    const saved = user?.defaultDisplaySettings;
    return saved ? { ...DEFAULT_DISPLAY_SETTINGS, ...saved } : DEFAULT_DISPLAY_SETTINGS;
  });

  // Update state when user data changes
  useEffect(() => {
    if (user?.defaultDisplaySettings) {
      setDisplaySettings({ ...DEFAULT_DISPLAY_SETTINGS, ...user.defaultDisplaySettings });
    }
  }, [user?.defaultDisplaySettings]);

  const saveDefaults = async () => {
    setIsSaving(true);
    try {
      const response = await apiRequest('PUT', '/api/user/default-display-settings', {
        body: displaySettings
      });

      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ['/api/user'] });
        toast({
          title: "Defaults saved",
          description: "New documents will use these appearance settings",
        });
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
      setIsSaving(false);
    }
  };

  return (
    <Card className="border-0 shadow-md bg-white rounded-xl overflow-hidden">
      <CardContent className="space-y-6 p-5">
        {/* Color Theme */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Default Color Theme</Label>
          <RadioGroup
            value={displaySettings.theme}
            onValueChange={(value) => setDisplaySettings(prev => ({ ...prev, theme: value as ThemeId }))}
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
                  <RadioGroupItem value={theme.id} id={`default-theme-${theme.id}`} />
                  <Label
                    htmlFor={`default-theme-${theme.id}`}
                    className="flex items-center gap-3 cursor-pointer flex-1 text-sm"
                  >
                    <div className="flex gap-1">
                      <div
                        className="w-4 h-4 rounded-full border border-gray-200"
                        style={{ backgroundColor: getSecondaryColor() }}
                      />
                      <div
                        className="w-4 h-4 rounded-full border border-gray-200"
                        style={{ backgroundColor: getPreviewColor() }}
                      />
                    </div>
                    <div className="flex-1">
                      <span className="font-medium">{theme.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">{theme.description}</span>
                    </div>
                    {theme.id === 'custom' && displaySettings.theme === 'custom' && (
                      <div className="flex items-center gap-2">
                        <div className="flex flex-col items-center">
                          <input
                            type="color"
                            value={displaySettings.customColor || '#8b5cf6'}
                            onChange={(e) => setDisplaySettings(prev => ({ ...prev, customColor: e.target.value }))}
                            className="w-6 h-6 rounded cursor-pointer border border-gray-300"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <span className="text-[9px] text-muted-foreground">Pri</span>
                        </div>
                        <div className="flex flex-col items-center">
                          <input
                            type="color"
                            value={displaySettings.customColorSecondary || '#64748b'}
                            onChange={(e) => setDisplaySettings(prev => ({ ...prev, customColorSecondary: e.target.value }))}
                            className="w-6 h-6 rounded cursor-pointer border border-gray-300"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <span className="text-[9px] text-muted-foreground">Sec</span>
                        </div>
                      </div>
                    )}
                  </Label>
                </div>
              );
            })}
          </RadioGroup>
        </div>

        {/* Section Style */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Default Section Style</Label>
          <RadioGroup
            value={displaySettings.sectionStyle}
            onValueChange={(value) => setDisplaySettings(prev => ({ ...prev, sectionStyle: value as 'cards' | 'minimal' }))}
            className="grid grid-cols-2 gap-4"
          >
            {/* Cards Style */}
            <div
              className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                displaySettings.sectionStyle === 'cards'
                  ? 'border-pink-500 bg-pink-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => setDisplaySettings(prev => ({ ...prev, sectionStyle: 'cards' }))}
            >
              <RadioGroupItem value="cards" id="default-style-cards" className="sr-only" />
              <Label htmlFor="default-style-cards" className="cursor-pointer block">
                <div className="font-medium text-sm text-center mb-3">Cards</div>
                {/* Visual Preview */}
                <div className="bg-white rounded-md overflow-hidden border border-gray-200 mb-3">
                  <div className="bg-gradient-to-r from-slate-500 to-blue-500 px-2 py-1.5">
                    <div className="text-white text-[9px] font-semibold">Section Title</div>
                  </div>
                  <div className="p-2 space-y-1">
                    <div className="h-1 bg-gray-200 rounded w-full"></div>
                    <div className="h-1 bg-gray-200 rounded w-3/4"></div>
                  </div>
                </div>
                <div className="text-[11px] text-muted-foreground text-center leading-tight">
                  Separate cards with bold gradient headers and shadows
                </div>
              </Label>
            </div>

            {/* Minimal Style */}
            <div
              className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                displaySettings.sectionStyle === 'minimal'
                  ? 'border-pink-500 bg-pink-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => setDisplaySettings(prev => ({ ...prev, sectionStyle: 'minimal' }))}
            >
              <RadioGroupItem value="minimal" id="default-style-minimal" className="sr-only" />
              <Label htmlFor="default-style-minimal" className="cursor-pointer block">
                <div className="font-medium text-sm text-center mb-3">Minimal</div>
                {/* Visual Preview */}
                <div className="bg-white rounded-md overflow-hidden border border-gray-200 mb-3 p-2 space-y-2">
                  <div>
                    <div className="text-blue-600 text-[9px] font-semibold">Section One</div>
                    <div className="h-0.5 bg-blue-600 mt-0.5 rounded w-10"></div>
                    <div className="mt-1 space-y-0.5">
                      <div className="h-1 bg-gray-200 rounded w-full"></div>
                    </div>
                  </div>
                  <div>
                    <div className="text-blue-600 text-[9px] font-semibold">Section Two</div>
                    <div className="h-0.5 bg-blue-600 mt-0.5 rounded w-10"></div>
                    <div className="mt-1 space-y-0.5">
                      <div className="h-1 bg-gray-200 rounded w-full"></div>
                    </div>
                  </div>
                </div>
                <div className="text-[11px] text-muted-foreground text-center leading-tight">
                  Single document with thin colored underlines under each section
                </div>
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Contact Position */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Default Contact Position</Label>
          <RadioGroup
            value={displaySettings.contactPosition}
            onValueChange={(value) => setDisplaySettings(prev => ({ ...prev, contactPosition: value as 'sidebar' | 'bottom' }))}
            className="grid grid-cols-2 gap-3"
          >
            <div
              className={`flex flex-col items-center justify-center border-2 rounded-lg p-3 cursor-pointer transition-all ${
                displaySettings.contactPosition === 'sidebar'
                  ? 'border-pink-500 bg-pink-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => setDisplaySettings(prev => ({ ...prev, contactPosition: 'sidebar' }))}
            >
              <RadioGroupItem value="sidebar" id="default-contact-sidebar" className="sr-only" />
              <PanelRight className="h-6 w-6 text-gray-600 mb-1" />
              <span className="font-medium text-sm">Sidebar</span>
            </div>
            <div
              className={`flex flex-col items-center justify-center border-2 rounded-lg p-3 cursor-pointer transition-all ${
                displaySettings.contactPosition === 'bottom'
                  ? 'border-pink-500 bg-pink-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => setDisplaySettings(prev => ({ ...prev, contactPosition: 'bottom' }))}
            >
              <RadioGroupItem value="bottom" id="default-contact-bottom" className="sr-only" />
              <PanelBottom className="h-6 w-6 text-gray-600 mb-1" />
              <span className="font-medium text-sm">Bottom</span>
            </div>
          </RadioGroup>
        </div>

        <Button
          onClick={saveDefaults}
          disabled={isSaving}
          className="w-full bg-gradient-to-r from-pink-500 to-rose-500 text-white hover:from-pink-600 hover:to-rose-600"
        >
          {isSaving ? "Saving..." : "Save as Default"}
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          These settings will be the default appearance for all new CIMs you create
        </p>
      </CardContent>
    </Card>
  );
}
