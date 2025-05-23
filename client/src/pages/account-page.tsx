import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

const profileSchema = z.object({
  email: z.string().email("Invalid email address"),
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters").optional(),
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
      console.error("Subscription action error:", error);
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
      console.log("Verifying session:", sessionId);
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
      console.error("Stripe session verification error:", error);
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
      email: user?.email || "",
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof profileSchema>) => {
    setIsUpdating(true);
    try {
      const res = await apiRequest("POST", "/api/user/update", values);
      if (!res.ok) throw new Error("Failed to update profile");

      toast({
        title: "Profile Updated",
        description: "Your profile has been updated successfully",
      });

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

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
            <CardDescription>Update your email and password</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
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
                        <Input {...field} type="password" />
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
                      <FormLabel>New Password (Optional)</FormLabel>
                      <FormControl>
                        <Input {...field} type="password" />
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
                        <Input {...field} type="password" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" disabled={isUpdating}>
                  {isUpdating ? "Updating..." : "Update Profile"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <SubscriptionCard 
          status={user?.subscriptionStatus} 
          endsAt={user?.subscriptionEndsAt} 
          monthlyUsage={user?.monthlyUsage}
        />
      </div>
    </div>
  );
}