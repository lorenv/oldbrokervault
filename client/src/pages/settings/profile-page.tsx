import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  User,
  Phone,
  Building,
  Upload,
  Camera,
  Lock,
  Globe,
  Clock,
  Check,
} from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { SettingsLayout } from "@/components/layout/settings-layout";
import { processLogoForDarkBackground } from "@/lib/image-utils";

// Common timezone options
const TIMEZONE_OPTIONS = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HT)" },
  { value: "America/Phoenix", label: "Arizona (MST)" },
  { value: "America/Toronto", label: "Toronto (ET)" },
  { value: "America/Vancouver", label: "Vancouver (PT)" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "Europe/Paris", label: "Paris (CET/CEST)" },
  { value: "Europe/Berlin", label: "Berlin (CET/CEST)" },
  { value: "Europe/Amsterdam", label: "Amsterdam (CET/CEST)" },
  { value: "Europe/Zurich", label: "Zurich (CET/CEST)" },
  { value: "Asia/Dubai", label: "Dubai (GST)" },
  { value: "Asia/Singapore", label: "Singapore (SGT)" },
  { value: "Asia/Hong_Kong", label: "Hong Kong (HKT)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "Asia/Shanghai", label: "Shanghai (CST)" },
  { value: "Australia/Sydney", label: "Sydney (AEST/AEDT)" },
  { value: "Australia/Melbourne", label: "Melbourne (AEST/AEDT)" },
  { value: "Australia/Perth", label: "Perth (AWST)" },
  { value: "Pacific/Auckland", label: "Auckland (NZST/NZDT)" },
  { value: "UTC", label: "UTC (Coordinated Universal Time)" },
];

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

export default function ProfilePage() {
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
    timezone: "America/New_York",
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
        timezone: (profile as any).timezone || "America/New_York",
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
      toast({ title: "Profile Updated", description: "Your profile information has been updated successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    },
    onError: (error: Error) => {
      toast({ title: "Update Failed", description: error.message, variant: "destructive" });
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
        resolve(canvas.toDataURL(outputFormat, quality));
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, field: 'businessLogo' | 'profilePhoto') => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: "Invalid File Type", description: "Please choose an image file.", variant: "destructive" });
      return;
    }
    try {
      let finalDataUrl = await compressImage(file, 800, 0.8);
      if (finalDataUrl.length > 2 * 1024 * 1024) {
        finalDataUrl = await compressImage(file, 600, 0.6);
      }
      if (field === 'businessLogo') {
        try {
          const { processedUrl } = await processLogoForDarkBackground(finalDataUrl);
          finalDataUrl = processedUrl;
        } catch (e) {}
      }
      const updatedForm = { ...profileForm, [field]: finalDataUrl };
      setProfileForm(updatedForm);
      await apiRequest("PUT", "/api/profile", { body: updatedForm });
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      // Also invalidate eSignature branding when logo changes (server syncs automatically)
      if (field === 'businessLogo') {
        queryClient.invalidateQueries({ queryKey: ["/api/esign/branding"] });
      }
      toast({ title: "Image Saved", description: field === 'businessLogo' ? "Your logo has been uploaded and synced across settings." : "Your profile photo has been saved." });
    } catch (error) {
      toast({ title: "Upload Failed", description: "Failed to process the image.", variant: "destructive" });
    }
  };

  const handleProfileSave = async () => {
    await updateProfileMutation.mutateAsync(profileForm);
  };

  const form = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: { email: "", currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  useEffect(() => {
    if (user?.email) form.setValue("email", user.email);
  }, [user, form]);

  const onSubmit = async (values: z.infer<typeof profileSchema>) => {
    setIsUpdating(true);
    try {
      const res = await apiRequest("POST", "/api/user/update", { body: values });
      if (!res.ok) throw new Error("Failed to update profile");
      toast({ title: "Profile Updated", description: "Your profile has been updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      form.reset({ email: values.email, currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to update", variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <SettingsLayout
      title="Profile"
      description="Manage your personal information and account settings"
    >
      <div className="space-y-6 max-w-4xl">
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg text-gray-900"><User className="h-5 w-5" />Personal Information</CardTitle>
              <CardDescription className="text-gray-600">Contact details for your CIM documents</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-gray-900">Full Name</Label>
                <Input id="name" value={profileForm.name} onChange={(e) => handleInputChange("name", e.target.value)} placeholder="Enter your full name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="title" className="text-gray-900">Title/Position</Label>
                <Input id="title" value={profileForm.title} onChange={(e) => handleInputChange("title", e.target.value)} placeholder="e.g., Business Broker" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phoneNumber" className="flex items-center gap-2 text-gray-900"><Phone className="h-4 w-4 text-gray-500" />Phone Number</Label>
                <Input id="phoneNumber" value={profileForm.phoneNumber} onChange={(e) => handleInputChange("phoneNumber", e.target.value)} placeholder="Enter your phone number" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="timezone" className="flex items-center gap-2 text-gray-900"><Clock className="h-4 w-4 text-gray-500" />Timezone</Label>
                <Select
                  value={profileForm.timezone}
                  onValueChange={(value) => handleInputChange("timezone", value)}
                >
                  <SelectTrigger id="timezone">
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONE_OPTIONS.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>
                        {tz.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-600">Used for task reminders and activity timestamps</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg text-gray-900"><Camera className="h-5 w-5" />Profile Photo</CardTitle>
              <CardDescription className="text-gray-600">Appears on share links and PDF exports</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border-2 border-dashed border-gray-200 rounded-lg p-5 text-center">
                {profileForm.profilePhoto ? (
                  <div className="space-y-4">
                    <img src={profileForm.profilePhoto} alt="Profile" className="w-24 h-24 mx-auto rounded-full object-cover border-2 border-gray-200" />
                    <div className="flex gap-2 justify-center">
                      <Button variant="outline" size="sm" onClick={() => document.getElementById('profilePhoto')?.click()}>Change</Button>
                      <Button variant="outline" size="sm" onClick={() => handleInputChange("profilePhoto", "")}>Remove</Button>
                    </div>
                  </div>
                ) : (
                  <div className="py-6">
                    <Camera className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                    <Button variant="outline" size="sm" onClick={() => document.getElementById('profilePhoto')?.click()}>Upload Photo</Button>
                  </div>
                )}
                <input id="profilePhoto" type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, "profilePhoto")} />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-gray-900"><Building className="h-5 w-5" />Business Information</CardTitle>
            <CardDescription className="text-gray-600">Company details for professional CIM branding</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="businessName" className="text-gray-900">Business Name</Label>
                <Input id="businessName" value={profileForm.businessName} onChange={(e) => handleInputChange("businessName", e.target.value)} placeholder="Enter your business name" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-gray-900"><Upload className="h-4 w-4" />Business Logo</Label>
                <div className="border-2 border-dashed border-muted rounded-lg p-4 text-center">
                  {profileForm.businessLogo ? (
                    <div className="space-y-3">
                      <img src={profileForm.businessLogo} alt="Logo" className="max-h-16 mx-auto object-contain" />
                      <div className="flex gap-2 justify-center">
                        <Button variant="outline" size="sm" onClick={() => document.getElementById('businessLogo')?.click()}>Change</Button>
                        <Button variant="outline" size="sm" onClick={async () => {
                          const updatedForm = { ...profileForm, businessLogo: "" };
                          setProfileForm(updatedForm);
                          await apiRequest("PUT", "/api/profile", { body: updatedForm });
                          // Also sync removal to eSignature branding
                          await apiRequest("PUT", "/api/esign/branding", { body: { logoUrl: null } });
                          queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
                          queryClient.invalidateQueries({ queryKey: ["/api/user"] });
                          queryClient.invalidateQueries({ queryKey: ["/api/esign/branding"] });
                          toast({ title: "Logo Removed", description: "Logo removed from all settings." });
                        }}>Remove</Button>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-green-600 justify-center">
                        <Check className="h-3 w-3" />
                        Synced to PDF, eSignature, and Branding
                      </div>
                    </div>
                  ) : (
                    <div className="py-4">
                      <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <Button variant="outline" size="sm" onClick={() => document.getElementById('businessLogo')?.click()}>Upload Logo</Button>
                    </div>
                  )}
                  <input id="businessLogo" type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, "businessLogo")} />
                </div>
              </div>
            </div>
            <div className="space-y-2 pt-4 border-t">
              <Label htmlFor="customSubdomain" className="flex items-center gap-2 text-gray-900"><Globe className="h-4 w-4" />Custom Share Link Subdomain</Label>
              <div className="flex items-center gap-2">
                <Input id="customSubdomain" value={profileForm.customSubdomain} onChange={(e) => handleInputChange("customSubdomain", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} placeholder="your-company" className="flex-1" maxLength={32} />
                <span className="text-sm text-gray-600">.cimshare.com</span>
              </div>
            </div>
            <Button onClick={handleProfileSave} disabled={updateProfileMutation.isPending} className="w-full">
              {updateProfileMutation.isPending ? "Saving..." : "Save Profile"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-gray-900"><Lock className="h-5 w-5" />Login Credentials</CardTitle>
            <CardDescription className="text-gray-600">Manage your email and password</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem><FormLabel className="text-gray-900">Email Address</FormLabel><FormControl><Input {...field} type="email" /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="newPassword" render={({ field }) => (
                    <FormItem><FormLabel className="text-gray-900">New Password (Optional)</FormLabel><FormControl><Input {...field} type="password" placeholder="Leave blank to keep current" /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="confirmPassword" render={({ field }) => (
                    <FormItem><FormLabel className="text-gray-900">Confirm Password</FormLabel><FormControl><Input {...field} type="password" /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="currentPassword" render={({ field }) => (
                  <FormItem><FormLabel className="text-gray-900">Current Password</FormLabel><FormControl><Input {...field} type="password" placeholder="Required to save changes" /></FormControl><FormMessage /></FormItem>
                )} />
                <Button type="submit" disabled={isUpdating} className="w-full">{isUpdating ? "Updating..." : "Update Credentials"}</Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </SettingsLayout>
  );
}
