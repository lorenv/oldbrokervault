import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CimDisplay } from "@/components/cim-display";
import { NdaDialog } from "@/components/nda-dialog";
import { UploadedFileViewer } from "@/components/uploaded-file-viewer";
import { Shield, FileText, AlertCircle, Download, Package } from "lucide-react";

export function SharePage() {
  const [, params] = useRoute("/share/:shareSlug");
  const shareSlug = params?.shareSlug;
  
  // console.log("Route params:", params);
  // console.log("Share slug extracted:", shareSlug);
  const [showNdaDialog, setShowNdaDialog] = useState(false);
  const [hasSignedNda, setHasSignedNda] = useState(false);

  const { data: shareData, isLoading, error } = useQuery({
    queryKey: ['/api/share', shareSlug],
    queryFn: async () => {
      const response = await fetch(`/api/share/${shareSlug}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Share API error:', errorText);
        throw new Error(`Failed to fetch shared CIM: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    },
    enabled: !!shareSlug,
    staleTime: 0,
    gcTime: 0
  }) as { data: any, isLoading: boolean, error: any };

  // Fetch uploaded files for the shared document
  const { data: uploadedFiles = [], isLoading: filesLoading } = useQuery({
    queryKey: ['/api/share', shareSlug, 'files'],
    queryFn: async () => {
      const response = await fetch(`/api/share/${shareSlug}/files`);
      if (!response.ok) {
        throw new Error('Failed to fetch uploaded files');
      }
      return response.json();
    },
    enabled: !!shareSlug && !!shareData?.cim?.isUploadedFile,
    staleTime: 0,
    gcTime: 0
  });

  useEffect(() => {
    // console.log("=== SHARE DEBUG ===");
    // console.log("Share data loaded:", shareData);
    // console.log("CIM document:", shareData?.cim);
    // console.log("NDA Protected flag:", shareData?.cim?.ndaProtected);
    // console.log("Requires NDA flag:", shareData?.requiresNda);
    // console.log("Has signed NDA:", hasSignedNda);
    // console.log("User Profile:", shareData?.cim?.userProfile);
    // console.log("Full API response:", JSON.stringify(shareData, null, 2));
    // console.log("=== END SHARE DEBUG ===");
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
  // console.log("NDA CHECK:", { needsNda, requiresNda: shareData?.requiresNda, ndaProtected: shareData?.cim?.ndaProtected, hasSignedNda });
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      {/* Document header without CIM God branding */}
      <div className="bg-white/90 backdrop-blur-sm border-b border-gray-200/50 shadow-sm">
        <div className="container mx-auto px-6 py-8">
          <div className="text-center space-y-4">
            {shareData.cim?.title && (
              <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                {shareData.cim.title}
              </h1>
            )}
            
            <div className="inline-flex items-center gap-3 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full shadow-lg">
              <Shield className="h-5 w-5" />
              <span className="font-medium">Confidential Information Memorandum</span>
            </div>
            
            {/* Export button placeholder - will be moved here by CimDisplay */}
            <div id="export-button-container" className="mt-4"></div>
            
            {shareData.requiresNda && hasSignedNda && (
              <div className="flex items-center justify-center space-x-2 text-sm text-gray-600">
                <Shield className="h-4 w-4 text-green-600" />
                <span>NDA Protected & Signed</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Document content */}
      <div className="container mx-auto px-6 py-8">
        {shareData.cim && (
          <>
            {/* Check if this is an uploaded file */}
            {shareData.cim.isUploadedFile ? (
              <div>
                {/* Loading state for files */}
                {filesLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="text-gray-500">Loading files...</div>
                  </div>
                ) : (
                  <>
                    {uploadedFiles.length === 1 && uploadedFiles[0]?.mimeType === 'application/pdf' ? (
                  // Single PDF: render in browser
                  <UploadedFileViewer 
                    cimDocument={shareData.cim}
                    shareSlug={shareSlug!}
                    userProfile={shareData.cim.userProfile}
                  />
                ) : uploadedFiles.length > 0 ? (
                  // Multiple files or non-PDF: show download list
                  <Card className="w-full max-w-4xl mx-auto">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5" />
                        Document Files ({uploadedFiles.length})
                      </CardTitle>
                      <CardDescription>
                        Download individual files or all files at once
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Individual file downloads */}
                      <div className="space-y-2">
                        {uploadedFiles.map((file: any, index: number) => (
                          <div key={file.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                            <div className="flex items-center gap-3">
                              <FileText className="h-5 w-5 text-gray-500" />
                              <div>
                                <p className="font-medium">{file.fileName}</p>
                                <p className="text-sm text-gray-500">
                                  {(file.fileSize / 1024 / 1024).toFixed(2)} MB • {file.mimeType.split('/').pop()?.toUpperCase()}
                                </p>
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const downloadUrl = `/api/share/${shareSlug}/download/${file.id}`;
                                const link = document.createElement('a');
                                link.href = downloadUrl;
                                link.download = file.fileName;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                              }}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Download
                            </Button>
                          </div>
                        ))}
                      </div>
                      
                      {/* Bulk download button */}
                      {uploadedFiles.length > 1 && (
                        <div className="pt-4 border-t">
                          <Button
                            className="w-full"
                            onClick={() => {
                              const downloadUrl = `/api/share/${shareSlug}/download-all`;
                              const link = document.createElement('a');
                              link.href = downloadUrl;
                              link.download = `${shareData.cim.title}_files.zip`;
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                            }}
                          >
                            <Package className="h-4 w-4 mr-2" />
                            Download All Files ({uploadedFiles.length})
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  // Fallback for legacy single file uploads
                  <UploadedFileViewer 
                    cimDocument={shareData.cim}
                    shareSlug={shareSlug!}
                    userProfile={shareData.cim.userProfile}
                  />
                    )}
                  </>
                )}
              </div>
            ) : (
              <CimDisplay 
                analysis={shareData.cim.analysis}
                docId={shareData.cim.id}
                websiteUrl={shareData.cim.websiteUrl}
                logoUrl={shareData.cim.logoUrl}
                selectedImages={shareData.cim.selectedImages}
                title={shareData.cim.title}
                isSharedView={true}
                userProfile={shareData.cim.userProfile}
                cimDocument={shareData.cim}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}