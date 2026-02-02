import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Settings,
  CreditCard,
  Mail,
  Check,
  X,
  ExternalLink,
  RefreshCw,
  Trash2,
  AlertCircle,
  Clock,
} from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { SettingsLayout } from "@/components/layout/settings-layout";
import { processLogoForDarkBackground } from "@/lib/image-utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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

interface EmailConnection {
  id: number;
  provider: 'gmail' | 'microsoft';
  providerAccountId: string;
  providerAccountName: string;
  status: 'active' | 'expired' | 'error' | 'disconnected';
  tokenExpiresAt: string | null;
  createdAt: string;
}

interface ProviderConfig {
  name: string;
  icon: string;
  description: string;
  configured: boolean;
}

export default function AccountSettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [isUpdating, setIsUpdating] = useState(false);
  const [disconnectingId, setDisconnectingId] = useState<number | null>(null);
  const [billingLoading, setBillingLoading] = useState(false);

  // Get active tab from URL hash
  const getInitialTab = () => {
    const hash = window.location.hash.replace('#', '');
    if (['profile', 'billing', 'email'].includes(hash)) return hash;
    return 'profile';
  };
  const [activeTab, setActiveTab] = useState(getInitialTab);

  // Handle Stripe session verification on billing tab
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    if (sessionId) {
      setActiveTab('billing');
      verifyStripeSession(sessionId);
    }
  }, []);

  const verifyStripeSession = async (sessionId: string) => {
    try {
      const response = await apiRequest("GET", `/api/subscription/verify-session?session_id=${sessionId}`);
      const data = await response.json();
      if (data.success) {
        await queryClient.invalidateQueries({ queryKey: ["/api/user"] });
        toast({ title: "Subscription Updated", description: `Your subscription has been upgraded to ${data.status}` });
        window.history.replaceState({}, '', '/settings/account#billing');
      }
    } catch (error) {
      toast({ title: "Subscription Verification Failed", description: "Please contact support.", variant: "destructive" });
    }
  };

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

  // Fetch email connections
  const { data: emailConnections = [] } = useQuery<EmailConnection[]>({
    queryKey: ["/api/integrations/email-connections"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/integrations/connections");
      const data = await res.json();
      return (data || []).filter((c: any) => c.provider === 'gmail' || c.provider === 'microsoft');
    },
  });

  // Fetch email providers
  const { data: emailProviders = [] } = useQuery<ProviderConfig[]>({
    queryKey: ["/api/integrations/email-providers"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/integrations/providers");
      const data = await res.json();
      return (data || []).filter((p: any) => p.id === 'gmail' || p.id === 'microsoft').map((p: any) => ({
        name: p.name,
        icon: p.icon,
        description: p.description,
        configured: p.status === 'available',
      }));
    },
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

  // Email connection mutations
  const connectEmailMutation = useMutation({
    mutationFn: async (provider: 'gmail' | 'microsoft') => {
      const res = await apiRequest("GET", `/api/integrations/auth/${provider}`);
      const data = await res.json();
      return data.authUrl;
    },
    onSuccess: (authUrl: string) => {
      window.location.href = authUrl;
    },
    onError: (error: any) => {
      toast({ title: "Connection failed", description: error.message || "Failed to start OAuth flow", variant: "destructive" });
    },
  });

  const disconnectEmailMutation = useMutation({
    mutationFn: async (connectionId: number) => {
      await apiRequest("DELETE", `/api/integrations/connections/${connectionId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/email-connections"] });
      toast({ title: "Email disconnected", description: "Your email account has been disconnected." });
      setDisconnectingId(null);
    },
    onError: (error: any) => {
      toast({ title: "Disconnect failed", description: error.message, variant: "destructive" });
    },
  });

  const testEmailMutation = useMutation({
    mutationFn: async (connectionId: number) => {
      const res = await apiRequest("POST", `/api/integrations/connections/${connectionId}/test`);
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data.success) {
        toast({ title: "Connection verified", description: data.message || "Email connection is working." });
      } else {
        toast({ title: "Connection issue", description: data.error, variant: "destructive" });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/email-connections"] });
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
      toast({ title: "Image Saved", description: field === 'businessLogo' ? "Your logo has been uploaded." : "Your profile photo has been saved." });
    } catch (error) {
      toast({ title: "Upload Failed", description: "Failed to process the image.", variant: "destructive" });
    }
  };

  const handleProfileSave = async () => {
    await updateProfileMutation.mutateAsync(profileForm);
  };

  const handleCustomerPortal = async () => {
    setBillingLoading(true);
    try {
      const response = await apiRequest("POST", "/api/subscription/create-portal-session");
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      toast({ title: "Unable to open billing portal", description: "Please try again.", variant: "destructive" });
    } finally {
      setBillingLoading(false);
    }
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

  // Get subscription info
  const isPaidPlan = user?.subscriptionStatus && ["starter", "starter_monthly", "pro", "pro_monthly", "standard", "premium", "enterprise", "admin"].includes(user.subscriptionStatus);
  const getStatusDisplay = () => {
    switch (user?.subscriptionStatus) {
      case 'admin': return { label: 'Admin', color: 'bg-purple-100 text-purple-700' };
      case 'enterprise': return { label: 'Enterprise', color: 'bg-indigo-100 text-indigo-700' };
      case 'pro': case 'pro_monthly': return { label: 'Pro', color: 'bg-blue-100 text-blue-700' };
      case 'standard': return { label: 'Standard', color: 'bg-green-100 text-green-700' };
      case 'starter': case 'starter_monthly': return { label: 'Starter', color: 'bg-teal-100 text-teal-700' };
      case 'canceled': return { label: 'Canceled', color: 'bg-red-100 text-red-700' };
      default: return { label: 'Free', color: 'bg-gray-100 text-gray-700' };
    }
  };
  const statusDisplay = getStatusDisplay();

  const getEmailStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return <Badge className="bg-green-100 text-green-700"><Check className="h-3 w-3 mr-1" />Connected</Badge>;
      case 'expired': return <Badge className="bg-amber-100 text-amber-700"><Clock className="h-3 w-3 mr-1" />Expired</Badge>;
      case 'error': return <Badge className="bg-red-100 text-red-700"><AlertCircle className="h-3 w-3 mr-1" />Error</Badge>;
      default: return <Badge className="bg-gray-100 text-gray-700"><X className="h-3 w-3 mr-1" />Disconnected</Badge>;
    }
  };

  const hasGmailConnection = emailConnections.some(c => c.provider === 'gmail');
  const hasMicrosoftConnection = emailConnections.some(c => c.provider === 'microsoft');
  const gmailConfigured = emailProviders.find(p => p.name === 'Gmail')?.configured;
  const microsoftConfigured = emailProviders.find(p => p.name === 'Microsoft 365')?.configured;

  return (
    <SettingsLayout
      title="Account Settings"
      description="Manage your profile, billing, and connected accounts"
    >
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); window.history.replaceState({}, '', `/settings/account#${v}`); }} className="max-w-4xl">
        <TabsList className="mb-6">
          <TabsTrigger value="profile" className="gap-2"><User className="h-4 w-4" />Profile</TabsTrigger>
          <TabsTrigger value="billing" className="gap-2"><CreditCard className="h-4 w-4" />Billing</TabsTrigger>
          <TabsTrigger value="email" className="gap-2"><Mail className="h-4 w-4" />Email Sync</TabsTrigger>
        </TabsList>

        {/* PROFILE TAB */}
        <TabsContent value="profile" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg"><User className="h-5 w-5" />Personal Information</CardTitle>
                <CardDescription>Contact details for your CIM documents</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input id="name" value={profileForm.name} onChange={(e) => handleInputChange("name", e.target.value)} placeholder="Enter your full name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="title">Title/Position</Label>
                  <Input id="title" value={profileForm.title} onChange={(e) => handleInputChange("title", e.target.value)} placeholder="e.g., Business Broker" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phoneNumber" className="flex items-center gap-2"><Phone className="h-4 w-4 text-gray-400" />Phone Number</Label>
                  <Input id="phoneNumber" value={profileForm.phoneNumber} onChange={(e) => handleInputChange("phoneNumber", e.target.value)} placeholder="Enter your phone number" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone" className="flex items-center gap-2"><Clock className="h-4 w-4 text-gray-400" />Timezone</Label>
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
                  <p className="text-xs text-muted-foreground">Used for task reminders and activity timestamps</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg"><Camera className="h-5 w-5" />Profile Photo</CardTitle>
                <CardDescription>Appears on share links and PDF exports</CardDescription>
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
              <CardTitle className="flex items-center gap-2 text-lg"><Building className="h-5 w-5" />Business Information</CardTitle>
              <CardDescription>Company details for professional CIM branding</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="businessName">Business Name</Label>
                  <Input id="businessName" value={profileForm.businessName} onChange={(e) => handleInputChange("businessName", e.target.value)} placeholder="Enter your business name" />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><Upload className="h-4 w-4" />Business Logo</Label>
                  <div className="border-2 border-dashed border-muted rounded-lg p-4 text-center">
                    {profileForm.businessLogo ? (
                      <div className="space-y-3">
                        <img src={profileForm.businessLogo} alt="Logo" className="max-h-16 mx-auto object-contain" />
                        <div className="flex gap-2 justify-center">
                          <Button variant="outline" size="sm" onClick={() => document.getElementById('businessLogo')?.click()}>Change</Button>
                          <Button variant="outline" size="sm" onClick={() => handleInputChange("businessLogo", "")}>Remove</Button>
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
                <Label htmlFor="customSubdomain" className="flex items-center gap-2"><Globe className="h-4 w-4" />Custom Share Link Subdomain</Label>
                <div className="flex items-center gap-2">
                  <Input id="customSubdomain" value={profileForm.customSubdomain} onChange={(e) => handleInputChange("customSubdomain", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} placeholder="your-company" className="flex-1" maxLength={32} />
                  <span className="text-sm text-muted-foreground">.cimshare.com</span>
                </div>
              </div>
              <Button onClick={handleProfileSave} disabled={updateProfileMutation.isPending} className="w-full">
                {updateProfileMutation.isPending ? "Saving..." : "Save Profile"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg"><Lock className="h-5 w-5" />Login Credentials</CardTitle>
              <CardDescription>Manage your email and password</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem><FormLabel>Email Address</FormLabel><FormControl><Input {...field} type="email" /></FormControl><FormMessage /></FormItem>
                  )} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField control={form.control} name="newPassword" render={({ field }) => (
                      <FormItem><FormLabel>New Password (Optional)</FormLabel><FormControl><Input {...field} type="password" placeholder="Leave blank to keep current" /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="confirmPassword" render={({ field }) => (
                      <FormItem><FormLabel>Confirm Password</FormLabel><FormControl><Input {...field} type="password" /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="currentPassword" render={({ field }) => (
                    <FormItem><FormLabel>Current Password</FormLabel><FormControl><Input {...field} type="password" placeholder="Required to save changes" /></FormControl><FormMessage /></FormItem>
                  )} />
                  <Button type="submit" disabled={isUpdating} className="w-full">{isUpdating ? "Updating..." : "Update Credentials"}</Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* BILLING TAB */}
        <TabsContent value="billing" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5" />Subscription</CardTitle>
                  <CardDescription>Your current plan and billing</CardDescription>
                </div>
                <Badge className={statusDisplay.color}>{statusDisplay.label}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b">
                <span className="text-sm text-muted-foreground">Plan</span>
                <span className="font-medium">{statusDisplay.label}</span>
              </div>
              {user?.subscriptionEndsAt && (
                <div className="flex items-center justify-between py-3 border-b">
                  <span className="text-sm text-muted-foreground">
                    {user.subscriptionStatus === 'canceled' ? 'Access until' : 'Next billing'}
                  </span>
                  <span className="font-medium">{new Date(user.subscriptionEndsAt).toLocaleDateString()}</span>
                </div>
              )}
              <div className="flex items-center justify-between py-3 border-b">
                <span className="text-sm text-muted-foreground">Monthly CIMs Created</span>
                <span className="font-medium">{user?.monthlyDocumentsCreated || 0}</span>
              </div>
              <div className="flex gap-3 pt-2">
                {isPaidPlan ? (
                  <Button onClick={handleCustomerPortal} disabled={billingLoading} className="flex-1">
                    {billingLoading ? "Loading..." : "Manage Subscription"}
                  </Button>
                ) : (
                  <Button onClick={() => navigate('/pricing')} className="flex-1">Upgrade Plan</Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* EMAIL SYNC TAB */}
        <TabsContent value="email" className="space-y-6">
          {emailConnections.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Connected Accounts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {emailConnections.map((connection) => (
                  <div key={connection.id} className="flex items-center gap-4 p-4 border rounded-lg">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${connection.provider === 'gmail' ? 'bg-red-50' : 'bg-blue-50'}`}>
                      <Mail className={`h-5 w-5 ${connection.provider === 'gmail' ? 'text-red-500' : 'text-blue-500'}`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{connection.providerAccountName || connection.providerAccountId}</span>
                        {getEmailStatusBadge(connection.status)}
                      </div>
                      <p className="text-sm text-muted-foreground">{connection.provider === 'gmail' ? 'Gmail' : 'Microsoft 365'}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => testEmailMutation.mutate(connection.id)} disabled={testEmailMutation.isPending}>
                        <RefreshCw className={`h-4 w-4 ${testEmailMutation.isPending ? 'animate-spin' : ''}`} />
                      </Button>
                      <Button variant="outline" size="sm" className="text-red-600" onClick={() => setDisconnectingId(connection.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{emailConnections.length > 0 ? 'Add Another Account' : 'Connect Email'}</CardTitle>
              <CardDescription>Connect your email to sync activity with CRM contacts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className={`p-4 border rounded-lg ${!gmailConfigured ? 'opacity-60' : ''}`}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
                      <Mail className="h-5 w-5 text-red-500" />
                    </div>
                    <div>
                      <h3 className="font-medium">Gmail</h3>
                      <p className="text-xs text-muted-foreground">Google Workspace</p>
                    </div>
                  </div>
                  {gmailConfigured ? (
                    <Button onClick={() => connectEmailMutation.mutate('gmail')} disabled={hasGmailConnection || connectEmailMutation.isPending} className="w-full" variant={hasGmailConnection ? "secondary" : "default"}>
                      {hasGmailConnection ? <><Check className="h-4 w-4 mr-2" />Connected</> : <><ExternalLink className="h-4 w-4 mr-2" />Connect</>}
                    </Button>
                  ) : (
                    <Badge variant="outline" className="w-full justify-center text-amber-600 border-amber-300">Coming Soon</Badge>
                  )}
                </div>

                <div className={`p-4 border rounded-lg ${!microsoftConfigured ? 'opacity-60' : ''}`}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                      <Mail className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <h3 className="font-medium">Microsoft 365</h3>
                      <p className="text-xs text-muted-foreground">Outlook</p>
                    </div>
                  </div>
                  {microsoftConfigured ? (
                    <Button onClick={() => connectEmailMutation.mutate('microsoft')} disabled={hasMicrosoftConnection || connectEmailMutation.isPending} className="w-full" variant={hasMicrosoftConnection ? "secondary" : "default"}>
                      {hasMicrosoftConnection ? <><Check className="h-4 w-4 mr-2" />Connected</> : <><ExternalLink className="h-4 w-4 mr-2" />Connect</>}
                    </Button>
                  ) : (
                    <Badge variant="outline" className="w-full justify-center text-amber-600 border-amber-300">Coming Soon</Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4">
              <div className="flex gap-3">
                <Mail className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-medium text-blue-900">How Email Sync Works</h3>
                  <p className="text-sm text-blue-700 mt-1">When connected, email activity with your CRM contacts appears in their timeline. You can also send emails directly from contact pages.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!disconnectingId} onOpenChange={() => setDisconnectingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Email Account?</AlertDialogTitle>
            <AlertDialogDescription>This will stop syncing email activity with your CRM contacts.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => disconnectingId && disconnectEmailMutation.mutate(disconnectingId)}>Disconnect</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsLayout>
  );
}
