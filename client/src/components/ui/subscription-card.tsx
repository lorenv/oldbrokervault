import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lock, CreditCard, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";

interface SubscriptionCardProps {
  status?: string;
  endsAt?: string | null;
  monthlyUsage?: number;
  monthlyDocumentsCreated?: number;
  monthlyRegenerationsUsed?: number;
  subtle?: boolean;
}

export function SubscriptionCard({ 
  status, 
  endsAt, 
  monthlyUsage = 0, 
  monthlyDocumentsCreated = 0, 
  monthlyRegenerationsUsed = 0, 
  subtle = false 
}: SubscriptionCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const isPremium = status === "premium";
  const isStandard = status === "standard";
  const isAdmin = status === "admin";
  const isCanceled = status === "canceled";

  const getLimit = () => {
    switch (status) {
      case "admin":
      case "enterprise":
        return "Unlimited";
      case "standard":
      case "canceled": // Canceled subscriptions maintain access until end date
        return 10;
      case "starter":
        return 3;
      default:
        return 1; // Free trial
    }
  };

  const getRegenerationLimit = () => {
    switch (status) {
      case "admin":
      case "enterprise":
      case "standard":
      case "canceled": // Canceled subscriptions maintain access until end date
        return "Unlimited";
      default:
        return 2; // Free trial
    }
  };

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
      }
    } catch (error) {
      console.error("Error accessing customer portal:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="bg-white/95 backdrop-blur-sm shadow-lg border border-gray-200/50 hover:shadow-xl transition-all duration-200 rounded-xl">
      <CardHeader className="pb-4 pt-6 px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <CreditCard className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold text-gray-900">Subscription Status</CardTitle>
              <p className="text-gray-600 mt-1 text-sm">
                {status === "admin" ? "Administrator account with unlimited access" : 
                 status !== "free" ? "Your subscription details and usage" : 
                 "Upgrade to generate more CIMs per month"}
              </p>
            </div>
          </div>
          <Badge
            variant={status === "free" ? "secondary" : isCanceled ? "destructive" : "default"}
            className="text-xs"
          >
            {isCanceled ? "CANCELED" :
             status === "standard" ? "PRO" :
             status === "starter" ? "STARTER" :
             status === "free" ? "FREE TRIAL" :
             status === "admin" ? "ADMIN" :
             status === "enterprise" ? "ENTERPRISE" :
             "FREE TRIAL"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-8">
        <div className="space-y-4">
          <div>
            {status === "admin" ? (
              <div className="text-sm text-muted-foreground">
                <p>Administrator account with unlimited access to all features</p>
              </div>
            ) : isCanceled ? (
              <div className="space-y-3">
                <Alert className="border-amber-200 bg-amber-50">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <AlertTitle className="text-amber-900">Subscription Canceled</AlertTitle>
                  <AlertDescription className="text-amber-700">
                    Your subscription has been canceled but you will maintain full access to all Pro plan features until the end of your current billing period. You can reactivate your subscription at any time before it expires.
                  </AlertDescription>
                </Alert>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-sm text-muted-foreground font-medium mb-1">
                    Full access continues until:
                  </p>
                  <p className="font-semibold text-lg text-gray-900">
                    {endsAt ? new Date(endsAt).toLocaleDateString('en-US', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    }) : "N/A"}
                  </p>
                  {endsAt && (
                    <p className="text-sm text-muted-foreground mt-1">
                      ({Math.ceil((new Date(endsAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days remaining)
                    </p>
                  )}
                </div>
              </div>
            ) : status !== "free" ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Your {status} subscription is active until:
                </p>
                <p className="font-medium">
                  {endsAt ? new Date(endsAt).toLocaleDateString() : "N/A"}
                </p>
              </>
            ) : (
              <div className="flex items-center space-x-2 text-muted-foreground">
                <Lock className="h-4 w-4" />
                <span className="text-sm">
                  Upgrade to generate more CIMs per month
                </span>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="space-y-2">
              <p className="text-sm font-medium">Documents Created This Month</p>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary rounded-full h-2"
                  style={{
                    width: `${getLimit() === "Unlimited" ? 0 : Math.min((monthlyDocumentsCreated / (getLimit() as number)) * 100, 100)}%`,
                  }}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                {monthlyDocumentsCreated} / {getLimit()} documents created
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Regenerations Used This Month</p>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-secondary rounded-full h-2"
                  style={{
                    width: `${getRegenerationLimit() === "Unlimited" ? 0 : Math.min((monthlyRegenerationsUsed / (getRegenerationLimit() as number)) * 100, 100)}%`,
                  }}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                {monthlyRegenerationsUsed} / {getRegenerationLimit()} regenerations used
              </p>
            </div>
          </div>

          {!isPremium && !isAdmin && !isCanceled && (
            <Button
              className="w-full"
              size={subtle ? "sm" : "default"}
              onClick={handleUpgrade}
            >
              {subtle ? "Upgrade Plan" : "Upgrade Subscription"}
            </Button>
          )}

          {(isPremium || isStandard || isCanceled) && !isAdmin && (
            <Button
              className="w-full"
              variant={isCanceled ? "default" : "outline"}
              size={subtle ? "sm" : "default"}
              onClick={handleCustomerPortal}
              disabled={isLoading}
            >
              {isLoading ? "Loading..." : isCanceled ? "Reactivate Subscription" : "Change your plan"}
            </Button>
          )}

          

          {status === "free" && (
            <div className="text-sm text-muted-foreground mt-4">
              <p>Upgrade for more CIM documents:</p>
              <ul className="list-disc pl-4 mt-2">
                <li>Pro: 20 CIMs per month, unlimited regenerations</li>
                <li>Enterprise: Unlimited CIMs and regenerations</li>
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}