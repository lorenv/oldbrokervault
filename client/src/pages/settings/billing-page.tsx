import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { SubscriptionCard } from "@/components/ui/subscription-card";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PageHeader } from "@/components/layout/page-header";
import { CreditCard } from "lucide-react";

export default function BillingPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

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

        // Update URL to remove session_id
        window.history.replaceState({}, '', '/settings/billing');
      } else {
        throw new Error(data.error || "Failed to verify subscription");
      }
    } catch (error) {
      toast({
        title: "Subscription Verification Failed",
        description: `Error: ${error instanceof Error ? error.message : 'Unknown error'}. Please check console for details.`,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="px-4 md:px-6 py-4 md:py-6 overflow-x-hidden">
      <PageHeader
        title="Billing & Subscription"
        description="Manage your subscription plan and billing details"
        icon={<CreditCard className="h-5 w-5" />}
      />

      <div className="max-w-4xl">
        <SubscriptionCard
        status={user?.subscriptionStatus}
        endsAt={user?.subscriptionEndsAt ? new Date(user.subscriptionEndsAt).toISOString() : null}
        monthlyUsage={user?.monthlyUsage}
        monthlyDocumentsCreated={user?.monthlyDocumentsCreated}
        monthlyRegenerationsUsed={user?.monthlyRegenerationsUsed}
        />
      </div>
    </div>
  );
}
