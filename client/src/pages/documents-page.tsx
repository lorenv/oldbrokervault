import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CimDocument } from "@shared/schema";
import { useCimDocument, useFinancialFiles, useCustomSections, useNdaSignatures } from "@/hooks/use-cim-document";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, Lock, Copy, Globe, Search, Trash2, Code, File, FileDown, Clock, Share2, Mail, Loader2, PenTool, Eye, ChevronLeft, ChevronRight, Settings, ExternalLink } from "lucide-react";
import { Link, useRoute } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { DocumentExport } from "@/components/document-export";
import { CimDisplay } from "@/components/cim-display";
import { DocumentSkeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { EmailShareDialog } from "@/components/email-share-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";

// Define types for the CIM analysis data structure
interface CimAnalysis {
  story: {
    yearStarted?: string;
    businessIdea?: string;
    businessModel?: string;
    orderProcess?: string;
    growthHistory?: string;
    businessStructure?: string;
    businessSummary?: string;
    keyAttractions?: string[];
    saleReason?: string | null;
  };
  executiveSummary: {
    buyerAttractions?: string[];
    growthOpportunities?: string[];
  };
  assets?: {
    digitalAssets?: string[];
    location?: string;
    equipmentValue?: string;
    equipmentDetails?: string;
    inventoryDetails?: string;
  };
  ownership?: {
    owners?: Array<{
      name?: string;
      percentage?: string;
      background?: string;
    }>;
    intellectualProperty?: string[];
  };
  marketAnalysis?: {
    uniqueFeatures?: string[];
    customerProfile?: string;
    saleReason?: string;
    competitors?: string[];
    strengths?: string[];
  };
  operations?: {
    suppliers?: {
      count?: string;
      transferability?: string;
      concentration?: string;
      terms?: string;
      replaceability?: string;
    };
    customers?: {
      recurring?: string;
      relationships?: string;
      concentration?: string;
      contracts?: string;
      replaceability?: string;
    };
  };
  inventory?: {
    leadTime?: string;
    sourcing?: string;
    storage?: string;
    value?: string;
    skuCount?: string;
    topProducts?: string[];
  };
  sales?: {
    channels?: Record<string, number>;
    seasonality?: string;
    averageOrderValue?: string;
    competitivePricing?: string;
    pricingModel?: string;
    paymentMethods?: string[];
    contractTerms?: string;
  };
  marketing?: {
    strategies?: string[];
    paidAdvertising?: {
      channels?: string[];
      effectiveness?: string;
    };
    emailMarketing?: {
      listSize?: string;
      usage?: string;
    };
    seoEfforts?: string;
    clientAcquisition?: string;
  };
  team?: {
    ownerResponsibilities?: string;
    ownerHours?: string;
    employeeSummary?: string;
    employeeCount?: string;
    contractorCount?: string;
    turnover?: string;
    hiring?: string;
    retention?: string;
    organization?: string;
    keyEmployees?: string[];
    management?: string;
  };
  facility?: {
    ownership?: string;
    size?: string;
    cost?: string;
    leaseDetails?: string;
  };
}

// Extend the CimDocument type to strongly type the analysis field
interface CimDocumentWithAnalysis extends CimDocument {
  analysis: CimAnalysis;
}

export default function DocumentsPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  
  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setCurrentPage(1); // Reset to first page when searching
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: paginatedData, isLoading: documentsLoading } = useQuery<{
    documents: CimDocumentWithAnalysis[];
    total: number;
    hasMore: boolean;
  }>({
    queryKey: ["/api/cim", currentPage, debouncedSearchQuery],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "12"
      });
      if (debouncedSearchQuery) {
        params.append("search", debouncedSearchQuery);
      }
      const response = await fetch(`/api/cim?${params}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch documents');
      return response.json();
    },
    staleTime: 60000, // Cache for 60 seconds to reduce refetches
    refetchOnWindowFocus: false // Prevent automatic refetches that cause flickering
  });
  
  const documents = paginatedData?.documents || [];
  const totalDocuments = paginatedData?.total || 0;
  const hasMore = paginatedData?.hasMore || false;
  const totalPages = Math.ceil(totalDocuments / 12);
  
  const [selectedDoc, setSelectedDoc] = useState<CimDocumentWithAnalysis | null>(null);
  const [isWordPressDialogOpen, setIsWordPressDialogOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [htmlExportLoading, setHtmlExportLoading] = useState(false);
  const [emailShareDialog, setEmailShareDialog] = useState<{
    open: boolean;
    documentId?: number;
    documentTitle?: string;
    shareToken?: string;
  }>({ open: false });
  const [shouldOpenShareDialog, setShouldOpenShareDialog] = useState(false);
  const [autoTriggerShare, setAutoTriggerShare] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Pre-load data for selected document to prevent duplicate API calls
  const { data: preLoadedCimDocument } = useCimDocument(selectedDoc?.id, !!selectedDoc);
  const { data: preLoadedFinancialFiles } = useFinancialFiles(selectedDoc?.id, !!selectedDoc);
  const { data: preLoadedCustomSections } = useCustomSections(selectedDoc?.id, !!selectedDoc);
  const { data: preLoadedNdaSignatures } = useNdaSignatures(selectedDoc?.id, !!selectedDoc);
  
  // Get the document ID from URL if present
  const [matched, params] = useRoute('/documents/:id');
  
  // Effect to set the selected document based on URL parameter
  useEffect(() => {
    if (matched && params?.id && documents) {
      const docId = parseInt(params.id);
      const doc = documents.find(d => d.id === docId);
      if (doc) {
        setSelectedDoc(doc);
      }
    }
  }, [matched, params, documents]);
  
  // Documents are already filtered and sorted by the backend
  const filteredDocuments = documents;
  
  // Delete document mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/cim/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cim"] });
      toast({
        title: "Success",
        description: "Document deleted successfully",
      });
      setConfirmDelete(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete document",
        variant: "destructive",
      });
    }
  });

  // Handle HTML export for copying formatted content to clipboard
  const handleHtmlExport = async (docId: number) => {
    if (htmlExportLoading) return;
    
    try {
      setHtmlExportLoading(true);
      const response = await apiRequest("POST", `/api/cim/export/html/${docId}`);
      const data = await response.json();
      
      if (!data.html) {
        throw new Error("No HTML content received");
      }
      
      await navigator.clipboard.writeText(data.html);
      toast({
        title: "Copied to clipboard",
        description: "Formatted HTML content has been copied to your clipboard. You can paste it into a document or email.",
      });
    } catch (error) {
      console.error("HTML export error:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to export HTML",
        variant: "destructive",
      });
    } finally {
      setHtmlExportLoading(false);
    }
  };
  
  const handleCopyToClipboard = async (analysis: CimAnalysis) => {
    try {
      const cimText = `
Business Summary:
${analysis.story.businessSummary || 'N/A'}

Market Analysis:
${analysis.marketAnalysis?.customerProfile || 'N/A'}
${analysis.marketAnalysis?.strengths?.join("\n") || 'N/A'}

Operations:
${analysis.operations?.customers?.recurring || 'N/A'}
${analysis.team?.ownerResponsibilities || 'N/A'}
      `.trim();

      await navigator.clipboard.writeText(cimText);
      toast({
        title: "Copied to clipboard",
        description: "CIM content has been copied to your clipboard",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const handleGoogleDocsExport = async (docId: number) => {
    try {
      toast({
        title: "Export Starting",
        description: "Creating your Google Doc...",
      });

      const response = await fetch(`/api/cim/export/gdocs/${docId}`, {
        method: 'POST',
        credentials: 'include'
      });

      if (!response.ok) {
        const error = await response.json();
        if (error.needsAuth) {
          // Redirect to Google OAuth flow
          const authResponse = await fetch('/api/auth/google');
          const { url } = await authResponse.json();
          window.location.href = url;
          return;
        }
        throw new Error(error.error || 'Failed to export to Google Docs');
      }

      const { url } = await response.json();
      window.open(url, '_blank');
      
      toast({
        title: "Export Successful",
        description: "Your Google Doc has been created and opened in a new tab",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "Failed to export to Google Docs",
        variant: "destructive"
      });
    }
  };

  const handleExport = async (docId: number, format: 'pdf' | 'word') => {
    // console.log(`Starting ${format} export for document ID ${docId}`);
    
    try {
      // Show export started toast
      toast({
        title: "Export Starting",
        description: `Preparing your ${format.toUpperCase()} export...`,
      });
      
      // For Word/PDF exports, we need to use a form submission approach to handle binary downloads
      // Create a temporary form to submit a POST request
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = `/api/cim/export/${format}/${docId}`;
      form.target = '_blank'; // Open in new tab or trigger download
      document.body.appendChild(form);
      
      // console.log(`Submitting form to: ${form.action}`);
      form.submit();
      
      // Clean up
      document.body.removeChild(form);
      
      toast({
        title: "Export Started",
        description: `Your ${format.toUpperCase()} export has started. Check your downloads.`,
      });
    } catch (error) {
      console.error(`${format} export error:`, error);
      toast({
        title: "Export Failed",
        description: `Failed to export to ${format.toUpperCase()}. Please try again.`,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row md:justify-between items-start md:items-center mb-6 gap-4">
          <h1 className="text-3xl font-bold">My CIM Documents</h1>
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <div className="relative flex-grow">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search documents..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Link href="/">
              <Button className="w-full sm:w-auto whitespace-nowrap">
                <FileText className="mr-2 h-4 w-4" />
                Create New CIM
              </Button>
            </Link>
          </div>
        </div>

        {/* Loading Animation */}
        {documentsLoading && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
            <p className="text-gray-600">Loading your CIM documents...</p>
          </div>
        )}

        {/* Documents Grid */}
        {!documentsLoading && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredDocuments?.map((doc) => (
            <Card 
              key={doc.id} 
              className="group cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all duration-200 border-0 shadow-md hover:shadow-xl bg-white/80 backdrop-blur-sm"
              onClick={() => {
                // Use setTimeout to prevent flickering from rapid state updates
                setTimeout(() => setSelectedDoc(doc), 50);
              }}
            >
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {doc.logoUrl && (
                        <div className="flex-shrink-0">
                          <img 
                            src={doc.logoUrl} 
                            alt="Company logo" 
                            className="w-6 h-6 rounded-full object-cover border border-gray-200"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        </div>
                      )}
                      <CardTitle className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors duration-200 truncate">
                        {doc.title}
                      </CardTitle>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(doc.createdAt).toLocaleDateString()}
                      </div>
                      <div className="flex items-center gap-1">
                        <PenTool className="h-3 w-3" />
                        {doc.ndaSignatureCount || 0} NDA{(doc.ndaSignatureCount || 0) !== 1 ? 's' : ''}
                      </div>
                      <div className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {doc.shareViewCount || 0} view{(doc.shareViewCount || 0) !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-60 group-hover:opacity-100 transition-opacity">
                        <Share2 className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem 
                        onClick={(e) => {
                          e.stopPropagation();
                          // Use setTimeout to prevent state update conflicts
                          setTimeout(() => {
                            setSelectedDoc(doc);
                            setTimeout(() => setAutoTriggerShare(true), 100);
                          }, 50);
                        }}
                      >
                        <Share2 className="mr-2 h-4 w-4" />
                        Share Link Settings
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={async (e) => {
                          e.stopPropagation();
                          
                          // If document doesn't have a share token, automatically enable sharing
                          if (!doc.shareToken) {
                            try {
                              // Generate a new share slug
                              const randomId = Math.random().toString(36).substring(2, 8);
                              const newSlug = `cim-${randomId}`;
                              const newShareUrl = `${window.location.origin}/share/${newSlug}`;
                              
                              // Save to server
                              const response = await fetch(`/api/cim/${doc.id}/share`, {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                },
                                credentials: 'include',
                                body: JSON.stringify({
                                  shareEnabled: true,
                                  shareSlug: newSlug,
                                  sharePassword: null,
                                  shareExpiresAt: null,
                                  ndaProtected: false,
                                  ndaTemplateId: null
                                }),
                              });
                              
                              if (!response.ok) {
                                throw new Error('Failed to enable sharing');
                              }
                              
                              // Copy the new URL with error handling
                              try {
                                await navigator.clipboard.writeText(newShareUrl);
                                toast({
                                  title: "Sharing enabled and link copied!",
                                  description: "Sharing has been automatically enabled and the link has been copied to your clipboard",
                                });
                              } catch (clipboardError) {
                                console.warn('Clipboard API failed, falling back to manual selection:', clipboardError);
                                // Fallback: Create a temporary input element for manual copy
                                const textArea = document.createElement('textarea');
                                textArea.value = newShareUrl;
                                textArea.style.position = 'fixed';
                                textArea.style.left = '-999999px';
                                textArea.style.top = '-999999px';
                                document.body.appendChild(textArea);
                                textArea.focus();
                                textArea.select();
                                try {
                                  document.execCommand('copy');
                                  toast({
                                    title: "Sharing enabled and link copied!",
                                    description: "Sharing has been automatically enabled and the link has been copied to your clipboard",
                                  });
                                } catch (fallbackError) {
                                  toast({
                                    title: "Sharing enabled!",
                                    description: `Sharing has been enabled. Please copy this link manually: ${newShareUrl}`,
                                  });
                                }
                                document.body.removeChild(textArea);
                              }
                              
                              // Refresh the documents list to show updated share status
                              queryClient.invalidateQueries({ queryKey: ["/api/cim"] });
                            } catch (error) {
                              console.error('Failed to enable sharing:', error);
                              toast({
                                title: "Error enabling sharing",
                                description: "Failed to enable sharing. Please try again.",
                                variant: "destructive"
                              });
                            }
                          } else {
                            // Normal copy operation when sharing is already enabled
                            navigator.clipboard.writeText(`${window.location.origin}/share/${doc.shareToken}`);
                            toast({
                              title: "Share link copied",
                              description: "The share link has been copied to your clipboard"
                            });
                          }
                        }}
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        Copy Share Link
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={(e) => {
                          e.stopPropagation();
                          setEmailShareDialog({
                            open: true,
                            documentId: doc.id,
                            documentTitle: doc.title,
                            shareToken: doc.shareToken
                          });
                        }}
                      >
                        <Mail className="mr-2 h-4 w-4" />
                        Share via Email
                      </DropdownMenuItem>
                      
                      {/* Show additional options only for generated CIMs, not uploaded files */}
                      {!doc.isUploadedFile && user?.subscriptionStatus !== "free" && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={(e) => {e.stopPropagation(); handleExport(doc.id, 'word');}}
                          >
                            <File className="mr-2 h-4 w-4 text-blue-600" />
                            Export to Word
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={(e) => {e.stopPropagation(); handleExport(doc.id, 'pdf');}}
                          >
                            <FileDown className="mr-2 h-4 w-4 text-red-600" />
                            Export to PDF
                          </DropdownMenuItem>
                        </>
                      )}
                      
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={(e) => {e.stopPropagation(); setConfirmDelete(doc.id);}} 
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  {doc.shareEnabled ? (
                    <div className="flex items-center gap-1 px-2 py-1 bg-green-50 text-green-600 rounded-full">
                      <Globe className="h-3 w-3" />
                      Shared
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 px-2 py-1 bg-gray-50 text-gray-600 rounded-full">
                      <Lock className="h-3 w-3" />
                      Private
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            ))}
          </div>
        )}

        {/* Empty States */}
        {!documentsLoading && filteredDocuments?.length === 0 && documents?.length !== 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No documents match your search. Try a different search term.
          </div>
        )}

        {!documentsLoading && documents?.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No CIM documents yet. Create your first one!
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-8">
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <span>
                Showing {((currentPage - 1) * 12) + 1} to {Math.min(currentPage * 12, totalDocuments)} of {totalDocuments} documents
              </span>
              {debouncedSearchQuery && (
                <span>
                  (filtered by "{debouncedSearchQuery}")
                </span>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1 || documentsLoading}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              
              <div className="flex items-center space-x-1">
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 7) {
                    pageNum = i + 1;
                  } else if (currentPage <= 4) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 3) {
                    pageNum = totalPages - 6 + i;
                  } else {
                    pageNum = currentPage - 3 + i;
                  }
                  
                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(pageNum)}
                      disabled={documentsLoading}
                      className="w-8 h-8 p-0"
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages || documentsLoading}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </main>
      
      {/* Delete confirmation dialog */}
      <Dialog open={confirmDelete !== null} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Document</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this document? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setConfirmDelete(null)}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => confirmDelete && deleteMutation.mutate(confirmDelete)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Interactive CIM Editor Dialog */}
      {selectedDoc && (
        <Dialog 
          open={!!selectedDoc} 
          onOpenChange={(open) => {
            if (!open) {
              // Use setTimeout to prevent rapid state changes that cause flickering
              setTimeout(() => {
                setSelectedDoc(null);
                setAutoTriggerShare(false);
              }, 50);
            }
          }}
        >
          <DialogContent className="w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between pr-8">
                <div>
                  <DialogTitle>Edit CIM Document</DialogTitle>
                  <DialogDescription>
                    {selectedDoc.title}
                  </DialogDescription>
                </div>
                <div className="flex gap-2">
                  {/* Share Button with Dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Share2 className="h-4 w-4 mr-2" />
                        Share
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => {
                        // Prevent rapid state changes that cause flickering
                        if (!autoTriggerShare) {
                          setTimeout(() => setAutoTriggerShare(true), 200);
                        }
                      }}>
                        <Settings className="h-4 w-4 mr-2" />
                        Share Link Settings
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={async () => {
                        if (!selectedDoc.shareSlug) {
                          // Auto-enable sharing if not already enabled
                          const randomId = Math.random().toString(36).substring(2, 8);
                          const newSlug = `cim-${randomId}`;
                          const newShareUrl = `${window.location.origin}/share/${newSlug}`;
                          
                          try {
                            const response = await fetch(`/api/cim/${selectedDoc.id}/share`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              credentials: 'include',
                              body: JSON.stringify({
                                shareEnabled: true,
                                shareSlug: newSlug,
                                sharePassword: null,
                                shareExpiresAt: null,
                                ndaProtected: false,
                                ndaTemplateId: null
                              }),
                            });
                            
                            if (response.ok) {
                              await navigator.clipboard.writeText(newShareUrl);
                              toast({
                                title: "Sharing enabled and link copied!",
                                description: "Share link has been copied to clipboard"
                              });
                              queryClient.invalidateQueries({ queryKey: ["/api/cim"] });
                            }
                          } catch (error) {
                            toast({
                              title: "Failed to enable sharing",
                              variant: "destructive"
                            });
                          }
                        } else {
                          const shareUrl = `${window.location.origin}/share/${selectedDoc.shareSlug}`;
                          await navigator.clipboard.writeText(shareUrl);
                          toast({
                            title: "Share Link Copied",
                            description: "The share link has been copied to your clipboard"
                          });
                        }
                      }}>
                        <Copy className="h-4 w-4 mr-2" />
                        Copy Share Link
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => {
                        setEmailShareDialog({
                          open: true,
                          documentTitle: selectedDoc.title,
                          shareSlug: selectedDoc.shareSlug || ""
                        });
                      }}>
                        <Mail className="h-4 w-4 mr-2" />
                        Share via Email
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExport(selectedDoc.id, 'pdf')}>
                        <FileDown className="h-4 w-4 mr-2" />
                        Export to PDF
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* View Share Link Button */}
                  <Button 
                    variant="default" 
                    size="sm" 
                    onClick={() => {
                      if (selectedDoc.shareSlug) {
                        const shareUrl = `${window.location.origin}/share/${selectedDoc.shareSlug}`;
                        window.open(shareUrl, '_blank');
                      } else {
                        toast({
                          title: "No share link available",
                          description: "Enable sharing first to view the share link"
                        });
                      }
                    }}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Share Link
                  </Button>
                </div>
              </div>
            </DialogHeader>
            <CimDisplay 
              analysis={selectedDoc.analysis} 
              docId={selectedDoc.id}
              websiteUrl={selectedDoc.websiteUrl || undefined}
              logoUrl={selectedDoc.logoUrl || undefined}
              selectedImages={selectedDoc.selectedImages || undefined}
              title={selectedDoc.title}
              cimDocument={selectedDoc}
              autoTriggerShare={autoTriggerShare}
              onShareTriggered={() => setAutoTriggerShare(false)}
            />
          </DialogContent>
        </Dialog>
      )}



      {/* Email Share Dialog */}
      <EmailShareDialog
        open={emailShareDialog.open}
        onOpenChange={(open) => setEmailShareDialog({ open })}
        shareUrl={emailShareDialog.shareToken ? `${window.location.origin}/share/${emailShareDialog.shareToken}` : ''}
        documentTitle={emailShareDialog.documentTitle || ''}
        senderName={user?.name}
      />
    </div>
  );
}