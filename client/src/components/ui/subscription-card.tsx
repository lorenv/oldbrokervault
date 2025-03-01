import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { loadStripe } from "@stripe/stripe-js";

interface SubscriptionCardProps {
  status?: string;
  endsAt?: string | null;
  monthlyUsage?: number;
}

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

export function SubscriptionCard({ status, endsAt, monthlyUsage = 0 }: SubscriptionCardProps) {
  const { toast } = useToast();
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

  const handleUpgrade = async (plan: string) => {
    try {
      setIsLoading(true);
      const response = await apiRequest("POST", "/api/subscription/create-checkout", { plan });
      const data = await response.json();

      const stripe = await stripePromise;
      if (!stripe) throw new Error("Stripe failed to load");

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("Invalid checkout session");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to initiate upgrade. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
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
            <div className="space-y-3">
              {status === "free" && (
                <Button
                  className="w-full"
                  onClick={() => handleUpgrade("standard")}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    "Processing..."
                  ) : (
                    "Upgrade to Standard - $500/month"
                  )}
                </Button>
              )}
              <Button
                className="w-full"
                onClick={() => handleUpgrade("premium")}
                disabled={isLoading}
              >
                {isLoading ? (
                  "Processing..."
                ) : (
                  "Upgrade to Premium - $4,000/month"
                )}
              </Button>
            </div>
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