import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CimDisplay } from "@/components/cim-display";
import { NdaDialog } from "@/components/nda-dialog";
import { UploadedFileViewer } from "@/components/uploaded-file-viewer";
import { Shield, FileText, AlertCircle, Download, Package, User } from "lucide-react";

export function SharePage() {
  const [, params] = useRoute("/share/:shareSlug");
  const shareSlug = params?.shareSlug;
  
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
        throw new Error('Failed to fetch files');
      }
      return response.json();
    },
    enabled: !!shareSlug && !!shareData?.cim?.isUploadedFile,
    staleTime: 0,
    gcTime: 0
  });

  useEffect(() => {
    if (shareData?.cim?.requiresNda && !hasSignedNda) {
      setShowNdaDialog(true);
    }
  }, [shareData, hasSignedNda]);

  const handleNdaAccepted = async (signature: { name: string; email: string; signature: string }) => {
    try {
      const response = await fetch(`/api/share/${shareSlug}/sign-nda`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(signature),
        credentials: 'include'
      });

      if (response.ok) {
        setHasSignedNda(true);
        setShowNdaDialog(false);
      } else {
        console.error('Failed to record NDA signature');
      }
    } catch (error) {
      console.error('Error signing NDA:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="flex justify-center items-center min-h-[50vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading document...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="flex justify-center items-center min-h-[50vh]">
          <Alert className="max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Unable to load the shared document. The link may be invalid or expired.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  if (!shareData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="flex justify-center items-center min-h-[50vh]">
          <div className="text-center text-gray-600">
            <p>Document not found</p>
          </div>
        </div>
      </div>
    );
  }

  const shouldShowNda = shareData.cim.requiresNda && !hasSignedNda;

  if (shouldShowNda) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="flex justify-center items-center min-h-[50vh]">
          <Card className="max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 p-3 rounded-full bg-yellow-100">
                <Shield className="h-6 w-6 text-yellow-600" />
              </div>
              <CardTitle>Non-Disclosure Agreement Required</CardTitle>
              <CardDescription>
                This document requires signing an NDA before viewing
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Button onClick={() => setShowNdaDialog(true)}>
                Review and Sign NDA
              </Button>
            </CardContent>
          </Card>
        </div>
        
        <NdaDialog
          isOpen={showNdaDialog}
          onClose={() => setShowNdaDialog(false)}
          onAccept={handleNdaAccepted}
          ndaText={shareData.ndaText}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm mb-4">
            <FileText className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-gray-700">Shared Document</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {shareData.cim.title}
          </h1>
          {shareData.cim.description && (
            <p className="text-gray-600 max-w-2xl mx-auto">
              {shareData.cim.description}
            </p>
          )}
        </div>

        <div className="space-y-6">
          {shareData.cim.isUploadedFile ? (
            <div>
              {filesLoading ? (
                <div className="flex justify-center py-8">
                  <div className="text-gray-500">Loading files...</div>
                </div>
              ) : uploadedFiles.length === 1 && uploadedFiles[0]?.mimeType === 'application/pdf' ? (
                <UploadedFileViewer 
                  cimDocument={shareData.cim}
                  shareSlug={shareSlug!}
                  userProfile={shareData.cim.userProfile}
                  logoUrl={shareData.cim.logoUrl}
                />
              ) : uploadedFiles.length > 0 ? (
                <div className="space-y-6">
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
                  
                  {shareData.cim.userProfile && (
                    <Card className="w-full max-w-4xl mx-auto">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <User className="h-5 w-5" />
                          Contact Information
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-start gap-6">
                          {shareData.cim.userProfile.profilePhotoUrl && (
                            <img 
                              src={shareData.cim.userProfile.profilePhotoUrl} 
                              alt="Profile" 
                              className="w-20 h-20 rounded-full object-cover border-2 border-gray-200"
                            />
                          )}
                          
                          <div className="flex-1">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <h3 className="font-semibold text-lg mb-2">
                                  {shareData.cim.userProfile.fullName || shareData.cim.userProfile.name}
                                </h3>
                                {shareData.cim.userProfile.title && (
                                  <p className="text-gray-600 mb-1">{shareData.cim.userProfile.title}</p>
                                )}
                                {(shareData.cim.userProfile.company || shareData.cim.userProfile.businessName) && (
                                  <p className="text-gray-600 mb-1">
                                    {shareData.cim.userProfile.company || shareData.cim.userProfile.businessName}
                                  </p>
                                )}
                                {shareData.cim.userProfile.email && (
                                  <p className="text-blue-600 mb-1">
                                    <a href={`mailto:${shareData.cim.userProfile.email}`} className="hover:underline">
                                      {shareData.cim.userProfile.email}
                                    </a>
                                  </p>
                                )}
                                {(shareData.cim.userProfile.phone || shareData.cim.userProfile.phoneNumber) && (
                                  <p className="text-gray-600 mb-1">
                                    <a href={`tel:${shareData.cim.userProfile.phone || shareData.cim.userProfile.phoneNumber}`} className="hover:underline">
                                      {shareData.cim.userProfile.phone || shareData.cim.userProfile.phoneNumber}
                                    </a>
                                  </p>
                                )}
                              </div>
                              
                              {shareData.cim.logoUrl && (
                                <div className="flex justify-end">
                                  <img 
                                    src={shareData.cim.logoUrl} 
                                    alt="Company Logo" 
                                    className="max-w-32 max-h-20 object-contain"
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              ) : (
                <UploadedFileViewer 
                  cimDocument={shareData.cim}
                  shareSlug={shareSlug!}
                  userProfile={shareData.cim.userProfile}
                  logoUrl={shareData.cim.logoUrl}
                />
              )}
            </div>
          ) : (
            <CimDisplay 
              analysis={shareData.cim.analysis}
              isSharedView={true}
            />
          )}
        </div>
      </div>
    </div>
  );
}