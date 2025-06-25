import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useState, useEffect } from "react";

export default function PricingPage() {
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [email, setEmail] = useState("");

  // Try to get user data with fallback for database issues
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const response = await fetch('/api/user', { 
          credentials: 'include',
          signal: AbortSignal.timeout(5000) // 5 second timeout
        });
        
        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
        }
      } catch (error) {
        console.log('User data unavailable, showing pricing without user context');
        // Don't show error to user, just continue without user data
      } finally {
        setIsLoading(false);
      }
    };

    loadUserData();
  }, []);

  const handleSubscriptionAction = async (planId?: string) => {
    try {
      if (planId === 'enterprise') {
        // For Enterprise plan, open contact form
        window.open('mailto:contact@cimshare.com?subject=Enterprise Plan Inquiry&body=I am interested in learning more about your Enterprise plan for unlimited CIM generation.', '_blank');
        return;
      }
      
      if (planId === 'standard') {
        // For Standard plan, create a checkout session
        const response = await apiRequest("POST", "/api/subscription/create-checkout", {
          plan: 'standard'
        });
        const { url } = await response.json();
        window.location.href = url;
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

  const plans = [
    {
      name: "Free Trial",
      price: "$0",
      description: "Try CIM Share with full features",
      features: [
        "1 CIM document (trial only)",
      ],
      current: user?.subscriptionStatus === "free" || false,
    },
    {
      name: "Standard",
      price: "$99",
      priceLabel: "/month",
      description: "Perfect for regular business use",
      features: [
        "3 CIM documents per month",
        "20 regenerations per month",
        "PDF export",
        "Advanced analytics and search",
        "NDA management and sharing",
        "E-signature templates",
        "Priority support",
      ],
      current: user?.subscriptionStatus === "standard" || false,
    },
    {
      name: "Enterprise",
      price: "Contact Us",
      priceLabel: "",
      description: "Unlimited enterprise solution",
      features: [
        "Everything in Standard",
        "Custom CIM generation allowance",
        "Unlimited regenerations",
        "Custom branding options",
        "Dedicated support",
        "Custom integrations",
      ],
      current: user?.subscriptionStatus === "enterprise" || false,
      isEnterprise: true
    },
  ];

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold mb-4">Choose Your Plan</h1>
          <p className="text-xl text-muted-foreground">Loading pricing information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold mb-4">Choose Your Plan</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Select the perfect plan for your business needs. Upgrade or downgrade at any time.
        </p>
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
                <span className="text-muted-foreground">{plan.priceLabel || "/month"}</span>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
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