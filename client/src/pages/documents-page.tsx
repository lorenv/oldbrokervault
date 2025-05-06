import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CimDocument } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, Lock, Copy, Globe, Search, Trash2, Code } from "lucide-react";
import { Link } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useState } from "react";
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

export default function DocumentsPage() {
  const { data: documents } = useQuery<CimDocument[]>({
    queryKey: ["/api/cim"],
  });
  const [selectedDoc, setSelectedDoc] = useState<CimDocument | null>(null);
  const [isWordPressDialogOpen, setIsWordPressDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [htmlExportLoading, setHtmlExportLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Filter documents based on search query
  const filteredDocuments = documents?.filter(doc => 
    doc.title.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
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
  
  const handleCopyToClipboard = async (analysis: any) => {
    try {
      const cimText = `
Business Summary:
${analysis.story.businessSummary}

Market Analysis:
${analysis.marketAnalysis.customerProfile}
${analysis.marketAnalysis.strengths.join("\n")}

Operations:
${analysis.operations.customers.recurring}
${analysis.team.ownerResponsibilities}
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
    
    try {
      // Create a temporary anchor element to trigger download
      const anchor = document.createElement('a');
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      
      // Set the download URL based on the export format
      const url = `/api/cim/export/${format}/${selectedDoc.id}`;
      anchor.href = url;
      anchor.download = `cim-${selectedDoc.id}.${format === 'pdf' ? 'pdf' : 'docx'}`;
      
      // Trigger the download
      anchor.click();
      
      // Clean up
      document.body.removeChild(anchor);
      
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
    if (!value) return "N/A";
    if (Array.isArray(value)) {
      return value.join(", ");
    }
    if (typeof value === "object") {
      if ('recurring' in value) return value.recurring;
      if ('terms' in value) return value.terms;
      if ('count' in value) return value.count;
      if ('usage' in value) return value.usage;
      return Object.entries(value)
        .filter(([_, val]) => val !== null && val !== undefined)
        .map(([key, val]) => `${key}: ${renderValue(val)}`)
        .join(", ");
    }
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
                <section>
                  <h2 className="text-2xl font-bold border-b pb-2 mb-4">Business Overview</h2>
                  <div className="space-y-4">
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
                        {renderValue(selectedDoc.analysis.marketAnalysis.customerProfile)}
                      </p>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold mb-2">Competitive Landscape</h3>
                      <div className="bg-muted rounded-lg p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <h4 className="font-medium mb-2">Key Competitors</h4>
                            <ul className="list-disc pl-6 space-y-1">
                              {selectedDoc.analysis.marketAnalysis.competitors?.map((competitor: string, i: number) => (
                                <li key={i} className="text-muted-foreground">{renderValue(competitor)}</li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <h4 className="font-medium mb-2">Business Strengths</h4>
                            <ul className="list-disc pl-6 space-y-1">
                              {selectedDoc.analysis.marketAnalysis.strengths?.map((strength: string, i: number) => (
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
                            <dd className="text-muted-foreground">{renderValue(selectedDoc.analysis.operations.customers.recurring)}</dd>
                          </div>
                          <div>
                            <dt className="font-medium">Customer Base</dt>
                            <dd className="text-muted-foreground">{renderValue(selectedDoc.analysis.operations.customers.relationships)}</dd>
                          </div>
                          <div>
                            <dt className="font-medium">Revenue Concentration</dt>
                            <dd className="text-muted-foreground">{renderValue(selectedDoc.analysis.operations.customers.concentration)}</dd>
                          </div>
                          <div>
                            <dt className="font-medium">Contract Terms</dt>
                            <dd className="text-muted-foreground">{renderValue(selectedDoc.analysis.operations.customers.contracts)}</dd>
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
                            <dd className="text-muted-foreground">{renderValue(selectedDoc.analysis.operations.suppliers.count)}</dd>
                          </div>
                          <div>
                            <dt className="font-medium">Supplier Terms</dt>
                            <dd className="text-muted-foreground">{renderValue(selectedDoc.analysis.operations.suppliers.terms)}</dd>
                          </div>
                          <div>
                            <dt className="font-medium">Concentration</dt>
                            <dd className="text-muted-foreground">{renderValue(selectedDoc.analysis.operations.suppliers.concentration)}</dd>
                          </div>
                          <div>
                            <dt className="font-medium">Relationship Transfer</dt>
                            <dd className="text-muted-foreground">{renderValue(selectedDoc.analysis.operations.suppliers.transferability)}</dd>
                          </div>
                        </dl>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold mb-3">Equipment & Assets</h3>
                      <div className="space-y-2">
                        <p className="text-muted-foreground">{renderValue(selectedDoc.analysis.assets.equipmentDetails)}</p>
                        <p className="text-muted-foreground">{renderValue(selectedDoc.analysis.assets.inventoryDetails)}</p>
                        <p><strong>Equipment Value:</strong> {renderValue(selectedDoc.analysis.assets.equipmentValue)}</p>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold mb-3">Marketing & Client Acquisition</h3>
                      <div className="space-y-2">
                        <p className="text-muted-foreground">{renderValue(selectedDoc.analysis.marketing.clientAcquisition)}</p>
                        <div className="mt-2">
                          <p className="font-medium">Marketing Strategies:</p>
                          <ul className="list-disc pl-6 mt-2">
                            {selectedDoc.analysis.marketing.strategies?.map((strategy: string, i: number) => (
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
                        <p><strong>Owner's Role:</strong> {renderValue(selectedDoc.analysis.team.ownerResponsibilities)}</p>
                        <p><strong>Required Hours:</strong> {renderValue(selectedDoc.analysis.team.ownerHours)}</p>
                        <p><strong>Management Structure:</strong> {renderValue(selectedDoc.analysis.team.management)}</p>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold mb-3">Employee Overview</h3>
                      <div className="space-y-2">
                        <p><strong>Total Employees:</strong> {renderValue(selectedDoc.analysis.team.employeeCount)}</p>
                        {selectedDoc.analysis.team.contractorCount && (
                          <p><strong>Contractors:</strong> {renderValue(selectedDoc.analysis.team.contractorCount)}</p>
                        )}
                        <p className="text-muted-foreground">{renderValue(selectedDoc.analysis.team.employeeSummary)}</p>

                        {selectedDoc.analysis.team.keyEmployees?.length > 0 && (
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
                        <dd className="text-muted-foreground">{renderValue(selectedDoc.analysis.facility.ownership)}</dd>
                      </div>
                      <div>
                        <dt className="font-medium">Size</dt>
                        <dd className="text-muted-foreground">{renderValue(selectedDoc.analysis.facility.size)}</dd>
                      </div>
                      <div>
                        <dt className="font-medium">Monthly Cost</dt>
                        <dd className="text-muted-foreground">{renderValue(selectedDoc.analysis.facility.cost)}</dd>
                      </div>
                      {selectedDoc.analysis.facility.leaseDetails && (
                        <div>
                          <dt className="font-medium">Lease Details</dt>
                          <dd className="text-muted-foreground">{renderValue(selectedDoc.analysis.facility.leaseDetails)}</dd>
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