import { useAuth } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { Loader2, PenTool, Database, Users, Workflow, Link2, CheckCircle, ArrowRight, Zap } from "lucide-react";
import { useState, useEffect } from "react";
import { extractPlanIntent, storePlanIntent, getPlanIntent, PlanIntent } from "@/lib/plan-intent";

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

export default function RegisterPage() {
  const { user, registerMutation } = useAuth();
  const [, setLocation] = useLocation();
  const [planIntent, setPlanIntent] = useState<PlanIntent | null>(null);

  // Capture plan intent from URL parameters on mount
  useEffect(() => {
    // First check URL for plan intent
    const urlIntent = extractPlanIntent();
    if (urlIntent) {
      storePlanIntent(urlIntent);
      setPlanIntent(urlIntent);
      // Clean URL by removing plan parameters
      const url = new URL(window.location.href);
      url.searchParams.delete('plan');
      url.searchParams.delete('billing');
      window.history.replaceState({}, '', url.toString());
    } else {
      // Check for existing stored intent
      const storedIntent = getPlanIntent();
      if (storedIntent) {
        setPlanIntent(storedIntent);
      }
    }
  }, []);

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (user) {
      setLocation("/dashboard");
    }
  }, [user, setLocation]);

  if (user) {
    return null; // Will redirect
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
            <img
              src="/brokervaultlogo.svg"
              alt="Broker Vault"
              className="h-12 mb-4 brightness-0 invert"
            />
            <p className="text-xl text-blue-200">The All-in-One Platform for Business Brokers & M&A Advisors</p>
          </div>

          {/* Key Features Grid */}
          <div className="space-y-6 mb-12">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-green-500/20 flex items-center justify-center">
                <PenTool className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">E-Signatures & NDAs</h3>
                <p className="text-blue-200 text-sm">Legally binding signatures with built-in NDA workflows and automatic audit trails</p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-orange-500/20 flex items-center justify-center">
                <Database className="w-6 h-6 text-orange-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">Centralized Deal Records</h3>
                <p className="text-blue-200 text-sm">Keep all your documents, contacts, and deal data organized in one secure location</p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <Users className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">Team Collaboration</h3>
                <p className="text-blue-200 text-sm">Work together seamlessly with role-based access, shared workspaces, and real-time updates</p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                <Workflow className="w-6 h-6 text-cyan-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">Automated Workflows</h3>
                <p className="text-blue-200 text-sm">Streamline your deal process with automated tasks, reminders, and status tracking</p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-pink-500/20 flex items-center justify-center">
                <Link2 className="w-6 h-6 text-pink-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">Powerful Integrations</h3>
                <p className="text-blue-200 text-sm">Connect with your favorite tools including email, calendar, and CRM systems</p>
              </div>
            </div>
          </div>

          {/* Bottom Features */}
          <div className="mt-8 flex flex-wrap gap-4">
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
              <span className="text-sm">Bank-Level Security</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Register Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="w-full max-w-md">
          {/* Mobile Logo (hidden on desktop) */}
          <div className="lg:hidden text-center mb-8">
            <img
              src="/brokervaultlogo.svg"
              alt="Broker Vault"
              className="h-10 mx-auto mb-2"
            />
            <p className="text-slate-600">The All-in-One Platform for Business Brokers</p>
          </div>

          {planIntent && (
            <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">You selected the Pro plan</p>
                  <p className="text-sm text-gray-600">
                    ${planIntent.billing === 'annual' ? '49' : '59'}/mo
                    {planIntent.billing === 'annual' ? ' billed annually' : ' billed monthly'}.
                    Create your account to continue.
                  </p>
                </div>
              </div>
            </div>
          )}

          <Card className="shadow-2xl border-0">
            <CardHeader className="space-y-1 pb-6">
              <CardTitle className="text-2xl font-bold text-center">
                Create an Account
              </CardTitle>
              <CardDescription className="text-center">
                {planIntent ? 'Sign up to activate your Pro plan' : 'Get started with your free account'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RegisterForm mutation={registerMutation} />

              <div className="mt-6 text-center text-sm text-gray-600">
                Already have an account?{" "}
                <Link href="/" className="text-blue-600 hover:text-blue-700 font-medium hover:underline">
                  Sign in
                </Link>
              </div>

              {/* Mobile Features (hidden on desktop) */}
              <div className="lg:hidden mt-8 pt-8 border-t">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <PenTool className="w-8 h-8 text-green-500 mx-auto mb-2" />
                    <p className="text-xs text-slate-600">E-Signatures</p>
                  </div>
                  <div>
                    <Database className="w-8 h-8 text-orange-500 mx-auto mb-2" />
                    <p className="text-xs text-slate-600">Deal Records</p>
                  </div>
                  <div>
                    <Users className="w-8 h-8 text-purple-500 mx-auto mb-2" />
                    <p className="text-xs text-slate-600">Team Collaboration</p>
                  </div>
                  <div>
                    <Workflow className="w-8 h-8 text-cyan-500 mx-auto mb-2" />
                    <p className="text-xs text-slate-600">Workflows</p>
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
        formData.append('agreeToTerms', 'true');

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
                  <a href="https://brokervault.ai/terms-of-service" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700 hover:underline">
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
