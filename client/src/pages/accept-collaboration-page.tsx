import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";

export function AcceptCollaborationPage() {
  const [, params] = useRoute("/accept-collaboration/:token");
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [documentId, setDocumentId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const acceptInvitation = async () => {
      if (!params?.token) {
        setStatus("error");
        setErrorMessage("Invalid invitation link");
        return;
      }

      if (!user) {
        // Redirect to login with return URL
        setLocation(`/login?redirect=/accept-collaboration/${params.token}`);
        return;
      }

      try {
        const response = await apiRequest("POST", `/api/collaborator/accept/${params.token}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to accept invitation");
        }

        setDocumentId(data.documentId);
        setStatus("success");
      } catch (error) {
        setStatus("error");
        setErrorMessage(error instanceof Error ? error.message : "Failed to accept invitation");
      }
    };

    acceptInvitation();
  }, [params?.token, user, setLocation]);

  const handleViewDocument = () => {
    if (documentId) {
      setLocation(`/documents/${documentId}`);
    }
  };

  const handleGoToDashboard = () => {
    setLocation("/dashboard");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Collaboration Invitation</CardTitle>
          <CardDescription>
            {status === "loading" && "Processing your invitation..."}
            {status === "success" && "You're all set!"}
            {status === "error" && "Something went wrong"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-4">
          {status === "loading" && (
            <>
              <Loader2 className="h-16 w-16 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Please wait while we process your invitation...</p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
                <CheckCircle className="h-12 w-12 text-green-600" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="font-semibold text-lg">Invitation Accepted!</h3>
                <p className="text-sm text-muted-foreground">
                  You've successfully joined as a collaborator. You can now access and manage this document.
                </p>
              </div>
              <div className="flex gap-2 w-full">
                <Button onClick={handleViewDocument} className="flex-1">
                  View Document
                </Button>
                <Button onClick={handleGoToDashboard} variant="outline" className="flex-1">
                  Go to Dashboard
                </Button>
              </div>
            </>
          )}

          {status === "error" && (
            <>
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
                <XCircle className="h-12 w-12 text-red-600" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="font-semibold text-lg">Unable to Accept Invitation</h3>
                <p className="text-sm text-muted-foreground">{errorMessage}</p>
              </div>
              <Button onClick={handleGoToDashboard} className="w-full">
                Go to Dashboard
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
