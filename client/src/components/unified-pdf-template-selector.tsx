import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "@/hooks/use-toast";
import { Check, FileImage, Palette, Image, FileText, Layers, Sparkles, ChevronDown, RotateCcw } from "lucide-react";

interface PdfTemplate {
  id: string;
  name: string;
  description: string;
  preview: string | null;
  type: 'branded' | 'background';
  icon?: React.ReactNode;
}

export function UnifiedPdfTemplateSelector() {
  const [selectedTemplate, setSelectedTemplate] = useState<string>('none');
  const [primaryColor, setPrimaryColor] = useState<string>('');
  const [secondaryColor, setSecondaryColor] = useState<string>('');
  const [primaryColorInput, setPrimaryColorInput] = useState<string>('');
  const [secondaryColorInput, setSecondaryColorInput] = useState<string>('');
  const queryClient = useQueryClient();

  // Fetch available background templates
  const { data: templatesData, isLoading: templatesLoading } = useQuery({
    queryKey: ['/api/pdf-templates'],
    queryFn: async () => {
      const response = await fetch('/api/pdf-templates', {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch templates');
      return response.json();
    }
  });

  // Fetch current user to get their template preference and brand colors
  const { data: userData } = useQuery({
    queryKey: ['/api/user'],
    queryFn: async () => {
      const response = await fetch('/api/user', {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch user');
      return response.json();
    }
  });

  // Determine the current selection - could be brandedPdfTemplate or pdfBackgroundTemplate
  useEffect(() => {
    if (userData) {
      // Prioritize branded template if set and not 'none'
      if (userData.brandedPdfTemplate && userData.brandedPdfTemplate !== 'none') {
        setSelectedTemplate(`branded-${userData.brandedPdfTemplate}`);
      } else if (userData.pdfBackgroundTemplate && userData.pdfBackgroundTemplate !== 'none') {
        setSelectedTemplate(`background-${userData.pdfBackgroundTemplate}`);
      } else {
        setSelectedTemplate('none');
      }

      // Load saved PDF branding colors (or use extracted brand colors as defaults)
      const extractedColors: string[] = userData.brandColors || [];
      const savedPrimary = userData.pdfPrimaryColor || extractedColors[0] || '#3b82f6';
      const savedSecondary = userData.pdfSecondaryColor || extractedColors[1] || '#e5e7eb';

      setPrimaryColor(savedPrimary);
      setSecondaryColor(savedSecondary);
      setPrimaryColorInput(savedPrimary);
      setSecondaryColorInput(savedSecondary);
    }
  }, [userData]);

  // Mutation to update template preference
  const updateTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      // Determine if this is a branded or background template
      if (templateId === 'none') {
        // Clear both
        await apiRequest('PUT', '/api/user/branded-pdf-template', {
          body: { brandedPdfTemplate: 'none' }
        });
        await fetch('/api/user/pdf-template', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ templateId: 'none' })
        });
      } else if (templateId.startsWith('branded-')) {
        const brandedId = templateId.replace('branded-', '');
        // Set branded template and clear background
        await apiRequest('PUT', '/api/user/branded-pdf-template', {
          body: { brandedPdfTemplate: brandedId }
        });
        await fetch('/api/user/pdf-template', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ templateId: 'none' })
        });
      } else if (templateId.startsWith('background-')) {
        const backgroundId = templateId.replace('background-', '');
        // Set background template and clear branded
        await apiRequest('PUT', '/api/user/branded-pdf-template', {
          body: { brandedPdfTemplate: 'none' }
        });
        await fetch('/api/user/pdf-template', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ templateId: backgroundId })
        });
      }
      return { templateId };
    },
    onSuccess: () => {
      toast({
        title: "Template Updated",
        description: "Your PDF template preference has been saved."
      });
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Failed to update PDF template preference.",
        variant: "destructive"
      });
    }
  });

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    updateTemplateMutation.mutate(templateId);
  };

  // Mutation to update PDF branding colors
  const updateColorsMutation = useMutation({
    mutationFn: async ({ pdfPrimaryColor, pdfSecondaryColor }: { pdfPrimaryColor?: string; pdfSecondaryColor?: string }) => {
      const response = await fetch('/api/user/pdf-branding-colors', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ pdfPrimaryColor, pdfSecondaryColor })
      });
      if (!response.ok) throw new Error('Failed to update colors');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Colors Updated",
        description: "Your PDF branding colors have been saved."
      });
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Failed to update PDF branding colors.",
        variant: "destructive"
      });
    }
  });

  const handlePrimaryColorChange = (color: string) => {
    setPrimaryColor(color);
    setPrimaryColorInput(color);
    updateColorsMutation.mutate({ pdfPrimaryColor: color });
  };

  const handleSecondaryColorChange = (color: string) => {
    setSecondaryColor(color);
    setSecondaryColorInput(color);
    updateColorsMutation.mutate({ pdfSecondaryColor: color });
  };

  const handlePrimaryInputBlur = () => {
    const hexRegex = /^#[0-9A-Fa-f]{6}$/;
    if (hexRegex.test(primaryColorInput)) {
      handlePrimaryColorChange(primaryColorInput);
    } else {
      setPrimaryColorInput(primaryColor); // Reset to valid value
    }
  };

  const handleSecondaryInputBlur = () => {
    const hexRegex = /^#[0-9A-Fa-f]{6}$/;
    if (hexRegex.test(secondaryColorInput)) {
      handleSecondaryColorChange(secondaryColorInput);
    } else {
      setSecondaryColorInput(secondaryColor); // Reset to valid value
    }
  };

  const resetToExtractedColors = () => {
    const extractedColors: string[] = userData?.brandColors || [];
    const defaultPrimary = extractedColors[0] || '#3b82f6';
    const defaultSecondary = extractedColors[1] || '#e5e7eb';

    setPrimaryColor(defaultPrimary);
    setSecondaryColor(defaultSecondary);
    setPrimaryColorInput(defaultPrimary);
    setSecondaryColorInput(defaultSecondary);

    // Update both colors at once
    updateColorsMutation.mutate({
      pdfPrimaryColor: defaultPrimary,
      pdfSecondaryColor: defaultSecondary
    });
  };

  const brandColors: string[] = userData?.brandColors || [];
  const hasLogo = !!userData?.businessLogo;
  const hasBrandColors = brandColors.length > 0;
  const canUseBranded = hasLogo || hasBrandColors;

  // Generate preview with user-selected colors for branded templates
  const renderBrandedPreview = (templateId: string) => {
    // Use user-selected colors (from state) instead of just extracted colors

    return (
      <div className="w-32 h-40 bg-white border border-gray-200 rounded shadow-sm relative overflow-hidden">
        {templateId === 'watermark' && (
          <div className="w-full h-full flex items-center justify-center">
            {hasLogo ? (
              <img
                src={userData?.businessLogo}
                alt="Logo"
                className="w-16 h-16 object-contain opacity-10"
              />
            ) : (
              <div
                className="w-16 h-16 rounded opacity-10"
                style={{ backgroundColor: primaryColor }}
              />
            )}
          </div>
        )}

        {templateId === 'footer' && (
          <>
            <div
              className="absolute bottom-3 left-3 right-3 h-0.5 opacity-30"
              style={{ backgroundColor: primaryColor }}
            />
            {hasLogo ? (
              <img
                src={userData?.businessLogo}
                alt="Logo"
                className="absolute bottom-1.5 left-3 w-8 h-4 object-contain opacity-70"
              />
            ) : (
              <div
                className="absolute bottom-1.5 left-3 w-8 h-4 rounded-sm opacity-70"
                style={{ backgroundColor: primaryColor }}
              />
            )}
          </>
        )}

        {templateId === 'accent' && (
          <>
            <div
              className="absolute top-0 left-0 right-0 h-2"
              style={{ backgroundColor: primaryColor }}
            />
            <div
              className="absolute bottom-3 left-3 right-3 h-0.5 opacity-40"
              style={{ backgroundColor: primaryColor }}
            />
            {hasLogo ? (
              <img
                src={userData?.businessLogo}
                alt="Logo"
                className="absolute bottom-1.5 left-3 w-8 h-4 object-contain opacity-80"
              />
            ) : (
              <div
                className="absolute bottom-1.5 left-3 w-8 h-4 rounded-sm opacity-80"
                style={{ backgroundColor: primaryColor }}
              />
            )}
          </>
        )}

        {templateId === 'full' && (
          <>
            <div
              className="absolute top-0 left-0 right-0 h-2.5"
              style={{ backgroundColor: primaryColor }}
            />
            <div
              className="absolute bottom-0 left-0 right-0 h-5 opacity-50"
              style={{ backgroundColor: secondaryColor }}
            />
            <div
              className="absolute bottom-5 left-0 right-0 h-0.5"
              style={{ backgroundColor: primaryColor }}
            />
            {hasLogo ? (
              <img
                src={userData?.businessLogo}
                alt="Logo"
                className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-10 h-4 object-contain opacity-90"
              />
            ) : (
              <div
                className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-10 h-4 rounded-sm opacity-90"
                style={{ backgroundColor: primaryColor }}
              />
            )}
            <div
              className="absolute top-5 left-1.5 bottom-6 w-0.5 opacity-15"
              style={{ backgroundColor: primaryColor }}
            />
          </>
        )}
      </div>
    );
  };

  // Build the combined template list
  const brandedTemplates: PdfTemplate[] = [
    {
      id: 'branded-watermark',
      name: 'Watermark',
      description: 'Your logo centered with subtle opacity',
      preview: null,
      type: 'branded',
      icon: <Image className="h-4 w-4" />
    },
    {
      id: 'branded-footer',
      name: 'Footer',
      description: 'Logo in bottom-left with accent line',
      preview: null,
      type: 'branded',
      icon: <FileText className="h-4 w-4" />
    },
    {
      id: 'branded-accent',
      name: 'Accent Bar',
      description: 'Brand color header bar + logo footer',
      preview: null,
      type: 'branded',
      icon: <Layers className="h-4 w-4" />
    },
    {
      id: 'branded-full',
      name: 'Full Brand',
      description: 'Header bar, footer bar, logo & accents',
      preview: null,
      type: 'branded',
      icon: <Sparkles className="h-4 w-4" />
    }
  ];

  // Get background templates from API, excluding 'none'
  const backgroundTemplates: PdfTemplate[] = (templatesData?.templates || [])
    .filter((t: any) => t.id !== 'none')
    .map((t: any) => ({
      ...t,
      id: `background-${t.id}`,
      type: 'background' as const
    }));

  if (templatesLoading) {
    return (
      <Card className="border-0 shadow-md bg-white rounded-xl overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-md bg-white rounded-xl overflow-hidden">
      <CardContent className="space-y-6 p-5">
        {/* PDF Branding Color Picker */}
        {canUseBranded && (
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Palette className="h-4 w-4 text-purple-600" />
                <p className="text-sm font-medium text-gray-700">PDF Branding Colors</p>
              </div>
              {hasBrandColors && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetToExtractedColors}
                  className="text-xs h-7 px-2 text-gray-500 hover:text-gray-700"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Reset to Logo Colors
                </Button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Primary Color Picker */}
              <div>
                <Label className="text-xs text-gray-600 mb-1.5 block">Primary Color</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-between h-9 px-3"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-5 h-5 rounded border border-gray-300"
                          style={{ backgroundColor: primaryColor }}
                        />
                        <span className="text-xs font-mono text-gray-600">{primaryColor}</span>
                      </div>
                      <ChevronDown className="h-3 w-3 text-gray-400" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-3" align="start">
                    <div className="space-y-3">
                      {hasBrandColors && (
                        <div>
                          <p className="text-xs font-medium text-gray-600 mb-2">From Logo</p>
                          <div className="flex gap-2 flex-wrap">
                            {brandColors.map((color, idx) => (
                              <button
                                key={idx}
                                className={`w-7 h-7 rounded border-2 transition-all ${
                                  primaryColor === color
                                    ? 'border-purple-500 ring-2 ring-purple-200'
                                    : 'border-gray-200 hover:border-gray-400'
                                }`}
                                style={{ backgroundColor: color }}
                                onClick={() => handlePrimaryColorChange(color)}
                                title={color}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-medium text-gray-600 mb-2">Custom Color</p>
                        <div className="flex gap-2">
                          <input
                            type="color"
                            value={primaryColor}
                            onChange={(e) => handlePrimaryColorChange(e.target.value)}
                            className="w-9 h-9 rounded cursor-pointer border border-gray-200"
                          />
                          <Input
                            value={primaryColorInput}
                            onChange={(e) => setPrimaryColorInput(e.target.value)}
                            onBlur={handlePrimaryInputBlur}
                            onKeyDown={(e) => e.key === 'Enter' && handlePrimaryInputBlur()}
                            placeholder="#000000"
                            className="flex-1 h-9 text-xs font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Secondary Color Picker */}
              <div>
                <Label className="text-xs text-gray-600 mb-1.5 block">Secondary Color</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-between h-9 px-3"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-5 h-5 rounded border border-gray-300"
                          style={{ backgroundColor: secondaryColor }}
                        />
                        <span className="text-xs font-mono text-gray-600">{secondaryColor}</span>
                      </div>
                      <ChevronDown className="h-3 w-3 text-gray-400" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-3" align="start">
                    <div className="space-y-3">
                      {hasBrandColors && (
                        <div>
                          <p className="text-xs font-medium text-gray-600 mb-2">From Logo</p>
                          <div className="flex gap-2 flex-wrap">
                            {brandColors.map((color, idx) => (
                              <button
                                key={idx}
                                className={`w-7 h-7 rounded border-2 transition-all ${
                                  secondaryColor === color
                                    ? 'border-purple-500 ring-2 ring-purple-200'
                                    : 'border-gray-200 hover:border-gray-400'
                                }`}
                                style={{ backgroundColor: color }}
                                onClick={() => handleSecondaryColorChange(color)}
                                title={color}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-medium text-gray-600 mb-2">Custom Color</p>
                        <div className="flex gap-2">
                          <input
                            type="color"
                            value={secondaryColor}
                            onChange={(e) => handleSecondaryColorChange(e.target.value)}
                            className="w-9 h-9 rounded cursor-pointer border border-gray-200"
                          />
                          <Input
                            value={secondaryColorInput}
                            onChange={(e) => setSecondaryColorInput(e.target.value)}
                            onBlur={handleSecondaryInputBlur}
                            onKeyDown={(e) => e.key === 'Enter' && handleSecondaryInputBlur()}
                            placeholder="#000000"
                            className="flex-1 h-9 text-xs font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Used for header bars, footer accents, and other PDF branding elements
            </p>
          </div>
        )}

        {/* None Option */}
        <div>
          <div
            className={`border rounded-lg p-4 cursor-pointer transition-all ${
              selectedTemplate === 'none'
                ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
            onClick={() => handleTemplateSelect('none')}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-16 h-20 border-2 border-dashed border-gray-300 rounded bg-white flex items-center justify-center">
                  <FileText className="h-6 w-6 text-gray-300" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">None</h3>
                    {selectedTemplate === 'none' && (
                      <Badge variant="default" className="bg-blue-600 text-xs px-1.5 py-0">
                        <Check className="h-3 w-3" />
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">Plain white background, no branding</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Branded Templates Section */}
        {canUseBranded && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Palette className="h-4 w-4 text-purple-600" />
              <h4 className="text-sm font-semibold text-gray-700">Branded Templates</h4>
              <span className="text-xs text-gray-500">(uses your logo & colors)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {brandedTemplates.map((template) => {
                const brandedId = template.id.replace('branded-', '');
                return (
                  <div
                    key={template.id}
                    className={`border rounded-lg p-3 cursor-pointer transition-all ${
                      selectedTemplate === template.id
                        ? 'border-purple-500 bg-purple-50 ring-1 ring-purple-500'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                    onClick={() => handleTemplateSelect(template.id)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={selectedTemplate === template.id ? 'text-purple-600' : 'text-gray-500'}>
                          {template.icon}
                        </span>
                        <h3 className="font-medium text-sm">{template.name}</h3>
                      </div>
                      {selectedTemplate === template.id && (
                        <Badge variant="default" className="bg-purple-600 text-xs px-1.5 py-0">
                          <Check className="h-3 w-3" />
                        </Badge>
                      )}
                    </div>
                    <div className="flex justify-center mb-2">
                      {renderBrandedPreview(brandedId)}
                    </div>
                    <p className="text-xs text-gray-500 text-center">{template.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* No brand assets warning */}
        {!canUseBranded && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-sm text-amber-800">
              Upload a business logo in your profile settings above to unlock branded PDF templates.
              We'll automatically extract your brand colors from the logo.
            </p>
          </div>
        )}

        {/* Background Templates Section */}
        {backgroundTemplates.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <FileImage className="h-4 w-4 text-blue-600" />
              <h4 className="text-sm font-semibold text-gray-700">Background Templates</h4>
              <span className="text-xs text-gray-500">(decorative backgrounds)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {backgroundTemplates.map((template) => (
                <div
                  key={template.id}
                  className={`border rounded-lg p-3 cursor-pointer transition-all ${
                    selectedTemplate === template.id
                      ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                  onClick={() => handleTemplateSelect(template.id)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-sm">{template.name}</h3>
                    {selectedTemplate === template.id && (
                      <Badge variant="default" className="bg-blue-600 text-xs px-1.5 py-0">
                        <Check className="h-3 w-3" />
                      </Badge>
                    )}
                  </div>
                  <div className="flex justify-center mb-2">
                    <div className="w-32 h-40 border rounded shadow-sm overflow-hidden bg-white">
                      <img
                        src={`/template-thumbnails/${template.id.replace('background-', '')}.png`}
                        alt={`${template.name} preview`}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 text-center">{template.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {updateTemplateMutation.isPending && (
          <div className="text-sm text-gray-600 text-center">
            Saving template preference...
          </div>
        )}
      </CardContent>
    </Card>
  );
}
