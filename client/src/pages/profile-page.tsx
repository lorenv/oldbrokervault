import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { User, Phone, Building, Upload, Camera } from "lucide-react";

export default function ProfilePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profileForm, setProfileForm] = useState({
    name: "",
    title: "",
    phoneNumber: "",
    businessName: "",
  });

  // Fetch profile data
  const { data: profile, isLoading } = useQuery({
    queryKey: ["/api/profile"],
    onSuccess: (data) => {
      setProfileForm({
        name: data.name || "",
        title: data.title || "",
        phoneNumber: data.phoneNumber || "",
        businessName: data.businessName || "",
      });
    },
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (profileData: typeof profileForm) => {
      const response = await apiRequest("PUT", "/api/profile", profileData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["/api/profile"]);
      toast({
        title: "Profile Updated",
        description: "Your profile information has been saved successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate(profileForm);
  };

  const handleInputChange = (field: keyof typeof profileForm, value: string) => {
    setProfileForm(prev => ({ ...prev, [field]: value }));
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/3"></div>
            <div className="h-64 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Profile Information</h1>
          <p className="text-muted-foreground">
            Manage your personal and business information. This data will appear at the bottom of your CIM documents.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Personal Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Personal Information
              </CardTitle>
              <CardDescription>
                Your personal details for CIM contact information.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  value={user?.email || ""}
                  disabled
                  className="bg-muted"
                />
                <p className="text-sm text-muted-foreground">
                  Email address cannot be changed from this page.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Business Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Business Information
              </CardTitle>
              <CardDescription>
                Your business details for professional CIM branding.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="businessName">Business Name</Label>
                <Input
                  id="businessName"
                  value={profileForm.businessName}
                  onChange={(e) => handleInputChange("businessName", e.target.value)}
                  placeholder="Enter your business name"
                />
              </div>
              
              {/* Business Logo Upload */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Business Logo
                </Label>
                <div className="border-2 border-dashed border-muted rounded-lg p-6 text-center">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground mb-2">
                    Upload your business logo (max 350px width)
                  </p>
                  <Button type="button" variant="outline" size="sm">
                    Choose File
                  </Button>
                  <p className="text-xs text-muted-foreground mt-1">
                    Coming soon - file upload functionality
                  </p>
                </div>
              </div>

              {/* Profile Photo Upload */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Camera className="h-4 w-4" />
                  Profile Photo
                </Label>
                <div className="border-2 border-dashed border-muted rounded-lg p-6 text-center">
                  <Camera className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground mb-2">
                    Upload your profile photo (max 350px width)
                  </p>
                  <Button type="button" variant="outline" size="sm">
                    Choose File
                  </Button>
                  <p className="text-xs text-muted-foreground mt-1">
                    Coming soon - file upload functionality
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Password Change */}
          <Card>
            <CardHeader>
              <CardTitle>Password & Security</CardTitle>
              <CardDescription>
                Update your password and security settings.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button type="button" variant="outline">
                Change Password
              </Button>
              <p className="text-sm text-muted-foreground mt-2">
                Coming soon - password change functionality
              </p>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button 
              type="submit" 
              disabled={updateProfileMutation.isPending}
              className="min-w-32"
            >
              {updateProfileMutation.isPending ? "Saving..." : "Save Profile"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}