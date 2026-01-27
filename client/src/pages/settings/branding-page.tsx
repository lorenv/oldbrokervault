import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { UnifiedPdfTemplateSelector } from "@/components/unified-pdf-template-selector";
import { DocumentDefaultsSettings } from "@/components/document-defaults-settings";
import { SettingsLayout, useSettingsAccess } from "@/components/layout/settings-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { FileImage, Globe, Palette, Upload, Check, RefreshCw, Lock } from "lucide-react";
import { compressImage, processLogoForDarkBackground } from "@/lib/image-utils";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function BrandingPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canEdit, isViewOnly } = useSettingsAccess();
  const [isUploading, setIsUploading] = useState(false);

  // Get active tab from URL hash
  const getInitialTab = () => {
    const hash = window.location.hash.replace('#', '');
    if (['identity', 'pdf', 'online'].includes(hash)) return hash;
    return 'identity';
  };
  const [activeTab, setActiveTab] = useState(getInitialTab);

  // Fetch profile data
  const { data: profile } = useQuery<any>({
    queryKey: ["/api/profile"],
  });

  // Fetch eSignature branding
  const { data: esignBranding } = useQuery<any>({
    queryKey: ["/api/esign/branding"],
  });

  const brandColors: string[] = profile?.brandColors || [];
  const businessLogo = profile?.businessLogo || null;
  const primaryColor = profile?.pdfPrimaryColor || brandColors[0] || '#3b82f6';

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("PUT", "/api/profile", { body: data });
      if (!response.ok) throw new Error("Failed to update profile");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    },
  });

  // Update eSignature branding mutation
  const updateEsignBrandingMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("PUT", "/api/esign/branding", { body: data });
      if (!response.ok) throw new Error("Failed to update branding");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/esign/branding"] });
    },
  });

  // Handle logo upload
  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      // Compress the image
      let finalDataUrl = await compressImage(file, 600, 0.6);

      // Process for dark backgrounds
      try {
        const { processedUrl } = await processLogoForDarkBackground(finalDataUrl);
        finalDataUrl = processedUrl;
      } catch {}

      // Update profile with new logo
      await updateProfileMutation.mutateAsync({ businessLogo: finalDataUrl });

      // Also update eSignature branding to keep in sync
      await updateEsignBrandingMutation.mutateAsync({ logoUrl: finalDataUrl });

      toast({ title: "Logo Updated", description: "Your brand logo has been saved and synced across all settings." });
    } catch (error) {
      toast({ title: "Upload Failed", description: "Failed to process the image.", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  // Remove logo
  const handleRemoveLogo = async () => {
    try {
      await updateProfileMutation.mutateAsync({ businessLogo: "" });
      await updateEsignBrandingMutation.mutateAsync({ logoUrl: null });
      toast({ title: "Logo Removed" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to remove logo", variant: "destructive" });
    }
  };

  // Update primary color and sync across all branding
  const handlePrimaryColorChange = async (color: string) => {
    try {
      // Update PDF branding color
      await fetch('/api/user/pdf-branding-colors', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ pdfPrimaryColor: color })
      });

      // Update eSignature branding color
      await updateEsignBrandingMutation.mutateAsync({ primaryColor: color });

      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });

      toast({ title: "Brand Color Updated", description: "Your primary color has been synced across all settings." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to update color", variant: "destructive" });
    }
  };

  return (
    <SettingsLayout
      title="Branding"
      description="Customize the appearance of your documents and communications"
    >
      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          setActiveTab(v);
          window.history.replaceState({}, '', `/settings/branding#${v}`);
        }}
        className="max-w-4xl"
      >
        <TabsList className="mb-6">
          <TabsTrigger value="identity" className="gap-2">
            <Palette className="h-4 w-4" />
            Brand Identity
          </TabsTrigger>
          <TabsTrigger value="pdf" className="gap-2">
            <FileImage className="h-4 w-4" />
            PDF Export
          </TabsTrigger>
          <TabsTrigger value="online" className="gap-2">
            <Globe className="h-4 w-4" />
            Online CIM
          </TabsTrigger>
        </TabsList>

        <TabsContent value="identity">
          <div className="space-y-6">
            {isViewOnly && (
              <Alert className="bg-amber-50 border-amber-200">
                <Lock className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-700">
                  You have view-only access to branding settings. Contact an admin or owner to make changes.
                </AlertDescription>
              </Alert>
            )}
            {/* Logo Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Business Logo</CardTitle>
                <CardDescription>
                  Your logo appears on PDFs, eSignature emails, and shared documents
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-start gap-6">
                  {/* Logo Preview */}
                  <div className="w-32 h-32 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center bg-gray-50">
                    {businessLogo ? (
                      <img
                        src={businessLogo}
                        alt="Business Logo"
                        className="max-w-full max-h-full object-contain p-2"
                      />
                    ) : (
                      <div className="text-center">
                        <Upload className="h-8 w-8 text-gray-300 mx-auto mb-1" />
                        <p className="text-xs text-gray-400">No logo</p>
                      </div>
                    )}
                  </div>

                  {/* Upload Controls */}
                  <div className="flex-1 space-y-3">
                    <div>
                      <Button
                        variant="outline"
                        onClick={() => document.getElementById('logo-upload')?.click()}
                        disabled={isUploading || isViewOnly}
                      >
                        {isUploading ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4 mr-2" />
                            {businessLogo ? "Change Logo" : "Upload Logo"}
                          </>
                        )}
                      </Button>
                      {businessLogo && (
                        <Button
                          variant="ghost"
                          className="ml-2 text-gray-500"
                          onClick={handleRemoveLogo}
                        >
                          Remove
                        </Button>
                      )}
                      <input
                        id="logo-upload"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleLogoUpload}
                      />
                    </div>
                    <p className="text-xs text-gray-500">
                      Recommended: PNG or SVG with transparent background. Max 600px width.
                    </p>
                    {businessLogo && (
                      <div className="flex items-center gap-2 text-xs text-green-600">
                        <Check className="h-3 w-3" />
                        Synced to PDF, eSignature, and Profile
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Brand Colors Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Brand Colors</CardTitle>
                <CardDescription>
                  Colors used across your PDFs and eSignature documents
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Extracted Colors from Logo */}
                {brandColors.length > 0 && (
                  <div>
                    <Label className="text-sm text-gray-600 mb-2 block">Extracted from logo</Label>
                    <div className="flex gap-2">
                      {brandColors.map((color, idx) => (
                        <button
                          key={idx}
                          onClick={() => handlePrimaryColorChange(color)}
                          className={`w-10 h-10 rounded-lg border-2 transition-all ${
                            primaryColor === color ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200 hover:border-gray-300'
                          }`}
                          style={{ backgroundColor: color }}
                          title={color}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Primary Color Picker */}
                <div>
                  <Label className="text-sm text-gray-600 mb-2 block">Primary brand color</Label>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-lg border-2 border-gray-200"
                      style={{ backgroundColor: primaryColor }}
                    />
                    <Input
                      type="text"
                      value={primaryColor}
                      onChange={(e) => {
                        if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
                          handlePrimaryColorChange(e.target.value);
                        }
                      }}
                      className="w-28 font-mono text-sm"
                      placeholder="#3b82f6"
                    />
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => handlePrimaryColorChange(e.target.value)}
                      className="w-10 h-10 cursor-pointer rounded border-0"
                    />
                  </div>
                </div>

                {/* Preset Colors */}
                <div>
                  <Label className="text-sm text-gray-600 mb-2 block">Preset colors</Label>
                  <div className="flex gap-2 flex-wrap">
                    {['#3b82f6', '#10b981', '#8b5cf6', '#ef4444', '#f59e0b', '#6366f1', '#ec4899', '#14b8a6', '#1e3a5f', '#374151'].map((color) => (
                      <button
                        key={color}
                        onClick={() => handlePrimaryColorChange(color)}
                        className={`w-8 h-8 rounded-lg border-2 transition-all ${
                          primaryColor === color ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200 hover:border-gray-300'
                        }`}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-green-600 pt-2">
                  <Check className="h-3 w-3" />
                  Color synced to PDF and eSignature settings
                </div>
              </CardContent>
            </Card>

            {/* Where Branding Appears */}
            <Card className="bg-gray-50 border-gray-200">
              <CardContent className="pt-5">
                <p className="text-sm font-medium text-gray-700 mb-3">Your branding appears in:</p>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    PDF exports (watermark, footer, or accent styles)
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    eSignature request emails
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    Document signing pages
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    Online CIM viewer
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="pdf">
          <UnifiedPdfTemplateSelector />
        </TabsContent>

        <TabsContent value="online">
          <DocumentDefaultsSettings user={user} />
        </TabsContent>
      </Tabs>
    </SettingsLayout>
  );
}
