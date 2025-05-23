import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CimDocument } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, Lock, Copy, Globe, Search, Trash2, Code } from "lucide-react";
import { Link, useRoute } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { DocumentExport } from "@/components/document-export";
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

  const handleExport = async (format: 'pdf' | 'word') => {
    if (!selectedDoc) return;
    
    console.log(`Starting ${format} export for document ID ${selectedDoc.id}`);
    
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
      form.action = `/api/cim/export/${format}/${selectedDoc.id}`;
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

  const renderValue = (value: any): string => {
    if (value === null || value === undefined) return "N/A";
    
    // Handle arrays by joining elements with commas
    if (Array.isArray(value)) {
      if (value.length === 0) return "N/A";
      
      // If array contains objects, handle each object individually
      return value.map(item => {
        if (typeof item === 'object' && item !== null) {
          return renderValue(item);
        }
        return String(item);
      }).join(", ");
    }
    
    // Handle objects
    if (typeof value === "object" && value !== null) {
      try {
        // Special cases for known object structures
        if ('recurring' in value && value.recurring) return String(value.recurring);
        if ('terms' in value && value.terms) return String(value.terms);
        if ('count' in value && value.count) return String(value.count);
        if ('usage' in value && value.usage) return String(value.usage);
        
        // For key team members or similar objects with name/title properties
        if ('name' in value && typeof value.name === 'string') {
          const parts = [];
          if (value.name) parts.push(value.name);
          if (value.title) parts.push(value.title);
          if (value.tenure) parts.push(`${value.tenure}`);
          if (value.responsibilities) parts.push(String(value.responsibilities));
          if (value.contributions) parts.push(String(value.contributions));
          return parts.join(", ");
        }
        
        // General object handling - filter out null/undefined values
        const entries = Object.entries(value)
          .filter(([_, val]) => val !== null && val !== undefined);
        
        if (entries.length === 0) return "N/A";
        
        // Format as "key: value, key2: value2"
        return entries
          .map(([key, val]) => `${key}: ${renderValue(val)}`)
          .join(", ");
      } catch (error) {
        console.error("Error rendering value:", error);
        return "N/A";
      }
    }
    
    // Handle primitive values
    return String(value);
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

        <div className="grid gap-4">
          {filteredDocuments?.map((doc) => (
            <Card key={doc.id} className="hover:border-primary transition-colors">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle 
                    className="cursor-pointer hover:text-primary transition-colors"
                    onClick={() => setSelectedDoc(doc)}
                  >
                    {doc.title}
                  </CardTitle>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Download className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleCopyToClipboard(doc.analysis)}>
                        <Copy className="mr-2 h-4 w-4" />
                        Copy Plain Text
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleHtmlExport(doc.id)}
                        disabled={htmlExportLoading}
                      >
                        <Code className="mr-2 h-4 w-4" />
                        Copy as HTML
                        {htmlExportLoading && <span className="ml-2 h-4 w-4 animate-spin">·</span>}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => setConfirmDelete(doc.id)} 
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">
                  Created: {new Date(doc.createdAt).toLocaleDateString()}
                </div>
                <div className="text-sm text-muted-foreground">
                  Regenerations: {doc.regenerationCount}
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

      {selectedDoc && (
        <Dialog open={!!selectedDoc} onOpenChange={(open) => !open && setSelectedDoc(null)}>
          <DialogContent className="w-full max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedDoc.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <div className="flex justify-end">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Download className="mr-2 h-4 w-4" />
                      Export
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleCopyToClipboard(selectedDoc.analysis)}>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy Plain Text
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => handleHtmlExport(selectedDoc.id)}
                      disabled={htmlExportLoading}
                    >
                      <Code className="mr-2 h-4 w-4" />
                      Copy as HTML
                      {htmlExportLoading && <span className="ml-2 h-4 w-4 animate-spin">·</span>}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => user?.subscriptionStatus !== "free" ? handleExport('word') : null}
                      className={user?.subscriptionStatus === "free" ? "opacity-50" : ""}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Export to Word
                      {user?.subscriptionStatus === "free" && <Lock className="ml-2 h-4 w-4" />}
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => user?.subscriptionStatus !== "free" ? handleExport('pdf') : null}
                      className={user?.subscriptionStatus === "free" ? "opacity-50" : ""}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Export to PDF
                      {user?.subscriptionStatus === "free" && <Lock className="ml-2 h-4 w-4" />}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => (user?.subscriptionStatus === "premium" || user?.isAdmin) ? setIsWordPressDialogOpen(true) : null}
                      className={(user?.subscriptionStatus !== "premium" && !user?.isAdmin) ? "opacity-50" : ""}
                    >
                      <Globe className="mr-2 h-4 w-4" />
                      Export to WordPress
                      {(user?.subscriptionStatus !== "premium" && !user?.isAdmin) && <Lock className="ml-2 h-4 w-4" />}
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => setConfirmDelete(selectedDoc.id)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Document
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="space-y-8">
                {/* Company Logo Section - Display at the very top */}
                {selectedDoc.logoUrl && (
                  <div className="text-center py-6 border-b">
                    <img 
                      src={selectedDoc.logoUrl} 
                      alt="Company Logo"
                      className="h-16 mx-auto"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                )}
                
                <section>
                  <h2 className="text-2xl font-bold border-b pb-2 mb-4">Business Overview</h2>
                  
                  {/* Company Logo in Business Overview */}
                  {selectedDoc.logoUrl && (
                    <div className="flex justify-center mb-6">
                      <img 
                        src={selectedDoc.logoUrl} 
                        alt="Company Logo"
                        className="h-20 max-w-xs object-contain"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                  
                  <div className="space-y-4">
                    {selectedDoc.websiteUrl && (
                      <div className="mb-4">
                        <h3 className="text-lg font-semibold mb-2">Business Website</h3>
                        <a 
                          href={selectedDoc.websiteUrl.startsWith('http') ? selectedDoc.websiteUrl : `https://${selectedDoc.websiteUrl}`} 
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          {selectedDoc.websiteUrl}
                        </a>
                        
                        {/* Display website screenshot if available */}
                        {selectedDoc.websiteScreenshotUrl && (
                          <div className="mt-3 mb-3">
                            <img 
                              src={selectedDoc.websiteScreenshotUrl} 
                              alt="Website Screenshot" 
                              className="border rounded-md shadow-sm max-w-full"
                              style={{ maxHeight: "300px", objectFit: "contain" }}
                            />
                          </div>
                        )}
                        
                        {selectedDoc.analysis.story.websiteAnalysisNote && (
                          <p className="text-sm text-amber-600 mt-2 italic">
                            {selectedDoc.analysis.story.websiteAnalysisNote}
                          </p>
                        )}
                      </div>
                    )}
                    <div>
                      <h3 className="text-lg font-semibold mb-2">Background</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="font-medium">Founded</p>
                          <p className="text-muted-foreground">
                            {renderValue(selectedDoc.analysis.story.yearStarted)}
                          </p>
                        </div>
                        <div>
                          <p className="font-medium">Structure</p>
                          <p className="text-muted-foreground">
                            {renderValue(selectedDoc.analysis.story.businessStructure)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold mb-2">Business Summary</h3>
                      <p className="text-muted-foreground">
                        {renderValue(selectedDoc.analysis.story.businessSummary)}
                      </p>
                    </div>

                    {selectedDoc.analysis.story.saleReason && (
                      <div>
                        <h3 className="text-lg font-semibold mb-2">Reason for Sale</h3>
                        <p className="text-muted-foreground">
                          {renderValue(selectedDoc.analysis.story.saleReason)}
                        </p>
                      </div>
                    )}
                  </div>
                </section>

                <section>
                  <h2 className="text-2xl font-bold border-b pb-2 mb-4">Investment Highlights</h2>
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold mb-2">Key Attractions</h3>
                      <ul className="list-disc pl-6 space-y-1">
                        {selectedDoc.analysis.story.keyAttractions?.map((item: string, i: number) => (
                          <li key={i} className="text-muted-foreground">{renderValue(item)}</li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold mb-2">Growth Opportunities</h3>
                      <ul className="list-disc pl-6 space-y-1">
                        {selectedDoc.analysis.executiveSummary.growthOpportunities?.map((item: string, i: number) => (
                          <li key={i} className="text-muted-foreground">{renderValue(item)}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </section>

                <section>
                  <h2 className="text-2xl font-bold border-b pb-2 mb-4">Market Position</h2>
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold mb-2">Target Market</h3>
                      <p className="text-muted-foreground">
                        {renderValue(selectedDoc.analysis.marketAnalysis?.customerProfile)}
                      </p>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold mb-2">Competitive Landscape</h3>
                      <div className="bg-muted rounded-lg p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <h4 className="font-medium mb-2">Key Competitors</h4>
                            <ul className="list-disc pl-6 space-y-1">
                              {selectedDoc.analysis.marketAnalysis?.competitors?.map((competitor: string, i: number) => (
                                <li key={i} className="text-muted-foreground">{renderValue(competitor)}</li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <h4 className="font-medium mb-2">Business Strengths</h4>
                            <ul className="list-disc pl-6 space-y-1">
                              {selectedDoc.analysis.marketAnalysis?.strengths?.map((strength: string, i: number) => (
                                <li key={i} className="text-muted-foreground">{renderValue(strength)}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <section>
                  <h2 className="text-2xl font-bold border-b pb-2 mb-4">Operations</h2>
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold mb-3">Customer Relationships</h3>
                      <div className="bg-muted rounded-lg p-4">
                        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <dt className="font-medium">Recurring Revenue</dt>
                            <dd className="text-muted-foreground">{renderValue(selectedDoc.analysis.operations?.customers?.recurring)}</dd>
                          </div>
                          <div>
                            <dt className="font-medium">Customer Base</dt>
                            <dd className="text-muted-foreground">{renderValue(selectedDoc.analysis.operations?.customers?.relationships)}</dd>
                          </div>
                          <div>
                            <dt className="font-medium">Revenue Concentration</dt>
                            <dd className="text-muted-foreground">{renderValue(selectedDoc.analysis.operations?.customers?.concentration)}</dd>
                          </div>
                          <div>
                            <dt className="font-medium">Contract Terms</dt>
                            <dd className="text-muted-foreground">{renderValue(selectedDoc.analysis.operations?.customers?.contracts)}</dd>
                          </div>
                        </dl>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold mb-3">Supply Chain</h3>
                      <div className="bg-muted rounded-lg p-4">
                        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <dt className="font-medium">Number of Suppliers</dt>
                            <dd className="text-muted-foreground">{renderValue(selectedDoc.analysis.operations?.suppliers?.count)}</dd>
                          </div>
                          <div>
                            <dt className="font-medium">Supplier Terms</dt>
                            <dd className="text-muted-foreground">{renderValue(selectedDoc.analysis.operations?.suppliers?.terms)}</dd>
                          </div>
                          <div>
                            <dt className="font-medium">Concentration</dt>
                            <dd className="text-muted-foreground">{renderValue(selectedDoc.analysis.operations?.suppliers?.concentration)}</dd>
                          </div>
                          <div>
                            <dt className="font-medium">Relationship Transfer</dt>
                            <dd className="text-muted-foreground">{renderValue(selectedDoc.analysis.operations?.suppliers?.transferability)}</dd>
                          </div>
                        </dl>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold mb-3">Equipment & Assets</h3>
                      <div className="space-y-2">
                        <p className="text-muted-foreground">{renderValue(selectedDoc.analysis.assets?.equipmentDetails)}</p>
                        <p className="text-muted-foreground">{renderValue(selectedDoc.analysis.assets?.inventoryDetails)}</p>
                        <p><strong>Equipment Value:</strong> {renderValue(selectedDoc.analysis.assets?.equipmentValue)}</p>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold mb-3">Marketing & Client Acquisition</h3>
                      <div className="space-y-2">
                        <p className="text-muted-foreground">{renderValue(selectedDoc.analysis.marketing?.clientAcquisition)}</p>
                        <div className="mt-2">
                          <p className="font-medium">Marketing Strategies:</p>
                          <ul className="list-disc pl-6 mt-2">
                            {selectedDoc.analysis.marketing?.strategies?.map((strategy: string, i: number) => (
                              <li key={i} className="text-muted-foreground">{renderValue(strategy)}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <section>
                  <h2 className="text-2xl font-bold border-b pb-2 mb-4">Team Structure</h2>
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold mb-3">Ownership & Management</h3>
                      <div className="space-y-2">
                        <p><strong>Owner's Role:</strong> {renderValue(selectedDoc.analysis.team?.ownerResponsibilities)}</p>
                        <p><strong>Required Hours:</strong> {renderValue(selectedDoc.analysis.team?.ownerHours)}</p>
                        <p><strong>Management Structure:</strong> {renderValue(selectedDoc.analysis.team?.management)}</p>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold mb-3">Employee Overview</h3>
                      <div className="space-y-2">
                        <p><strong>Total Employees:</strong> {renderValue(selectedDoc.analysis.team?.employeeCount)}</p>
                        {selectedDoc.analysis.team?.contractorCount && (
                          <p><strong>Contractors:</strong> {renderValue(selectedDoc.analysis.team?.contractorCount)}</p>
                        )}
                        <p className="text-muted-foreground">{renderValue(selectedDoc.analysis.team?.employeeSummary)}</p>

                        {selectedDoc.analysis.team?.keyEmployees && selectedDoc.analysis.team.keyEmployees.length > 0 && (
                          <div className="mt-4">
                            <p className="font-medium">Key Team Members:</p>
                            <ul className="list-disc pl-6 mt-2">
                              {selectedDoc.analysis.team.keyEmployees.map((employee: string, i: number) => (
                                <li key={i} className="text-muted-foreground">{renderValue(employee)}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </section>

                <section>
                  <h2 className="text-2xl font-bold border-b pb-2 mb-4">Facilities</h2>
                  <div className="bg-muted rounded-lg p-4">
                    <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <dt className="font-medium">Ownership Status</dt>
                        <dd className="text-muted-foreground">{renderValue(selectedDoc.analysis.facility?.ownership)}</dd>
                      </div>
                      <div>
                        <dt className="font-medium">Size</dt>
                        <dd className="text-muted-foreground">{renderValue(selectedDoc.analysis.facility?.size)}</dd>
                      </div>
                      <div>
                        <dt className="font-medium">Monthly Cost</dt>
                        <dd className="text-muted-foreground">{renderValue(selectedDoc.analysis.facility?.cost)}</dd>
                      </div>
                      {selectedDoc.analysis.facility?.leaseDetails && (
                        <div>
                          <dt className="font-medium">Lease Details</dt>
                          <dd className="text-muted-foreground">{renderValue(selectedDoc.analysis.facility?.leaseDetails)}</dd>
                        </div>
                      )}
                    </dl>
                  </div>
                </section>
              </div>
            </div>
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