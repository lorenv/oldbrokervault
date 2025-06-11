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
import { User, Phone, Building, Upload, Camera, Shield, Lock, CreditCard, Settings } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Define authorized admin emails
const AUTHORIZED_ADMIN_EMAILS = [
  'robertkale20@gmail.com',
  'robertkale20+cimshare@gmail.com'
];

function isAuthorizedAdmin(user: any): boolean {
  if (!user) return false;
  return AUTHORIZED_ADMIN_EMAILS.includes(user.email);
}

const profileSchema = z.object({
  email: z.string().email("Invalid email address"),
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be less than 128 characters")
    .regex(/(?=.*[a-z])/, "Password must contain at least one lowercase letter")
    .regex(/(?=.*[A-Z])/, "Password must contain at least one uppercase letter")
    .regex(/(?=.*\d)/, "Password must contain at least one number")
    .regex(/(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\?])/, "Password must contain at least one special character")
    .optional(),
  confirmPassword: z.string().optional(),
}).refine((data) => {
  if (data.newPassword && data.newPassword !== data.confirmPassword) {
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
  const [profileForm, setProfileForm] = useState({
    name: "",
    title: "",
    phoneNumber: "",
    businessName: "",
    businessLogo: "",
    profilePhoto: "",
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
      });
    }
  }, [profile]);

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (profileData: typeof profileForm) => {
      const response = await apiRequest("PUT", "/api/profile", profileData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Profile Updated",
        description: "Your profile information has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
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
        
        // Draw and compress
        ctx?.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
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
      const compressedDataUrl = await compressImage(file, 800, 0.8);
      
      // Check compressed size (should be under 2MB base64)
      if (compressedDataUrl.length > 2 * 1024 * 1024) {
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
        handleInputChange(field, moreCompressed);
      } else {
        handleInputChange(field, compressedDataUrl);
      }
      
      toast({
        title: "Image Processed",
        description: "Image has been compressed and optimized for upload.",
      });
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
        console.error("Subscription action error:", error);
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

    if (sessionId) {
      verifyStripeSession(sessionId);
    }
  }, []);

  const verifyStripeSession = async (sessionId: string) => {
    try {
      const response = await apiRequest("GET", `/api/subscription/verify-session?session_id=${sessionId}`);
      const data = await response.json();

      if (data.success) {
        // Invalidate the user query to refresh the subscription status
        queryClient.invalidateQueries({ queryKey: ["/api/user"] });

        toast({
          title: "Subscription Updated",
          description: `Your subscription has been upgraded to ${data.status}`,
        });
        // Remove session_id from URL
        window.history.replaceState({}, '', '/account');
      } else {
        throw new Error(data.error || "Failed to verify subscription");
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error("Stripe session verification error:", error);
      }
      toast({
        title: "Error",
        description: "Failed to verify subscription status. Please contact support if this persists.",
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
      const res = await apiRequest("POST", "/api/user/update", values);
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
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">Account Settings</h1>

      <Tabs defaultValue="account" className="space-y-6">
        <TabsList className={`grid w-full ${user?.isAdmin ? 'grid-cols-4' : 'grid-cols-3'}`}>
          <TabsTrigger value="account" className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Account & Security
          </TabsTrigger>
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Profile & Business
          </TabsTrigger>
          <TabsTrigger value="billing" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Subscription
          </TabsTrigger>
          {isAuthorizedAdmin(user) && (
            <TabsTrigger value="admin" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Admin Tools
            </TabsTrigger>
          )}
        </TabsList>

        {/* Account & Security Tab */}
        <TabsContent value="account" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Login Credentials
              </CardTitle>
              <CardDescription>
                Manage your email address and authentication settings
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
                          <Input {...field} type="email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

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

                  <Button type="submit" disabled={isUpdating} className="w-full">
                    {isUpdating ? "Updating..." : "Update Email"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>
                Update your password to keep your account secure
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="currentPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Current Password</FormLabel>
                        <FormControl>
                          <Input {...field} type="password" placeholder="Enter your current password" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>New Password</FormLabel>
                        <FormControl>
                          <Input {...field} type="password" placeholder="Must be at least 8 characters" />
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
                          <Input {...field} type="password" placeholder="Re-enter your new password" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" disabled={isUpdating} className="w-full">
                    {isUpdating ? "Updating..." : "Change Password"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Profile & Business Tab */}
        <TabsContent value="profile" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Personal Information */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Personal Information
                </CardTitle>
                <CardDescription>
                  Contact details that appear in your CIM documents
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
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
                      <Phone className="h-4 w-4" />
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
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Camera className="h-5 w-5" />
                  Profile Photo
                </CardTitle>
                <CardDescription>
                  Your photo appears on share links and PDF exports
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border-2 border-dashed border-muted rounded-lg p-6 text-center">
                  {profileForm.profilePhoto ? (
                    <div className="space-y-4">
                      <img 
                        src={profileForm.profilePhoto} 
                        alt="Profile Photo" 
                        className="w-24 h-24 mx-auto rounded-full object-cover border-2 border-border"
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
                    <div className="py-8">
                      <Camera className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-sm text-muted-foreground mb-4">
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
                  <p className="text-xs text-muted-foreground mt-3">
                    PNG, JPG, or GIF up to 5MB
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Business Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
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

              <div className="border-t pt-6">
                <Button 
                  onClick={handleProfileSave} 
                  disabled={updateProfileMutation.isPending}
                  className="w-full"
                >
                  {updateProfileMutation.isPending ? "Saving..." : "Save Profile Information"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Subscription & Billing Tab */}
        <TabsContent value="billing" className="space-y-6">
          <SubscriptionCard 
            status={user?.subscriptionStatus} 
            endsAt={user?.subscriptionEndsAt ? new Date(user.subscriptionEndsAt).toISOString() : null} 
            monthlyUsage={user?.monthlyUsage}
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