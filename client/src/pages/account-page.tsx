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
import { User, Phone, Building, Upload, Camera, Shield, Lock, CreditCard, Settings, FileImage, FileText } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PdfTemplateSelector } from "@/components/pdf-template-selector";
import { NdaTemplate } from "@shared/schema";
import { Plus, FileSignature, Grid3X3, List, Eye, Edit, Trash2, Calendar, MoreVertical, Users } from "lucide-react";
import NdaTemplateEditor from "@/components/nda-template-editor";
import { format } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

// Templates Content Component
function TemplatesContent() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showNewTemplateEditor, setShowNewTemplateEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<NdaTemplate | null>(null);

  // Fetch NDA templates
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['/api/nda-templates'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/nda-templates');
      const data = await response.json();
      return data.sort((a: NdaTemplate, b: NdaTemplate) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  // Create template mutation
  const createTemplateMutation = useMutation({
    mutationFn: async (templateData: {
      name: string;
      fileContent: string;
      signatureFields: any[];
    }) => {
      const response = await apiRequest('POST', '/api/nda-templates', templateData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/nda-templates'] });
      setShowNewTemplateEditor(false);
      toast({
        title: "Template created",
        description: "NDA template has been created successfully"
      });
    },
    onError: () => {
      toast({
        title: "Creation failed",
        description: "Failed to create template",
        variant: "destructive"
      });
    }
  });

  // Update template mutation
  const updateTemplateMutation = useMutation({
    mutationFn: async (templateData: {
      id: number;
      name: string;
      fileContent: string;
      signatureFields: any[];
    }) => {
      const { id, ...data } = templateData;
      const response = await apiRequest('PUT', `/api/nda-templates/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/nda-templates'] });
      setEditingTemplate(null);
      toast({
        title: "Template updated",
        description: "NDA template has been updated successfully"
      });
    },
    onError: () => {
      toast({
        title: "Update failed",
        description: "Failed to update template",
        variant: "destructive"
      });
    }
  });

  // Delete template mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/nda-templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/nda-templates'] });
      toast({
        title: "Template deleted",
        description: "NDA template has been deleted successfully"
      });
    },
    onError: () => {
      toast({
        title: "Delete failed",
        description: "Failed to delete template",
        variant: "destructive"
      });
    }
  });

  const handleDelete = (id: number, name: string) => {
    if (window.confirm(`Are you sure you want to delete "${name}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  const handleCreateTemplate = (data: {
    name: string;
    fileContent: string;
    signatureFields: any[];
  }) => {
    createTemplateMutation.mutate(data);
  };

  const handleUpdateTemplate = (data: {
    name: string;
    fileContent: string;
    signatureFields: any[];
  }) => {
    if (editingTemplate) {
      updateTemplateMutation.mutate({
        id: editingTemplate.id,
        ...data
      });
    }
  };

  if (showNewTemplateEditor) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Create New NDA Template</h2>
            <p className="text-gray-600 mt-1">Upload a PDF and configure signature fields</p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => setShowNewTemplateEditor(false)}
          >
            Back to Templates
          </Button>
        </div>

        <NdaTemplateEditor
          onSave={handleCreateTemplate}
          isLoading={createTemplateMutation.isPending}
        />
      </div>
    );
  }

  if (editingTemplate) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Edit NDA Template</h2>
            <p className="text-gray-600 mt-1">Modify template settings and signature fields</p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => setEditingTemplate(null)}
          >
            Back to Templates
          </Button>
        </div>

        <NdaTemplateEditor
          initialTemplate={editingTemplate}
          onSave={handleUpdateTemplate}
          isLoading={updateTemplateMutation.isPending}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* NDA Templates Section */}
      <Card className="border-0 shadow-xl bg-white/95 backdrop-blur-sm rounded-2xl overflow-hidden ring-1 ring-gray-200/50">
        <CardHeader className="bg-gradient-to-r from-orange-600 to-orange-700 pb-6 pt-8 px-8 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 backdrop-blur-sm rounded-xl shadow-sm">
                <FileSignature className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-white">NDA Templates</CardTitle>
                <CardDescription className="text-orange-100 mt-1">
                  Create and manage your NDA templates with signature fields
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {templates.length > 0 && (
                <div className="flex items-center border border-white/30 rounded-lg p-1 bg-white/10">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setViewMode('grid')}
                    className={`h-8 w-8 p-0 ${viewMode === 'grid' ? 'bg-white/30 shadow-sm text-white' : 'text-orange-100 hover:text-white hover:bg-white/20'}`}
                  >
                    <Grid3X3 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setViewMode('list')}
                    className={`h-8 w-8 p-0 ${viewMode === 'list' ? 'bg-white/30 shadow-sm text-white' : 'text-orange-100 hover:text-white hover:bg-white/20'}`}
                  >
                    <List className="w-4 h-4" />
                  </Button>
                </div>
              )}
              <Button 
                onClick={() => setShowNewTemplateEditor(true)}
                className="bg-white/20 hover:bg-white/30 text-white border-white/30 flex items-center gap-2"
                variant="outline"
              >
                <Plus className="w-4 h-4" />
                Add New Template
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-12">
              <FileSignature className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No NDA Templates</h3>
              <p className="text-gray-600 mb-4">
                Create your first NDA template to get started with document protection
              </p>
              <Button 
                onClick={() => setShowNewTemplateEditor(true)}
                className="flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add New Template
              </Button>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((template: NdaTemplate) => (
                <Card 
                  key={template.id} 
                  className="group hover:shadow-lg transition-all duration-200 cursor-pointer border-gray-200 hover:border-blue-200"
                  onClick={() => setEditingTemplate(template)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="flex items-center gap-2 text-base truncate group-hover:text-blue-600 transition-colors">
                          <div className="p-1.5 rounded-lg bg-blue-50 group-hover:bg-blue-100 transition-colors">
                            <FileSignature className="w-4 h-4 text-blue-600" />
                          </div>
                          <span className="truncate">{template.name}</span>
                        </CardTitle>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="w-4 h-4 text-gray-500" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingTemplate(template);
                            }}
                          >
                            <Edit className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(template.id, template.name);
                            }}
                            className="text-red-600"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2 text-sm text-gray-500">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        <span>Created {format(new Date(template.createdAt), 'MMM d, yyyy')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        <span>{(template.signatureFields as any[])?.length || 0} signature fields</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {templates.map((template: NdaTemplate) => (
                <div 
                  key={template.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer group"
                  onClick={() => setEditingTemplate(template)}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-50 group-hover:bg-blue-100 transition-colors">
                      <FileSignature className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-medium group-hover:text-blue-600 transition-colors">{template.name}</h3>
                      <p className="text-sm text-gray-500">
                        Created {format(new Date(template.createdAt), 'MMM d, yyyy')} • {(template.signatureFields as any[])?.length || 0} signature fields
                      </p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="w-4 h-4 text-gray-500" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem 
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingTemplate(template);
                        }}
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(template.id, template.name);
                        }}
                        className="text-red-600"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* PDF Background Templates Section */}
      <PdfTemplateSelector />
    </div>
  );
}

export default function AccountPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);
  const [, navigate] = useLocation();
  
  // Get tab from URL query parameter
  const searchParams = new URLSearchParams(window.location.search);
  const tabFromUrl = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabFromUrl || 'account');
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
      {/* Enhanced Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl shadow-lg">
            <Settings className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
            Account Settings
          </h1>
        </div>
        <p className="text-gray-600 ml-12">Manage your account, security, and preferences</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className={`grid w-full ${isAuthorizedAdmin(user) ? 'grid-cols-5' : 'grid-cols-4'}`}>
          <TabsTrigger value="account" className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Account & Security
          </TabsTrigger>
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Profile & Business
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Templates
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
          <Card className="border-0 shadow-xl bg-white/95 backdrop-blur-sm rounded-2xl overflow-hidden ring-1 ring-gray-200/50">
            <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 pb-6 pt-8 px-8 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 backdrop-blur-sm rounded-xl shadow-sm">
                  <Lock className="h-6 w-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold text-white">Login Credentials</CardTitle>
                  <CardDescription className="text-blue-100 mt-1">
                    Manage your email address and authentication settings
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-8">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white border-0 shadow-lg"
                  >
                    {isUpdating ? "Updating..." : "Save Changes"}
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
            <Card className="lg:col-span-1 border-0 shadow-xl bg-white/95 backdrop-blur-sm rounded-2xl overflow-hidden ring-1 ring-gray-200/50">
              <CardHeader className="bg-gradient-to-r from-emerald-600 to-emerald-700 pb-6 pt-8 px-8 shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 backdrop-blur-sm rounded-xl shadow-sm">
                    <User className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-bold text-white">Personal Information</CardTitle>
                    <CardDescription className="text-emerald-100 mt-1">
                      Contact details that appear in your CIM documents
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-8">
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
            <Card className="lg:col-span-1 border-0 shadow-xl bg-white/95 backdrop-blur-sm rounded-2xl overflow-hidden ring-1 ring-gray-200/50">
              <CardHeader className="bg-gradient-to-r from-purple-600 to-purple-700 pb-6 pt-8 px-8 shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 backdrop-blur-sm rounded-xl shadow-sm">
                    <Camera className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-bold text-white">Profile Photo</CardTitle>
                    <CardDescription className="text-purple-100 mt-1">
                      Your photo appears on share links and PDF exports
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-8">
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
          <Card className="border-0 shadow-xl bg-white/95 backdrop-blur-sm rounded-2xl overflow-hidden ring-1 ring-gray-200/50">
            <CardHeader className="bg-gradient-to-r from-slate-600 to-slate-700 pb-6 pt-8 px-8 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 backdrop-blur-sm rounded-xl shadow-sm">
                  <Building className="h-6 w-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold text-white">Business Information</CardTitle>
                  <CardDescription className="text-slate-100 mt-1">
                    Company details for professional CIM branding
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 pt-8">
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
                  className="w-full bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white border-0 shadow-lg"
                >
                  {updateProfileMutation.isPending ? "Saving..." : "Save Profile Information"}
                </Button>
              </div>
            </CardContent>
          </Card>

        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-6">
          <TemplatesContent />
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