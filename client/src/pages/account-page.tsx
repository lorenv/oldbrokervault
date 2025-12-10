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
import { useLocation } from "wouter";
import { SubscriptionCard } from "@/components/ui/subscription-card";
import { SecurityDashboard } from "@/components/security-dashboard";
import { UserManagement } from "@/components/user-management";
import { User, Phone, Building, Upload, Camera, Shield, Lock, CreditCard, Settings, FileImage, FileText, Globe } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UnifiedPdfTemplateSelector } from "@/components/unified-pdf-template-selector";

// Define authorized admin emails
const AUTHORIZED_ADMIN_EMAILS = [
  'robertkale20@gmail.com',
  'robertkale20+cimshare@gmail.com',
  'lorenvandegrift@gmail.com'
];

function isAuthorizedAdmin(user: any): boolean {
  if (!user) return false;
  return AUTHORIZED_ADMIN_EMAILS.includes(user.email);
}

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
  // If new password is provided and not empty, confirm password must match
  if (data.newPassword && data.newPassword.length > 0 && data.newPassword !== data.confirmPassword) {
    return false;
  }
  return true;
}, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});


export default function AccountPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);
  const [, navigate] = useLocation();

  // Get tab from URL query parameter with fallback logic
  const getTabFromUrl = () => {
    const searchParams = new URLSearchParams(window.location.search);
    const tabFromUrl = searchParams.get('tab');
    const sessionId = searchParams.get('session_id');
    
    // If there's a session_id and no tab, default to billing
    // If there's already a tab parameter, use it
    // Otherwise default to account tab
    return tabFromUrl || (sessionId ? 'billing' : 'account');
  };
  
  const [activeTab, setActiveTab] = useState(getTabFromUrl());

  // Listen for URL changes to update active tab (browser back/forward only)
  useEffect(() => {
    const handlePopState = () => {
      const searchParams = new URLSearchParams(window.location.search);
      const newTab = searchParams.get('tab') || 'account';
      setActiveTab(newTab);
    };

    // Listen for browser back/forward navigation
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []); // Empty dependency array - only set up once
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
      // Also invalidate user query so useAuth() gets the updated customSubdomain
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
        // Calculate new dimensions
        let { width, height } = img;
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        // Check if image has transparency by examining the original file type
        const hasTransparency = file.type === 'image/png' || file.type === 'image/gif';

        if (!hasTransparency) {
          // For non-transparent images, fill with white background
          ctx!.fillStyle = 'white';
          ctx!.fillRect(0, 0, width, height);
        }

        // Draw the image
        ctx?.drawImage(img, 0, 0, width, height);

        // Use PNG for transparent images, JPEG for others
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

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File Type",
        description: "Please choose an image file (PNG, JPG, or GIF).",
        variant: "destructive",
      });
      return;
    }

    try {
      // Compress image before uploading
      let finalDataUrl = await compressImage(file, 800, 0.8);

      // Check compressed size (should be under 2MB base64)
      if (finalDataUrl.length > 2 * 1024 * 1024) {
        // Try with higher compression
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

      // Update local state
      const updatedForm = { ...profileForm, [field]: finalDataUrl };
      setProfileForm(updatedForm);

      // Auto-save immediately to persist the image and extract brand colors
      toast({
        title: "Uploading...",
        description: "Saving your image...",
      });

      try {
        const response = await apiRequest("PUT", "/api/profile", { body: updatedForm });
        const data = await response.json();

        // Update local state with server response (includes file path and extracted colors)
        setProfileForm(prev => ({
          ...prev,
          [field]: data[field] || prev[field]
        }));

        // Invalidate queries to refresh data
        queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
        queryClient.invalidateQueries({ queryKey: ["/api/user"] });
        // Also invalidate e-sign branding since logo is synced there too
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

  const handleSubscriptionAction = async () => {
    try {
      if (user?.subscriptionStatus === "free") {
        // Free tier users go to pricing page
        navigate("/pricing");
      } else {
        // Paid tier users get access to Stripe Customer Portal
        const response = await apiRequest("POST", "/api/subscription/create-portal-session");
        const { url } = await response.json();
        if (url) {
          window.location.href = url;
        } else {
          throw new Error("Failed to get portal URL");
        }
      }
    } catch (error) {
      // Log error for debugging in development only
      if (process.env.NODE_ENV === 'development') {
      }
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to process request. Please try again.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    // Check for Stripe session verification
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    const tabParam = params.get('tab');

    
    // Set the tab from URL if it exists
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
    
    if (sessionId) {
      verifyStripeSession(sessionId);
    }
  }, []);

  const verifyStripeSession = async (sessionId: string) => {
    try {
      const response = await apiRequest("GET", `/api/subscription/verify-session?session_id=${sessionId}`);
      const data = await response.json();

      if (data.success) {
        
        // Force refetch the user query to refresh the subscription status
        await queryClient.invalidateQueries({ queryKey: ["/api/user"] });
        
        // Add a small delay to ensure session update has propagated
        await new Promise(resolve => setTimeout(resolve, 500));
        await queryClient.refetchQueries({ queryKey: ["/api/user"] });
        
        // Force a complete cache reset for the user data
        queryClient.removeQueries({ queryKey: ["/api/user"] });
        await queryClient.refetchQueries({ queryKey: ["/api/user"] });

        toast({
          title: "Subscription Updated",
          description: `Your subscription has been upgraded to ${data.status}`,
        });
        
        // Update URL to show billing tab and remove session_id
        window.history.replaceState({}, '', '/account?tab=billing');
        
        // Update the active tab state to match the URL change
        setActiveTab('billing');
        
      } else {
        throw new Error(data.error || "Failed to verify subscription");
      }
    } catch (error) {
      
      // Show more detailed error information
      if (error instanceof Error) {
      }
      
      toast({
        title: "Subscription Verification Failed",
        description: `Error: ${error instanceof Error ? error.message : 'Unknown error'}. Please check console for details.`,
        variant: "destructive",
      });
    }
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

      // Invalidate user and profile queries to refresh the data
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
    <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8 max-w-4xl">
      {/* Enhanced Page Header */}
      <div className="mb-6 sm:mb-8">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
            Account Settings
          </h1>
        </div>
        <p className="text-sm sm:text-base text-gray-600">Manage your account, security, and preferences</p>
        
      </div>

      <Tabs value={activeTab} onValueChange={(tab) => {
        setActiveTab(tab);
        // Update URL to reflect the tab change
        window.history.pushState({}, '', `/account?tab=${tab}`);
      }} className="space-y-6 sm:space-y-8">
        {/* Modern pill-style tabs */}
        <div className="w-full overflow-x-auto pb-1">
          <TabsList className={`inline-flex w-max min-w-full md:w-full h-auto p-1.5 bg-gray-100/80 rounded-xl gap-1 ${isAuthorizedAdmin(user) ? 'md:grid md:grid-cols-4' : 'md:grid md:grid-cols-3'}`}>
          <TabsTrigger
            value="account"
            className="flex items-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-medium whitespace-nowrap rounded-lg transition-all duration-200 data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm data-[state=inactive]:text-gray-600 data-[state=inactive]:hover:text-gray-900 data-[state=inactive]:hover:bg-white/50"
          >
            <Lock className="h-4 w-4" />
            <span className="hidden sm:inline">Account & Security</span>
            <span className="sm:hidden">Account</span>
          </TabsTrigger>
          <TabsTrigger
            value="profile"
            className="flex items-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-medium whitespace-nowrap rounded-lg transition-all duration-200 data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm data-[state=inactive]:text-gray-600 data-[state=inactive]:hover:text-gray-900 data-[state=inactive]:hover:bg-white/50"
          >
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Profile & Branding</span>
            <span className="sm:hidden">Profile</span>
          </TabsTrigger>
          <TabsTrigger
            value="billing"
            className="flex items-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-medium whitespace-nowrap rounded-lg transition-all duration-200 data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm data-[state=inactive]:text-gray-600 data-[state=inactive]:hover:text-gray-900 data-[state=inactive]:hover:bg-white/50"
          >
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">Subscription</span>
            <span className="sm:hidden">Billing</span>
          </TabsTrigger>
          {isAuthorizedAdmin(user) && (
            <TabsTrigger
              value="admin"
              className="flex items-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-medium whitespace-nowrap rounded-lg transition-all duration-200 data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm data-[state=inactive]:text-gray-600 data-[state=inactive]:hover:text-gray-900 data-[state=inactive]:hover:bg-white/50"
            >
              <Shield className="h-4 w-4" />
              Admin
            </TabsTrigger>
          )}
          </TabsList>
        </div>

        {/* Account & Security Tab */}
        <TabsContent value="account" className="space-y-4 sm:space-y-6">
          <Card className="border-0 shadow-xl bg-white/95 backdrop-blur-sm rounded-xl sm:rounded-2xl overflow-hidden ring-1 ring-gray-200/50">
            <CardHeader className="bg-gradient-to-r from-slate-600 to-slate-700 pb-3 sm:pb-4 pt-4 sm:pt-6 px-4 sm:px-6 shadow-lg">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-white/20 backdrop-blur-sm rounded-lg shadow-sm">
                  <Lock className="h-4 w-4 text-white" />
                </div>
                <div>
                  <CardTitle className="text-lg font-semibold text-white">Login Credentials</CardTitle>
                  <CardDescription className="text-slate-100 mt-0.5 text-sm">
                    Manage your email address and authentication settings
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 sm:pt-8 px-4 sm:px-6">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
                    className="w-full bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white border-0 shadow-lg"
                  >
                    {isUpdating ? "Updating..." : "Save Changes"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Profile & Branding Tab */}
        <TabsContent value="profile" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Personal Information */}
            <Card className="lg:col-span-1 border-0 shadow-md bg-white rounded-xl overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-slate-600 to-slate-700 pb-4 pt-5 px-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <User className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold text-white">Personal Information</CardTitle>
                    <CardDescription className="text-slate-200 mt-0.5 text-sm">
                      Contact details for your CIM documents
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-5 px-5 pb-5">
                <div className="space-y-4">
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
                </div>
              </CardContent>
            </Card>

            {/* Profile Photo */}
            <Card className="lg:col-span-1 border-0 shadow-md bg-white rounded-xl overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-slate-600 to-slate-700 pb-4 pt-5 px-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Camera className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold text-white">Profile Photo</CardTitle>
                    <CardDescription className="text-slate-200 mt-0.5 text-sm">
                      Appears on share links and PDF exports
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-5 px-5 pb-5">
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
          <Card className="border-0 shadow-md bg-white rounded-xl overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-slate-600 to-slate-700 pb-4 pt-5 px-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Building className="h-4 w-4 text-white" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold text-white">Business Information</CardTitle>
                  <CardDescription className="text-slate-200 mt-0.5 text-sm">
                    Company details for professional CIM branding
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 pt-5 px-5 pb-5">
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
                        {/* Brand Colors Extracted from Logo */}
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
                            <p className="text-[10px] text-gray-400 mt-2">
                              Used for branded PDF templates & e-signatures
                            </p>
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
                    <p className="text-xs text-muted-foreground mt-2">
                      PNG, JPG, or GIF up to 5MB
                    </p>
                  </div>
                </div>
              </div>

              {/* Custom Subdomain Section */}
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
                      // Only allow lowercase letters, numbers, and hyphens
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

          {/* PDF Templates (Branded + Background combined) */}
          <UnifiedPdfTemplateSelector />

        </TabsContent>

        {/* Subscription & Billing Tab */}
        <TabsContent value="billing" className="space-y-6">
          <SubscriptionCard
            status={user?.subscriptionStatus}
            endsAt={user?.subscriptionEndsAt ? new Date(user.subscriptionEndsAt).toISOString() : null}
            monthlyUsage={user?.monthlyUsage}
            monthlyDocumentsCreated={user?.monthlyDocumentsCreated}
            monthlyRegenerationsUsed={user?.monthlyRegenerationsUsed}
          />
        </TabsContent>

        {/* Admin Tools Tab */}
        {isAuthorizedAdmin(user) && (
          <TabsContent value="admin" className="space-y-6">
            <UserManagement />
            <SecurityDashboard />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}