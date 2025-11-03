import { useAuth } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema } from "@shared/schema";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocation, Link } from "wouter";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { z } from "zod";
import { Loader2, AlertTriangle, Shield, Zap, Lock, FileText, Database, Download, PenTool, Globe, CheckCircle, ArrowRight } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Schema for login form - only email and password
const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormData = z.infer<typeof loginSchema>;

const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

const resetPasswordSchema = z.object({
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be less than 128 characters")
    .regex(/(?=.*[a-z])/, "Password must contain at least one lowercase letter")
    .regex(/(?=.*[A-Z])/, "Password must contain at least one uppercase letter")
    .regex(/(?=.*\d)/, "Password must contain at least one number")
    .regex(/(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\?])/, "Password must contain at least one special character"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type ForgotPasswordData = z.infer<typeof forgotPasswordSchema>;
type ResetPasswordData = z.infer<typeof resetPasswordSchema>;

const registerSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be less than 128 characters")
    .regex(/(?=.*[a-z])/, "Password must contain at least one lowercase letter")
    .regex(/(?=.*[A-Z])/, "Password must contain at least one uppercase letter")
    .regex(/(?=.*\d)/, "Password must contain at least one number")
    .regex(/(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\?])/, "Password must contain at least one special character"),
  name: z.string().min(1, "Please enter your full name"),
  agreeToTerms: z.boolean().refine(val => val === true, {
    message: "You must agree to the terms and conditions"
  }),
  businessName: z.string().optional(),
  phoneNumber: z.string().optional(),
  profilePhoto: z.any().optional(),
  businessLogo: z.any().optional()
});

type RegisterFormData = z.infer<typeof registerSchema>;

export default function LoginPage() {
  const { user, loginMutation, registerMutation } = useAuth();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  
  // Get tab from URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const tabFromUrl = urlParams.get('tab');
  const defaultTab = tabFromUrl === 'register' ? 'register' : 'login';

  // Forgot password mutation
  const forgotPasswordMutation = useMutation({
    mutationFn: async (data: ForgotPasswordData) => {
      const res = await apiRequest("POST", "/api/forgot-password", { body: data });
      return await res.json();
    },
    onSuccess: () => {
      setEmailSent(true);
      toast({
        title: "Reset Email Sent",
        description: "Please check your email for password reset instructions.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Reset Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Reset password mutation
  const resetPasswordMutation = useMutation({
    mutationFn: async (data: ResetPasswordData) => {
      const res = await apiRequest("POST", "/api/reset-password", {
        body: {
          token: resetToken,
          password: data.password,
        }
      });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Password Reset Successfully",
        description: "Your password has been updated. You can now log in with your new password.",
      });
      setShowResetPassword(false);
      setResetToken(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Reset Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Check for reset token in URL or reset-password route
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    // If we're on the reset-password route or have a token, show reset form
    if (token || location === '/reset-password') {
      setResetToken(token);
      setShowResetPassword(true);
    }
  }, [location]);

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (user) {
      setLocation("/dashboard");
    }
  }, [user, setLocation]);

  if (user) {
    return null; // Will redirect
  }

  if (showResetPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Reset Your Password</CardTitle>
            <CardDescription>
              Enter your new password below.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResetPasswordForm mutation={resetPasswordMutation} />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (showForgotPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Reset Password</CardTitle>
            <CardDescription>
              Enter your email address and we'll send you a link to reset your password.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {emailSent ? (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-green-800 mb-2">Email Sent Successfully!</h3>
                  <p className="text-gray-600 mb-4">
                    We've sent password reset instructions to your email address. 
                    Please check your inbox and follow the instructions to reset your password.
                  </p>
                  <p className="text-sm text-gray-500 mb-6">
                    The reset link will expire in 1 hour. If you don't see the email, check your spam folder.
                  </p>
                </div>
                <Button
                  onClick={() => {
                    setShowForgotPassword(false);
                    setEmailSent(false);
                  }}
                  className="w-full"
                >
                  Back to Login
                </Button>
              </div>
            ) : (
              <>
                <ForgotPasswordForm mutation={forgotPasswordMutation} />
                <div className="mt-4 text-center">
                  <Button
                    type="button"
                    variant="link"
                    onClick={() => setShowForgotPassword(false)}
                  >
                    Back to login
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Features Showcase */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 35px, rgba(255,255,255,.05) 35px, rgba(255,255,255,.05) 70px)`,
          }}></div>
        </div>

        {/* Floating shapes */}
        <div className="absolute top-20 left-10 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '4s' }}></div>

        <div className="relative z-10 flex flex-col justify-center px-12 w-full">
          {/* Logo and Tagline */}
          <div className="mb-12">
            <h1 className="text-5xl font-bold text-white mb-4">CIM Share</h1>
            <p className="text-xl text-blue-200">Professional CIMs with Enterprise Security</p>
          </div>

          {/* Key Features Grid */}
          <div className="space-y-6 mb-12">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-green-500/20 flex items-center justify-center">
                <Shield className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">NDA Protection Built-In</h3>
                <p className="text-blue-200 text-sm">Secure document sharing with integrated confidentiality agreements and audit trails</p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-orange-500/20 flex items-center justify-center">
                <Zap className="w-6 h-6 text-orange-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">AI-Powered Document Creation</h3>
                <p className="text-blue-200 text-sm">Transform meeting transcripts into professional CIMs instantly with advanced AI</p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <Database className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">Investor Management System</h3>
                <p className="text-blue-200 text-sm">Track contacts, manage permissions, and monitor document engagement in real-time</p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                <Lock className="w-6 h-6 text-cyan-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">Bank-Level Encryption</h3>
                <p className="text-blue-200 text-sm">Enterprise-grade security with end-to-end encryption</p>
              </div>
            </div>
          </div>

          {/* Social Proof */}
          <div className="border-t border-blue-800 pt-8">
            <div className="flex items-center space-x-8">
              <div>
                <p className="text-3xl font-bold text-white">10,000+</p>
                <p className="text-blue-300 text-sm">Documents Created</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-white">500+</p>
                <p className="text-blue-300 text-sm">Companies Trust Us</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-white">99.9%</p>
                <p className="text-blue-300 text-sm">Uptime Guaranteed</p>
              </div>
            </div>
          </div>

          {/* Bottom Features */}
          <div className="mt-12 flex flex-wrap gap-4">
            <div className="flex items-center space-x-2 text-blue-300">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span className="text-sm">Free Plan Available</span>
            </div>
            <div className="flex items-center space-x-2 text-blue-300">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span className="text-sm">No Credit Card Required</span>
            </div>
            <div className="flex items-center space-x-2 text-blue-300">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span className="text-sm">Cancel Anytime</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Login/Register Forms */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="w-full max-w-md">
          {/* Mobile Logo (hidden on desktop) */}
          <div className="lg:hidden text-center mb-8">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">CIM Share</h1>
            <p className="text-slate-600">Professional CIMs with Enterprise Security</p>
          </div>

          <Card className="shadow-2xl border-0">
            <CardHeader className="space-y-1 pb-6">
              <CardTitle className="text-2xl font-bold text-center">Welcome Back</CardTitle>
              <CardDescription className="text-center">
                Enter your credentials to access your account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue={defaultTab} className="space-y-6">
                <TabsList className="grid w-full grid-cols-2 bg-slate-100">
                  <TabsTrigger 
                    value="login" 
                    className="data-[state=active]:bg-white data-[state=active]:shadow-sm"
                  >
                    Sign In
                  </TabsTrigger>
                  <TabsTrigger 
                    value="register"
                    className="data-[state=active]:bg-white data-[state=active]:shadow-sm"
                  >
                    Register
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="login" className="space-y-0">
                  <LoginForm 
                    mutation={loginMutation} 
                    onForgotPassword={() => setShowForgotPassword(true)}
                  />
                </TabsContent>

                <TabsContent value="register" className="space-y-0">
                  <RegisterForm mutation={registerMutation} />
                </TabsContent>
              </Tabs>

              {/* Mobile Features (hidden on desktop) */}
              <div className="lg:hidden mt-8 pt-8 border-t">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <Shield className="w-8 h-8 text-green-500 mx-auto mb-2" />
                    <p className="text-xs text-slate-600">NDA Protection</p>
                  </div>
                  <div>
                    <Zap className="w-8 h-8 text-orange-500 mx-auto mb-2" />
                    <p className="text-xs text-slate-600">AI-Powered</p>
                  </div>
                  <div>
                    <Database className="w-8 h-8 text-purple-500 mx-auto mb-2" />
                    <p className="text-xs text-slate-600">Investor Database</p>
                  </div>
                  <div>
                    <Lock className="w-8 h-8 text-cyan-500 mx-auto mb-2" />
                    <p className="text-xs text-slate-600">Bank-Level Security</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function LoginForm({ mutation, onForgotPassword }: { mutation: any; onForgotPassword: () => void }) {
  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-5">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-gray-700">Email</FormLabel>
              <FormControl>
                <Input
                  placeholder="name@example.com"
                  type="email"
                  autoComplete="email"
                  className="h-11"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel className="text-sm font-medium text-gray-700">Password</FormLabel>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="px-0 h-auto text-sm"
                  onClick={onForgotPassword}
                >
                  Forgot password?
                </Button>
              </div>
              <FormControl>
                <Input
                  type="password"
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="h-11"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          type="submit"
          className="w-full h-11 bg-gradient-to-r from-slate-600 to-blue-600 hover:from-slate-700 hover:to-blue-700 text-white"
          disabled={mutation.isPending}
        >
          {mutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Signing in...
            </>
          ) : (
            <>
              Sign In
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </form>
    </Form>
  );
}

function RegisterForm({ mutation }: { mutation: any }) {
  const form = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      password: "",
      name: "",
      businessName: "",
      phoneNumber: "",
      agreeToTerms: false,
    },
  });

  // Password validation states for visual feedback
  const [password, setPassword] = useState("");
  const [passwordChecks, setPasswordChecks] = useState({
    minLength: false,
    hasLowercase: false,
    hasUppercase: false,
    hasNumber: false,
    hasSpecial: false,
  });

  // Upload success states
  const [uploadStatus, setUploadStatus] = useState({
    profilePhoto: false,
    businessLogo: false,
  });

  // Update password checks in real-time
  const updatePasswordChecks = (value: string) => {
    setPassword(value);
    setPasswordChecks({
      minLength: value.length >= 8,
      hasLowercase: /[a-z]/.test(value),
      hasUppercase: /[A-Z]/.test(value),
      hasNumber: /\d/.test(value),
      hasSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\?]/.test(value),
    });
  };

  const handleFileUpload = (fieldName: 'profilePhoto' | 'businessLogo', file: File | null) => {
    if (file) {
      setUploadStatus(prev => ({
        ...prev,
        [fieldName]: true
      }));
    } else {
      setUploadStatus(prev => ({
        ...prev,
        [fieldName]: false
      }));
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((data) => {
        // Create FormData for file upload support
        const formData = new FormData();
        formData.append('email', data.email);
        formData.append('password', data.password);
        formData.append('name', data.name.trim());
        formData.append('agreeToTerms', 'true'); // Always send as string 'true' for backend validation

        // Add optional business profile fields only if they have values
        if (data.businessName && data.businessName.trim()) {
          formData.append('businessName', data.businessName.trim());
        }
        if (data.phoneNumber && data.phoneNumber.trim()) {
          formData.append('phoneNumber', data.phoneNumber.trim());
        }
        if (data.profilePhoto) {
          formData.append('profilePhoto', data.profilePhoto);
        }
        if (data.businessLogo) {
          formData.append('businessLogo', data.businessLogo);
        }

        mutation.mutate(formData as any);
      })} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-gray-700">Email</FormLabel>
              <FormControl>
                <Input
                  placeholder="name@example.com"
                  type="email"
                  autoComplete="email"
                  className="h-11"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-gray-700">Full Name</FormLabel>
              <FormControl>
                <Input
                  placeholder="John Doe"
                  type="text"
                  autoComplete="name"
                  className="h-11"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-gray-700">Password</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  placeholder="Choose a secure password"
                  autoComplete="new-password"
                  className="h-11"
                  {...field}
                  onChange={(e) => {
                    field.onChange(e);
                    updatePasswordChecks(e.target.value);
                  }}
                />
              </FormControl>
              {/* Password Requirements Checklist */}
              {password && (
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div className={`flex items-center gap-1 ${passwordChecks.minLength ? 'text-green-600' : 'text-gray-400'}`}>
                    <CheckCircle className="w-3 h-3" />
                    <span>8+ characters</span>
                  </div>
                  <div className={`flex items-center gap-1 ${passwordChecks.hasLowercase ? 'text-green-600' : 'text-gray-400'}`}>
                    <CheckCircle className="w-3 h-3" />
                    <span>Lowercase</span>
                  </div>
                  <div className={`flex items-center gap-1 ${passwordChecks.hasUppercase ? 'text-green-600' : 'text-gray-400'}`}>
                    <CheckCircle className="w-3 h-3" />
                    <span>Uppercase</span>
                  </div>
                  <div className={`flex items-center gap-1 ${passwordChecks.hasNumber ? 'text-green-600' : 'text-gray-400'}`}>
                    <CheckCircle className="w-3 h-3" />
                    <span>Number</span>
                  </div>
                  <div className={`flex items-center gap-1 ${passwordChecks.hasSpecial ? 'text-green-600' : 'text-gray-400'} col-span-2`}>
                    <CheckCircle className="w-3 h-3" />
                    <span>Special character</span>
                  </div>
                </div>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Business Profile Fields */}
        <div className="space-y-4 bg-slate-50/50 p-4 rounded-lg border border-slate-200">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-6a1 1 0 00-1-1H9a1 1 0 00-1 1v6a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" />
            </svg>
            Business Information <span className="text-gray-400 font-normal">(optional)</span>
          </div>

          <FormField
            control={form.control}
            name="businessName"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium text-gray-600">Company Name</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Your company name"
                    type="text"
                    className="h-10"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="phoneNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium text-gray-600">Phone Number</FormLabel>
                <FormControl>
                  <Input
                    placeholder="(555) 123-4567"
                    type="tel"
                    className="h-10"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="profilePhoto"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-gray-600 flex items-center gap-2">
                    Profile Photo
                    {uploadStatus.profilePhoto && (
                      <div className="flex items-center gap-1 text-emerald-600 text-xs font-semibold">
                        <CheckCircle className="w-3 h-3" />
                        <span>Uploaded</span>
                      </div>
                    )}
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="file"
                      accept="image/*"
                      className="h-10 px-2 border border-gray-300 rounded-md focus:border-blue-400 focus:ring-0 transition-colors duration-200 bg-white text-sm file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-medium file:bg-blue-50 file:text-blue-600 hover:file:bg-blue-100"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        field.onChange(file);
                        handleFileUpload('profilePhoto', file);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="businessLogo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-gray-600 flex items-center gap-2">
                    Business Logo
                    {uploadStatus.businessLogo && (
                      <div className="flex items-center gap-1 text-emerald-600 text-xs font-semibold">
                        <CheckCircle className="w-3 h-3" />
                        <span>Uploaded</span>
                      </div>
                    )}
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="file"
                      accept="image/*"
                      className="h-10 px-2 border border-gray-300 rounded-md focus:border-blue-400 focus:ring-0 transition-colors duration-200 bg-white text-sm file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-medium file:bg-blue-50 file:text-blue-600 hover:file:bg-blue-100"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        field.onChange(file);
                        handleFileUpload('businessLogo', file);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <FormField
          control={form.control}
          name="agreeToTerms"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  className="mt-0.5"
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel className="text-sm font-normal text-gray-700">
                  I agree to the{" "}
                  <a href="/terms-of-service" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700 hover:underline">
                    Terms and Conditions
                  </a>
                </FormLabel>
                <FormMessage />
              </div>
            </FormItem>
          )}
        />

        <Button
          type="submit"
          className="w-full h-11 bg-gradient-to-r from-slate-600 to-blue-600 hover:from-slate-700 hover:to-blue-700 text-white"
          disabled={mutation.isPending}
        >
          {mutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating account...
            </>
          ) : (
            <>
              Create Account
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </form>
    </Form>
  );
}

function ForgotPasswordForm({ mutation }: { mutation: any }) {
  const form = useForm<ForgotPasswordData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email address</FormLabel>
              <FormControl>
                <Input
                  placeholder="name@example.com"
                  type="email"
                  autoComplete="email"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button 
          type="submit" 
          className="w-full"
          disabled={mutation.isPending}
        >
          {mutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            "Send Reset Link"
          )}
        </Button>
      </form>
    </Form>
  );
}

function ResetPasswordForm({ mutation }: { mutation: any }) {
  const form = useForm<ResetPasswordData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>New Password</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  placeholder="Enter your new password"
                  autoComplete="new-password"
                  {...field}
                />
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
              <FormLabel>Confirm Password</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  placeholder="Confirm your new password"
                  autoComplete="new-password"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button 
          type="submit" 
          className="w-full"
          disabled={mutation.isPending}
        >
          {mutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Resetting...
            </>
          ) : (
            "Reset Password"
          )}
        </Button>
      </form>
    </Form>
  );
}