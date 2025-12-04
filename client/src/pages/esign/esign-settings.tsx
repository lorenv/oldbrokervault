import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  ArrowLeft,
  Settings,
  Upload,
  Palette,
  Building2,
  Image,
  Check,
  Trash2,
} from "lucide-react";

interface BrandingSettings {
  id?: number;
  companyName: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
}

const defaultColors = [
  '#0072CE', // Blue
  '#00A651', // Green
  '#FF6B00', // Orange
  '#7B2D8E', // Purple
  '#E31837', // Red
  '#1A1A1A', // Black
  '#0D5257', // Teal
  '#4A4A4A', // Gray
];

export default function EsignSettings() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: branding, isLoading } = useQuery<BrandingSettings>({
    queryKey: ["/api/esign/branding"],
    queryFn: async () => {
      const res = await fetch("/api/esign/branding");
      if (!res.ok) {
        if (res.status === 404) {
          return { companyName: null, logoUrl: null, primaryColor: null };
        }
        throw new Error("Failed to fetch branding settings");
      }
      return res.json();
    },
  });

  const [formData, setFormData] = useState<BrandingSettings>({
    companyName: null,
    logoUrl: null,
    primaryColor: '#0072CE',
  });

  // Update form when data loads
  useEffect(() => {
    if (branding) {
      setFormData({
        companyName: branding.companyName,
        logoUrl: branding.logoUrl,
        primaryColor: branding.primaryColor || '#0072CE',
      });
    }
  }, [branding]);

  const saveMutation = useMutation({
    mutationFn: async (data: BrandingSettings) => {
      return apiRequest("POST", "/api/esign/branding", {
        body: data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/esign/branding"] });
      toast({
        title: "Settings saved",
        description: "Your branding settings have been updated.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("logo", file);
      const res = await fetch("/api/esign/branding/logo", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to upload logo");
      return res.json();
    },
    onSuccess: (data) => {
      setFormData((prev) => ({ ...prev, logoUrl: data.logoUrl }));
      toast({
        title: "Logo uploaded",
        description: "Your company logo has been uploaded.",
      });
    },
    onError: () => {
      toast({
        title: "Upload failed",
        description: "Failed to upload logo. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please select an image under 5MB.",
          variant: "destructive",
        });
        return;
      }
      uploadMutation.mutate(file);
    }
  };

  const handleSave = () => {
    saveMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 via-slate-700 to-slate-600 border-b border-slate-200 shadow-lg">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              className="text-white hover:bg-white/10"
              onClick={() => setLocation("/esign")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                <Settings className="h-8 w-8" />
                E-Signature Settings
              </h1>
              <p className="text-slate-200">
                Customize your branding for signing emails and documents
              </p>
            </div>
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Company Logo */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Image className="h-5 w-5" />
              Company Logo
            </CardTitle>
            <CardDescription>
              Your logo will appear in signing invitation emails and on the signing page
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50 overflow-hidden">
                {formData.logoUrl ? (
                  <img
                    src={formData.logoUrl}
                    alt="Company logo"
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <Building2 className="h-12 w-12 text-gray-400" />
                )}
              </div>
              <div className="flex-1">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadMutation.isPending}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {uploadMutation.isPending ? "Uploading..." : "Upload Logo"}
                  </Button>
                  {formData.logoUrl && (
                    <Button
                      variant="outline"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => setFormData((prev) => ({ ...prev, logoUrl: null }))}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remove
                    </Button>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  Recommended: 400x100px or similar aspect ratio. Max 5MB.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Company Name */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Company Name
            </CardTitle>
            <CardDescription>
              The name that appears in emails sent to signers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-w-md">
              <Label htmlFor="companyName">Company Name</Label>
              <Input
                id="companyName"
                placeholder="Your Company Name"
                value={formData.companyName || ""}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, companyName: e.target.value || null }))
                }
                className="mt-1"
              />
            </div>
          </CardContent>
        </Card>

        {/* Primary Color */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Brand Color
            </CardTitle>
            <CardDescription>
              Choose your brand color for buttons and accents in emails
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-3">
                {defaultColors.map((color) => (
                  <button
                    key={color}
                    className={`w-10 h-10 rounded-lg border-2 transition-all ${
                      formData.primaryColor === color
                        ? "border-gray-900 ring-2 ring-offset-2 ring-gray-400"
                        : "border-gray-200 hover:border-gray-400"
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setFormData((prev) => ({ ...prev, primaryColor: color }))}
                  >
                    {formData.primaryColor === color && (
                      <Check className="h-5 w-5 text-white mx-auto" />
                    )}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3 max-w-xs">
                <Label htmlFor="customColor" className="shrink-0">Custom:</Label>
                <Input
                  id="customColor"
                  type="color"
                  value={formData.primaryColor || "#0072CE"}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, primaryColor: e.target.value }))
                  }
                  className="w-16 h-10 p-1 cursor-pointer"
                />
                <Input
                  value={formData.primaryColor || "#0072CE"}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, primaryColor: e.target.value }))
                  }
                  placeholder="#0072CE"
                  className="font-mono uppercase"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Preview */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>
              How your branding will appear in signing emails
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg p-6 bg-white">
              <div className="max-w-md mx-auto">
                {formData.logoUrl && (
                  <div className="text-center mb-4">
                    <img
                      src={formData.logoUrl}
                      alt="Logo preview"
                      className="h-12 mx-auto object-contain"
                    />
                  </div>
                )}
                <div className="text-center mb-6">
                  <h3 className="text-xl font-semibold text-gray-900">
                    {formData.companyName || "Your Company"} has sent you a document to sign
                  </h3>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <p className="text-sm text-gray-600 mb-2">Document</p>
                  <p className="font-medium">Sample Agreement.pdf</p>
                </div>
                <button
                  className="w-full py-3 rounded-lg text-white font-medium"
                  style={{ backgroundColor: formData.primaryColor || "#0072CE" }}
                >
                  Review & Sign Document
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button
            size="lg"
            onClick={handleSave}
            disabled={saveMutation.isPending}
            style={{ backgroundColor: formData.primaryColor || "#0072CE" }}
            className="text-white"
          >
            {saveMutation.isPending ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </main>
    </div>
  );
}
