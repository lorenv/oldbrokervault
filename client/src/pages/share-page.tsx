import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CimDisplay } from "@/components/cim-display";
import { NdaDialog } from "@/components/nda-dialog";
import { UploadedFileViewer } from "@/components/uploaded-file-viewer";
import { FinancialDocumentsDisplay } from "@/components/financial-documents-display";
import { Shield, FileText, AlertCircle, Download, Package, User, DollarSign, Mail, TrendingUp, BarChart3 } from "lucide-react";

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
      const data = await response.json();
      console.log('🔍 Share page uploaded files data:', data);
      return data;
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

  const shouldShowNda = shareData.requiresNda && !hasSignedNda;

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
          onSigned={() => setHasSignedNda(true)}
          shareSlug={shareSlug || ''}
          cimTitle={shareData.cim.title}
          ndaUrl={shareData.ndaUrl}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Modern header section */}
      <div className="bg-white/90 backdrop-blur-sm border-b border-gray-200/50 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="text-center">
            <div className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-full shadow-sm mb-6 border border-blue-100">
              <FileText className="h-5 w-5 text-blue-600" />
              <span className="text-sm font-semibold text-slate-700 tracking-wide">SHARED DOCUMENT</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 bg-clip-text text-transparent mb-4 tracking-tight">
              {shareData.cim.title}
            </h1>
            {shareData.cim.description && (
              <p className="text-lg text-slate-600 max-w-3xl mx-auto leading-relaxed">
                {shareData.cim.description}
              </p>
            )}
            
            {/* Export Button */}
            <div className="mt-8">
              <Button
                onClick={async () => {
                  try {
                    const response = await fetch(`/api/share/${shareSlug}/export/pdf`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' }
                    });
                    
                    if (response.ok) {
                      const blob = await response.blob();
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${shareData.cim.title || 'document'}.pdf`;
                      document.body.appendChild(a);
                      a.click();
                      window.URL.revokeObjectURL(url);
                      document.body.removeChild(a);
                    }
                  } catch (error) {
                    console.error('Export failed:', error);
                  }
                }}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
              >
                <Download className="h-5 w-5 mr-2" />
                Export as PDF
              </Button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Content section */}
      <div className="max-w-6xl mx-auto px-6 py-8">

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
                  uploadedFiles={uploadedFiles}
                />
              ) : uploadedFiles.length > 0 ? (
                <div className="space-y-8">
                  <Card className="w-full max-w-5xl mx-auto border-0 shadow-2xl bg-gradient-to-br from-white/95 to-gray-50/95 backdrop-blur-md rounded-2xl overflow-hidden">
                    <CardHeader className="bg-gradient-to-r from-slate-50 to-blue-50/50 pb-6 pt-8 px-8">
                      <CardTitle className="flex items-center gap-3 text-2xl font-bold text-slate-800">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <Package className="h-6 w-6 text-blue-600" />
                        </div>
                        Document Files ({uploadedFiles.length})
                      </CardTitle>
                      <CardDescription className="text-lg text-slate-600 mt-2">
                        Download individual files or all files at once
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-8 space-y-6">
                      <div className="space-y-4">
                        {uploadedFiles.map((file: any, index: number) => (
                          <div key={file.id} className="flex items-center justify-between p-6 bg-white/80 backdrop-blur-sm border border-gray-200/50 rounded-xl hover:bg-white/90 hover:shadow-lg transition-all duration-200">
                            <div className="flex items-center gap-4">
                              <div className="p-3 bg-blue-50 rounded-lg">
                                <FileText className="h-6 w-6 text-blue-600" />
                              </div>
                              <div>
                                <p className="font-semibold text-lg text-slate-900">{file.fileName}</p>
                                <p className="text-sm text-slate-500 mt-1">
                                  {(file.fileSize / 1024 / 1024).toFixed(2)} MB • {file.mimeType.split('/').pop()?.toUpperCase()}
                                </p>
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              size="lg"
                              className="bg-white/90 hover:bg-blue-50 border-blue-200 text-blue-700 font-medium"
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
                              <Download className="h-5 w-5 mr-2" />
                              Download
                            </Button>
                          </div>
                        ))}
                      </div>
                      
                      {uploadedFiles.length > 1 && (
                        <div className="pt-6 border-t border-gray-200/50">
                          <Button
                            className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-800 hover:to-slate-900 text-white shadow-lg"
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
                            <Package className="h-6 w-6 mr-3" />
                            Download All Files ({uploadedFiles.length})
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  

                  {shareData.cim.userProfile && (
                    <Card className="w-full max-w-5xl mx-auto border-0 shadow-2xl bg-gradient-to-br from-white/95 to-gray-50/95 backdrop-blur-md rounded-2xl overflow-hidden">
                      <CardHeader className="bg-gradient-to-r from-slate-50 to-blue-50/50 pb-6 pt-8 px-8">
                        <CardTitle className="flex items-center gap-3 text-2xl font-bold text-slate-800">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <User className="h-6 w-6 text-blue-600" />
                          </div>
                          Contact Information
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-8">
                        {(() => {
                          console.log("Share data debug:", shareData);
                          console.log("Contact section debug:", {
                            hasUserProfile: !!shareData.cim.userProfile,
                            userProfileData: shareData.cim.userProfile,
                            fullCimData: shareData.cim
                          });
                          return null;
                        })()}
                        {shareData.cim.userProfile ? (
                          <div className="flex items-start gap-8">
                            {shareData.cim.userProfile.profilePhoto && (
                              <div className="flex-shrink-0">
                                <img 
                                  src={shareData.cim.userProfile.profilePhoto} 
                                  alt="Profile" 
                                  className="w-32 h-32 rounded-2xl object-cover border-4 border-white"
                                />
                              </div>
                            )}
                            
                            <div className="flex-1 min-w-0">
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                  <div>
                                    {shareData.cim.userProfile.name && (
                                      <h3 className="text-2xl font-bold text-slate-900 mb-2">
                                        {shareData.cim.userProfile.name}
                                      </h3>
                                    )}
                                    {shareData.cim.userProfile.title && (
                                      <p className="text-lg text-blue-600 font-medium mb-2">{shareData.cim.userProfile.title}</p>
                                    )}
                                    {shareData.cim.userProfile.businessName && (
                                      <p className="text-lg text-slate-600 font-medium mb-3">
                                        {shareData.cim.userProfile.businessName}
                                      </p>
                                    )}
                                  </div>
                                  
                                  <div className="space-y-3">
                                    {shareData.cim.userProfile.email && (
                                      <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
                                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                        <a href={`mailto:${shareData.cim.userProfile.email}`} className="text-blue-600 font-medium hover:text-blue-700 transition-colors">
                                          {shareData.cim.userProfile.email}
                                        </a>
                                      </div>
                                    )}
                                    {shareData.cim.userProfile.phoneNumber && (
                                      <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                                        <div className="w-2 h-2 bg-slate-500 rounded-full"></div>
                                        <a href={`tel:${shareData.cim.userProfile.phoneNumber}`} className="text-slate-600 font-medium hover:text-slate-700 transition-colors">
                                          {shareData.cim.userProfile.phoneNumber}
                                        </a>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                
                                {(shareData.cim.logoUrl || shareData.cim.userProfile.businessLogo) && (
                                  <div className="flex justify-center lg:justify-end items-start">
                                    <div className="p-6 bg-white rounded-2xl border border-gray-100">
                                      <img 
                                        src={shareData.cim.logoUrl || shareData.cim.userProfile.businessLogo} 
                                        alt="Company Logo" 
                                        className="max-w-48 max-h-32 object-contain"
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {shareData.cim.userProfile?.name && (
                              <h3 className="text-xl font-bold text-slate-900">
                                {shareData.cim.userProfile.name}
                              </h3>
                            )}
                            {shareData.cim.userProfile?.title && (
                              <p className="text-lg text-blue-600 font-medium">{shareData.cim.userProfile.title}</p>
                            )}
                            {shareData.cim.userProfile?.businessName && (
                              <p className="text-lg text-slate-600 font-medium">{shareData.cim.userProfile.businessName}</p>
                            )}
                            <div className="space-y-3">
                              {shareData.cim.userProfile?.email && (
                                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                                  <Mail className="h-4 w-4 text-blue-600" />
                                  <a href={`mailto:${shareData.cim.userProfile.email}`} className="text-blue-600 hover:text-blue-700 transition-colors font-medium">
                                    {shareData.cim.userProfile.email}
                                  </a>
                                </div>
                              )}
                              {shareData.cim.userProfile?.phoneNumber && (
                                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                                  <div className="w-2 h-2 bg-slate-500 rounded-full"></div>
                                  <a href={`tel:${shareData.cim.userProfile.phoneNumber}`} className="text-slate-600 hover:text-slate-700 transition-colors font-medium">
                                    {shareData.cim.userProfile.phoneNumber}
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              ) : (
                <UploadedFileViewer 
                  cimDocument={shareData.cim}
                  shareSlug={shareSlug!}
                  userProfile={shareData.cim.userProfile}
                  uploadedFiles={uploadedFiles}
                />
              )}
            </div>
          ) : (
            <div className="space-y-8">
              {/* Financial Information Section */}
              {(shareData.cim.askingPrice || shareData.cim.revenue || shareData.cim.ebitda) && (
                <Card className="w-full max-w-5xl mx-auto border-0 shadow-2xl bg-gradient-to-br from-white/95 to-gray-50/95 backdrop-blur-md rounded-2xl overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50/50 pb-6 pt-8 px-8">
                    <CardTitle className="flex items-center gap-3 text-2xl font-bold text-slate-800">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <DollarSign className="h-6 w-6 text-green-600" />
                      </div>
                      Financial Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {shareData.cim.askingPrice && (
                        <div className="text-center p-6 bg-white rounded-xl shadow-sm border border-gray-100">
                          <div className="flex items-center justify-center gap-2 mb-3">
                            <DollarSign className="h-5 w-5 text-green-600" />
                            <h4 className="text-lg font-semibold text-gray-600">Asking Price</h4>
                          </div>
                          <p className="text-3xl font-bold text-green-600">
                            ${parseInt(shareData.cim.askingPrice).toLocaleString()}
                          </p>
                        </div>
                      )}
                      {shareData.cim.revenue && (
                        <div className="text-center p-6 bg-white rounded-xl shadow-sm border border-gray-100">
                          <div className="flex items-center justify-center gap-2 mb-3">
                            <TrendingUp className="h-5 w-5 text-blue-600" />
                            <h4 className="text-lg font-semibold text-gray-600">Annual Revenue</h4>
                          </div>
                          <p className="text-3xl font-bold text-blue-600">
                            ${parseInt(shareData.cim.revenue).toLocaleString()}
                          </p>
                        </div>
                      )}
                      {shareData.cim.ebitda && (
                        <div className="text-center p-6 bg-white rounded-xl shadow-sm border border-gray-100">
                          <div className="flex items-center justify-center gap-2 mb-3">
                            <BarChart3 className="h-5 w-5 text-purple-600" />
                            <h4 className="text-lg font-semibold text-gray-600">EBITDA</h4>
                          </div>
                          <p className="text-3xl font-bold text-purple-600">
                            ${parseInt(shareData.cim.ebitda).toLocaleString()}
                          </p>
                        </div>
                      )}
                    </div>
                    
                    {/* Financial Documents Download Section */}
                    <FinancialDocumentsDisplay cimId={shareData.cim.id} />
                  </CardContent>
                </Card>
              )}

              {/* Business Images for flexible CIM documents */}
              {shareData.cim.selectedImages && Array.isArray(shareData.cim.selectedImages) && shareData.cim.selectedImages.length > 0 && (
                <Card className="w-full max-w-5xl mx-auto border-0 shadow-2xl bg-gradient-to-br from-white/95 to-gray-50/95 backdrop-blur-md rounded-2xl overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-slate-50 to-blue-50/50 pb-6 pt-8 px-8">
                    <CardTitle className="flex items-center gap-3 text-2xl font-bold text-slate-800">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <Package className="h-6 w-6 text-purple-600" />
                      </div>
                      Business Images
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {shareData.cim.selectedImages.map((imageUrl: string, index: number) => (
                        <div key={index} className="group relative overflow-hidden rounded-xl shadow-lg hover:shadow-xl transition-all duration-300">
                          <img 
                            src={imageUrl} 
                            alt={`Business Image ${index + 1}`} 
                            className="w-full h-64 object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <CimDisplay 
                analysis={shareData.cim.analysis}
                isSharedView={true}
                docId={shareData.cim.id}
                websiteUrl={shareData.websiteUrl}
                logoUrl={shareData.logoUrl}
                selectedImages={shareData.selectedImages}
                title={shareData.cim.title}
                userProfile={shareData.cim.userProfile}
              />

              {/* Contact Information Card for Generated CIMs */}
              {shareData.userProfileData && (
                <Card className="w-full max-w-5xl mx-auto border-0 shadow-2xl bg-gradient-to-br from-white/95 to-gray-50/95 backdrop-blur-md rounded-2xl overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-slate-50 to-blue-50/50 pb-6 pt-8 px-8">
                    <CardTitle className="flex items-center gap-3 text-2xl font-bold text-slate-800">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <User className="h-6 w-6 text-blue-600" />
                      </div>
                      Contact Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-8">
                    <div className="flex items-start gap-8">
                      {shareData.userProfileData.profilePhoto && (
                        <div className="flex-shrink-0">
                          <img 
                            src={shareData.userProfileData.profilePhoto} 
                            alt="Profile" 
                            className="w-32 h-32 rounded-2xl object-cover border-4 border-white shadow-lg"
                          />
                        </div>
                      )}
                      
                      <div className="flex-1 min-w-0">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                          <div className="space-y-4">
                            <div>
                              {shareData.userProfileData.name && (
                                <h3 className="text-2xl font-bold text-slate-900 mb-2">
                                  {shareData.userProfileData.name}
                                </h3>
                              )}
                              {shareData.userProfileData.title && (
                                <p className="text-lg text-blue-600 font-medium mb-2">{shareData.userProfileData.title}</p>
                              )}
                              {shareData.userProfileData.businessName && (
                                <p className="text-lg text-slate-600 font-medium mb-3">
                                  {shareData.userProfileData.businessName}
                                </p>
                              )}
                            </div>
                            
                            <div className="space-y-3">
                              {shareData.userProfileData.email && (
                                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
                                  <Mail className="h-5 w-5 text-blue-600" />
                                  <a href={`mailto:${shareData.userProfileData.email}`} className="text-blue-600 font-medium hover:text-blue-700 transition-colors">
                                    {shareData.userProfileData.email}
                                  </a>
                                </div>
                              )}
                              {shareData.userProfileData.phoneNumber && (
                                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                                  <div className="w-2 h-2 bg-slate-500 rounded-full"></div>
                                  <a href={`tel:${shareData.userProfileData.phoneNumber}`} className="text-slate-600 font-medium hover:text-slate-700 transition-colors">
                                    {shareData.userProfileData.phoneNumber}
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {(shareData.logoUrl || shareData.userProfileData.businessLogo) && (
                            <div className="flex justify-center lg:justify-end items-start">
                              <div className="p-6 bg-white rounded-2xl border border-gray-100 shadow-sm">
                                <img 
                                  src={shareData.logoUrl || shareData.userProfileData.businessLogo} 
                                  alt="Company Logo" 
                                  className="max-w-48 max-h-32 object-contain"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

            </div>
          )}
        </div>
      </div>
    </div>
  );
}