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
  subtle?: boolean;
}

export function SubscriptionCard({ status, endsAt, monthlyUsage = 0, subtle = false }: SubscriptionCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const isPremium = status === "premium";
  const isStandard = status === "standard";

  const getLimit = () => {
    switch (status) {
      case "premium":
        return 100;
      case "standard":
        return 10;
      default:
        return 1;
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
          <Badge variant={isPremium ? "default" : isStandard ? "secondary" : "outline"}>
            {status?.toUpperCase() || "FREE"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            {status !== "free" ? (
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

          <div className="space-y-2">
            <p className="text-sm font-medium">Usage This Month</p>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-primary rounded-full h-2"
                style={{
                  width: `${Math.min((monthlyUsage / getLimit()) * 100, 100)}%`,
                }}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              {monthlyUsage} / {getLimit()} CIMs generated
            </p>
          </div>

          {!isPremium && (
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
              ✓ {status === "premium" ? "Unlimited exports" : "PDF & Word exports"}
            </li>
            <li className="flex items-center">
              ✓ {status === "premium" ? "Priority support" : "Standard support"}
            </li>
            {status === "premium" && (
              <li className="flex items-center">
                ✓ Custom branding options
              </li>
            )}
          </ul>

          {status === "free" && (
            <div className="text-sm text-muted-foreground mt-4">
              <p>Upgrade to Premium for:</p>
              <ul className="list-disc pl-4 mt-2">
                <li>Generate up to 100 CIMs per month</li>
                <li>Custom branding options</li>
                <li>Priority support</li>
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}