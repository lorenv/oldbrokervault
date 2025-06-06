import { useEffect } from "react";
import { useRoute } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Shield, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function NdaRedirectPage() {
  const [, params] = useRoute("/nda/redirect/:redirectId");
  const redirectId = params?.redirectId;

  useEffect(() => {
    if (redirectId) {
      // Automatically redirect to the backend endpoint which will handle the token lookup
      window.location.href = `/api/nda/redirect/${redirectId}`;
    }
  }, [redirectId]);

  if (!redirectId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="flex justify-center items-center min-h-[50vh]">
          <Alert className="max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Invalid redirect link. Please check the URL and try again.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="flex justify-center items-center min-h-[50vh]">
        <Card className="max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-3 rounded-full bg-blue-100">
              <Shield className="h-6 w-6 text-blue-600" />
            </div>
            <CardTitle>Accessing Secure Document</CardTitle>
            <CardDescription>
              Verifying your access credentials and redirecting to the document...
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
            <p className="text-sm text-gray-600 mt-4">
              This should only take a moment
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}