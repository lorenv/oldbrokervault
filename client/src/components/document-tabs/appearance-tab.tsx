import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Palette,
  PanelRight,
  PanelBottom,
  Star
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  DisplaySettings,
  DEFAULT_DISPLAY_SETTINGS,
  THEME_OPTIONS,
  SECTION_STYLE_OPTIONS,
  CONTACT_POSITION_OPTIONS,
  ThemeId,
  SectionStyle,
  ContactPosition
} from "@/lib/share-themes";

interface DocumentAppearanceTabProps {
  cimDocument: any;
  user: any;
}

export function DocumentAppearanceTab({ cimDocument, user }: DocumentAppearanceTabProps) {
  const { toast } = useToast();

  // Display settings state
  const [displaySettings, setDisplaySettings] = useState<DisplaySettings>(() => {
    const saved = cimDocument.displaySettings;
    return saved ? { ...DEFAULT_DISPLAY_SETTINGS, ...saved } : DEFAULT_DISPLAY_SETTINGS;
  });
  const [isUpdatingDisplay, setIsUpdatingDisplay] = useState(false);
  const [setAsDefault, setSetAsDefault] = useState(false);
  const [isSavingDefault, setIsSavingDefault] = useState(false);

  // Update display settings
  const updateDisplaySettings = async () => {
    if (!cimDocument.id) return;

    setIsUpdatingDisplay(true);
    try {
      const response = await apiRequest('PATCH', `/api/cim/${cimDocument.id}`, {
        body: { displaySettings }
      });

      if (response.ok) {
        // Also save as default if checkbox is checked
        if (setAsDefault) {
          await saveAsDefault();
        }
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

  // Save current settings as default for new documents
  const saveAsDefault = async () => {
    setIsSavingDefault(true);
    try {
      const response = await apiRequest('PUT', '/api/user/default-display-settings', {
        body: displaySettings
      });

      if (response.ok) {
        // Invalidate user query to refresh cached data
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

  return (
    <div className="space-y-6">
      <Card className="border rounded-xl bg-white shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-r from-pink-500 to-rose-500 rounded-lg">
              <Palette className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl">Share Page Appearance</CardTitle>
              <CardDescription>Customize how your shared document looks to viewers</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Color Theme */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Color Theme</Label>
            <p className="text-sm text-muted-foreground">
              Choose a color palette for section headers and accents
            </p>
            <RadioGroup
              value={displaySettings.theme}
              onValueChange={(value) => setDisplaySettings(prev => ({ ...prev, theme: value as ThemeId }))}
              className="grid grid-cols-1 gap-3"
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
                    <Label
                      htmlFor={`theme-${theme.id}`}
                      className="flex items-center gap-3 cursor-pointer flex-1"
                    >
                      <div className="flex gap-1">
                        <div
                          className="w-5 h-5 rounded-full border border-gray-200"
                          style={{ backgroundColor: getPreviewColor() }}
                        />
                        <div
                          className="w-5 h-5 rounded-full border border-gray-200"
                          style={{ backgroundColor: getSecondaryColor() }}
                        />
                      </div>
                      <div className="flex-1">
                        <span className="font-medium">{theme.name}</span>
                        <span className="text-sm text-muted-foreground ml-2">{theme.description}</span>
                      </div>
                      {theme.id === 'custom' && displaySettings.theme === 'custom' && (
                        <div className="flex items-center gap-2">
                          <div className="flex flex-col items-center">
                            <input
                              type="color"
                              value={displaySettings.customColor || '#8b5cf6'}
                              onChange={(e) => setDisplaySettings(prev => ({ ...prev, customColor: e.target.value }))}
                              className="w-8 h-8 rounded cursor-pointer border border-gray-300"
                              onClick={(e) => e.stopPropagation()}
                              title="Primary color"
                            />
                            <span className="text-[10px] text-muted-foreground mt-0.5">Primary</span>
                          </div>
                          <div className="flex flex-col items-center">
                            <input
                              type="color"
                              value={displaySettings.customColorSecondary || '#64748b'}
                              onChange={(e) => setDisplaySettings(prev => ({ ...prev, customColorSecondary: e.target.value }))}
                              className="w-8 h-8 rounded cursor-pointer border border-gray-300"
                              onClick={(e) => e.stopPropagation()}
                              title="Secondary color"
                            />
                            <span className="text-[10px] text-muted-foreground mt-0.5">Secondary</span>
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

          <Separator />

          {/* Section Style */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Section Style</Label>
            <p className="text-sm text-muted-foreground">
              Control how content sections are displayed
            </p>
            <RadioGroup
              value={displaySettings.sectionStyle}
              onValueChange={(value) => setDisplaySettings(prev => ({ ...prev, sectionStyle: value as SectionStyle }))}
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
            >
              {/* Cards Style */}
              <div
                className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                  displaySettings.sectionStyle === 'cards'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setDisplaySettings(prev => ({ ...prev, sectionStyle: 'cards' }))}
              >
                <div className="flex items-center space-x-2 mb-3">
                  <RadioGroupItem value="cards" id="style-cards" />
                  <Label htmlFor="style-cards" className="cursor-pointer">
                    <span className="font-medium">Cards</span>
                  </Label>
                </div>
                {/* Visual Preview */}
                <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-100">
                  <div className="bg-gradient-to-r from-slate-600 to-blue-600 px-3 py-2">
                    <div className="text-white text-[10px] font-semibold">Section Title</div>
                  </div>
                  <div className="p-3">
                    <div className="h-1.5 bg-gray-200 rounded w-full mb-1"></div>
                    <div className="h-1.5 bg-gray-200 rounded w-3/4"></div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">Bold gradient headers with shadows</p>
              </div>

              {/* Minimal Style */}
              <div
                className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                  displaySettings.sectionStyle === 'minimal'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setDisplaySettings(prev => ({ ...prev, sectionStyle: 'minimal' }))}
              >
                <div className="flex items-center space-x-2 mb-3">
                  <RadioGroupItem value="minimal" id="style-minimal" />
                  <Label htmlFor="style-minimal" className="cursor-pointer">
                    <span className="font-medium">Minimal</span>
                  </Label>
                </div>
                {/* Visual Preview - Single document style */}
                <div className="bg-white rounded-lg overflow-hidden border border-gray-200 shadow-sm">
                  <div className="p-3 space-y-3">
                    {/* Section 1 */}
                    <div>
                      <div className="text-blue-600 text-[10px] font-semibold">Section One</div>
                      <div className="h-0.5 bg-blue-600 mt-0.5 rounded w-12"></div>
                      <div className="mt-1.5 space-y-0.5">
                        <div className="h-1 bg-gray-200 rounded w-full"></div>
                        <div className="h-1 bg-gray-200 rounded w-3/4"></div>
                      </div>
                    </div>
                    {/* Section 2 */}
                    <div>
                      <div className="text-blue-600 text-[10px] font-semibold">Section Two</div>
                      <div className="h-0.5 bg-blue-600 mt-0.5 rounded w-12"></div>
                      <div className="mt-1.5 space-y-0.5">
                        <div className="h-1 bg-gray-200 rounded w-full"></div>
                        <div className="h-1 bg-gray-200 rounded w-2/3"></div>
                      </div>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">Clean single-document layout</p>
              </div>
            </RadioGroup>
          </div>

          <Separator />

          {/* Contact Position */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Contact Section Position</Label>
            <p className="text-sm text-muted-foreground">
              Choose where the contact information appears on the share page
            </p>
            <RadioGroup
              value={displaySettings.contactPosition}
              onValueChange={(value) => setDisplaySettings(prev => ({ ...prev, contactPosition: value as ContactPosition }))}
              className="grid grid-cols-2 gap-3"
            >
              {CONTACT_POSITION_OPTIONS.map((position) => (
                <div
                  key={position.id}
                  className={`flex flex-col items-center p-4 border rounded-lg cursor-pointer transition-all ${
                    displaySettings.contactPosition === position.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setDisplaySettings(prev => ({ ...prev, contactPosition: position.id }))}
                >
                  {position.id === 'sidebar' ? (
                    <PanelRight className="h-8 w-8 text-gray-600 mb-2" />
                  ) : (
                    <PanelBottom className="h-8 w-8 text-gray-600 mb-2" />
                  )}
                  <span className="font-medium text-sm">{position.name}</span>
                  <span className="text-xs text-muted-foreground text-center mt-1">{position.description}</span>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Set as default checkbox */}
          <div className="flex items-center space-x-2 pt-2">
            <Checkbox
              id="setAsDefault"
              checked={setAsDefault}
              onCheckedChange={(checked) => setSetAsDefault(checked === true)}
            />
            <label
              htmlFor="setAsDefault"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex items-center gap-1.5"
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
