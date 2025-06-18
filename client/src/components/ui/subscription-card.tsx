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
      default:
        return 3;
    }
  };

  const getRegenerationLimit = () => {
    switch (status) {
      case "admin":
      case "enterprise":
        return "Unlimited";
      default:
        return 9;
    }
  };

  const handleUpgrade = () => {
    window.location.href = "/pricing";
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

          <ul className="space-y-2 text-sm">
            <li className="flex items-center">
              ✓ {status === "premium" ? "Unlimited exports" : "PDF exports"}
            </li>
            <li className="flex items-center">
              ✓ {status === "premium" ? "Priority support" : "Standard support"}
            </li>
          </ul>

          {status === "free" && (
            <div className="text-sm text-muted-foreground mt-4">
              <p>Upgrade to Premium for:</p>
              <ul className="list-disc pl-4 mt-2">
                <li>Generate up to 100 CIMs per month</li>
                <li>Priority support</li>
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}