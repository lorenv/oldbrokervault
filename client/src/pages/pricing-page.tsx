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
import { Check, Star, Zap, Shield, Users, Sparkles, Minus, Calculator, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
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
import { Slider } from "@/components/ui/slider";
import { SEOHead } from "@/components/seo-head";

// Pricing constants
const PRO_MONTHLY_PRICE = 59;
const PRO_ANNUAL_PRICE = 49; // Pay for 10 months, get 12

export default function PricingPage() {
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "annual">("annual");
  const [showSignupModal, setShowSignupModal] = useState(false);

  // Calculator state
  const [proSeats, setProSeats] = useState(3);
  const [viewerSeats, setViewerSeats] = useState(2);

  // Try to get user data with fallback for database issues
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const response = await fetch('/api/user', {
          credentials: 'include',
          signal: AbortSignal.timeout(5000)
        });

        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
        }
      } catch (error) {
      } finally {
        setIsLoading(false);
      }
    };

    loadUserData();
  }, []);

  const handleSubscriptionAction = async (planId?: string) => {
    try {
      if (planId === 'enterprise') {
        if (window.lintrk) {
          window.lintrk('track', { conversion_id: 21789796 });
        }

        try {
          const response = await fetch('/api/config');
          const config = await response.json();
          const supportEmail = config.company?.supportEmail || 'contact@cimshare.com';
          window.open(`mailto:${supportEmail}?subject=Enterprise Plan Inquiry&body=I am interested in learning more about your Enterprise plan.`, '_blank');
        } catch (error) {
          window.open('mailto:contact@cimshare.com?subject=Enterprise Plan Inquiry&body=I am interested in learning more about your Enterprise plan.', '_blank');
        }
        return;
      }

      if (planId === 'pro' || planId === 'pro_monthly') {
        if (window.lintrk) {
          window.lintrk('track', { conversion_id: 21789788 });
        }

        if (!user) {
          toast({
            title: "Account Required",
            description: "Please sign up for an account to subscribe to the Pro plan.",
            variant: "destructive",
          });
          return;
        }

        const response = await apiRequest("POST", "/api/subscription/create-checkout", {
          body: { plan: planId }
        });
        const { url } = await response.json();

        const newWindow = window.open(url, '_blank');
        if (!newWindow || newWindow.closed || typeof newWindow.closed == 'undefined') {
          window.location.href = url;
        }
        return;
      }

      if (user?.subscriptionStatus !== "free") {
        const response = await apiRequest("POST", "/api/subscription/create-portal-session");
        const { url } = await response.json();
        window.open(url, '_blank');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to process subscription action",
        variant: "destructive",
      });
    }
  };

  // Calculate pricing
  const pricePerSeat = billingPeriod === "monthly" ? PRO_MONTHLY_PRICE : PRO_ANNUAL_PRICE;
  const monthlyTotal = proSeats * pricePerSeat;
  const annualTotal = monthlyTotal * (billingPeriod === "monthly" ? 12 : 10); // Pay for 10, get 12
  const annualSavings = billingPeriod === "annual" ? proSeats * PRO_MONTHLY_PRICE * 2 : 0; // 2 months free

  // Competitor pricing calculations
  const hubspotCost = proSeats * 90; // $90/seat
  const salesforceCost = proSeats * 75; // $75/seat
  // Tupelo: $400 for 2 users, $75/seat after 3
  const tupeloCost = proSeats <= 2 ? 400 : 400 + Math.max(0, proSeats - 3) * 75;

  const hubspotSavings = Math.round(((hubspotCost - monthlyTotal) / hubspotCost) * 100);
  const salesforceSavings = Math.round(((salesforceCost - monthlyTotal) / salesforceCost) * 100);
  const tupeloSavings = Math.round(((tupeloCost - monthlyTotal) / tupeloCost) * 100);

  const plans = [
    {
      id: "free",
      name: "Free",
      price: "$0",
      description: "Try out CIM Share with limited features",
      features: [
        { text: "1 user", included: true },
        { text: "1 CIM document", included: true },
        { text: "100 contacts", included: true },
        { text: "10 deals", included: true },
        { text: "Basic CRM features", included: true },
        { text: "Email sync", included: false },
        { text: "Team collaboration", included: false },
      ],
      current: user?.subscriptionStatus === "free",
      icon: <Sparkles className="h-6 w-6" />,
      color: "border-slate-200",
      popular: false,
    },
    {
      id: billingPeriod === "monthly" ? "pro_monthly" : "pro",
      name: "Pro",
      price: `$${pricePerSeat}`,
      priceLabel: "/seat/month",
      description: "Everything you need to grow your business",
      features: [
        { text: "Unlimited CIM documents", included: true },
        { text: "Unlimited contacts & deals", included: true },
        { text: "Full CRM with pipeline", included: true },
        { text: "Email sync & tracking", included: true },
        { text: "Unlimited eSignatures", included: true },
        { text: "Free Viewer seats (read-only)", included: true, highlight: true },
        { text: "Priority support", included: true },
      ],
      current: user?.subscriptionStatus === "pro" || user?.subscriptionStatus === "pro_monthly" || user?.subscriptionStatus === "standard",
      icon: <Zap className="h-6 w-6" />,
      color: "border-blue-500",
      popular: true,
      badge: "Most Popular",
      subtext: billingPeriod === "annual" ? "Pay for 10 months, get 12" : null,
    },
    {
      id: "enterprise",
      name: "Enterprise",
      price: "Custom",
      priceLabel: "pricing",
      description: "For larger teams with advanced needs",
      features: [
        { text: "Everything in Pro", included: true },
        { text: "10+ seat minimum", included: true },
        { text: "SSO / SAML authentication", included: true },
        { text: "API access", included: true },
        { text: "Custom integrations", included: true },
        { text: "Dedicated account manager", included: true },
        { text: "Custom training sessions", included: true },
      ],
      current: user?.subscriptionStatus === "enterprise",
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
            <h1 className="text-4xl font-bold mb-4 text-gray-900">Choose Your Plan</h1>
            <p className="text-xl text-gray-600">Loading pricing information...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <SEOHead
        title="Pricing - CIM Share Plans & Pricing"
        description="Simple, transparent pricing. $59/seat/month for full CRM, unlimited CIMs, and free viewer seats. Compare and save vs HubSpot and Salesforce."
        canonicalUrl="https://cimshare.com/pricing"
      />
      <div className="container mx-auto px-4 py-16">
        {/* Header Section */}
        <div className="text-center mb-12">
          <Badge className="mb-4" variant="secondary">
            <Star className="h-3 w-3 mr-1" />
            Simple Pricing
          </Badge>
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
            One Price. No Surprises.
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8">
            $59/seat/month for Pro. Add free Viewer seats for read-only access.
            <br />Scale your team without complex tier calculations.
          </p>

          {/* Billing Toggle */}
          <div className="flex flex-col items-center justify-center gap-2 mb-8">
            <div className="flex items-center justify-center gap-3">
              <span
                className={`text-sm font-medium transition-colors ${
                  billingPeriod === "monthly" ? "text-gray-900" : "text-gray-500"
                }`}
              >
                Monthly
              </span>
              <button
                onClick={() => setBillingPeriod(billingPeriod === "monthly" ? "annual" : "monthly")}
                className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  billingPeriod === "annual" ? "bg-blue-600" : "bg-gray-200"
                }`}
                role="switch"
                aria-checked={billingPeriod === "annual"}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform ${
                    billingPeriod === "annual" ? "translate-x-8" : "translate-x-1"
                  }`}
                />
              </button>
              <span
                className={`text-sm font-medium transition-colors ${
                  billingPeriod === "annual" ? "text-gray-900" : "text-gray-500"
                }`}
              >
                Annual
              </span>
            </div>
            {billingPeriod === "annual" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">
                <Check className="h-3 w-3" />
                Pay for 10 months, get 12 (2 months free!)
              </span>
            )}
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-16">
          {plans.map((plan) => (
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
                "relative overflow-hidden border-2 transition-all duration-300 h-full",
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

                <CardHeader className="text-center pb-6 pt-6">
                  <div className="mb-4 flex justify-center">
                    {plan.icon}
                  </div>
                  <CardTitle className="text-2xl font-bold mb-2 text-gray-900">{plan.name}</CardTitle>
                  <CardDescription className="text-base mb-4 text-gray-600">{plan.description}</CardDescription>
                  <div className="mt-4">
                    <div>
                      <span className="text-5xl font-bold text-gray-900">{plan.price}</span>
                      {plan.priceLabel && (
                        <span className="text-gray-600 text-lg ml-1">{plan.priceLabel}</span>
                      )}
                    </div>
                    {plan.subtext && (
                      <p className="text-xs text-green-600 font-medium mt-1">{plan.subtext}</p>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="px-6 pb-6">
                  <ul className="space-y-3">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <div className={`rounded-full p-1 mt-0.5 ${
                          feature.included
                            ? feature.highlight ? 'bg-blue-100' : 'bg-green-100'
                            : 'bg-gray-100'
                        }`}>
                          {feature.included ? (
                            <Check className={`h-3 w-3 ${feature.highlight ? 'text-blue-600' : 'text-green-600'}`} />
                          ) : (
                            <Minus className="h-3 w-3 text-gray-400" />
                          )}
                        </div>
                        <span className={`text-sm ${
                          feature.included
                            ? feature.highlight ? 'font-semibold text-blue-700' : 'text-gray-700'
                            : 'text-gray-400 line-through'
                        }`}>
                          {feature.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>

                <CardFooter className="px-6 pb-6 mt-auto">
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
                          onClick={() => setShowSignupModal(true)}
                        >
                          Start Free
                        </Button>
                      ) : (
                        <Button
                          className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white shadow-lg"
                          size="lg"
                          onClick={() => setShowSignupModal(true)}
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
                      Current Plan
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
                  ) : plan.id === 'free' ? (
                    <Button
                      variant="outline"
                      className="w-full"
                      size="lg"
                      disabled
                    >
                      —
                    </Button>
                  ) : (
                    <Button
                      className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white shadow-lg"
                      size="lg"
                      onClick={() => handleSubscriptionAction(plan.id)}
                    >
                      Upgrade to Pro
                    </Button>
                  )}
                </CardFooter>
              </Card>
            </div>
          ))}
        </div>

        {/* Viewer Seats Explanation */}
        <div className="max-w-3xl mx-auto mb-16">
          <Card className="border-blue-200 bg-blue-50/50">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="rounded-full bg-blue-100 p-3">
                  <Eye className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-gray-900 mb-1">Free Viewer Seats</h3>
                  <p className="text-gray-700">
                    Add unlimited Viewer seats at no extra cost. Viewers can see all CRM data but cannot edit, create,
                    delete, or export. Perfect for executives, investors, or stakeholders who need visibility without
                    full access.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pricing Calculator */}
        <div className="max-w-4xl mx-auto mb-16">
          <div className="text-center mb-8">
            <Badge className="mb-4" variant="outline">
              <Calculator className="h-3 w-3 mr-1" />
              Pricing Calculator
            </Badge>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Calculate Your Cost</h2>
            <p className="text-gray-600">See exactly what you'll pay and compare to competitors</p>
          </div>

          <Card className="border-2">
            <CardContent className="p-8">
              <div className="grid md:grid-cols-2 gap-8">
                {/* Left: Inputs */}
                <div className="space-y-6">
                  <div>
                    <Label className="text-base font-medium text-gray-900 mb-3 block">
                      Pro seats (full access)
                    </Label>
                    <div className="flex items-center gap-4">
                      <Slider
                        value={[proSeats]}
                        onValueChange={(value) => setProSeats(value[0])}
                        min={1}
                        max={25}
                        step={1}
                        className="flex-1"
                      />
                      <div className="w-16">
                        <Input
                          type="number"
                          value={proSeats}
                          onChange={(e) => setProSeats(Math.max(1, Math.min(25, parseInt(e.target.value) || 1)))}
                          className="text-center font-semibold"
                          min={1}
                          max={25}
                        />
                      </div>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">${pricePerSeat}/seat/month</p>
                  </div>

                  <div>
                    <Label className="text-base font-medium text-gray-900 mb-3 block">
                      Viewer seats (read-only)
                    </Label>
                    <div className="flex items-center gap-4">
                      <Slider
                        value={[viewerSeats]}
                        onValueChange={(value) => setViewerSeats(value[0])}
                        min={0}
                        max={50}
                        step={1}
                        className="flex-1"
                      />
                      <div className="w-16">
                        <Input
                          type="number"
                          value={viewerSeats}
                          onChange={(e) => setViewerSeats(Math.max(0, Math.min(50, parseInt(e.target.value) || 0)))}
                          className="text-center font-semibold"
                          min={0}
                          max={50}
                        />
                      </div>
                    </div>
                    <p className="text-sm text-green-600 font-medium mt-1">Always free!</p>
                  </div>

                  <div className="pt-4 border-t">
                    <div className="text-sm text-gray-600 mb-1">Total team size</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {proSeats + viewerSeats} users
                    </div>
                    <div className="text-sm text-gray-500">
                      {proSeats} Pro + {viewerSeats} Viewer
                    </div>
                  </div>
                </div>

                {/* Right: Summary */}
                <div className="bg-gradient-to-br from-blue-50 to-slate-50 rounded-xl p-6">
                  <div className="text-center mb-6">
                    <div className="text-sm text-gray-600 mb-1">Your {billingPeriod} cost</div>
                    <div className="text-5xl font-bold text-gray-900">
                      ${monthlyTotal.toLocaleString()}
                      <span className="text-xl font-normal text-gray-600">/mo</span>
                    </div>
                    {billingPeriod === "annual" && (
                      <>
                        <div className="text-sm text-gray-600 mt-2">
                          ${annualTotal.toLocaleString()}/year (billed annually)
                        </div>
                        <div className="inline-flex items-center gap-1 mt-2 rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-800">
                          <Check className="h-4 w-4" />
                          Save ${annualSavings.toLocaleString()}/year
                        </div>
                      </>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="text-sm font-medium text-gray-700 mb-2">Compare to competitors:</div>

                    <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                      <div>
                        <div className="font-medium text-gray-900">HubSpot Sales Hub</div>
                        <div className="text-sm text-gray-500">${hubspotCost}/mo for {proSeats} seats</div>
                      </div>
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                        Save {hubspotSavings}%
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                      <div>
                        <div className="font-medium text-gray-900">Salesforce Essentials</div>
                        <div className="text-sm text-gray-500">${salesforceCost}/mo for {proSeats} seats</div>
                      </div>
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                        Save {salesforceSavings}%
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                      <div>
                        <div className="font-medium text-gray-900">Tupelo CRM</div>
                        <div className="text-sm text-gray-500">${tupeloCost}/mo for {proSeats} seats</div>
                      </div>
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                        Save {tupeloSavings}%
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* FAQ or Trust indicators could go here */}
        <div className="text-center">
          <p className="text-gray-500 text-sm">
            Questions? <a href="mailto:contact@cimshare.com" className="text-blue-600 hover:underline">Contact us</a>
          </p>
        </div>
      </div>

      {/* Signup Modal */}
      <Dialog open={showSignupModal} onOpenChange={setShowSignupModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center text-gray-900">Great choice!</DialogTitle>
            <DialogDescription className="text-center text-lg pt-2 text-gray-600">
              First, let's create your account.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-col gap-3 mt-4">
            <Button
              className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white"
              size="lg"
              onClick={() => {
                setShowSignupModal(false);
                window.location.href = '/login?tab=register';
              }}
            >
              Create Account
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowSignupModal(false)}
            >
              Maybe Later
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
