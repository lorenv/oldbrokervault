import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { User, Phone, Building, Upload, Camera, Lock, Globe, Settings } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { processLogoForDarkBackground } from "@/lib/image-utils";

const profileSchema = z.object({
  email: z.string().email("Invalid email address"),
  currentPassword: z.string().min(1, "Current password is required to save changes"),
  newPassword: z.string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be less than 128 characters")
    .regex(/(?=.*[a-z])/, "Password must contain at least one lowercase letter")
    .regex(/(?=.*[A-Z])/, "Password must contain at least one uppercase letter")
    .regex(/(?=.*\d)/, "Password must contain at least one number")
    .regex(/(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\?])/, "Password must contain at least one special character")
    .optional()
    .or(z.literal("")),
  confirmPassword: z.string().optional().or(z.literal("")),
}).refine((data) => {
  if (data.newPassword && data.newPassword.length > 0 && data.newPassword !== data.confirmPassword) {
    return false;
  }
  return true;
}, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export default function AccountSettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);

  const [profileForm, setProfileForm] = useState({
    name: "",
    title: "",
    phoneNumber: "",
    businessName: "",
    businessLogo: "",
    profilePhoto: "",
    customSubdomain: "",
  });

  // Fetch profile data
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["/api/profile"],
  });

  // Update form when profile data loads
  useEffect(() => {
    if (profile) {
      setProfileForm({
        name: (profile as any).name || "",
        title: (profile as any).title || "",
        phoneNumber: (profile as any).phoneNumber || "",
        businessName: (profile as any).businessName || "",
        businessLogo: (profile as any).businessLogo || "",
        profilePhoto: (profile as any).profilePhoto || "",
        customSubdomain: (profile as any).customSubdomain || "",
      });
    }
  }, [profile]);

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (profileData: typeof profileForm) => {
      const response = await apiRequest("PUT", "/api/profile", { body: profileData });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Profile Updated",
        description: "Your profile information has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleInputChange = (field: keyof typeof profileForm, value: string) => {
    setProfileForm(prev => ({ ...prev, [field]: value }));
  };

  const compressImage = (file: File, maxWidth: number = 800, quality: number = 0.7): Promise<string> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        let { width, height } = img;
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const hasTransparency = file.type === 'image/png' || file.type === 'image/gif';

        if (!hasTransparency) {
          ctx!.fillStyle = 'white';
          ctx!.fillRect(0, 0, width, height);
        }

        ctx?.drawImage(img, 0, 0, width, height);

        const outputFormat = hasTransparency ? 'image/png' : 'image/jpeg';
        const compressedDataUrl = canvas.toDataURL(outputFormat, quality);
        resolve(compressedDataUrl);
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, field: 'businessLogo' | 'profilePhoto') => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File Type",
        description: "Please choose an image file (PNG, JPG, or GIF).",
        variant: "destructive",
      });
      return;
    }

    try {
      let finalDataUrl = await compressImage(file, 800, 0.8);

      if (finalDataUrl.length > 2 * 1024 * 1024) {
        const moreCompressed = await compressImage(file, 600, 0.6);
        if (moreCompressed.length > 2 * 1024 * 1024) {
          toast({
            title: "Image Too Large",
            description: "Please choose a smaller image or reduce the image quality.",
            variant: "destructive",
          });
          return;
        }
        finalDataUrl = moreCompressed;
      }

      // For business logos, try to remove white background for better dark sidebar display
      if (field === 'businessLogo') {
        try {
          const { processedUrl, wasProcessed } = await processLogoForDarkBackground(finalDataUrl);
          finalDataUrl = processedUrl;
          if (wasProcessed) {
            toast({
              title: "Background Removed",
              description: "White background was automatically removed for better display.",
            });
          }
        } catch (e) {
          // If processing fails, continue with original image
          console.log('Logo background processing skipped:', e);
        }
      }

      const updatedForm = { ...profileForm, [field]: finalDataUrl };
      setProfileForm(updatedForm);

      toast({
        title: "Uploading...",
        description: "Saving your image...",
      });

      try {
        const response = await apiRequest("PUT", "/api/profile", { body: updatedForm });
        const data = await response.json();

        setProfileForm(prev => ({
          ...prev,
          [field]: data[field] || prev[field]
        }));

        queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
        queryClient.invalidateQueries({ queryKey: ["/api/user"] });
        if (field === 'businessLogo') {
          queryClient.invalidateQueries({ queryKey: ["/api/esign/branding"] });
        }

        toast({
          title: "Image Saved",
          description: field === 'businessLogo'
            ? "Your logo has been uploaded and brand colors extracted."
            : "Your profile photo has been saved.",
        });
      } catch (saveError) {
        toast({
          title: "Save Failed",
          description: "Image was processed but failed to save. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: "Failed to process the image. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleProfileSave = async () => {
    await updateProfileMutation.mutateAsync(profileForm);
  };

  const form = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      email: "",
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  // Update form when user data loads
  useEffect(() => {
    if (user?.email) {
      form.setValue("email", user.email);
    }
  }, [user, form]);

  const onSubmit = async (values: z.infer<typeof profileSchema>) => {
    setIsUpdating(true);
    try {
      const res = await apiRequest("POST", "/api/user/update", { body: values });
      if (!res.ok) throw new Error("Failed to update profile");

      toast({
        title: "Profile Updated",
        description: "Your profile has been updated successfully",
      });

      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });

      form.reset({
        email: values.email,
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Account Settings"
        description="Manage your profile information and security settings"
        icon={<Settings className="h-5 w-5" />}
      />

      <div className="space-y-6 max-w-4xl">
        {/* Personal Information */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="h-5 w-5" />
                Personal Information
              </CardTitle>
              <CardDescription>
                Contact details for your CIM documents
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={profileForm.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  placeholder="Enter your full name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">Title/Position</Label>
                <Input
                  id="title"
                  value={profileForm.title}
                  onChange={(e) => handleInputChange("title", e.target.value)}
                  placeholder="e.g., Business Broker, Owner"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phoneNumber" className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-gray-400" />
                  Phone Number
                </Label>
                <Input
                  id="phoneNumber"
                  value={profileForm.phoneNumber}
                  onChange={(e) => handleInputChange("phoneNumber", e.target.value)}
                  placeholder="Enter your phone number"
                />
              </div>
            </CardContent>
          </Card>

          {/* Profile Photo */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Camera className="h-5 w-5" />
                Profile Photo
              </CardTitle>
              <CardDescription>
                Appears on share links and PDF exports
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border-2 border-dashed border-gray-200 rounded-lg p-5 text-center">
                {profileForm.profilePhoto ? (
                  <div className="space-y-4">
                    <img
                      src={profileForm.profilePhoto}
                      alt="Profile Photo"
                      className="w-24 h-24 mx-auto rounded-full object-cover border-2 border-gray-200"
                    />
                    <div className="flex gap-2 justify-center">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => document.getElementById('profilePhoto')?.click()}
                      >
                        Change Photo
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleInputChange("profilePhoto", "")}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="py-6">
                    <Camera className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                    <p className="text-sm text-gray-500 mb-4">
                      Upload your profile photo
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById('profilePhoto')?.click()}
                    >
                      Choose File
                    </Button>
                  </div>
                )}
                <input
                  id="profilePhoto"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFileUpload(e, "profilePhoto")}
                />
                <p className="text-xs text-gray-400 mt-3">
                  PNG, JPG, or GIF up to 5MB
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Business Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building className="h-5 w-5" />
              Business Information
            </CardTitle>
            <CardDescription>
              Company details for professional CIM branding
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="businessName">Business Name</Label>
                <Input
                  id="businessName"
                  value={profileForm.businessName}
                  onChange={(e) => handleInputChange("businessName", e.target.value)}
                  placeholder="Enter your business name"
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Business Logo
                </Label>
                <div className="border-2 border-dashed border-muted rounded-lg p-4 text-center">
                  {profileForm.businessLogo ? (
                    <div className="space-y-3">
                      <img
                        src={profileForm.businessLogo}
                        alt="Business Logo"
                        className="max-h-16 mx-auto object-contain"
                      />
                      <div className="flex gap-2 justify-center">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => document.getElementById('businessLogo')?.click()}
                        >
                          Change Logo
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleInputChange("businessLogo", "")}
                        >
                          Remove
                        </Button>
                      </div>
                      {(profile as any)?.brandColors && (profile as any).brandColors.length > 0 && (
                        <div className="pt-3 border-t border-gray-100 mt-3">
                          <p className="text-xs font-medium text-gray-600 mb-2">Extracted Brand Colors</p>
                          <div className="flex gap-2 justify-center flex-wrap">
                            {((profile as any).brandColors as string[]).map((color, idx) => (
                              <div key={idx} className="flex flex-col items-center gap-1">
                                <div
                                  className="w-6 h-6 rounded-full border border-gray-200 shadow-sm"
                                  style={{ backgroundColor: color }}
                                  title={color}
                                />
                                <span className="text-[10px] text-gray-400 font-mono">{color}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="py-6">
                      <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground mb-2">
                        Upload your business logo
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => document.getElementById('businessLogo')?.click()}
                      >
                        Choose File
                      </Button>
                    </div>
                  )}
                  <input
                    id="businessLogo"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, "businessLogo")}
                  />
                </div>
              </div>
            </div>

            {/* Custom Subdomain */}
            <div className="space-y-2 pt-4 border-t border-gray-100">
              <Label htmlFor="customSubdomain" className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Custom Share Link Subdomain
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="customSubdomain"
                  value={profileForm.customSubdomain}
                  onChange={(e) => {
                    const sanitized = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
                    handleInputChange("customSubdomain", sanitized);
                  }}
                  placeholder="your-company"
                  className="flex-1"
                  maxLength={32}
                />
                <span className="text-sm text-muted-foreground whitespace-nowrap">.cimshare.com</span>
                {profileForm.customSubdomain && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleInputChange("customSubdomain", "")}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 px-2"
                  >
                    Clear
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {profileForm.customSubdomain ? (
                  <>Your share links will be: <span className="font-medium text-blue-600">{profileForm.customSubdomain}.cimshare.com/share/...</span></>
                ) : (
                  <>Choose a subdomain for branded share links (lowercase letters, numbers, and hyphens only)</>
                )}
              </p>
            </div>

            <div className="border-t border-gray-100 pt-5">
              <Button
                onClick={handleProfileSave}
                disabled={updateProfileMutation.isPending}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                {updateProfileMutation.isPending ? "Saving..." : "Save Profile Information"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Login Credentials / Security */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Lock className="h-5 w-5" />
              Login Credentials
            </CardTitle>
            <CardDescription>
              Manage your email address and password
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" placeholder="Enter your email address" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>New Password (Optional)</FormLabel>
                        <FormControl>
                          <Input {...field} type="password" placeholder="Leave blank to keep current" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm New Password</FormLabel>
                        <FormControl>
                          <Input {...field} type="password" placeholder="Confirm new password" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Password</FormLabel>
                      <FormControl>
                        <Input {...field} type="password" placeholder="Required to save any changes" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  disabled={isUpdating}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isUpdating ? "Updating..." : "Update Login Credentials"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

