import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Check, Palette, Image, FileText, Layers, Sparkles } from "lucide-react";

interface BrandedTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
}

const BRANDED_TEMPLATES: BrandedTemplate[] = [
  {
    id: 'none',
    name: 'None',
    description: 'No branded elements on PDF pages',
    icon: <FileText className="h-5 w-5" />
  },
  {
    id: 'watermark',
    name: 'Watermark',
    description: 'Your logo centered with subtle opacity',
    icon: <Image className="h-5 w-5" />
  },
  {
    id: 'footer',
    name: 'Footer',
    description: 'Logo in bottom-left with accent line',
    icon: <FileText className="h-5 w-5" />
  },
  {
    id: 'accent',
    name: 'Accent Bar',
    description: 'Brand color header bar + logo footer',
    icon: <Layers className="h-5 w-5" />
  },
  {
    id: 'full',
    name: 'Full Brand',
    description: 'Header bar, footer bar, logo & accents',
    icon: <Sparkles className="h-5 w-5" />
  }
];

export function BrandedPdfTemplateSelector() {
  const [selectedTemplate, setSelectedTemplate] = useState<string>('none');
  const queryClient = useQueryClient();

  // Fetch current user to get their brand settings
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

  // Update selected template when user data loads
  useEffect(() => {
    if (userData?.brandedPdfTemplate) {
      setSelectedTemplate(userData.brandedPdfTemplate);
    }
  }, [userData]);

  // Mutation to update branded template preference
  const updateTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const response = await apiRequest('PUT', '/api/user/branded-pdf-template', {
        body: { brandedPdfTemplate: templateId }
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Template Updated",
        description: "Your branded PDF template has been saved."
      });
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Failed to update branded template preference.",
        variant: "destructive"
      });
    }
  });

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    updateTemplateMutation.mutate(templateId);
  };

  const brandColors: string[] = userData?.brandColors || [];
  const hasLogo = !!userData?.businessLogo;
  const hasBrandColors = brandColors.length > 0;

  // Generate preview with brand colors
  const renderPreview = (templateId: string) => {
    const primaryColor = brandColors[0] || '#3b82f6';
    const secondaryColor = brandColors[1] || '#e5e7eb';

    return (
      <div className="w-24 h-32 bg-white border border-gray-200 rounded shadow-sm relative overflow-hidden">
        {templateId === 'none' && (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <FileText className="h-8 w-8" />
          </div>
        )}

        {templateId === 'watermark' && (
          <div className="w-full h-full flex items-center justify-center">
            {hasLogo ? (
              <img
                src={userData?.businessLogo}
                alt="Logo"
                className="w-12 h-12 object-contain opacity-10"
              />
            ) : (
              <div
                className="w-12 h-12 rounded opacity-10"
                style={{ backgroundColor: primaryColor }}
              />
            )}
          </div>
        )}

        {templateId === 'footer' && (
          <>
            <div
              className="absolute bottom-2 left-2 right-2 h-0.5 opacity-30"
              style={{ backgroundColor: primaryColor }}
            />
            {hasLogo ? (
              <img
                src={userData?.businessLogo}
                alt="Logo"
                className="absolute bottom-1 left-2 w-6 h-3 object-contain opacity-70"
              />
            ) : (
              <div
                className="absolute bottom-1 left-2 w-6 h-3 rounded-sm opacity-70"
                style={{ backgroundColor: primaryColor }}
              />
            )}
          </>
        )}

        {templateId === 'accent' && (
          <>
            <div
              className="absolute top-0 left-0 right-0 h-1.5"
              style={{ backgroundColor: primaryColor }}
            />
            <div
              className="absolute bottom-2 left-2 right-2 h-0.5 opacity-40"
              style={{ backgroundColor: primaryColor }}
            />
            {hasLogo ? (
              <img
                src={userData?.businessLogo}
                alt="Logo"
                className="absolute bottom-1 left-2 w-6 h-3 object-contain opacity-80"
              />
            ) : (
              <div
                className="absolute bottom-1 left-2 w-6 h-3 rounded-sm opacity-80"
                style={{ backgroundColor: primaryColor }}
              />
            )}
          </>
        )}

        {templateId === 'full' && (
          <>
            <div
              className="absolute top-0 left-0 right-0 h-2"
              style={{ backgroundColor: primaryColor }}
            />
            <div
              className="absolute bottom-0 left-0 right-0 h-4 opacity-50"
              style={{ backgroundColor: secondaryColor }}
            />
            <div
              className="absolute bottom-4 left-0 right-0 h-0.5"
              style={{ backgroundColor: primaryColor }}
            />
            {hasLogo ? (
              <img
                src={userData?.businessLogo}
                alt="Logo"
                className="absolute bottom-0.5 left-1/2 transform -translate-x-1/2 w-8 h-3 object-contain opacity-90"
              />
            ) : (
              <div
                className="absolute bottom-0.5 left-1/2 transform -translate-x-1/2 w-8 h-3 rounded-sm opacity-90"
                style={{ backgroundColor: primaryColor }}
              />
            )}
            <div
              className="absolute top-4 left-1 bottom-5 w-0.5 opacity-15"
              style={{ backgroundColor: primaryColor }}
            />
          </>
        )}
      </div>
    );
  };

  return (
    <Card className="border-0 shadow-md bg-white rounded-xl overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-purple-600 to-blue-600 pb-4 pt-5 px-5">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/20 rounded-lg">
            <Palette className="h-4 w-4 text-white" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold text-white">Branded PDF Templates</CardTitle>
            <CardDescription className="text-purple-100 mt-0.5 text-sm">
              Use your logo and brand colors on PDF exports
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 pt-5 px-5 pb-5">
        {/* Brand Colors Display */}
        {hasBrandColors && (
          <div className="mb-4">
            <p className="text-sm font-medium text-gray-700 mb-2">Your Brand Colors</p>
            <div className="flex gap-2 flex-wrap">
              {brandColors.map((color, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <div
                    className="w-6 h-6 rounded-full border border-gray-200 shadow-sm"
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                  <span className="text-xs text-gray-500 font-mono">{color}</span>
                  {idx === 0 && (
                    <span className="text-xs text-purple-600 font-medium">(Primary)</span>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Your primary brand color is automatically synced to e-signature settings.
            </p>
          </div>
        )}

        {/* No logo/colors warning */}
        {!hasLogo && !hasBrandColors && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-amber-800">
              Upload a business logo in your profile settings to enable branded PDF templates.
              We'll automatically extract your brand colors from the logo.
            </p>
          </div>
        )}

        {/* Template Options */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {BRANDED_TEMPLATES.map((template) => (
            <div
              key={template.id}
              className={`border rounded-lg p-3 cursor-pointer transition-all ${
                selectedTemplate === template.id
                  ? 'border-purple-500 bg-purple-50 ring-1 ring-purple-500'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              } ${template.id !== 'none' && !hasLogo && !hasBrandColors ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={() => {
                if (template.id === 'none' || hasLogo || hasBrandColors) {
                  handleTemplateSelect(template.id);
                }
              }}
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
                {renderPreview(template.id)}
              </div>

              <p className="text-xs text-gray-500 text-center">{template.description}</p>
            </div>
          ))}
        </div>

        {updateTemplateMutation.isPending && (
          <div className="text-sm text-gray-600 text-center">
            Saving template preference...
          </div>
        )}
      </CardContent>
    </Card>
  );
}
