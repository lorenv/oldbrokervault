import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lock } from "lucide-react";

interface SubscriptionCardProps {
  status?: string;
  endsAt?: string | null;
}

export function SubscriptionCard({ status, endsAt }: SubscriptionCardProps) {
  const isPremium = status === "premium";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Subscription Status
          <Badge variant={isPremium ? "default" : "secondary"}>
            {status?.toUpperCase() || "FREE"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            {isPremium ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Your premium subscription is active until:
                </p>
                <p className="font-medium">
                  {endsAt ? new Date(endsAt).toLocaleDateString() : "N/A"}
                </p>
              </>
            ) : (
              <div className="flex items-center space-x-2 text-muted-foreground">
                <Lock className="h-4 w-4" />
                <span className="text-sm">
                  Upgrade to premium for unlimited CIM generation
                </span>
              </div>
            )}
          </div>

          <ul className="space-y-2 text-sm">
            <li className="flex items-center">
              ✓ {isPremium ? "Unlimited" : "3"} CIM documents per month
            </li>
            <li className="flex items-center">
              ✓ {isPremium ? "All export formats" : "Basic exports only"}
            </li>
            <li className="flex items-center">
              ✓ {isPremium ? "Priority" : "Standard"} support
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
