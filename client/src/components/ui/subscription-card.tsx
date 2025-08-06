import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lock, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
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

  const getLimit = () => {
    switch (status) {
      case "admin":
      case "enterprise":
        return "Unlimited";
      case "standard":
        return 20;
      default:
        return 1; // Free trial
    }
  };

  const getRegenerationLimit = () => {
    switch (status) {
      case "admin":
      case "enterprise":
      case "standard":
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
    <Card className="border-0 shadow-xl bg-white/95 backdrop-blur-sm rounded-2xl overflow-hidden ring-1 ring-gray-200/50">
      <CardHeader className="bg-gradient-to-r from-emerald-600 to-emerald-700 pb-6 pt-8 px-8 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 backdrop-blur-sm rounded-xl shadow-sm">
              <CreditCard className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-white">Subscription Status</CardTitle>
              <p className="text-emerald-100 mt-1 text-sm">
                {status === "admin" ? "Administrator account with unlimited access" : 
                 status !== "free" ? "Your subscription details and usage" : 
                 "Upgrade to generate more CIMs per month"}
              </p>
            </div>
          </div>
          <Badge 
            variant="outline" 
            className={`${isAdmin ? "bg-red-500/20 text-red-100 border-red-400/50" : 
                        isPremium ? "bg-purple-500/20 text-purple-100 border-purple-400/50" : 
                        isStandard ? "bg-blue-500/20 text-blue-100 border-blue-400/50" : 
                        "bg-white/20 text-white border-white/30"}`}
          >
            {status?.toUpperCase() || "FREE"}
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

          {!isPremium && !isAdmin && (
            <Button
              className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white border-0 shadow-lg"
              size={subtle ? "sm" : "default"}
              onClick={handleUpgrade}
            >
              {subtle ? "Upgrade Plan" : "Upgrade Subscription"}
            </Button>
          )}

          {(isPremium || isStandard) && !isAdmin && (
            <Button
              className="w-full bg-white/20 hover:bg-white/30 text-emerald-700 border-emerald-600/50 shadow-lg"
              variant="outline"
              size={subtle ? "sm" : "default"}
              onClick={handleCustomerPortal}
              disabled={isLoading}
            >
              {isLoading ? "Loading..." : "Change your plan"}
            </Button>
          )}

          

          {status === "free" && (
            <div className="text-sm text-muted-foreground mt-4">
              <p>Upgrade for more CIM documents:</p>
              <ul className="list-disc pl-4 mt-2">
                <li>Standard: 20 CIMs per month, unlimited regenerations</li>
                <li>Enterprise: Unlimited CIMs and regenerations</li>
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}