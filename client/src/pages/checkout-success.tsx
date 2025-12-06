import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function CheckoutSuccess() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const verifySession = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const sessionId = urlParams.get('session_id');

      if (!sessionId) {
        setStatus('error');
        setMessage('No session ID found. Please contact support if you believe this is an error.');
        return;
      }

      try {
        
        // First, verify the checkout session and update subscription (using public endpoint)
        const response = await apiRequest("GET", `/api/subscription/verify-checkout?session_id=${sessionId}`);
        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Failed to verify subscription');
        }


        // Clear any cached user data to ensure fresh data
        queryClient.removeQueries({ queryKey: ["/api/user"] });
        
        // Prefetch fresh user data
        await queryClient.prefetchQuery({
          queryKey: ["/api/user"],
          queryFn: async () => {
            const res = await apiRequest("GET", "/api/user");
            if (res.ok) {
              return res.json();
            }
            return null;
          },
        });

        setStatus('success');
        setMessage('Your subscription has been activated successfully!');
        
        toast({
          title: "Welcome to CIM Share Pro!",
          description: "Your account has been upgraded. Redirecting to your account...",
        });

        // Redirect to account page after a brief delay
        setTimeout(() => {
          setLocation('/account?tab=billing');
        }, 3000);

      } catch (error) {
        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'Failed to verify your subscription. Please contact support.');
        
        toast({
          title: "Verification Failed",
          description: "There was an issue verifying your subscription. Please contact support.",
          variant: "destructive",
        });
      }
    };

    verifySession();
  }, [setLocation, toast]);

  return (
    <div className="container max-w-2xl py-16">
      <Card>
        <CardHeader className="text-center">
          {status === 'loading' && (
            <>
              <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-blue-600" />
              <CardTitle>Processing Your Subscription</CardTitle>
              <CardDescription>
                Please wait while we activate your account...
              </CardDescription>
            </>
          )}
          
          {status === 'success' && (
            <>
              <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-600" />
              <CardTitle>Payment Successful!</CardTitle>
              <CardDescription>{message}</CardDescription>
            </>
          )}
          
          {status === 'error' && (
            <>
              <XCircle className="h-12 w-12 mx-auto mb-4 text-red-600" />
              <CardTitle>Verification Issue</CardTitle>
              <CardDescription>{message}</CardDescription>
            </>
          )}
        </CardHeader>
        
        <CardContent className="text-center space-y-4">
          {status === 'success' && (
            <p className="text-sm text-muted-foreground">
              You will be redirected to your account in a few seconds...
            </p>
          )}
          
          {status === 'error' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                If you were charged but your account wasn't upgraded, don't worry - 
                your payment is secure and we'll resolve this quickly.
              </p>
              <div className="flex gap-4 justify-center">
                <Button onClick={() => setLocation('/account?tab=billing')}>
                  Go to Account
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => window.location.href = 'mailto:support@cimshare.com'}
                >
                  Contact Support
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}