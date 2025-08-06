import { useState, useEffect } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, BarChart3, Edit, Edit2, FileSignature, Share2, Eye, Users, Calendar, TrendingUp, Check, X, Menu, ChevronLeft } from "lucide-react";
import { useCimDocument, useFinancialFiles, useCustomSections, useNdaSignatures } from "@/hooks/use-cim-document";
import { DocumentSkeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { CimDisplay } from "@/components/cim-display";
import { DocumentExport } from "@/components/document-export";
import { useMutation, useQueryClient } from "@tanstack/react-query";

// Tab Components
import { DocumentAnalyticsTab } from "@/components/document-tabs/analytics-tab";
import { DocumentEditTab } from "@/components/document-tabs/edit-tab";
import { DocumentNdaTab } from "@/components/document-tabs/nda-tab";
import { DocumentShareTab } from "@/components/document-tabs/share-tab";
import { apiRequest } from "@/lib/queryClient";

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
        title: newTitle
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
      await queryClient.cancelQueries({ queryKey: ['/api/cim', docId] });
      
      // Snapshot the previous value
      const previousData = queryClient.getQueryData(['/api/cim', docId]);
      
      // Optimistically update the cache
      queryClient.setQueryData(['/api/cim', docId], (old: any) => {
        return old ? { ...old, title: newTitle } : old;
      });
      
      // Return context for potential rollback
      return { previousData, previousDisplayTitle: displayTitle };
    },
    onSuccess: (data) => {
      // Invalidate to ensure we have the latest server data
      queryClient.invalidateQueries({ queryKey: ['/api/cim', docId] });
      queryClient.invalidateQueries({ queryKey: ['/api/cim'] });
      toast({ title: "Title Updated", description: "Document title saved successfully." });
      onTitleUpdate?.(editTitle);
      setIsEditing(false);
    },
    onError: (err, newTitle, context: any) => {
      // Rollback both cache and display title
      if (context?.previousData) {
        queryClient.setQueryData(['/api/cim', docId], context.previousData);
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
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          className="text-3xl font-bold tracking-tight bg-transparent border-none outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded px-2 py-1 flex-1"
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
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div 
      className="group text-3xl font-bold tracking-tight cursor-pointer hover:bg-gray-50 rounded px-2 py-1 -mx-2 -my-1 transition-colors flex items-center gap-2"
      onClick={() => setIsEditing(true)}
      title="Click to edit title"
    >
      <h1>{displayTitle}</h1>
      <Edit2 className="h-5 w-5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
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
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  
  // Fetch document data
  const { data: cimDocument, isLoading: docLoading, error: docError } = useCimDocument(docId, !!docId);
  const { data: financialFiles } = useFinancialFiles(docId, !!docId);
  const { data: customSections } = useCustomSections(docId, !!docId);
  const { data: ndaSignatures } = useNdaSignatures(docId, !!docId);
  
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
    setIsMobileSidebarOpen(false); // Close mobile sidebar when tab changes
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
  
  // Ensure user owns the document
  if (cimDocument.userId !== user?.id) {
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
              <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
              <p className="text-gray-600 mb-4">You don't have permission to view this document.</p>
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
  
  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8">
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
          
          <div className="flex items-start justify-between">
            <div className="space-y-3">
              <EditableTitle title={cimDocument.title} docId={docId} />
              <div className="flex items-center gap-3 flex-wrap">
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
            <div className="text-right text-sm text-muted-foreground">
              <div>Created</div>
              <div className="font-medium">{new Date(cimDocument.createdAt).toLocaleDateString()}</div>
            </div>
          </div>
        </div>
        
        {/* Mobile Navigation Header */}
        <div className="lg:hidden mt-6">
          <div className="flex items-center justify-between p-4 bg-white border rounded-lg shadow-sm">
            <div className="flex items-center gap-2">
              {activeTab === 'analytics' && <><BarChart3 className="h-5 w-5 text-blue-600" /><span className="font-medium">Analytics</span></>}
              {activeTab === 'edit' && <><Edit className="h-5 w-5 text-blue-600" /><span className="font-medium">Edit CIM</span></>}
              {activeTab === 'nda' && <><FileSignature className="h-5 w-5 text-blue-600" /><span className="font-medium">NDA Signatures</span></>}
              {activeTab === 'share' && <><Share2 className="h-5 w-5 text-blue-600" /><span className="font-medium">Share CIM</span></>}
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="min-h-[44px] px-4"
            >
              <Menu className="h-4 w-4 mr-2" />
              Switch Tab
            </Button>
          </div>
        </div>

        {/* Mobile Sidebar Overlay */}
        {isMobileSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
        )}

        {/* Mobile Sidebar */}
        <div className={`
          fixed inset-y-0 left-0 z-50 w-80 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out
          ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:hidden
        `}>
          <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
            <h2 className="text-lg font-semibold text-gray-800">Navigation</h2>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setIsMobileSidebarOpen(false)}
              className="h-8 w-8 p-0"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          
          <div className="p-4 space-y-2">
            <button
              onClick={() => handleTabChange('analytics')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left rounded-lg transition-colors min-h-[44px] ${
                activeTab === 'analytics' 
                  ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <BarChart3 className="h-5 w-5" />
              Analytics
            </button>
            <button
              onClick={() => handleTabChange('edit')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left rounded-lg transition-colors min-h-[44px] ${
                activeTab === 'edit' 
                  ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Edit className="h-5 w-5" />
              Edit CIM
            </button>
            <button
              onClick={() => handleTabChange('nda')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left rounded-lg transition-colors min-h-[44px] ${
                activeTab === 'nda' 
                  ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <FileSignature className="h-5 w-5" />
              NDA Signatures
            </button>
            <button
              onClick={() => handleTabChange('share')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left rounded-lg transition-colors min-h-[44px] ${
                activeTab === 'share' 
                  ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Share2 className="h-5 w-5" />
              Share CIM
            </button>
          </div>
        </div>

        {/* Desktop Sidebar Layout */}
        <div className="flex gap-8 mt-8">
          {/* Desktop Sidebar Navigation */}
          <div className="w-64 flex-shrink-0 hidden lg:block">
            <nav className="space-y-2 sticky top-6">
              <button
                onClick={() => setActiveTab('analytics')}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left rounded-lg transition-colors ${
                  activeTab === 'analytics' 
                    ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <BarChart3 className="h-5 w-5" />
                Analytics
              </button>
              <button
                onClick={() => setActiveTab('edit')}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left rounded-lg transition-colors ${
                  activeTab === 'edit' 
                    ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Edit className="h-5 w-5" />
                Edit CIM
              </button>
              <button
                onClick={() => setActiveTab('nda')}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left rounded-lg transition-colors ${
                  activeTab === 'nda' 
                    ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <FileSignature className="h-5 w-5" />
                NDA Signatures
              </button>
              <button
                onClick={() => setActiveTab('share')}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left rounded-lg transition-colors ${
                  activeTab === 'share' 
                    ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Share2 className="h-5 w-5" />
                Share CIM
              </button>
            </nav>
          </div>
          
          {/* Main Content Area */}
          <div className="flex-1 min-w-0 lg:ml-0">
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
          </div>
        </div>
      </main>
    </div>
  );
}