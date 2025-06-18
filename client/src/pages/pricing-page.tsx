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
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

export default function PricingPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [pricing, setPricing] = useState<any>(null);
  const [pricingLoading, setPricingLoading] = useState(true);
  const [pricingError, setPricingError] = useState<any>(null);

  // Fetch pricing data directly to bypass cache issues
  useEffect(() => {
    const fetchPricing = async () => {
      try {
        setPricingLoading(true);
        // Add timestamp to URL to force cache bypass
        const timestamp = Date.now();
        const response = await fetch(`/api/pricing?t=${timestamp}`, {
          cache: 'no-cache',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        const data = await response.json();
        // console.log("Fresh pricing data fetched:", data);
        setPricing(data);
        setPricingError(null);
      } catch (error) {
        console.error("Direct fetch error:", error);
        setPricingError(error);
      } finally {
        setPricingLoading(false);
      }
    };

    fetchPricing();
  }, []);

  const handleSubscriptionAction = async (planId?: string) => {
    try {
      if (planId === 'enterprise') {
        // For Enterprise plan, open contact form
        window.open('mailto:contact@cimshare.com?subject=Enterprise Plan Inquiry&body=I am interested in learning more about your Enterprise plan for unlimited CIM generation.', '_blank');
        return;
      }
      
      if (user?.subscriptionStatus !== "free") {
        // For existing subscribers, create a Customer Portal session
        const response = await apiRequest("POST", "/api/subscription/create-portal-session");
        const { url } = await response.json();
        window.location.href = url;
      }
    } catch (error) {
      console.error("Subscription action error:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to process subscription action",
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
      name: "Free Trial",
      price: "$0",
      description: "Try CIM Share with one document",
      features: [
        "1 CIM document (trial only)",
        "Basic templates",
        "Export to PDF and Word",
        "Professional analysis",
        "Email support",
      ],
      current: user?.subscriptionStatus === "free",
    },
    {
      name: "Standard",
      price: "$99/month",
      description: "Perfect for regular business use",
      features: [
        "3 CIM documents per month",
        "20 regenerations per month",
        "All templates",
        "Export to PDF and Word",
        "Priority support",
      ],
      current: user?.subscriptionStatus === "standard",
    },
    {
      name: "Enterprise",
      price: "Contact Us",
      description: "Unlimited enterprise solution",
      features: [
        "Unlimited CIM generation",
        "Unlimited regenerations",
        "Custom branding options",
        "Advanced export formats",
        "Dedicated support",
        "API access",
        "Team collaboration",
        "Custom integrations",
      ],
      current: user?.subscriptionStatus === "enterprise",
      isEnterprise: true
    },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold mb-4">Choose Your Plan</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Select the perfect plan for your business needs. Upgrade or downgrade at any time.
        </p>
        {/* Clear cache button for testing */}
        <div className="mt-4">
          <Button 
            onClick={() => {
              // Clear all caches and force hard refresh
              if ('caches' in window) {
                caches.keys().then(names => {
                  names.forEach(name => {
                    caches.delete(name);
                  });
                });
              }
              window.location.reload();
            }}
            variant="outline"
            size="sm"
          >
            Force Refresh Cache
          </Button>
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
                  onClick={() => handleSubscriptionAction(plan.name === 'Standard' ? 'standard' : plan.isEnterprise ? 'enterprise' : undefined)}
                >
                  {plan.isEnterprise ? 'Contact Us' : plan.name === 'Standard' ? 'Upgrade to Standard' : 'Get Started'}
                </Button>
              )}
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}