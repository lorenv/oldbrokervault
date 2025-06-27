import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lock } from "lucide-react";
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Subscription Status
          <Badge variant={isAdmin ? "destructive" : isPremium ? "default" : isStandard ? "secondary" : "outline"}>
            {status?.toUpperCase() || "FREE"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
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
              className="w-full"
              variant={subtle ? "outline" : "default"}
              size={subtle ? "sm" : "default"}
              onClick={handleUpgrade}
            >
              {subtle ? "Upgrade Plan" : "Upgrade Subscription"}
            </Button>
          )}

          {(isPremium || isStandard) && !isAdmin && (
            <Button
              className="w-full"
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