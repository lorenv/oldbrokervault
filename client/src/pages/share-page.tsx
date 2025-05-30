import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CimDisplay } from "@/components/cim-display";
import { NdaDialog } from "@/components/nda-dialog";
import { Shield, FileText, AlertCircle } from "lucide-react";

export function SharePage() {
  const [, params] = useRoute("/cims/:shareSlug");
  const shareSlug = params?.shareSlug;
  
  console.log("Route params:", params);
  console.log("Share slug extracted:", shareSlug);
  const [showNdaDialog, setShowNdaDialog] = useState(false);
  const [hasSignedNda, setHasSignedNda] = useState(false);

  const { data: shareData, isLoading, error } = useQuery({
    queryKey: ['/api/share', shareSlug],
    queryFn: async () => {
      const response = await fetch(`/api/share/${shareSlug}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch shared CIM: ${response.status}`);
      }
      return response.json();
    },
    enabled: !!shareSlug
  }) as { data: any, isLoading: boolean, error: any };

  useEffect(() => {
    console.log("=== SHARE DEBUG ===");
    console.log("Share data loaded:", shareData);
    console.log("CIM document:", shareData?.cim);
    console.log("NDA Protected flag:", shareData?.cim?.ndaProtected);
    console.log("Requires NDA flag:", shareData?.requiresNda);
    console.log("Has signed NDA:", hasSignedNda);
    console.log("User Profile:", shareData?.cim?.userProfile);
    console.log("Full API response:", JSON.stringify(shareData, null, 2));
    console.log("=== END SHARE DEBUG ===");
  }, [shareData, hasSignedNda]);

  const handleNdaSigned = () => {
    setHasSignedNda(true);
    setShowNdaDialog(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="text-muted-foreground">Loading shared document...</p>
        </div>
      </div>
    );
  }

  if (error || !shareData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Access Denied
            </CardTitle>
            <CardDescription>
              This shared link is invalid, expired, or you don't have permission to view it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              variant="outline" 
              onClick={() => window.location.href = '/'}
              className="w-full"
            >
              Return to Homepage
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check both possible NDA flags for protection
  const needsNda = shareData?.requiresNda || shareData?.cim?.ndaProtected;
  console.log("NDA CHECK:", { needsNda, requiresNda: shareData?.requiresNda, ndaProtected: shareData?.cim?.ndaProtected, hasSignedNda });
  if (needsNda && !hasSignedNda) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-600">
              <Shield className="h-5 w-5" />
              Protected Document
            </CardTitle>
            <CardDescription>
              This confidential information memorandum requires signing a Non-Disclosure Agreement.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <FileText className="h-4 w-4" />
              <AlertDescription>
                <strong>{shareData.cim?.title}</strong><br />
                You must sign an NDA before accessing this document.
              </AlertDescription>
            </Alert>
            <Button 
              onClick={() => setShowNdaDialog(true)}
              className="w-full"
            >
              <Shield className="h-4 w-4 mr-2" />
              Review & Sign NDA
            </Button>
          </CardContent>
        </Card>

        <NdaDialog
          isOpen={showNdaDialog}
          onClose={() => setShowNdaDialog(false)}
          onSigned={handleNdaSigned}
          shareSlug={shareSlug!}
          cimTitle={shareData.cim?.title || "Confidential Information Memorandum"}
          ndaUrl={shareData.ndaUrl}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-800">
              <FileText className="h-5 w-5" />
              Shared Document
            </CardTitle>
            <CardDescription className="text-blue-700">
              You are viewing a shared confidential information memorandum
              {shareData.requiresNda && hasSignedNda && (
                <span className="ml-2 inline-flex items-center gap-1">
                  <Shield className="h-3 w-3" />
                  NDA Protected
                </span>
              )}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      {shareData.cim && (
        <>
          {/* Debug: Log the data being passed */}
          {(() => {
            console.log('Share page debug - CIM data:', {
              websiteUrl: shareData.cim.websiteUrl,
              selectedImages: shareData.cim.selectedImages,
              logoUrl: shareData.cim.logoUrl,
              userProfile: shareData.cim.userProfile,
              fullCimData: shareData.cim
            });
            return null;
          })()}
          <CimDisplay 
            analysis={shareData.cim.analysis}
            docId={shareData.cim.id}
            websiteUrl={shareData.cim.websiteUrl}
            logoUrl={shareData.cim.logoUrl}
            selectedImages={shareData.cim.selectedImages}
            title={shareData.cim.title}
            isSharedView={true}
            userProfile={shareData.cim.userProfile}
          />
        </>
      )}
    </div>
  );
}