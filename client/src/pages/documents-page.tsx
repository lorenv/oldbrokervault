import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CimDocument } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, Lock, Copy, Globe, Search, Trash2, Code, File, FileDown, Clock, Share2 } from "lucide-react";
import { Link, useRoute } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { DocumentExport } from "@/components/document-export";
import { CimDisplay } from "@/components/cim-display";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
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
  const { data: documents } = useQuery<CimDocumentWithAnalysis[]>({
    queryKey: ["/api/cim"],
  });
  const [selectedDoc, setSelectedDoc] = useState<CimDocumentWithAnalysis | null>(null);
  const [isWordPressDialogOpen, setIsWordPressDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [htmlExportLoading, setHtmlExportLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
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
  
  // Filter documents based on search query and sort by creation date (newest first)
  const filteredDocuments = documents?.filter(doc => 
    doc.title.toLowerCase().includes(searchQuery.toLowerCase())
  )
  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  
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
    console.log(`Starting ${format} export for document ID ${docId}`);
    
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
      
      console.log(`Submitting form to: ${form.action}`);
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

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredDocuments?.map((doc) => (
            <Card 
              key={doc.id} 
              className="group cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all duration-200 border-0 shadow-md hover:shadow-xl bg-white/80 backdrop-blur-sm"
              onClick={() => setSelectedDoc(doc)}
            >
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors duration-200 truncate">
                      {doc.title}
                    </CardTitle>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(doc.createdAt).toLocaleDateString()}
                      </div>
                      <div className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {doc.regenerationCount} regen{doc.regenerationCount !== 1 ? 's' : ''}
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
                          navigator.clipboard.writeText(`${window.location.origin}/share/${doc.shareToken}`);
                          toast({
                            title: "Share link copied",
                            description: "The share link has been copied to your clipboard"
                          });
                        }}
                      >
                        <Share2 className="mr-2 h-4 w-4" />
                        Copy Share Link
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={(e) => {e.stopPropagation(); handleCopyToClipboard(doc.analysis);}}>
                        <Copy className="mr-2 h-4 w-4" />
                        Copy Plain Text
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={(e) => {e.stopPropagation(); handleHtmlExport(doc.id);}}
                        disabled={htmlExportLoading}
                      >
                        <Code className="mr-2 h-4 w-4" />
                        Copy as HTML
                        {htmlExportLoading && <span className="ml-2 h-4 w-4 animate-spin">·</span>}
                      </DropdownMenuItem>
                      {user?.subscriptionStatus !== "free" && (
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
                          {(user?.subscriptionStatus === "premium" || user?.isAdmin) && (
                            <DropdownMenuItem 
                              onClick={(e) => {e.stopPropagation(); handleGoogleDocsExport(doc.id);}}
                            >
                              <Globe className="mr-2 h-4 w-4 text-blue-500" />
                              Export to Google Docs
                            </DropdownMenuItem>
                          )}
                          {(user?.subscriptionStatus === "premium" || user?.isAdmin) && (
                            <DropdownMenuItem 
                              onClick={(e) => {e.stopPropagation(); setIsWordPressDialogOpen(true);}}
                            >
                              <Globe className="mr-2 h-4 w-4" />
                              Export to WordPress
                            </DropdownMenuItem>
                          )}
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

          {filteredDocuments?.length === 0 && documents?.length !== 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No documents match your search. Try a different search term.
            </div>
          )}

          {documents?.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No CIM documents yet. Create your first one!
            </div>
          )}
        </div>
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
        <Dialog open={!!selectedDoc} onOpenChange={(open) => !open && setSelectedDoc(null)}>
          <DialogContent className="w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            <CimDisplay 
              analysis={selectedDoc.analysis} 
              docId={selectedDoc.id}
              websiteUrl={selectedDoc.websiteUrl || undefined}
              logoUrl={selectedDoc.logoUrl || undefined}
              selectedImages={selectedDoc.selectedImages || undefined}
              title={selectedDoc.title}
            />
          </DialogContent>
        </Dialog>
      )}

      {selectedDoc && (
        <DocumentExport 
          analysis={selectedDoc.analysis} 
          docId={selectedDoc.id} 
          user={user}
          isWordPressDialogOpen={isWordPressDialogOpen}
          setIsWordPressDialogOpen={setIsWordPressDialogOpen}
        />
      )}
    </div>
  );
}