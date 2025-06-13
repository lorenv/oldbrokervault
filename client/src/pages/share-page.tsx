import { useState, useEffect, useRef } from "react";
import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CimDisplay } from "@/components/cim-display";
import { CoverImageDisplay } from "@/components/cover-image-display";
import { NdaDialog } from "@/components/nda-dialog";
import { UploadedFileViewer } from "@/components/uploaded-file-viewer";
import { FinancialDocumentsDisplay } from "@/components/financial-documents-display";
import { ShareStickySidebar } from "@/components/share-sticky-sidebar";
import { Shield, FileText, AlertCircle, Download, Package, DollarSign, TrendingUp, BarChart3, Loader2, Globe, ExternalLink } from "lucide-react";

export function SharePage() {
  const [matchShare, paramsShare] = useRoute("/share/:shareSlug");
  const [matchCims, paramsCims] = useRoute("/cims/:shareSlug");
  const shareSlug = paramsShare?.shareSlug || paramsCims?.shareSlug;

  const [showNdaDialog, setShowNdaDialog] = useState(false);
  const [hasSignedNda, setHasSignedNda] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // Parallax effect state
  const [scrollY, setScrollY] = useState(0);
  const coverImageRef = useRef<HTMLDivElement>(null);

  // Check for access token in URL params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    if (token) {
      setAccessToken(token);
      // Remove token from URL for security
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Parallax scroll effect with performance optimization
  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          setScrollY(window.scrollY);
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Validate access token if present
  const { data: tokenValidation, isLoading: isValidatingToken, error: tokenError } = useQuery({
    queryKey: ['/api/nda/validate-token', accessToken],
    queryFn: async () => {
      if (!accessToken) return null;
      const response = await fetch(`/api/nda/validate-token/${accessToken}`);
      if (!response.ok) {
        console.error('Token validation failed:', response.status, response.statusText);
        // Don't return invalid here - let the query error handling take care of it
        throw new Error(`Token validation failed: ${response.status}`);
      }
      return response.json();
    },
    enabled: !!accessToken,
    staleTime: 10 * 60 * 1000, // 10 minutes
    retry: false, // Don't retry token validation to avoid race conditions
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
    refetchOnMount: false // Don't refetch on component remount
  });

  const { data: shareData, isLoading, error } = useQuery({
    queryKey: ['/api/share', shareSlug],
    queryFn: async () => {
      console.log('🔍 Fetching share data for:', shareSlug);
      const response = await fetch(`/api/share/${shareSlug}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });

      console.log('📡 Share API response:', response.status, response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Share API error:', response.status, errorText);
        throw new Error(`Failed to fetch shared CIM: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Share data received:', data);
      return data;
    },
    enabled: !!shareSlug,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 1, // Only retry once to avoid excessive requests
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
    refetchOnMount: false // Don't refetch on component remount
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
    console.log('🔄 Share page effect - shareData:', shareData, 'error:', error, 'isLoading:', isLoading);
    if (shareData?.cim?.requiresNda && !hasSignedNda) {
      setShowNdaDialog(true);
    }
  }, [shareData, hasSignedNda, error, isLoading]);

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

  // If user has a valid access token, they can bypass NDA
  const hasValidToken = tokenValidation?.valid === true;
  const shouldShowNda = shareData?.requiresNda && !hasSignedNda && !hasValidToken;

  // Show loading state while validating token
  if (accessToken && isValidatingToken) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="flex justify-center items-center min-h-[50vh]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-gray-600">Validating access...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show error if token validation failed with an actual error (not just missing token)
  if (accessToken && tokenError && !isValidatingToken) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="flex justify-center items-center min-h-[50vh]">
          <Card className="max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 p-3 rounded-full bg-red-100">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <CardTitle>Invalid or Expired Access Token</CardTitle>
              <CardDescription>
                The access link you used is no longer valid. Please request a new link or sign the NDA again.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Button onClick={() => window.location.href = `/share/${shareSlug}`}>
                Return to Document
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (shouldShowNda) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="flex justify-center items-center min-h-[50vh]">
          <Card className="max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 p-3 rounded-full bg-blue-100">
                <Shield className="h-6 w-6 text-blue-600" />
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
          ndaUrl={shareData.ndaUrl}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
      {/* Cover Image with Header Overlay - only for non-uploaded file CIMs */}
      {!shareData.cim.isUploadedFile && shareData.cim.coverImageUrl ? (
        <div ref={coverImageRef} className="relative h-[35vh] md:h-[40vh] overflow-hidden">
          {/* Cover Image with Parallax */}
          <div 
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url(${shareData.cim.coverImageUrl})`,
              backgroundPosition: shareData.cim.coverImagePosition || 'center',
              transform: `translate3d(0, ${scrollY * 0.5}px, 0) scale(1.1)`,
              willChange: 'transform'
            }}
          />

          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60" />

          {/* Header Content Overlay - Bottom Positioned */}
          <div 
            className="absolute inset-x-0 bottom-0 pb-16 px-6 transition-opacity duration-300"
            style={{
              opacity: Math.max(0, 1 - (scrollY / 400))
            }}
          >
            <div className="max-w-6xl mx-auto text-center">
              <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 tracking-tight"
                  style={{
                    textShadow: '0 2px 4px rgba(0,0,0,0.3), 0 4px 8px rgba(0,0,0,0.2), 0 8px 16px rgba(0,0,0,0.1)'
                  }}>
                {shareData.cim.title}
              </h1>
              {shareData.cim.description && (
                <p className="text-lg md:text-xl text-white/90 max-w-3xl mx-auto leading-relaxed mb-8"
                   style={{
                     textShadow: '0 1px 2px rgba(0,0,0,0.4), 0 2px 4px rgba(0,0,0,0.2)'
                   }}>
                  {shareData.cim.description}
                </p>
              )}

              {/* Export Button */}
              <div className="mt-8">
                <Button
                  variant="outline"
                  onClick={async () => {
                    setIsExportingPdf(true);
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
                    } finally {
                      setIsExportingPdf(false);
                    }
                  }}
                  disabled={isExportingPdf}
                  className="min-w-[200px] border-white/30 text-white hover:bg-white hover:text-slate-800 bg-white/5 backdrop-blur-sm transition-all duration-200"
                  style={{
                    boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
                  }}
                >
                  {isExportingPdf ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating PDF...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-5 w-5" />
                      Export as PDF
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Cover Image Attribution */}
          {shareData.cim.coverImageAttribution && (
            <div 
              className="absolute bottom-2 right-2 text-white/70 text-xs bg-black/20 px-2 py-1 rounded backdrop-blur-sm"
              dangerouslySetInnerHTML={{ __html: shareData.cim.coverImageAttribution }}
            />
          )}
        </div>
      ) : (
        // Fallback header when no cover image - only show logo if no cover image exists
        <div className="bg-white/90 backdrop-blur-sm border-b border-gray-200/50 shadow-sm">
          <div className="max-w-6xl mx-auto px-6 py-12">
            <div className="text-center">
              {/* Website extracted logo above title - only when no cover image */}
              {shareData.logoUrl && (
                <div className="flex justify-center mb-6">
                  <img src={shareData.logoUrl} alt="Company Logo" className="h-32 md:h-40" />
                </div>
              )}
              <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 bg-clip-text text-transparent mb-4 tracking-tight">
                {shareData.cim.title}
              </h1>
              {shareData.cim.description && (
                <p className="text-lg text-slate-600 max-w-3xl mx-auto leading-relaxed mb-8">
                  {shareData.cim.description}
                </p>
              )}

              {/* Export Button */}
              <div className="mt-8">
                <Button
                  variant="outline"
                  onClick={async () => {
                    setIsExportingPdf(true);
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
                    } finally {
                      setIsExportingPdf(false);
                    }
                  }}
                  disabled={isExportingPdf}
                  className="min-w-[200px] border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  {isExportingPdf ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating PDF...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-5 w-5" />
                      Export as PDF
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Content section with sidebar layout */}
      <div className="max-w-[90rem] mx-auto px-6 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Main content area */}
          <div className="flex-1 min-w-0 space-y-6">
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
                  <Card className="border-0 shadow-2xl bg-gradient-to-br from-white/95 to-gray-50/95 backdrop-blur-md rounded-2xl overflow-hidden">
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
              <>
                {/* Financial Information Section */}
                {(shareData.cim.askingPrice || shareData.cim.revenue || shareData.cim.ebitda) && (
                  <Card className="border-0 shadow-2xl bg-gradient-to-br from-white/95 to-gray-50/95 backdrop-blur-md rounded-2xl overflow-hidden">
                    <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-150 pb-6 pt-8 px-8 border-b border-blue-200/50">
                      <CardTitle className="flex items-center gap-3 text-2xl font-bold text-slate-800">
                        <div className="p-2 bg-blue-300 rounded-lg">
                          <DollarSign className="h-6 w-6 text-blue-700" />
                        </div>
                        Financial Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-8">
                      {/* Website extracted logo inside financial box */}
                      {shareData.logoUrl && (
                        <div className="flex justify-center mb-8 pb-6 border-b border-gray-200">
                          <img 
                            src={shareData.logoUrl} 
                            alt="Company Logo" 
                            className="h-24 md:h-36 object-contain"
                          />
                        </div>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {shareData.cim.askingPrice && (
                          <div className="text-center p-6 bg-white rounded-xl shadow-sm border border-gray-100">
                            <div className="flex items-center justify-center gap-2 mb-3">
                              <DollarSign className="h-5 w-5 text-blue-600" />
                              <h4 className="text-lg font-semibold text-gray-600">Asking Price</h4>
                            </div>
                            <p className="text-3xl font-bold text-blue-600">
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

                {/* Website URL Section */}
                {shareData.websiteUrl && (
                  <Card className="border-0 shadow-2xl bg-gradient-to-br from-white/95 to-gray-50/95 backdrop-blur-md rounded-2xl overflow-hidden">
                    <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 pb-6 pt-8 px-8 border-b border-green-200/50">
                      <CardTitle className="flex items-center gap-3 text-2xl font-bold text-slate-800">
                        <div className="p-2 bg-green-100 rounded-lg">
                          <Globe className="h-6 w-6 text-green-600" />
                        </div>
                        Website
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-8">
                      <div className="text-center">
                        <a 
                          href={shareData.websiteUrl.startsWith('http') ? shareData.websiteUrl : `https://${shareData.websiteUrl}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-2xl font-semibold text-green-600 hover:text-green-700 transition-colors duration-200 hover:underline"
                        >
                          {shareData.websiteUrl.replace(/^https?:\/\//, '')}
                          <ExternalLink className="h-5 w-5" />
                        </a>
                        <p className="text-gray-600 mt-3 text-lg">
                          Visit the company website to learn more
                        </p>
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
                  cimDocument={shareData.cim}
                />
              </>
            )}
          </div>

          {/* Sticky Sidebar */}
          <div className="lg:w-[28rem] flex-shrink-0">
            <ShareStickySidebar 
              shareSlug={shareSlug!}
              cimTitle={shareData.cim.title}
              userProfile={shareData.userProfileData || shareData.cim.userProfile}
              logoUrl={shareData.logoUrl}
            />
          </div>
        </div>
      </div>
    </div>
  );
}