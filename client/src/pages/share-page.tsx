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
import { Shield, FileText, AlertCircle, Download, Package, DollarSign, TrendingUp, BarChart3, Loader2, Globe, ExternalLink, Clock, Phone, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OwnerToolbar } from "@/components/owner-toolbar";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { sanitizeHtml } from "@/lib/sanitize";

export function SharePage() {
  const [matchShare, paramsShare] = useRoute("/share/:shareSlug");
  const [matchCims, paramsCims] = useRoute("/cims/:shareSlug");
  const shareSlug = paramsShare?.shareSlug || paramsCims?.shareSlug;

  const [showNdaDialog, setShowNdaDialog] = useState(false);
  const [hasSignedNda, setHasSignedNda] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const [hasShownBypassNotification, setHasShownBypassNotification] = useState(false);

  // Password protection state
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [enteredPassword, setEnteredPassword] = useState<string | null>(null);
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);

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

  // Step 1: Fast NDA check
  const { data: ndaCheck, isLoading: isCheckingNda, error: ndaCheckError } = useQuery({
    queryKey: ['/api/share/nda-check', shareSlug],
    queryFn: async () => {
      const response = await fetch(`/api/share/${shareSlug}/nda-check`);

      if (!response.ok) {
        throw new Error(`Failed to check NDA status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    },
    enabled: !!shareSlug,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false
  });

  // Step 2: Load full document data only if no NDA required OR user has access OR user is owner
  const shouldLoadFullData = Boolean(ndaCheck && (!ndaCheck.requiresNda || hasSignedNda || accessToken || ndaCheck.isOwner) && !ndaCheckError);

  const { data: shareData, isLoading, error } = useQuery({
    queryKey: ['/api/share', shareSlug, accessToken, enteredPassword],
    queryFn: async () => {
      let url = `/api/share/${shareSlug}`;
      const params = new URLSearchParams();
      if (accessToken) params.append('token', accessToken);
      if (enteredPassword) params.append('password', enteredPassword);
      if (params.toString()) url += `?${params.toString()}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        // Handle password required response
        if (response.status === 401 && errorData.requiresPassword) {
          setRequiresPassword(true);
          if (enteredPassword) {
            setPasswordError('Incorrect password. Please try again.');
          }
          throw new Error('PASSWORD_REQUIRED');
        }

        throw new Error(`Failed to fetch shared CIM: ${response.status}`);
      }

      // Password accepted - clear any error state
      setRequiresPassword(false);
      setPasswordError('');

      const data = await response.json();
      return data;
    },
    enabled: Boolean(shouldLoadFullData),
    refetchOnWindowFocus: false,
    retry: false // Don't auto-retry on password errors
  });

  // Don't redirect - show NDA dialog instead when needed

  // Fetch uploaded files for the shared document
  const { data: uploadedFiles = [], isLoading: filesLoading } = useQuery({
    queryKey: ['/api/share', shareSlug, 'files'],
    queryFn: async () => {
      const response = await fetch(`/api/share/${shareSlug}/files`);
      if (!response.ok) {
        throw new Error('Failed to fetch files');
      }
      const data = await response.json();
      return data;
    },
    enabled: !!shareSlug && !!shareData?.cim?.analysis?.isUploadedFile,
    staleTime: 0,
    gcTime: 0
  });

  useEffect(() => {

    // Don't show bypass screen anymore - the server already handles owner bypass
    // The owner will see the document directly since requiresNda is false for them

    if (shareData?.cim?.requiresNda && !hasSignedNda) {
      setShowNdaDialog(true);
    }
  }, [shareData, hasSignedNda, error, isLoading, ndaCheck]);

  // Show notification when NDA is bypassed for collaborators/owners
  useEffect(() => {
    if (shareData?.bypassedNda && !hasShownBypassNotification) {
      const role = shareData.isOwner ? "document owner" : shareData.isCollaborator ? "collaborator" : "";
      if (role) {
        toast({
          title: "NDA Requirement Bypassed",
          description: `As a ${role}, you can access this NDA-protected document without signing.`,
          duration: 5000,
        });
        setHasShownBypassNotification(true);
      }
    }
  }, [shareData?.bypassedNda, shareData?.isOwner, shareData?.isCollaborator, hasShownBypassNotification, toast]);

  // Heartbeat tracking for time spent on page
  useEffect(() => {
    const sessionId = shareData?.viewSessionId;
    if (!sessionId) return; // Don't track for owners or if no session

    const HEARTBEAT_INTERVAL = 30000; // 30 seconds

    const sendHeartbeat = async () => {
      try {
        await fetch('/api/track/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            additionalSeconds: 30
          })
        });
      } catch (error) {
        console.error('Heartbeat failed:', error);
      }
    };

    // Send heartbeat every 30 seconds
    const intervalId = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

    // Also send on page unload
    const handleUnload = () => {
      // Use sendBeacon for reliable delivery on page close
      navigator.sendBeacon('/api/track/heartbeat', JSON.stringify({
        sessionId,
        additionalSeconds: Math.floor((Date.now() % HEARTBEAT_INTERVAL) / 1000)
      }));
    };

    window.addEventListener('beforeunload', handleUnload);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('beforeunload', handleUnload);
      // Send final heartbeat on cleanup
      sendHeartbeat();
    };
  }, [shareData?.viewSessionId]);

  if (isCheckingNda || isLoading || isValidatingToken) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/40 p-4">
        <div className="flex justify-center items-center min-h-[50vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading document...</p>
          </div>
        </div>
      </div>
    );
  }

  // Password entry handler
  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordInput.trim()) {
      setPasswordError('Please enter a password');
      return;
    }
    setPasswordError('');
    setIsSubmittingPassword(true);
    setEnteredPassword(passwordInput);
    // The query will auto-refetch when enteredPassword changes
    setTimeout(() => setIsSubmittingPassword(false), 500);
  };

  // Show password entry form if document requires password
  if (requiresPassword && !shareData) {
    const ownerLogo = ndaCheck?.ownerBusinessLogo;
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/40 p-4">
        <div className="flex justify-center items-center min-h-[50vh]">
          <Card className="max-w-md w-full">
            <CardHeader className="text-center">
              {ownerLogo ? (
                <div className="mx-auto mb-4 max-w-[180px] max-h-[80px] flex items-center justify-center">
                  <img
                    src={ownerLogo}
                    alt="Business logo"
                    className="max-w-full max-h-[80px] object-contain"
                  />
                </div>
              ) : (
                <div className="mx-auto mb-4 w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <Lock className="h-6 w-6 text-blue-600" />
                </div>
              )}
              <CardTitle>Password Protected</CardTitle>
              <CardDescription>
                This document requires a password to view.
                {ndaCheck?.title && (
                  <span className="block mt-2 font-medium text-foreground">
                    "{ndaCheck.title}"
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="share-password">Password</Label>
                  <Input
                    id="share-password"
                    type="password"
                    placeholder="Enter password"
                    value={passwordInput}
                    onChange={(e) => {
                      setPasswordInput(e.target.value);
                      setPasswordError('');
                    }}
                    autoFocus
                  />
                  {passwordError && (
                    <p className="text-sm text-red-500">{passwordError}</p>
                  )}
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmittingPassword}
                >
                  {isSubmittingPassword ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    'Access Document'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Show generic error for non-password related errors
  if ((error && error.message !== 'PASSWORD_REQUIRED') || tokenError || ndaCheckError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/40 p-4">
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

  // If NDA check shows document exists but requires NDA, don't show "not found"
  if (!shareData && !ndaCheck) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/40 p-4">
        <div className="flex justify-center items-center min-h-[50vh]">
          <div className="text-center text-gray-600">
            <p>Document not found</p>
          </div>
        </div>
      </div>
    );
  }

  // If document requires NDA and user hasn't signed, redirect directly to NDA signing
  // No intermediate dialogue - go straight to the NDA flow

  // If user has a valid access token, they can bypass NDA
  const hasValidToken = tokenValidation?.valid === true;

  // Show NDA dialog if document requires NDA and user hasn't signed or has no valid token and is not owner
  const shouldShowNdaDialog = ndaCheck?.requiresNda && !hasSignedNda && !accessToken && !ndaCheckError && !ndaCheck?.isOwner;

  // Only access shareData.cim if shareData exists
  const cimData = shareData?.cim;

  // Check if manual approval is required and not yet granted
  const needsApproval = shareData?.ndaApprovalStatus?.requiresApproval && !shareData?.ndaApprovalStatus?.isApproved;

  // Show loading state while validating token
  if (accessToken && isValidatingToken) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/40 p-4">
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/40 p-4">
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

  // Show approval pending message if manual approval is required but not granted
  if (needsApproval) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/40 p-4">
        <div className="flex justify-center items-center min-h-[50vh]">
          <Card className="max-w-lg">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 p-3 rounded-full bg-orange-100">
                <Clock className="h-6 w-6 text-orange-600" />
              </div>
              <CardTitle>Approval Pending</CardTitle>
              <CardDescription>
                {shareData?.ndaApprovalStatus?.message || "Your NDA signature is pending approval before you can view this document."}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-sm text-gray-600 mb-4">
                You'll receive an email with access once your signature is approved.
              </p>
              <Button variant="outline" onClick={() => window.location.reload()}>
                Check Status
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }


  // Show NDA dialog if required
  if (shouldShowNdaDialog) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/40 p-4">
        <div className="flex justify-center items-center min-h-[50vh]">
          <NdaDialog
            isOpen={true}
            onClose={() => {}}
            onSigned={() => setHasSignedNda(true)}
            shareSlug={shareSlug || ''}
            ndaUrl={undefined}
          />
        </div>
      </div>
    );
  }

  // Don't render if shareData or cimData is not available
  if (!shareData || !cimData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/40 p-4">
        <div className="flex justify-center items-center min-h-[50vh]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-gray-600">Loading document...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50">
      {/* Owner Toolbar */}
      {shareData?.isOwner && cimData && (
        <OwnerToolbar
          documentId={cimData.id}
          shareSlug={cimData.shareSlug || shareSlug || ''}
        />
      )}
      {/* Add top padding when owner toolbar is visible */}
      <div className={shareData?.isOwner ? "pt-12" : ""}>
      {/* Cover Image with Header Overlay - only for non-uploaded file CIMs */}
      {!cimData.analysis?.isUploadedFile && cimData.coverImageUrl ? (
        <div ref={coverImageRef} className="relative h-[35vh] md:h-[40vh] overflow-hidden animate-fade-in">
          {/* Cover Image with Parallax */}
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url(${cimData.coverImageUrl})`,
              backgroundPosition: (() => {
                if (cimData.coverImagePosition) {
                  try {
                    const position = JSON.parse(cimData.coverImagePosition);
                    return `${position.x}% ${position.y}%`;
                  } catch {
                    return 'center';
                  }
                }
                return 'center';
              })(),
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
              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold text-white mb-8 tracking-tight break-words px-4 animate-slide-up delay-300"
                  style={{
                    textShadow: '0 2px 4px rgba(0,0,0,0.3), 0 4px 8px rgba(0,0,0,0.2), 0 8px 16px rgba(0,0,0,0.1)'
                  }}>
                {shareData.cim.title}
              </h1>
              {shareData.cim.description && (
                <p className="text-sm sm:text-base md:text-lg lg:text-xl text-white/90 max-w-3xl mx-auto leading-relaxed mb-8 break-words px-4 animate-slide-up delay-500"
                   style={{
                     textShadow: '0 1px 2px rgba(0,0,0,0.4), 0 2px 4px rgba(0,0,0,0.2)'
                   }}>
                  {shareData.cim.description}
                </p>
              )}

              {/* Export Button - only show for generated CIMs, not uploaded ones */}
              {!shareData.cim.analysis?.isUploadedFile && (
                <div className="mt-8 animate-slide-up delay-700">
                  <Button
                    variant="outline"
                    onClick={async () => {
                      setIsExportingPdf(true);
                      try {
                        const response = await fetch(`/api/share/${shareSlug}/export/pdf`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ password: enteredPassword })
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

                          // Track download
                          if (shareData.viewSessionId) {
                            fetch('/api/track/download', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                documentId: shareData.cim.id,
                                downloadType: 'pdf',
                                viewerEmail: shareData.viewerEmail,
                                sessionId: shareData.viewSessionId
                              })
                            }).catch(console.error);
                          }
                        } else {
                          const errorData = await response.json().catch(() => ({}));
                          toast({
                            title: "PDF Export Failed",
                            description: errorData.error || "Failed to generate PDF",
                            variant: "destructive"
                          });
                        }
                      } catch (error) {
                        toast({
                          title: "PDF Export Failed",
                          description: "An error occurred while generating the PDF",
                          variant: "destructive"
                        });
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
              )}
            </div>
          </div>

          {/* Cover Image Attribution */}
          {shareData.cim.coverImageAttribution && (
            <div
              className="absolute bottom-2 right-2 text-white/70 text-xs bg-black/20 px-2 py-1 rounded backdrop-blur-sm"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(shareData.cim.coverImageAttribution) }}
            />
          )}
        </div>
      ) : (
        // Fallback header when no cover image - only show logo for generated CIMs (not uploaded)
        <div className="bg-white/90 backdrop-blur-sm border-b border-gray-200/50 shadow-sm animate-slide-down">
          <div className="max-w-6xl mx-auto px-6 py-12">
            <div className="text-center">
              {/* Website extracted logo above title - only for generated CIMs, not uploaded files */}
              {!shareData.cim.analysis?.isUploadedFile && (shareData.cim.logoUrl || shareData.cim.userProfile?.businessLogo) && (
                <div className="flex justify-center mb-6 animate-fade-in delay-200">
                  <img
                    src={shareData.cim.logoUrl || shareData.cim.userProfile?.businessLogo}
                    alt="Company Logo"
                    className="h-16 md:h-20 max-w-[200px] object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              )}
              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-slate-600 to-blue-600 bg-clip-text text-transparent mb-8 tracking-tight break-words px-4 animate-slide-up delay-300">
                {shareData.cim.title}
              </h1>
              {shareData.cim.description && (
                <p className="text-sm sm:text-base md:text-lg text-slate-600 max-w-3xl mx-auto leading-relaxed mb-8 break-words px-4 animate-slide-up delay-500">
                  {shareData.cim.description}
                </p>
              )}

              {/* Export Button - only show for generated CIMs, not uploaded ones */}
              {!shareData.cim.analysis?.isUploadedFile && (
                <div className="mt-8 animate-slide-up delay-700">
                  <Button
                    variant="outline"
                    onClick={async () => {
                      setIsExportingPdf(true);
                      try {
                        const response = await fetch(`/api/share/${shareSlug}/export/pdf`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ password: enteredPassword })
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

                          // Track download
                          if (shareData.viewSessionId) {
                            fetch('/api/track/download', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                documentId: shareData.cim.id,
                                downloadType: 'pdf',
                                viewerEmail: shareData.viewerEmail,
                                sessionId: shareData.viewSessionId
                              })
                            }).catch(console.error);
                          }
                        } else {
                          const errorData = await response.json().catch(() => ({}));
                          toast({
                            title: "PDF Export Failed",
                            description: errorData.error || "Failed to generate PDF",
                            variant: "destructive"
                          });
                        }
                      } catch (error) {
                        toast({
                          title: "PDF Export Failed",
                          description: "An error occurred while generating the PDF",
                          variant: "destructive"
                        });
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
              )}
            </div>
          </div>
        </div>
      )}

      {/* Content section with sidebar layout */}
      <div className="max-w-[90rem] mx-auto px-4 md:px-6 py-8">
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
          {/* Main content area */}
          <div className="flex-1 min-w-0 space-y-6 animate-fade-in delay-200">
            {shareData.cim.analysis?.isUploadedFile === true ? (
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
                  <Card className="border-0 shadow-2xl bg-gradient-to-br from-white/95 to-gray-50/95 backdrop-blur-md rounded-2xl overflow-hidden animate-slide-up delay-300">
                    <CardHeader className="bg-gradient-to-r from-slate-600 to-blue-600 text-white pb-6 pt-8 px-8">
                      <CardTitle className="flex items-center gap-3 text-2xl font-bold text-white">
                        <div className="p-2 bg-white/20 rounded-lg">
                          <Package className="h-6 w-6 text-white" />
                        </div>
                        Document Files ({uploadedFiles.length})
                      </CardTitle>
                      <CardDescription className="text-lg text-white/90 mt-2">
                        Download individual files or all files at once
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-8 space-y-6">
                      <div className="space-y-4">
                        {uploadedFiles.map((file: any, index: number) => (
                          <div key={file.id} className="flex items-center justify-between p-6 bg-white/80 backdrop-blur-sm border border-gray-200/50 rounded-xl hover:bg-white/90 hover:shadow-lg transition-all duration-200 animate-slide-up stagger-100">
                            <div className="flex items-center gap-4">
                              <div className="p-3 bg-blue-50 rounded-lg">
                                <FileText className="h-6 w-6 text-blue-600" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-lg text-slate-900 break-words">{file.fileName}</p>
                                <p className="text-sm text-slate-500 mt-1 break-words">
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
                  <div className="animate-slide-up delay-300">
                    <UploadedFileViewer
                      cimDocument={shareData.cim}
                      shareSlug={shareSlug!}
                      userProfile={shareData.cim.userProfile}
                      uploadedFiles={uploadedFiles}
                    />
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Financial Information Section - Always show */}
                <Card className="border-0 shadow-2xl bg-gradient-to-br from-white/95 to-gray-50/95 backdrop-blur-md rounded-2xl overflow-hidden animate-slide-up delay-300">
                    <CardHeader className="bg-gradient-to-r from-slate-600 to-blue-600 text-white pb-6 pt-8 px-8">
                      <CardTitle className="flex items-center gap-3 text-2xl font-bold text-white">
                        <div className="p-2 bg-white/20 rounded-lg">
                          <DollarSign className="h-6 w-6 text-white" />
                        </div>
                        Financial Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-8">
                      {/* Website extracted logo inside financial box - use website logo unless user uploaded override */}
                      {(shareData.cim.logoUrl || shareData.cim.userProfile?.businessLogo) && (
                        <div className="flex justify-center mb-8 pb-6 border-b border-gray-200 animate-fade-in delay-500">
                          <img
                            src={shareData.cim.logoUrl || shareData.cim.userProfile?.businessLogo}
                            alt="Company Logo"
                            className="h-24 md:h-36 object-contain"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        </div>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="text-center p-6 bg-white rounded-xl shadow-sm border border-gray-100 animate-slide-up delay-500">
                          <div className="flex items-center justify-center gap-2 mb-3">
                            <DollarSign className="h-5 w-5 text-blue-600" />
                            <h4 className="text-lg font-semibold text-gray-600">Asking Price</h4>
                          </div>
                          <p className="text-2xl sm:text-3xl font-bold text-blue-600 break-words">
                            {shareData.cim.askingPrice || "Not specified"}
                          </p>
                        </div>
                        <div className="text-center p-6 bg-white rounded-xl shadow-sm border border-gray-100 animate-slide-up delay-700">
                          <div className="flex items-center justify-center gap-2 mb-3">
                            <TrendingUp className="h-5 w-5 text-blue-600" />
                            <h4 className="text-lg font-semibold text-gray-600">Annual Revenue</h4>
                          </div>
                          <p className="text-2xl sm:text-3xl font-bold text-blue-600 break-words">
                            {shareData.cim.revenue || "Not specified"}
                          </p>
                        </div>
                        <div className="text-center p-6 bg-white rounded-xl shadow-sm border border-gray-100 animate-slide-up delay-1000">
                          <div className="flex items-center justify-center gap-2 mb-3">
                            <BarChart3 className="h-5 w-5 text-purple-600" />
                            <h4 className="text-lg font-semibold text-gray-600">EBITDA</h4>
                          </div>
                          <p className="text-2xl sm:text-3xl font-bold text-purple-600 break-words">
                            {shareData.cim.ebitda || "Not specified"}
                          </p>
                        </div>
                      </div>

                      {/* Financial Documents Download Section */}
                      <div className="animate-slide-up delay-1000">
                        <FinancialDocumentsDisplay cimId={shareData.cim.id} shareSlug={shareSlug!} />
                      </div>
                    </CardContent>
                  </Card>

                {/* Website URL Section */}
                {shareData.websiteUrl && (
                  <Card className="border-0 shadow-2xl bg-gradient-to-br from-white/95 to-gray-50/95 backdrop-blur-md rounded-2xl overflow-hidden animate-slide-up delay-500">
                    <CardHeader className="bg-gradient-to-r from-slate-600 to-blue-600 text-white pb-6 pt-8 px-8">
                      <CardTitle className="flex items-center gap-3 text-2xl font-bold text-white">
                        <div className="p-2 bg-white/20 rounded-lg">
                          <Globe className="h-6 w-6 text-white" />
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
                          className="inline-flex items-center gap-2 text-xl md:text-2xl font-semibold text-blue-600 hover:text-blue-700 transition-colors duration-200 hover:underline break-all"
                        >
                          <span className="break-all">{shareData.websiteUrl.replace(/^https?:\/\//, '')}</span>
                          <ExternalLink className="h-5 w-5 flex-shrink-0" />
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
                  logoUrl={shareData.cim.logoUrl}
                  selectedImages={shareData.cim.selectedImages}
                  title={shareData.cim.title}
                  userProfile={shareData.cim.userProfile}
                  cimDocument={shareData.cim}
                  customSections={shareData.customSections}
                />
              </>
            )}
          </div>

          {/* Sticky Sidebar */}
          <div className="lg:w-[28rem] flex-shrink-0 animate-slide-right delay-300">
            <ShareStickySidebar
              shareSlug={shareSlug!}
              cimTitle={shareData.cim.title}
              userProfile={shareData.userProfileData || shareData.cim.userProfile}
              logoUrl={shareData.cim.logoUrl}
            />
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}