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
  hideProButtons?: boolean; // New prop to hide buttons for Pro users
  hideActiveUntil?: boolean; // Hide the "active until" date
  hideRegenerations?: boolean; // Hide regenerations section
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
    <Card className="bg-white shadow-lg border border-gray-200 hover:shadow-xl transition-all duration-300 rounded-xl overflow-hidden">
      <CardHeader className="pb-4 pt-6 px-6 bg-slate-700 border-b border-slate-600">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 backdrop-blur-sm rounded-xl">
              <CreditCard className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold text-white">Subscription Status</CardTitle>
              <p className="text-white/90 mt-0.5 text-sm font-medium">
                {status === "admin" ? "Administrator account with unlimited access" :
                 status !== "free" ? "Your subscription details and usage" :
                 "Unlock unlimited potential"}
              </p>
            </div>
          </div>
          <Badge
            variant={status === "free" ? "secondary" : isCanceled ? "destructive" : "default"}
            className={`text-xs px-3 py-1.5 font-bold flex-shrink-0 shadow-sm ${
              status === "free" ? "bg-white/90 text-gray-700" :
              isCanceled ? "bg-red-100 text-red-700" :
              "bg-white/90 text-slate-700"
            }`}
          >
            {isCanceled ? "CANCELED" :
             status === "standard" ? "PRO" :
             status === "starter" ? "STARTER" :
             status === "free" ? "FREE" :
             status === "admin" ? "ADMIN" :
             status === "enterprise" ? "ENTERPRISE" :
             "FREE"}
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
            ) : status !== "free" && !hideActiveUntil ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Your {status} subscription is active until:
                </p>
                <p className="font-medium">
                  {endsAt ? new Date(endsAt).toLocaleDateString() : "N/A"}
                </p>
              </>
            ) : status === "free" ? (
              <div className="flex items-center space-x-2 text-muted-foreground">
                <Lock className="h-4 w-4" />
                <span className="text-sm">
                  Upgrade to generate more CIMs per month
                </span>
              </div>
            ) : null}
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-gray-700">Documents Created This Month</p>
              <div className="w-full bg-gray-200 rounded-full h-2.5 shadow-inner">
                <div
                  className="bg-blue-600 rounded-full h-2.5 transition-all duration-500"
                  style={{
                    width: `${getLimit() === "Unlimited" ? 0 : Math.min((monthlyDocumentsCreated / (getLimit() as number)) * 100, 100)}%`,
                  }}
                />
              </div>
              <p className="text-sm font-medium text-gray-600">
                {monthlyDocumentsCreated} / {getLimit()} documents created
              </p>
            </div>

            {!hideRegenerations && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-700">Regenerations Used This Month</p>
                <div className="w-full bg-gray-200 rounded-full h-2.5 shadow-inner">
                  <div
                    className="bg-slate-600 rounded-full h-2.5 transition-all duration-500"
                    style={{
                      width: `${getRegenerationLimit() === "Unlimited" ? 0 : Math.min((monthlyRegenerationsUsed / (getRegenerationLimit() as number)) * 100, 100)}%`,
                    }}
                  />
                </div>
                <p className="text-sm font-medium text-gray-600">
                  {monthlyRegenerationsUsed} / {getRegenerationLimit()} regenerations used
                </p>
              </div>
            )}
          </div>

          {!isPremium && !isAdmin && !isCanceled && !isStandard && (
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md hover:shadow-lg transition-all duration-200"
              size={subtle ? "sm" : "lg"}
              onClick={handleUpgrade}
            >
              {subtle ? "Upgrade Plan" : "Upgrade Subscription"}
            </Button>
          )}

          {(isPremium || isStandard || isCanceled) && !isAdmin &&
           !(hideProButtons && isStandard) && (
            <Button
              className={`w-full font-semibold shadow-md hover:shadow-lg transition-all duration-200 ${
                isCanceled
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "bg-slate-700 hover:bg-slate-800 text-white border-0"
              }`}
              size={subtle ? "sm" : "lg"}
              onClick={handleCustomerPortal}
              disabled={isLoading}
            >
              {isLoading ? "Loading..." : isCanceled ? "Reactivate Subscription" : "Change Your Plan"}
            </Button>
          )}

          

          {status === "free" && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
              <p className="text-sm font-semibold text-gray-800 mb-3">Unlock More with Premium:</p>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  <span><strong>Pro:</strong> 10 CIMs per month, unlimited regenerations</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-slate-600 font-bold">•</span>
                  <span><strong>Enterprise:</strong> Unlimited CIMs and regenerations</span>
                </li>
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}