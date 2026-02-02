import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface SubscriptionCardProps {
  status?: string;
  endsAt?: string | null;
  monthlyUsage?: number;
  monthlyDocumentsCreated?: number;
  monthlyRegenerationsUsed?: number;
  subtle?: boolean;
  hideProButtons?: boolean;
  hideActiveUntil?: boolean;
  hideRegenerations?: boolean;
}

export function SubscriptionCard({
  status,
  endsAt,
  monthlyUsage = 0,
  monthlyDocumentsCreated = 0,
  monthlyRegenerationsUsed = 0,
  subtle = false,
  hideProButtons = false,
  hideActiveUntil = false,
  hideRegenerations = false
}: SubscriptionCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Check if user has any paid plan status
  const isPaidPlan = status && ["starter", "starter_monthly", "pro", "pro_monthly", "standard", "premium", "enterprise"].includes(status);
  const isAdmin = status === "admin";
  const isCanceled = status === "canceled";
  const isFree = status === "free" || !status;

  const handleUpgrade = () => {
    window.location.href = "/pricing";
  };

  const handleCustomerPortal = async () => {
    setIsLoading(true);
    try {
      const response = await apiRequest("POST", "/api/subscription/create-portal-session");
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No portal URL received");
      }
    } catch (error) {
      toast({
        title: "Unable to open billing portal",
        description: error instanceof Error ? error.message : "Please try again or contact support if the issue persists.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getPlanName = () => {
    switch (status) {
      case "pro":
      case "pro_monthly":
      case "standard":
        return "Pro";
      case "starter":
      case "starter_monthly":
        return "Starter";
      case "enterprise":
        return "Enterprise";
      case "admin":
        return "Admin";
      case "canceled":
        return "Canceled";
      default:
        return "Free";
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-gray-900">Subscription</CardTitle>
            <CardDescription>
              {isAdmin ? "Administrator account with unlimited access" :
               isPaidPlan ? "Unlimited CIM documents & features" :
               "Manage your subscription plan"}
            </CardDescription>
          </div>
          <Badge
            variant={isFree ? "secondary" : isCanceled ? "destructive" : "default"}
            className={`${
              isFree ? "bg-gray-100 text-gray-700" :
              isCanceled ? "bg-red-100 text-red-700" :
              "bg-blue-100 text-blue-700"
            }`}
          >
            {getPlanName()}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isCanceled && (
          <Alert className="border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertTitle className="text-red-900">Subscription Canceled</AlertTitle>
            <AlertDescription className="text-red-700">
              Your subscription has been canceled but you will maintain full access until{" "}
              {endsAt ? new Date(endsAt).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric'
              }) : "the end of your billing period"}.
            </AlertDescription>
          </Alert>
        )}

        {!isFree && !hideActiveUntil && !isCanceled && endsAt && (
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-gray-600">Next billing date</span>
            <span className="font-medium text-gray-900">
              {new Date(endsAt).toLocaleDateString()}
            </span>
          </div>
        )}

        {isFree && (
          <div className="flex items-center justify-between py-2 border-b">
            <span className="text-sm text-gray-600">CIM documents</span>
            <span className="font-medium text-gray-900">
              {monthlyDocumentsCreated} / 1
            </span>
          </div>
        )}

        {isPaidPlan && (
          <div className="flex items-center gap-2 py-2 text-green-600">
            <Zap className="h-4 w-4" />
            <span className="text-sm font-medium">Unlimited CIM documents</span>
          </div>
        )}

        {isFree && !isAdmin && (
          <Button
            className="w-full"
            onClick={handleUpgrade}
          >
            <Zap className="h-4 w-4 mr-2" />
            Upgrade Plan
          </Button>
        )}

        {(isPaidPlan || isCanceled) && !isAdmin &&
         !(hideProButtons && (status === "standard" || status === "pro" || status === "pro_monthly")) && (
          <Button
            variant={isCanceled ? "default" : "outline"}
            className="w-full"
            onClick={handleCustomerPortal}
            disabled={isLoading}
          >
            {isLoading ? "Loading..." : isCanceled ? "Reactivate Subscription" : "Manage Subscription"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
