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

  // Fetch dynamic pricing from Stripe
  const { data: pricing, isLoading: pricingLoading } = useQuery({
    queryKey: ["/api/pricing"],
  });

  const handleSubscriptionAction = async (checkoutLink?: string) => {
    try {
      if (user?.subscriptionStatus !== "free") {
        // For existing subscribers, create a Customer Portal session
        const response = await apiRequest("POST", "/api/subscription/create-portal-session");
        const { url } = await response.json();
        window.location.href = url;
      } else if (checkoutLink) {
        // For new subscriptions, go directly to Stripe checkout
        window.location.href = checkoutLink;
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
      price: "$500",
      description: "Professional CIM creation",
      features: [
        "Generate up to 10 CIMs per month",
        "Export to Word and PDF",
        "Advanced analysis",
        "Priority support",
        "Unlimited regenerations",
      ],
      current: user?.subscriptionStatus === "standard",
      checkoutLink: "https://buy.stripe.com/eVa9DA8cO86ugqA3ce"
    },
    {
      name: "Premium",
      price: "$1",
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
      checkoutLink: "https://buy.stripe.com/aEUg1YfFg1I65LW9AB"
    },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold mb-4">Choose Your Plan</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Select the perfect plan for your business needs. Upgrade or downgrade at any time.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
        {plans.map((plan) => (
          <Card key={plan.name} className={`flex flex-col ${plan.current ? 'border-primary' : ''}`}>
            <CardHeader>
              <CardTitle>{plan.name}</CardTitle>
              <CardDescription>{plan.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
              <div className="text-3xl font-bold mb-6">{plan.price}<span className="text-sm text-muted-foreground">/month</span></div>
              <ul className="space-y-2">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              {plan.current ? (
                <Button className="w-full" disabled>Current Plan</Button>
              ) : (
                <Button 
                  className="w-full" 
                  onClick={() => handleSubscriptionAction(plan.checkoutLink)}
                >
                  {user?.subscriptionStatus !== "free" ? "Change Plan" : "Upgrade"}
                </Button>
              )}
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}