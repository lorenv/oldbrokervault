import { useState, useRef, useEffect, Suspense } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  User, 
  Bell, 
  Shield, 
  CreditCard, 
  LogOut,
  Save,
  Palette,
  Upload,
  Database
} from "lucide-react";
import { LazyBackupManager } from "@/components/lazy-components";
import { useLocation } from "wouter";

export default function Settings() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [settings, setSettings] = useState({
    fullName: "",
    email: "",
    password: "",
    twoFactorAuth: false,
    emailNotifications: true,
    documentCompleted: true,
    reminderEmails: false,
    // Profile settings - additional fields from registration
    phoneNumber: "",
    businessName: "",
    businessLogo: "",
    profilePhoto: "",
    // Branding settings
    companyName: "",
    companyLogo: "",
    primaryColor: "#2563eb",
    secondaryColor: "#64748b",
    customEmailTemplate: true,
    brandingOnSigningPage: true,
    customFooterText: "",
  });

  // Load user data from the authenticated user API
  const { data: userData } = useQuery({
    queryKey: ["/api/user"],
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Load user settings from backend (no stale time to always get fresh data)
  const { data: userSettings } = useQuery({
    queryKey: ["/api/settings"],
    staleTime: 0, // Always fetch fresh data
  });

  // Update settings when user data or user settings load
  useEffect(() => {
    if (userData || userSettings) {
      setSettings(prev => ({
        ...prev,
        // Use actual user data - map 'name' field to 'fullName' for the settings form
        fullName: (userData as any)?.name || (userData as any)?.fullName || prev.fullName,
        email: (userData as any)?.email || prev.email,
        // Map additional profile fields from registration
        phoneNumber: (userData as any)?.phoneNumber || prev.phoneNumber,
        businessName: (userData as any)?.businessName || prev.businessName,
        businessLogo: (userData as any)?.businessLogo || prev.businessLogo,
        profilePhoto: (userData as any)?.profilePhoto || prev.profilePhoto,
        // Merge in saved settings
        ...(userSettings as any),
        // Ensure we keep defaults for missing values
        companyName: (userSettings as any)?.companyName || (userData as any)?.businessName || `${(userData as any)?.name || (userData as any)?.fullName || 'Your'} Company`,
        customFooterText: (userSettings as any)?.customFooterText || `Powered by ${(userSettings as any)?.companyName || (userData as any)?.businessName || ((userData as any)?.name || (userData as any)?.fullName || 'Your') + ' Company'}`,
        // Use business logo from registration as company logo for branding
        companyLogo: (userSettings as any)?.companyLogo || (userData as any)?.businessLogo || prev.companyLogo,
      }));
    }
  }, [userData, userSettings]);

  const saveSettingsMutation = useMutation({
    mutationFn: async (settingsData: typeof settings) => {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(settingsData),
      });
      if (!response.ok) {
        throw new Error("Failed to save settings");
      }
      return response.json();
    },
    onSuccess: (response) => {
      toast({
        title: "Settings saved",
        description: "Your settings have been successfully updated.",
      });
      // Update the settings state with the response to maintain any server-side changes
      if (response?.settings) {
        setSettings(prevSettings => {
          const updatedSettings = { ...prevSettings, ...response.settings };
          // Save to localStorage for persistence
          localStorage.setItem('userSettings', JSON.stringify(updatedSettings));
          return updatedSettings;
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to save settings",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    },
  });

  const handleLogout = async () => {
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      
      if (response.ok) {
        window.location.href = "/";
      }
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const handleSaveSettings = async () => {
    saveSettingsMutation.mutate(settings);
  };

  const uploadLogoMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("logo", file);
      
      const response = await fetch("/api/upload-logo", {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error("Failed to upload logo");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setSettings(prev => {
        const updated = {
          ...prev,
          companyLogo: data.logoUrl
        };
        // Save to localStorage immediately
        localStorage.setItem('userSettings', JSON.stringify(updated));
        return updated;
      });
      toast({
        title: "Logo uploaded",
        description: "Your company logo has been uploaded successfully.",
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

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadLogoMutation.mutate(file);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="glass-card border-none px-8 py-6 h-[89px] flex items-center justify-between paper-shadow">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-ink-violet to-document-gray-dark bg-clip-text text-transparent">Settings</h1>
          <p className="text-sm text-document-gray-dark/70 mt-1">
            Manage your account preferences and security settings
          </p>
        </div>
        <Button 
          onClick={handleLogout}
          variant="outline"
          className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 hover:border-red-300 ml-8"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </Button>
      </header>

        {/* Settings Content */}
        <main className="flex-1 overflow-auto p-8 ink-flow document-texture">
          <div className="max-w-4xl">
            <Tabs defaultValue="profile" className="space-y-6">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="profile" className="flex items-center">
                  <User className="h-4 w-4 mr-2" />
                  Profile
                </TabsTrigger>
                <TabsTrigger value="branding" className="flex items-center">
                  <Palette className="h-4 w-4 mr-2" />
                  Branding
                </TabsTrigger>
                <TabsTrigger value="notifications" className="flex items-center">
                  <Bell className="h-4 w-4 mr-2" />
                  Notifications
                </TabsTrigger>
                <TabsTrigger value="backup" className="flex items-center">
                  <Database className="h-4 w-4 mr-2" />
                  Backup
                </TabsTrigger>
                <TabsTrigger value="subscription" className="flex items-center">
                  <CreditCard className="h-4 w-4 mr-2" />
                  Subscription
                </TabsTrigger>
              </TabsList>

              <TabsContent value="profile" className="space-y-6">
                {/* Profile Settings */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <User className="h-5 w-5 mr-2" />
                      Profile Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="fullName">Full Name</Label>
                        <Input
                          id="fullName"
                          value={settings.fullName}
                          onChange={(e) => setSettings({...settings, fullName: e.target.value})}
                        />
                      </div>
                      <div>
                        <Label htmlFor="email">Email Address</Label>
                        <Input
                          id="email"
                          type="email"
                          value={settings.email}
                          onChange={(e) => setSettings({...settings, email: e.target.value})}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="phoneNumber">Phone Number</Label>
                        <Input
                          id="phoneNumber"
                          type="tel"
                          value={settings.phoneNumber}
                          onChange={(e) => setSettings({...settings, phoneNumber: e.target.value})}
                          placeholder="Your phone number"
                        />
                      </div>
                      <div>
                        <Label htmlFor="businessName">Business Name</Label>
                        <Input
                          id="businessName"
                          value={settings.businessName}
                          onChange={(e) => setSettings({...settings, businessName: e.target.value})}
                          placeholder="Your business name"
                        />
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="profilePhoto">Profile Photo</Label>
                        <div className="flex items-center space-x-4 mt-2">
                          {settings.profilePhoto && (
                            <img 
                              src={settings.profilePhoto} 
                              alt="Profile Photo" 
                              className="h-12 w-12 rounded-full object-cover border"
                            />
                          )}
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = (e) => {
                                  const result = e.target?.result as string;
                                  setSettings({...settings, profilePhoto: result});
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                            className="flex-1"
                          />
                        </div>
                        <p className="text-sm text-gray-500 mt-1">Upload your profile photo</p>
                      </div>
                      
                      <div>
                        <Label htmlFor="businessLogo">Business Logo</Label>
                        <div className="flex items-center space-x-4 mt-2">
                          {settings.businessLogo && (
                            <img 
                              src={settings.businessLogo} 
                              alt="Business Logo" 
                              className="h-12 w-auto max-w-[150px] object-contain border rounded p-1"
                            />
                          )}
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = (e) => {
                                  const result = e.target?.result as string;
                                  setSettings({...settings, businessLogo: result});
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                            className="flex-1"
                          />
                        </div>
                        <p className="text-sm text-gray-500 mt-1">Upload your business logo</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Security Settings in Profile */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Shield className="h-5 w-5 mr-2" />
                      Security & Authentication
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <Label>Change Password</Label>
                      <p className="text-sm text-slate-500 mt-1 mb-3">
                        Update your account password
                      </p>
                      <Button variant="outline">
                        Change Password
                      </Button>
                    </div>
                    
                    <Separator />
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="twoFactorAuth">Two-Factor Authentication</Label>
                        <p className="text-sm text-slate-500 mt-1">
                          Add an extra layer of security to your account
                        </p>
                      </div>
                      <Switch
                        id="twoFactorAuth"
                        checked={settings.twoFactorAuth}
                        onCheckedChange={(checked) => setSettings({...settings, twoFactorAuth: checked})}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="branding" className="space-y-6">
                {/* Custom Branding */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Palette className="h-5 w-5 mr-2" />
                      Custom Branding
                    </CardTitle>
                    <p className="text-sm text-slate-500">
                      Customize the appearance of your signing pages and emails
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="companyName">Company Name</Label>
                        <Input
                          id="companyName"
                          value={settings.companyName}
                          onChange={(e) => setSettings({...settings, companyName: e.target.value})}
                          placeholder="Your Company"
                        />
                      </div>
                      <div>
                        <Label htmlFor="customFooterText">Footer Text</Label>
                        <Input
                          id="customFooterText"
                          value={settings.customFooterText}
                          onChange={(e) => setSettings({...settings, customFooterText: e.target.value})}
                          placeholder="Powered by Your Company"
                        />
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <Label htmlFor="companyLogo">Company Logo</Label>
                      <p className="text-sm text-slate-500 mt-1 mb-3">
                        Upload your company logo to appear on signing pages and emails
                      </p>
                      <div className="flex items-center space-x-4">
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleLogoUpload}
                          accept="image/*"
                          className="hidden"
                        />
                        <Button 
                          variant="outline" 
                          className="flex items-center"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadLogoMutation.isPending}
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          {uploadLogoMutation.isPending ? "Uploading..." : "Upload Logo"}
                        </Button>
                        {settings.companyLogo && (
                          <img 
                            src={settings.companyLogo} 
                            alt="Company Logo" 
                            className="h-12 w-auto border rounded"
                          />
                        )}
                      </div>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="primaryColor">Primary Color</Label>
                        <div className="flex items-center space-x-2 mt-1">
                          <Input
                            id="primaryColor"
                            type="color"
                            value={settings.primaryColor}
                            onChange={(e) => setSettings({...settings, primaryColor: e.target.value})}
                            className="w-16 h-10 p-1 rounded"
                          />
                          <Input
                            value={settings.primaryColor}
                            onChange={(e) => setSettings({...settings, primaryColor: e.target.value})}
                            placeholder="#2563eb"
                            className="flex-1"
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="secondaryColor">Secondary Color</Label>
                        <div className="flex items-center space-x-2 mt-1">
                          <Input
                            id="secondaryColor"
                            type="color"
                            value={settings.secondaryColor}
                            onChange={(e) => setSettings({...settings, secondaryColor: e.target.value})}
                            className="w-16 h-10 p-1 rounded"
                          />
                          <Input
                            value={settings.secondaryColor}
                            onChange={(e) => setSettings({...settings, secondaryColor: e.target.value})}
                            placeholder="#64748b"
                            className="flex-1"
                          />
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="brandingOnSigningPage">Show Branding on Signing Pages</Label>
                          <p className="text-sm text-slate-500 mt-1">
                            Display your company logo and colors on document signing pages
                          </p>
                        </div>
                        <Switch
                          id="brandingOnSigningPage"
                          checked={settings.brandingOnSigningPage}
                          onCheckedChange={(checked) => setSettings({...settings, brandingOnSigningPage: checked})}
                        />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="customEmailTemplate">Custom Email Templates</Label>
                          <p className="text-sm text-slate-500 mt-1">
                            Use your branding in email invitations and notifications
                          </p>
                        </div>
                        <Switch
                          id="customEmailTemplate"
                          checked={settings.customEmailTemplate}
                          onCheckedChange={(checked) => setSettings({...settings, customEmailTemplate: checked})}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="notifications" className="space-y-6">
                {/* Notification Settings */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Bell className="h-5 w-5 mr-2" />
                      Notifications
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="emailNotifications">Email Notifications</Label>
                        <p className="text-sm text-slate-500 mt-1">
                          Receive notifications about your documents via email
                        </p>
                      </div>
                      <Switch
                        id="emailNotifications"
                        checked={settings.emailNotifications}
                        onCheckedChange={(checked) => setSettings({...settings, emailNotifications: checked})}
                      />
                    </div>
                    
                    <Separator />
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="documentCompleted">Document Completion Alerts</Label>
                        <p className="text-sm text-slate-500 mt-1">
                          Get notified when documents are completed
                        </p>
                      </div>
                      <Switch
                        id="documentCompleted"
                        checked={settings.documentCompleted}
                        onCheckedChange={(checked) => setSettings({...settings, documentCompleted: checked})}
                      />
                    </div>
                    
                    <Separator />
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="reminderEmails">Reminder Emails</Label>
                        <p className="text-sm text-slate-500 mt-1">
                          Send reminders to signers who haven't completed documents
                        </p>
                      </div>
                      <Switch
                        id="reminderEmails"
                        checked={settings.reminderEmails}
                        onCheckedChange={(checked) => setSettings({...settings, reminderEmails: checked})}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="backup" className="space-y-6">
                <Suspense fallback={<div className="flex items-center justify-center p-8"><div className="text-sm text-slate-500">Loading backup manager...</div></div>}>
                  <LazyBackupManager />
                </Suspense>
              </TabsContent>

              <TabsContent value="subscription" className="space-y-6">
                {/* Plan & Billing */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <CreditCard className="h-5 w-5 mr-2" />
                      Current Plan
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                      <div>
                        <h4 className="font-medium">Professional Plan</h4>
                        <p className="text-sm text-slate-500">
                          Unlimited documents • Advanced features • Priority support
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">$29/month</p>
                        <p className="text-sm text-slate-500">Billed monthly</p>
                      </div>
                    </div>
                    <div className="flex space-x-3">
                      <Button variant="outline">
                        Change Plan
                      </Button>
                      <Button variant="outline">
                        View Billing History
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Usage Statistics */}
                <Card>
                  <CardHeader>
                    <CardTitle>Usage This Month</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-blue-50 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">47</div>
                        <div className="text-sm text-slate-600">Documents Sent</div>
                      </div>
                      <div className="p-4 bg-green-50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">142</div>
                        <div className="text-sm text-slate-600">Signatures Collected</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Save Button */}
              <div className="flex justify-end">
                <Button 
                  onClick={handleSaveSettings} 
                  disabled={saveSettingsMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saveSettingsMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </Tabs>
          </div>
        </main>
    </div>
  );
}