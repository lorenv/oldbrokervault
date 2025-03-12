import { useQuery } from "@tanstack/react-query";
import { CimDocument } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, Lock, Copy } from "lucide-react";
import { Link } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function DocumentsPage() {
  const { data: documents } = useQuery<CimDocument[]>({
    queryKey: ["/api/cim"],
  });
  const [selectedDoc, setSelectedDoc] = useState<CimDocument | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

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
    toast({
      title: "Coming Soon",
      description: `Export to ${format.toUpperCase()} will be available soon`,
    });
  };

  const renderValue = (value: any): string => {
    if (Array.isArray(value)) {
      return value.join(", ");
    }
    if (typeof value === "object" && value !== null) {
      return Object.entries(value)
        .map(([key, val]) => `${key}: ${renderValue(val)}`)
        .join(", ");
    }
    return String(value || "N/A");
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">My CIM Documents</h1>
          <Link href="/">
            <Button>
              <FileText className="mr-2 h-4 w-4" />
              Create New CIM
            </Button>
          </Link>
        </div>

        <div className="grid gap-4">
          {documents?.map((doc) => (
            <Card key={doc.id} className="cursor-pointer hover:border-primary transition-colors" onClick={() => setSelectedDoc(doc)}>
              <CardHeader>
                <CardTitle>{doc.title}</CardTitle>
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

          {documents?.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No CIM documents yet. Create your first one!
            </div>
          )}
        </div>
      </main>

      {selectedDoc && (
        <Dialog open={!!selectedDoc} onOpenChange={(open) => !open && setSelectedDoc(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
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
                      Copy to Clipboard
                    </DropdownMenuItem>
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
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Display CIM content - reuse the same structure as in cim-generator.tsx */}
              <div className="space-y-8">
                {/* Business Overview */}
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

                {/* Add other sections as needed, following the same pattern as in cim-generator.tsx */}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}