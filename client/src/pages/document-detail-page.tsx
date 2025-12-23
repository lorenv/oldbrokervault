import { useState, useEffect } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, BarChart3, Edit, Edit2, FileSignature, Share2, Eye, Users, Calendar, TrendingUp, Check, X, Link as LinkIcon, Copy, Palette, FileText } from "lucide-react";
import { useCimDocument, useFinancialFiles, useCustomSections, useNdaSignatures } from "@/hooks/use-cim-document";
import { DocumentSkeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { getBaseUrlWithSubdomain } from "@/lib/url-utils";
import { CimDisplay } from "@/components/cim-display";
import { DocumentExport } from "@/components/document-export";
import { useMutation, useQueryClient } from "@tanstack/react-query";

// Tab Components
import { DocumentAnalyticsTab } from "@/components/document-tabs/analytics-tab";
import { DocumentEditTab } from "@/components/document-tabs/edit-tab";
import { DocumentNdaTab } from "@/components/document-tabs/nda-tab";
import { DocumentShareTab } from "@/components/document-tabs/share-tab";
import { DocumentAppearanceTab } from "@/components/document-tabs/appearance-tab";
import { DocumentTeaserTab } from "@/components/document-tabs/teaser-tab";
import { apiRequest } from "@/lib/queryClient";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Editable Title Component
interface EditableTitleProps {
  title: string;
  docId: number;
  onTitleUpdate?: (newTitle: string) => void;
}

function EditableTitle({ title, docId, onTitleUpdate }: EditableTitleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(title);
  const [displayTitle, setDisplayTitle] = useState(title);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Update editTitle and displayTitle when title prop changes
  useEffect(() => {
    setEditTitle(title);
    setDisplayTitle(title);
  }, [title]);

  const updateTitleMutation = useMutation({
    mutationFn: async (newTitle: string) => {
      const response = await apiRequest("PATCH", `/api/cim/${docId}`, {
        body: {
          title: newTitle
        }
      });
      if (!response.ok) {
        throw new Error('Failed to update title');
      }
      return response.json();
    },
    onMutate: async (newTitle: string) => {
      // Immediately update the display title for instant UI feedback
      setDisplayTitle(newTitle);
      
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: [`/api/cim/${docId}`] });
      
      // Snapshot the previous value
      const previousData = queryClient.getQueryData([`/api/cim/${docId}`]);
      
      // Optimistically update the cache
      queryClient.setQueryData([`/api/cim/${docId}`], (old: any) => {
        return old ? { ...old, title: newTitle } : old;
      });
      
      // Return context for potential rollback
      return { previousData, previousDisplayTitle: displayTitle };
    },
    onSuccess: (data) => {
      // Invalidate to ensure we have the latest server data
      queryClient.invalidateQueries({ queryKey: [`/api/cim/${docId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/cim'] });
      toast({ title: "Title Updated", description: "Document title saved successfully." });
      onTitleUpdate?.(editTitle);
      setIsEditing(false);
    },
    onError: (err, newTitle, context: any) => {
      // Rollback both cache and display title
      if (context?.previousData) {
        queryClient.setQueryData([`/api/cim/${docId}`], context.previousData);
      }
      if (context?.previousDisplayTitle) {
        setDisplayTitle(context.previousDisplayTitle);
      }
      setEditTitle(title); // Revert edit field
      toast({ title: "Save Failed", description: "Failed to save title changes.", variant: "destructive" });
      setIsEditing(false);
    }
  });

  const handleSave = () => {
    if (editTitle.trim() !== title) {
      updateTitleMutation.mutate(editTitle.trim());
    } else {
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setEditTitle(title);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center justify-center gap-2">
        <input
          type="text"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight bg-transparent border-none outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded px-2 py-1 text-center text-gray-900"
          autoFocus
          disabled={updateTitleMutation.isPending}
        />
        <Button
          size="sm"
          onClick={handleSave}
          disabled={updateTitleMutation.isPending}
          className="h-8 w-8 p-0"
        >
          <Check className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleCancel}
          disabled={updateTitleMutation.isPending}
          className="h-8 w-8 p-0"
        >
          <X className="h-4 w-4 text-gray-700" />
        </Button>
      </div>
    );
  }

  return (
    <div
      className="group cursor-pointer hover:bg-gray-50 rounded px-3 py-2 transition-colors flex items-center justify-center gap-2"
      onClick={() => setIsEditing(true)}
      title="Click to edit title"
    >
      <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-gray-900">{displayTitle}</h1>
      <Edit2 className="h-5 w-5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex-shrink-0" />
    </div>
  );
}

export function DocumentDetailPage() {
  const [matched, params] = useRoute('/documents/:id');
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const docId = params?.id ? parseInt(params.id) : undefined;
  
  // Get current tab from URL or default to edit for new documents
  const urlTab = new URLSearchParams(window.location.search).get('tab') || 'edit';
  const [activeTab, setActiveTab] = useState(urlTab);

  
  // Fetch document data
  const { data: cimDocument, isLoading: docLoading, error: docError } = useCimDocument(docId, !!docId);
  const { data: financialFiles } = useFinancialFiles(docId, !!docId);
  const { data: customSections } = useCustomSections(docId, !!docId);
  const { data: ndaSignatures } = useNdaSignatures(docId, !!docId);

  // Calculate pending NDA approvals
  const pendingNdaCount = ndaSignatures?.filter((sig: any) =>
    cimDocument?.ndaApprovalRequired && !sig.approved
  ).length || 0;

  // Update URL when tab changes
  useEffect(() => {
    if (docId) {
      const newUrl = `/documents/${docId}${activeTab !== 'edit' ? `?tab=${activeTab}` : ''}`;
      if (window.location.pathname + window.location.search !== newUrl) {
        window.history.replaceState(null, '', newUrl);
      }
    }
  }, [activeTab, docId]);
  
  // Handle tab change
  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };

  // Share link functions
  const [copyButtonState, setCopyButtonState] = useState<'idle' | 'copied' | 'error' | 'hidden'>('idle');

  const generateShareUrl = () => {
    const baseUrl = getBaseUrlWithSubdomain(user?.customSubdomain);
    return `${baseUrl}/share/${cimDocument?.shareSlug || 'not-shared'}`;
  };

  const handleCopyShareLink = async () => {
    if (!cimDocument?.shareSlug) {
      toast({
        title: "Sharing Not Enabled",
        description: "Please enable sharing for this document first in the Share tab.",
        variant: "destructive"
      });
      return;
    }

    try {
      const shareUrl = generateShareUrl();
      await navigator.clipboard.writeText(shareUrl);
// Debug log
      setCopyButtonState('copied');
      // Reset after 1 second, with a brief 'hidden' state to prevent tooltip flash
      setTimeout(() => {
        setCopyButtonState('hidden');
        // After brief hidden period, return to idle
        setTimeout(() => setCopyButtonState('idle'), 200);
      }, 1000);
    } catch (error) {
// Debug log
      setCopyButtonState('error');
      // Reset after 1 second, with a brief 'hidden' state to prevent tooltip flash
      setTimeout(() => {
        setCopyButtonState('hidden');
        // After brief hidden period, return to idle
        setTimeout(() => setCopyButtonState('idle'), 200);
      }, 1000);
    }
  };

  const handlePreviewShareLink = () => {
    if (!cimDocument?.shareSlug) {
      toast({
        title: "Sharing Not Enabled",
        description: "Please enable sharing for this document first in the Share tab.",
        variant: "destructive"
      });
      return;
    }

    const shareUrl = generateShareUrl();
    window.open(shareUrl, '_blank');
  };

  // Get tooltip text based on copy button state
  const getCopyTooltipText = () => {
    switch (copyButtonState) {
      case 'copied':
        return 'Link Copied!';
      case 'error':
        return 'Copy Failed';
      default:
        return 'Copy Share Link';
    }
  };
  
  if (!matched || !docId) {
    setLocation('/documents');
    return (
      <div className="min-h-screen bg-background">
        <main className="container mx-auto px-4 py-8">
          <div className="flex items-center gap-4 mb-6">
            <Link href="/documents">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Documents
              </Button>
            </Link>
          </div>
          <div>Redirecting...</div>
        </main>
      </div>
    );
  }
  
  if (docLoading) {
    return (
      <div className="min-h-screen bg-background">
        <main className="container mx-auto px-4 py-8">
          <div className="flex items-center gap-4 mb-6">
            <Link href="/documents">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Documents
              </Button>
            </Link>
          </div>
          <DocumentSkeleton />
        </main>
      </div>
    );
  }
  
  if (docError || !cimDocument) {
    return (
      <div className="min-h-screen bg-background">
        <main className="container mx-auto px-4 py-8">
          <div className="flex items-center gap-4 mb-6">
            <Link href="/documents">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Documents
              </Button>
            </Link>
          </div>
          <Card>
            <CardContent className="p-6 text-center">
              <h2 className="text-xl font-semibold mb-2">Document Not Found</h2>
              <p className="text-gray-600 mb-4">The CIM document you're looking for doesn't exist or you don't have access to it.</p>
              <Link href="/documents">
                <Button>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Documents
                </Button>
              </Link>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // Access control is handled by the backend - if we successfully fetched the document,
  // the user has permission to view it (either as owner, admin, or collaborator)

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link href="/documents">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Documents
              </Button>
            </Link>
          </div>

          {/* Document Title - Centered, prominent display */}
          <div className="text-center mb-6">
            <div className="inline-block">
              <EditableTitle title={cimDocument.title} docId={docId} />
            </div>
            <div className="flex items-center justify-center gap-4 mt-3 text-sm text-muted-foreground flex-wrap">
              <span>Created {new Date(cimDocument.createdAt).toLocaleDateString()}</span>
              {cimDocument.ndaProtected && (
                <Badge variant="outline" className="border-blue-200 text-blue-700 bg-blue-50">
                  <FileSignature className="h-3 w-3 mr-1" />
                  NDA Protected
                </Badge>
              )}
              {ndaSignatures && ndaSignatures.length > 0 && (
                <Badge variant="outline" className="border-purple-200 text-purple-700 bg-purple-50">
                  <Users className="h-3 w-3 mr-1" />
                  {ndaSignatures.length} Signature{ndaSignatures.length !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>
          </div>
        </div>
        
        {/* Mobile-optimized TabsList with scrollable tabs - Subtle Theme */}
        <div className="lg:hidden mt-6">
          <div className="w-full overflow-x-auto">
            <div className="flex w-max min-w-full bg-gray-50 p-2 rounded-lg gap-1 shadow-sm border border-gray-200">
              {/* Mobile Share Link Action Buttons */}
              <TooltipProvider delayDuration={0}>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handlePreviewShareLink}
                      disabled={!cimDocument?.shareSlug}
                      className={`flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm whitespace-nowrap rounded-md transition-all ${
                        cimDocument?.shareSlug
                          ? 'text-gray-700 hover:text-gray-900 hover:bg-white'
                          : 'text-gray-400 cursor-not-allowed opacity-50'
                      }`}
                    >
                      <Eye className="h-3 w-3 sm:h-4 sm:w-4 text-blue-500" />
                      <span>Preview</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Preview Share Link</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider delayDuration={0}>
                <Tooltip delayDuration={0} open={copyButtonState === 'copied' || copyButtonState === 'error' ? true : copyButtonState === 'hidden' ? false : undefined}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleCopyShareLink}
                      disabled={!cimDocument?.shareSlug}
                      className={`flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm whitespace-nowrap rounded-md transition-all duration-200 ${
                        copyButtonState === 'copied'
                          ? 'bg-green-50 text-green-700 border border-green-200'
                          : copyButtonState === 'error'
                          ? 'bg-red-50 text-red-700 border border-red-200'
                          : cimDocument?.shareSlug
                          ? 'text-gray-700 hover:text-gray-900 hover:bg-white'
                          : 'text-gray-400 cursor-not-allowed opacity-50'
                      }`}
                    >
                      <LinkIcon className="h-3 w-3 sm:h-4 sm:w-4 text-green-500" />
                      <span className="hidden sm:inline">Copy Share Link</span>
                      <span className="sm:hidden">Copy</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className={copyButtonState === 'copied' ? 'bg-green-700 text-white' : copyButtonState === 'error' ? 'bg-red-700 text-white' : ''}>
                    <p>{getCopyTooltipText()}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Visual separator between action buttons and tabs */}
              <div className="w-px bg-gray-300 mx-1 my-1" />

              <button
                onClick={() => handleTabChange('analytics')}
                className={`flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm whitespace-nowrap rounded-md transition-all ${
                  activeTab === 'analytics'
                    ? 'bg-white text-blue-700 shadow-sm border border-blue-200'
                    : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Analytics</span>
                <span className="sm:hidden">Analytics</span>
              </button>
              <button
                onClick={() => handleTabChange('edit')}
                className={`flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm whitespace-nowrap rounded-md transition-all ${
                  activeTab === 'edit'
                    ? 'bg-white text-blue-700 shadow-sm border border-blue-200'
                    : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <Edit className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Edit CIM</span>
                <span className="sm:hidden">Edit</span>
              </button>
              <button
                onClick={() => handleTabChange('nda')}
                className={`flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm whitespace-nowrap rounded-md transition-all relative ${
                  activeTab === 'nda'
                    ? 'bg-white text-blue-700 shadow-sm border border-blue-200'
                    : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <FileSignature className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">NDA Signatures</span>
                <span className="sm:hidden">NDA</span>
                {pendingNdaCount > 0 && (
                  <Badge className="ml-1 sm:ml-2 px-1 sm:px-2 py-0 text-[10px] sm:text-xs bg-orange-500 text-white border-none font-semibold">
                    {pendingNdaCount}
                  </Badge>
                )}
              </button>
              <button
                onClick={() => handleTabChange('share')}
                className={`flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm whitespace-nowrap rounded-md transition-all ${
                  activeTab === 'share'
                    ? 'bg-white text-blue-700 shadow-sm border border-blue-200'
                    : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <Share2 className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Share CIM</span>
                <span className="sm:hidden">Share</span>
              </button>
              <button
                onClick={() => handleTabChange('appearance')}
                className={`flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm whitespace-nowrap rounded-md transition-all ${
                  activeTab === 'appearance'
                    ? 'bg-white text-blue-700 shadow-sm border border-blue-200'
                    : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <Palette className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Appearance</span>
                <span className="sm:hidden">Style</span>
              </button>
              <button
                onClick={() => handleTabChange('teaser')}
                className={`flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm whitespace-nowrap rounded-md transition-all ${
                  activeTab === 'teaser'
                    ? 'bg-white text-blue-700 shadow-sm border border-blue-200'
                    : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <FileText className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Teaser</span>
                <span className="sm:hidden">Teaser</span>
              </button>
            </div>
          </div>
        </div>

        {/* Desktop Sidebar Layout */}
        <div className="flex gap-6 lg:gap-8 mt-6 lg:mt-8">
          {/* Desktop Sidebar Navigation - Subtle Professional Theme */}
          <div className="w-64 flex-shrink-0 hidden lg:block">
            <nav className="sticky top-6 bg-gray-50 rounded-lg shadow-sm border border-gray-200">
              {/* Quick Actions Section - Share Link with Copy/Preview */}
              <div className="px-4 pt-4 pb-3 border-b border-gray-200">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Share Link</h3>
                {cimDocument?.shareSlug ? (
                  <div className="space-y-2">
                    {/* Full share link display */}
                    <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-md border border-gray-200">
                      <LinkIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      <span className="text-xs text-gray-600 break-all flex-1">
                        {window.location.origin}/share/{cimDocument.shareSlug}
                      </span>
                    </div>
                    {/* Copy and Preview buttons */}
                    <div className="flex gap-2">
                      <TooltipProvider delayDuration={0}>
                        <Tooltip delayDuration={0} open={copyButtonState === 'copied' || copyButtonState === 'error' ? true : copyButtonState === 'hidden' ? false : undefined}>
                          <TooltipTrigger asChild>
                            <button
                              onClick={handleCopyShareLink}
                              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                                copyButtonState === 'copied'
                                  ? 'bg-green-100 text-green-700 border border-green-300'
                                  : copyButtonState === 'error'
                                  ? 'bg-red-100 text-red-700 border border-red-300'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                              }`}
                            >
                              <Copy className="h-3.5 w-3.5" />
                              <span>Copy</span>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className={copyButtonState === 'copied' ? 'bg-green-700 text-white' : copyButtonState === 'error' ? 'bg-red-700 text-white' : ''}>
                            <p>{getCopyTooltipText()}</p>
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip delayDuration={0}>
                          <TooltipTrigger asChild>
                            <button
                              onClick={handlePreviewShareLink}
                              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200 transition-all duration-200"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              <span>Preview</span>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Preview share page</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                ) : (
                  <div className="px-3 py-2 text-sm text-gray-400 italic">
                    No share link available
                  </div>
                )}
              </div>

              {/* Navigation Section */}
              <div className="px-4 py-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Navigation</h3>
                <div className="space-y-1">

                  <button
                    onClick={() => setActiveTab('analytics')}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-md transition-all duration-200 ${
                      activeTab === 'analytics'
                        ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-600 pl-2'
                        : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    <BarChart3 className="h-5 w-5 text-blue-600" />
                    <span className="font-medium">Analytics</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('edit')}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-md transition-all duration-200 ${
                      activeTab === 'edit'
                        ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-600 pl-2'
                        : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    <Edit className="h-5 w-5 text-blue-600" />
                    <span className="font-medium">Edit CIM</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('nda')}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-md transition-all duration-200 ${
                      activeTab === 'nda'
                        ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-600 pl-2'
                        : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    <FileSignature className="h-5 w-5 text-blue-600" />
                    <span className="flex-1 font-medium">NDA Signatures</span>
                    {pendingNdaCount > 0 && (
                      <Badge className="ml-auto bg-orange-500 text-white border-none font-semibold text-xs px-2">
                        {pendingNdaCount}
                      </Badge>
                    )}
                  </button>

                  <button
                    onClick={() => setActiveTab('share')}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-md transition-all duration-200 ${
                      activeTab === 'share'
                        ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-600 pl-2'
                        : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    <Share2 className="h-5 w-5 text-blue-600" />
                    <span className="font-medium">Share CIM</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('appearance')}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-md transition-all duration-200 ${
                      activeTab === 'appearance'
                        ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-600 pl-2'
                        : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    <Palette className="h-5 w-5 text-pink-500" />
                    <span className="font-medium">Appearance</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('teaser')}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-md transition-all duration-200 ${
                      activeTab === 'teaser'
                        ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-600 pl-2'
                        : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    <FileText className="h-5 w-5 text-emerald-600" />
                    <span className="font-medium">Teaser</span>
                  </button>
                </div>
              </div>
            </nav>
          </div>
          
          {/* Main Content Area */}
          <div className="flex-1 min-w-0 w-full lg:ml-0">
            {activeTab === 'analytics' && (
              <DocumentAnalyticsTab 
                cimDocument={cimDocument}
                ndaSignatures={ndaSignatures || []}
              />
            )}
            
            {activeTab === 'edit' && (
              <DocumentEditTab 
                cimDocument={cimDocument}
                financialFiles={financialFiles || []}
                customSections={customSections || []}
              />
            )}
            
            {activeTab === 'nda' && (
              <DocumentNdaTab 
                cimDocument={cimDocument}
                ndaSignatures={ndaSignatures || []}
              />
            )}
            
            {activeTab === 'share' && (
              <DocumentShareTab
                cimDocument={cimDocument}
                user={user}
              />
            )}

            {activeTab === 'appearance' && (
              <DocumentAppearanceTab
                cimDocument={cimDocument}
                user={user}
              />
            )}

            {activeTab === 'teaser' && (
              <DocumentTeaserTab
                cimDocument={cimDocument}
                user={user}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}