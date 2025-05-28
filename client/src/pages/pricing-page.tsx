import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";

export default function PricingPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  // Fetch dynamic pricing from Stripe with proper error handling
  const { data: pricing, isLoading: pricingLoading, error: pricingError } = useQuery({
    queryKey: ["/api/pricing"],
  });

  const handleSubscriptionAction = async (planId?: string) => {
    try {
      if (user?.subscriptionStatus !== "free") {
        // For existing subscribers, create a Customer Portal session
        const response = await apiRequest("POST", "/api/subscription/create-portal-session");
        const { url } = await response.json();
        window.location.href = url;
      } else if (planId) {
        // For new subscriptions, create a checkout session with the plan
        const response = await apiRequest("POST", "/api/subscription/create-checkout", { plan: planId });
        const { url } = await response.json();
        window.location.href = url;
      }
    } catch (error) {
      console.error("Subscription action error:", error);
      toast({
        title: "Error",
        description: "Failed to process subscription request. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Show loading state while fetching pricing
  if (pricingLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">Loading Pricing...</h1>
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
        </div>
      </div>
    );
  }

  // Show error state if pricing fetch failed
  if (pricingError || !pricing) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">Pricing Unavailable</h1>
          <p className="text-red-500 mb-4">
            Unable to load current pricing from Stripe.
          </p>
          <p className="text-sm text-muted-foreground">
            Error: {pricingError?.message || "Failed to fetch pricing data"}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Pricing data received: {JSON.stringify(pricing)}
          </p>
          <Button 
            onClick={() => window.location.reload()} 
            className="mt-4"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const plans = [
    {
      name: "Free",
      price: "$0",
      description: "Basic CIM generation",
      features: [
        "Generate up to 3 CIMs per month",
        "Basic export options",
        "Standard analysis",
        "Email support",
      ],
      current: user?.subscriptionStatus === "free",
    },
    {
      name: "Standard", 
      price: `$${pricing.standard?.amount || 'Error'}`,
      description: "Professional CIM creation",
      features: [
        "Generate up to 10 CIMs per month",
        "Export to Word and PDF",
        "Advanced analysis",
        "Priority support",
        "Unlimited regenerations",
      ],
      current: user?.subscriptionStatus === "standard",
      planId: "standard"
    },
    {
      name: "Premium",
      price: `$${pricing.premium?.amount || 'Error'}`,
      description: "Enterprise-grade solution",
      features: [
        "Unlimited CIM generation",
        "Custom branding options",
        "Advanced export formats",
        "Dedicated support",
        "API access",
        "Team collaboration",
      ],
      current: user?.subscriptionStatus === "premium",
      planId: "premium"
    },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold mb-4">Choose Your Plan</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Select the perfect plan for your business needs. Upgrade or downgrade at any time.
        </p>
        {/* Debug info - always show for now */}
        <div className="mt-4 p-4 bg-gray-100 rounded text-sm">
          <p>Debug - Pricing data: {JSON.stringify(pricing)}</p>
          <p>Standard amount: {pricing?.standard?.amount}</p>
          <p>Premium amount: {pricing?.premium?.amount}</p>
          <p>Type of pricing: {typeof pricing}</p>
          <p>Keys in pricing: {pricing ? Object.keys(pricing).join(', ') : 'none'}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {plans.map((plan) => (
          <Card key={plan.name} className={`relative ${plan.current ? 'ring-2 ring-primary' : ''}`}>
            {plan.current && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <span className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm font-medium">
                  Current Plan
                </span>
              </div>
            )}
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">{plan.name}</CardTitle>
              <CardDescription>{plan.description}</CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold">{plan.price}</span>
                <span className="text-muted-foreground">/month</span>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              {plan.current ? (
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => handleSubscriptionAction()}
                >
                  Current Plan
                </Button>
              ) : (
                <Button 
                  className="w-full"
                  onClick={() => handleSubscriptionAction(plan.planId)}
                >
                  Upgrade
                </Button>
              )}
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}