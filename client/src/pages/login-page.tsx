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
import { Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";

type LoginFormData = z.infer<typeof insertUserSchema>;

const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

const resetPasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(8, "Password must be at least 8 characters"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type ForgotPasswordData = z.infer<typeof forgotPasswordSchema>;
type ResetPasswordData = z.infer<typeof resetPasswordSchema>;

const registerSchema = insertUserSchema.omit({ adminCode: true }).extend({
  agreeToTerms: z.boolean().refine(val => val === true, {
    message: "You must agree to the terms and conditions"
  }),
  captcha: z.string().min(1, "Please complete the captcha")
});

type RegisterFormData = z.infer<typeof registerSchema>;

export default function LoginPage() {
  const { user, loginMutation, registerMutation } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(null);

  // Forgot password mutation
  const forgotPasswordMutation = useMutation({
    mutationFn: async (data: ForgotPasswordData) => {
      const res = await apiRequest("POST", "/api/forgot-password", data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Reset Email Sent",
        description: "Please check your email for password reset instructions.",
      });
      setShowForgotPassword(false);
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
        token: resetToken,
        password: data.password,
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

  // Check for reset token in URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    if (token) {
      setResetToken(token);
      setShowResetPassword(true);
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

  if (showResetPassword) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
        <div className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16 xl:px-24 min-h-screen">
          <div className="mx-auto w-full max-w-sm">
            <div className="mb-8">
              <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-4">
                Reset Your Password
              </h1>
              <p className="text-gray-600">
                Enter your new password below.
              </p>
            </div>

            <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
              <CardContent className="p-8">
                <ResetPasswordForm mutation={resetPasswordMutation} />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (showForgotPassword) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
        <div className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16 xl:px-24 min-h-screen">
          <div className="mx-auto w-full max-w-sm">
            <div className="mb-8">
              <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-4">
                Reset Password
              </h1>
              <p className="text-gray-600">
                Enter your email address and we'll send you a link to reset your password.
              </p>
            </div>

            <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
              <CardContent className="p-8">
                <ForgotPasswordForm mutation={forgotPasswordMutation} />
                <div className="mt-6 text-center">
                  <Button
                    type="button"
                    variant="link"
                    onClick={() => setShowForgotPassword(false)}
                    className="text-sm"
                  >
                    Back to login
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="grid min-h-screen lg:grid-cols-2">
        {/* Left side - Welcome Section */}
        <div className="hidden lg:flex lg:flex-col lg:justify-center lg:px-12 xl:px-24 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
          <div className="max-w-md">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 mb-6">
              Welcome to CIM Share
            </h1>
            <p className="text-lg text-gray-600 mb-8 leading-relaxed">
              The ultimate platform for creating professional Confidential Information Memorandums with NDA protection, full customization, and export to Word, PDF, and HTML formats.
            </p>
            <div className="bg-white/60 backdrop-blur-sm rounded-lg p-6 border border-white/20">
              <h3 className="font-semibold text-gray-900 mb-3">Key Features:</h3>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-center">
                  <div className="w-2 h-2 bg-primary rounded-full mr-3"></div>
                  Professional document generation
                </li>
                <li className="flex items-center">
                  <div className="w-2 h-2 bg-primary rounded-full mr-3"></div>
                  NDA protection & secure sharing
                </li>
                <li className="flex items-center">
                  <div className="w-2 h-2 bg-primary rounded-full mr-3"></div>
                  Multiple export formats
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Right side - Form Section */}
        <div className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16 xl:px-24">
          <div className="mx-auto w-full max-w-sm">
            <div className="lg:hidden mb-8">
              <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-4">
                Welcome to CIM Share
              </h1>
              <p className="text-gray-600">
                Create professional CIMs with ease
              </p>
            </div>

            <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
              <CardContent className="p-8">
                <Tabs defaultValue="login">
                  <TabsList className="grid w-full grid-cols-2 mb-6">
                    <TabsTrigger value="login" className="text-sm font-medium">Login</TabsTrigger>
                    <TabsTrigger value="register" className="text-sm font-medium">Register</TabsTrigger>
                  </TabsList>

                  <TabsContent value="login" className="mt-0">
                    <div className="mb-6">
                      <h2 className="text-xl font-semibold text-gray-900 mb-2">Sign in to your account</h2>
                      <p className="text-sm text-gray-600">Welcome back! Please enter your details.</p>
                    </div>
                    <LoginForm 
                      mutation={loginMutation} 
                      onForgotPassword={() => setShowForgotPassword(true)}
                    />
                  </TabsContent>

                  <TabsContent value="register" className="mt-0">
                    <div className="mb-6">
                      <h2 className="text-xl font-semibold text-gray-900 mb-2">Create your account</h2>
                      <p className="text-sm text-gray-600">Start creating professional CIMs today!</p>
                    </div>
                    <RegisterForm mutation={registerMutation} />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoginForm({ mutation, onForgotPassword }: { mutation: any; onForgotPassword: () => void }) {
  const form = useForm<LoginFormData>({
    resolver: zodResolver(insertUserSchema),
    defaultValues: {
      email: "",
      password: "",
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
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel>Password</FormLabel>
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
              Logging in...
            </>
          ) : (
            "Login"
          )}
        </Button>
      </form>
    </Form>
  );
}

function RegisterForm({ mutation }: { mutation: any }) {
  const [captchaAnswer, setCaptchaAnswer] = useState<number>(0);
  const [captchaQuestion, setCaptchaQuestion] = useState<string>("");

  // Generate simple math captcha
  useEffect(() => {
    const num1 = Math.floor(Math.random() * 10) + 1;
    const num2 = Math.floor(Math.random() * 10) + 1;
    setCaptchaAnswer(num1 + num2);
    setCaptchaQuestion(`${num1} + ${num2} = ?`);
  }, []);

  const form = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      password: "",
      agreeToTerms: false,
      captcha: "",
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((data) => {
        // Validate captcha before submission
        if (parseInt(data.captcha) !== captchaAnswer) {
          form.setError("captcha", { message: "Incorrect answer" });
          return;
        }
        // Remove captcha from submission data
        const { captcha, ...submitData } = data;
        mutation.mutate(submitData);
      })} className="space-y-4">
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
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  placeholder="Choose a secure password (min. 8 characters)"
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
          name="captcha"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Security Check: {captchaQuestion}</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  placeholder="Enter the answer"
                  {...field}
                  onChange={(e) => {
                    field.onChange(e.target.value);
                    // Validate captcha answer
                    if (parseInt(e.target.value) !== captchaAnswer) {
                      form.setError("captcha", { message: "Incorrect answer" });
                    } else {
                      form.clearErrors("captcha");
                    }
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="agreeToTerms"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel className="text-sm font-normal">
                  I agree to the{" "}
                  <Link href="/eula">
                    <a className="text-primary hover:underline">Terms and Conditions</a>
                  </Link>
                </FormLabel>
                <FormMessage />
              </div>
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
              Creating account...
            </>
          ) : (
            "Create Account"
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