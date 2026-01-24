import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { SettingsLayout } from "@/components/layout/settings-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Users, CreditCard, Plus, Minus, Eye, Check, Zap, Crown } from "lucide-react";
import { Link } from "wouter";

const PRO_MONTHLY_PRICE = 59;
const PRO_ANNUAL_PRICE = 49;

export default function BillingPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [additionalSeats, setAdditionalSeats] = useState(1);
  const [isLoadingPortal, setIsLoadingPortal] = useState(false);
  const [isAddingLicenses, setIsAddingLicenses] = useState(false);

  const { data: organization } = useQuery<any>({
    queryKey: ["/api/crm/organization"],
  });

  const licenses = organization?.licenses || { totalSeats: 1, usedSeats: 0, availableSeats: 1, viewerCount: 0 };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    if (sessionId) {
      verifyStripeSession(sessionId);
    }
  }, []);

  const verifyStripeSession = async (sessionId: string) => {
    try {
      const response = await apiRequest("GET", `/api/subscription/verify-session?session_id=${sessionId}`);
      const data = await response.json();

      if (data.success) {
        await queryClient.invalidateQueries({ queryKey: ["/api/user"] });
        await new Promise(resolve => setTimeout(resolve, 500));
        queryClient.removeQueries({ queryKey: ["/api/user"] });
        await queryClient.refetchQueries({ queryKey: ["/api/user"] });

        toast({
          title: "Subscription Updated",
          description: `Your subscription has been upgraded to ${data.status}`,
        });

        window.history.replaceState({}, '', '/settings/billing');
      } else {
        throw new Error(data.error || "Failed to verify subscription");
      }
    } catch (error) {
      toast({
        title: "Subscription Verification Failed",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive",
      });
    }
  };

  const handleManageSubscription = async () => {
    setIsLoadingPortal(true);
    try {
      const response = await apiRequest("POST", "/api/subscription/create-portal-session");
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No portal URL received");
      }
    } catch (error) {
      toast({
        title: "Unable to open billing portal",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingPortal(false);
    }
  };

  const handleAddLicenses = async () => {
    setIsAddingLicenses(true);
    try {
      const response = await apiRequest("POST", "/api/subscription/add-licenses", {
        body: { additionalSeats },
      });
      const data = await response.json();

      if (data.success) {
        toast({
          title: "Licenses Added",
          description: data.message,
        });
        // Refresh organization data to show updated seat count
        queryClient.invalidateQueries({ queryKey: ["/api/crm/organization"] });
        setAdditionalSeats(1); // Reset the counter
      } else {
        throw new Error(data.error || "Failed to add licenses");
      }
    } catch (error) {
      toast({
        title: "Unable to add licenses",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAddingLicenses(false);
    }
  };

  const isPro = user?.subscriptionStatus === 'pro' || user?.subscriptionStatus === 'pro_monthly' || user?.subscriptionStatus === 'standard' || user?.subscriptionStatus === 'starter' || user?.subscriptionStatus === 'starter_monthly';
  const isAnnual = user?.subscriptionStatus === 'pro' || user?.subscriptionStatus === 'standard' || user?.subscriptionStatus === 'starter';
  const isFree = !isPro && user?.subscriptionStatus !== 'enterprise' && user?.subscriptionStatus !== 'admin';
  const pricePerSeat = isAnnual ? PRO_ANNUAL_PRICE : PRO_MONTHLY_PRICE;

  const getPlanDisplayName = () => {
    switch (user?.subscriptionStatus) {
      case 'pro':
      case 'pro_monthly':
      case 'standard':
        return 'Pro';
      case 'starter':
      case 'starter_monthly':
        return 'Starter';
      case 'enterprise':
        return 'Enterprise';
      case 'admin':
        return 'Admin';
      default:
        return 'Free';
    }
  };

  return (
    <SettingsLayout
      title="Billing"
      description="Manage your subscription and team licenses"
    >
      <div className="max-w-3xl space-y-6">
        {/* Current Plan Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  isPro ? 'bg-blue-100' : isFree ? 'bg-gray-100' : 'bg-purple-100'
                }`}>
                  {isPro ? (
                    <Zap className={`h-6 w-6 text-blue-600`} />
                  ) : isFree ? (
                    <CreditCard className="h-6 w-6 text-gray-600" />
                  ) : (
                    <Crown className="h-6 w-6 text-purple-600" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-gray-900">{getPlanDisplayName()} Plan</h3>
                    <Badge variant={isFree ? "secondary" : "default"} className={
                      isFree ? "bg-gray-100 text-gray-700" : "bg-blue-100 text-blue-700"
                    }>
                      {isFree ? "Free" : "Active"}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-500">
                    {isFree ? "Limited to 1 CIM document" : "Unlimited CIM documents & features"}
                  </p>
                </div>
              </div>

              <div className="text-right">
                {isPro && (
                  <>
                    <p className="text-2xl font-bold text-gray-900">
                      ${licenses.totalSeats * pricePerSeat}
                      <span className="text-sm font-normal text-gray-500">/mo</span>
                    </p>
                    <p className="text-xs text-gray-500">
                      {licenses.totalSeats} license{licenses.totalSeats !== 1 ? 's' : ''} × ${pricePerSeat}
                    </p>
                  </>
                )}
                {isFree && (
                  <p className="text-2xl font-bold text-gray-900">$0</p>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-6 flex gap-3">
              {isFree ? (
                <Link href="/pricing" className="flex-1">
                  <Button className="w-full">
                    <Zap className="h-4 w-4 mr-2" />
                    Upgrade to Pro
                  </Button>
                </Link>
              ) : (
                <Button
                  variant="outline"
                  onClick={handleManageSubscription}
                  disabled={isLoadingPortal}
                  className="flex-1"
                >
                  {isLoadingPortal ? "Loading..." : "Manage Subscription"}
                </Button>
              )}
            </div>

            {isAnnual && isPro && (
              <p className="mt-4 text-sm text-green-600 flex items-center gap-1">
                <Check className="h-4 w-4" />
                You're saving ${(PRO_MONTHLY_PRICE - PRO_ANNUAL_PRICE) * licenses.totalSeats * 12}/year with annual billing
              </p>
            )}
          </CardContent>
        </Card>

        {/* Team Licenses Card - Only for Pro users */}
        {isPro && (
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                Team Licenses
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* License Usage */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Pro licenses</span>
                  <span className="text-sm font-medium text-gray-900">
                    {licenses.usedSeats} of {licenses.totalSeats} used
                  </span>
                </div>
                <Progress
                  value={(licenses.usedSeats / licenses.totalSeats) * 100}
                  className="h-2"
                />
                {licenses.availableSeats > 0 && (
                  <p className="text-xs text-green-600 mt-1">
                    {licenses.availableSeats} license{licenses.availableSeats !== 1 ? 's' : ''} available
                  </p>
                )}
              </div>

              {/* Viewer Seats */}
              {licenses.viewerCount > 0 && (
                <div className="flex items-center justify-between py-3 border-t">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-600">Viewer seats</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{licenses.viewerCount}</span>
                    <Badge variant="outline" className="text-xs text-green-600 border-green-200">Free</Badge>
                  </div>
                </div>
              )}

              {/* Add Licenses */}
              <div className="pt-3 border-t">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Add licenses</p>
                    <p className="text-xs text-gray-500">${pricePerSeat}/license/month</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setAdditionalSeats(Math.max(1, additionalSeats - 1))}
                      disabled={additionalSeats <= 1}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <Input
                      type="number"
                      value={additionalSeats}
                      onChange={(e) => setAdditionalSeats(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-14 h-8 text-center text-sm"
                      min={1}
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setAdditionalSeats(additionalSeats + 1)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm text-gray-600">
                    +${additionalSeats * pricePerSeat}/month
                  </span>
                  <Button
                    size="sm"
                    onClick={handleAddLicenses}
                    disabled={isAddingLicenses}
                  >
                    {isAddingLicenses ? "Adding..." : "Add Licenses"}
                  </Button>
                </div>
              </div>

              {/* Link to Team Settings */}
              <div className="pt-3 border-t">
                <Link href="/settings/team">
                  <Button variant="ghost" className="w-full justify-start text-gray-600 hover:text-gray-900">
                    <Users className="h-4 w-4 mr-2" />
                    Manage team members →
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Viewer Info for Pro users */}
        {isPro && (
          <Card className="bg-blue-50/50 border-blue-100">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-start gap-3">
                <Eye className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-900">Free viewer seats</p>
                  <p className="text-sm text-blue-700 mt-0.5">
                    Add unlimited viewers at no cost. They can view all data but can't edit or export.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Upgrade CTA for Free users */}
        {isFree && (
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100">
            <CardContent className="pt-6 pb-6">
              <div className="text-center">
                <Zap className="h-10 w-10 text-blue-600 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Upgrade to Pro</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Get unlimited CIMs, team collaboration, email sync, and more.
                </p>
                <div className="flex items-center justify-center gap-2 mb-4">
                  <span className="text-3xl font-bold text-gray-900">$59</span>
                  <span className="text-gray-500">/seat/month</span>
                </div>
                <Link href="/pricing">
                  <Button size="lg">
                    View Plans
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </SettingsLayout>
  );
}
