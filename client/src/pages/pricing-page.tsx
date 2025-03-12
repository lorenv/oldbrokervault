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

export default function PricingPage() {
  const { user } = useAuth();
  const { toast } = useToast();

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
      price: "$49",
      description: "Professional CIM creation",
      features: [
        "Generate up to 10 CIMs per month",
        "Export to Word and PDF",
        "Advanced analysis",
        "Priority support",
        "Unlimited regenerations",
      ],
      current: user?.subscriptionStatus === "standard",
    },
    {
      name: "Premium",
      price: "$99",
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
    },
  ];

  const handleUpgrade = async (planName: string) => {
    try {
      window.location.href = planName === "standard" 
        ? `/api/create-subscription?priceId=${process.env.STRIPE_PRICE_ID_STANDARD}`
        : `/api/create-subscription?priceId=${process.env.STRIPE_PRICE_ID_PREMIUM}`;
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to initiate upgrade. Please try again.",
        variant: "destructive",
      });
    }
  };

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
              ) : user?.subscriptionStatus !== "free" ? (
                <Button 
                  className="w-full" 
                  onClick={() => window.location.href = "https://billing.stripe.com/p/login/test"}
                >
                  Manage Subscription
                </Button>
              ) : (
                <Button 
                  className="w-full" 
                  onClick={() => handleUpgrade(plan.name.toLowerCase())}
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
