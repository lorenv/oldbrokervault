import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { Check, Star, Zap, Shield, Users, Sparkles, Sprout } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

export default function PricingPage() {
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

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
        try {
          const response = await fetch('/api/config');
          const config = await response.json();
          const supportEmail = config.company?.supportEmail || 'contact@cimshare.com';
          
          window.open(`mailto:${supportEmail}?subject=Enterprise Plan Inquiry&body=I am interested in learning more about your Enterprise plan for unlimited CIM generation.`, '_blank');
        } catch (error) {
          // Fallback to hardcoded email if config fails
          window.open('mailto:contact@cimshare.com?subject=Enterprise Plan Inquiry&body=I am interested in learning more about your Enterprise plan for unlimited CIM generation.', '_blank');
        }
        return;
      }
      
      if (planId === 'starter' || planId === 'standard') {
        // Only authenticated users can create checkout sessions
        if (!user) {
          const planName = planId === 'starter' ? 'Starter plan' : 'Pro plan';
          toast({
            title: "Account Required",
            description: `Please sign up for an account to subscribe to the ${planName}.`,
            variant: "destructive",
          });
          return;
        }
        
        // For authenticated users, create a checkout session directly
        const response = await apiRequest("POST", "/api/subscription/create-checkout", {
          plan: planId
        });
        const { url } = await response.json();
        
        // Try to open in new tab, with fallback to same window
        const newWindow = window.open(url, '_blank');
        if (!newWindow || newWindow.closed || typeof newWindow.closed == 'undefined') {
          // Popup was blocked, fallback to same window
          window.location.href = url;
        }
        return;
      }
      
      if (user?.subscriptionStatus !== "free") {
        // For existing subscribers, create a Customer Portal session
        const response = await apiRequest("POST", "/api/subscription/create-portal-session");
        const { url } = await response.json();
        window.open(url, '_blank');
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

  // Debug: Log the actual subscription status
  console.log('[Pricing Page] User subscription status:', user?.subscriptionStatus);

  const plans = [
    {
      id: "free",
      name: "Free Trial",
      price: "$0",
      description: "Perfect for trying out CIM Share",
      features: [
        "1 CIM document (trial only)",
        "Basic export options",
        "Standard support",
        "7-day trial period",
      ],
      current: user?.subscriptionStatus === "free",
      icon: <Sparkles className="h-6 w-6" />,
      color: "border-slate-200",
      popular: false,
    },
    {
      id: "starter",
      name: "Starter Plan",
      price: "$599",
      priceLabel: "/year",
      description: "Perfect for individual professionals",
      features: [
        "3 CIM documents per year",
        "Unlimited regenerations",
        "PDF export",
        "NDA management & sharing",
        "E-signature templates",
        "Email support",
        "Custom branding options",
      ],
      current: user?.subscriptionStatus === "starter",
      icon: <Sprout className="h-6 w-6" />,
      color: "border-green-500",
      popular: false,
    },
    {
      id: "standard",
      name: "Pro Plan",
      price: "$999",
      priceLabel: "/year",
      description: "Everything you need for your business",
      features: [
        "10 CIM documents per year",
        "Unlimited regenerations",
        "PDF export",
        "NDA management & sharing",
        "E-signature templates",
        "Priority email support",
        "Custom branding options",
      ],
      current: user?.subscriptionStatus === "standard" || false,
      icon: <Zap className="h-6 w-6" />,
      color: "border-blue-500",
      popular: true,
      badge: "Most Popular",
    },
    {
      id: "enterprise",
      name: "Enterprise",
      price: "Custom",
      priceLabel: "pricing",
      description: "Tailored solutions for large organizations",
      features: [
        "Unlimited CIM documents",
        "Everything in Pro",
        "Dedicated account manager",
        "Custom integrations",
        "Advanced security features",
        "Team training sessions",
      ],
      current: user?.subscriptionStatus === "enterprise" || false,
      isEnterprise: true,
      icon: <Shield className="h-6 w-6" />,
      color: "border-purple-500",
      popular: false,
    },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <div className="container mx-auto px-4 py-16">
          <div className="text-center mb-10">
            <h1 className="text-4xl font-bold mb-4">Choose Your Plan</h1>
            <p className="text-xl text-muted-foreground">Loading pricing information...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="container mx-auto px-4 py-16">
        {/* Header Section */}
        <div className="text-center mb-16">
          <Badge className="mb-4" variant="secondary">
            <Star className="h-3 w-3 mr-1" />
            Pricing Plans
          </Badge>
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
            Choose Your Perfect Plan
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            {!user 
              ? "Start with our free trial and upgrade anytime. No credit card required to get started."
              : "Flexible pricing that scales with your business needs. Switch plans anytime."
            }
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto mb-16">
          {plans.map((plan, index) => (
            <div
              key={plan.name}
              className={cn(
                "relative transform transition-all duration-300 hover:scale-105",
                plan.popular && "md:-mt-4"
              )}
            >
              {plan.badge && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
                  <Badge className="px-3 py-1 text-sm font-semibold bg-gradient-to-r from-blue-600 to-blue-500 text-white border-0">
                    {plan.badge}
                  </Badge>
                </div>
              )}
              
              <Card className={cn(
                "relative overflow-hidden border-2 transition-all duration-300",
                plan.color,
                plan.current && "ring-2 ring-primary ring-offset-2",
                plan.popular && "shadow-2xl",
                "hover:shadow-xl"
              )}>
                {plan.current && (
                  <div className="absolute top-4 right-4">
                    <Badge variant="secondary" className="font-semibold">
                      Current Plan
                    </Badge>
                  </div>
                )}
                
                <CardHeader className="text-center pb-8 pt-6">
                  <div className="mb-4 flex justify-center">
                    {plan.icon}
                  </div>
                  <CardTitle className="text-2xl font-bold mb-2">{plan.name}</CardTitle>
                  <CardDescription className="text-base mb-4">{plan.description}</CardDescription>
                  <div className="mt-4">
                    <span className="text-5xl font-bold">{plan.price}</span>
                    {plan.priceLabel && (
                      <span className="text-muted-foreground text-lg ml-1">{plan.priceLabel}</span>
                    )}
                  </div>
                </CardHeader>
                
                <CardContent className="px-6 pb-6">
                  <ul className="space-y-3">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <div className="rounded-full p-1 bg-green-100 mt-0.5">
                          <Check className="h-3 w-3 text-green-600" />
                        </div>
                        <span className="text-sm text-slate-700">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                
                <CardFooter className="px-6 pb-6">
                  {!user ? (
                    <div className="w-full">
                      {plan.isEnterprise ? (
                        <Button 
                          className="w-full bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-white shadow-lg"
                          size="lg"
                          onClick={() => handleSubscriptionAction('enterprise')}
                        >
                          <Users className="mr-2 h-4 w-4" />
                          Contact Sales
                        </Button>
                      ) : plan.id === 'free' ? (
                        <Button 
                          className="w-full bg-gradient-to-r from-slate-600 to-slate-500 hover:from-slate-700 hover:to-slate-600 text-white shadow-lg"
                          size="lg"
                          onClick={() => window.location.href = '/login?tab=register'}
                        >
                          Start Free Trial
                        </Button>
                      ) : (
                        <Button 
                          className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white shadow-lg"
                          size="lg"
                          onClick={() => window.location.href = '/login?tab=register'}
                        >
                          Get Started
                        </Button>
                      )}
                    </div>
                  ) : plan.current ? (
                    <Button 
                      variant="outline" 
                      className="w-full"
                      size="lg"
                      disabled
                    >
                      Your Current Plan
                    </Button>
                  ) : plan.isEnterprise ? (
                    <Button 
                      className="w-full bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-white shadow-lg"
                      size="lg"
                      onClick={() => handleSubscriptionAction('enterprise')}
                    >
                      <Users className="mr-2 h-4 w-4" />
                      Contact Sales
                    </Button>
                  ) : plan.id === 'standard' ? (
                    <Button 
                      className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white shadow-lg"
                      size="lg"
                      onClick={() => handleSubscriptionAction('standard')}
                    >
                      Upgrade Now
                    </Button>
                  ) : (
                    <Button 
                      variant="outline"
                      className="w-full"
                      size="lg"
                      disabled
                    >
                      Current Plan
                    </Button>
                  )}
                </CardFooter>
              </Card>
            </div>
          ))}
        </div>

        {/* Features Comparison Section */}
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Why Choose CIM Share?</h2>
            <p className="text-lg text-muted-foreground">
              Trusted by businesses worldwide for professional CIM document generation
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16 max-w-2xl mx-auto">
            <div className="text-center">
              <div className="inline-flex p-3 rounded-full bg-blue-100 mb-4">
                <Zap className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="font-semibold mb-2">Lightning Fast</h3>
              <p className="text-sm text-muted-foreground">
                Generate professional CIMs in minutes, not hours
              </p>
            </div>
            <div className="text-center">
              <div className="inline-flex p-3 rounded-full bg-green-100 mb-4">
                <Shield className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="font-semibold mb-2">Bank-Level Security</h3>
              <p className="text-sm text-muted-foreground">
                Your data is encrypted and secure at all times
              </p>
            </div>
          </div>

          {/* FAQ or Contact Section */}
          <div className="bg-slate-50 rounded-2xl p-8 text-center">
            <h3 className="text-2xl font-bold mb-4">Need Help Choosing?</h3>
            <p className="text-muted-foreground mb-6">
              Our team is here to help you find the perfect plan for your business needs
            </p>
            <div className="flex gap-4 justify-center">
              <Button variant="outline" size="lg" onClick={() => window.location.href = '/contact'}>
                Contact Support
              </Button>
              {!user && (
                <Button size="lg" onClick={() => window.location.href = '/login?tab=register'}>
                  Start Free Trial
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}