import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertCimDocumentSchema, DEFAULT_CIM_DIRECTIONS, subscriptionPlans } from "@shared/schema";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Loader2, Settings } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { File, FileText } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, Copy } from "lucide-react";


export function CimGenerator() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [analysis, setAnalysis] = useState<any>(null);
  const [currentDocId, setCurrentDocId] = useState<number | null>(null);
  const [isDirectionsOpen, setIsDirectionsOpen] = useState(false);

  const form = useForm({
    resolver: zodResolver(insertCimDocumentSchema),
    defaultValues: {
      directions: DEFAULT_CIM_DIRECTIONS
    }
  });

  const generateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/cim", {
        ...data,
        docId: currentDocId // Pass docId for regeneration
      });
      return res.json();
    },
    onSuccess: (data) => {
      setAnalysis(data.analysis);
      setCurrentDocId(data.id);
      queryClient.invalidateQueries({ queryKey: ["/api/cim"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to generate CIM",
        variant: "destructive"
      });
    }
  });

  const handleGenerate = (data: any) => {
    // Check regeneration limits
    if (currentDocId) {
      const plan = subscriptionPlans[user?.subscriptionStatus as keyof typeof subscriptionPlans];
      if (analysis?.regenerationCount >= plan.regenerationLimit) {
        toast({
          title: "Regeneration Limit Reached",
          description: `Your ${plan.name} plan allows ${plan.regenerationLimit} regenerations per CIM. Please upgrade to increase this limit.`,
          variant: "destructive"
        });
        return;
      }
    }
    generateMutation.mutate(data);
  };

  const handleCopyToClipboard = async () => {
    try {
      // Create a formatted text version of the CIM
      const cimText = `
Business Summary:
${analysis.story.businessModel}

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
    // To be implemented: PDF and Word export functionality
    toast({
      title: "Coming Soon",
      description: `Export to ${format.toUpperCase()} will be available soon`,
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Generate CIM Document</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={form.handleSubmit(handleGenerate)}
            className="space-y-4"
          >
            <div>
              <Input
                placeholder="Document Title"
                {...form.register("title")}
              />
            </div>
            <div>
              <Textarea
                placeholder="Paste your meeting transcript here..."
                className="min-h-[200px]"
                {...form.register("transcript")}
              />
            </div>
            <div>
              <Dialog open={isDirectionsOpen} onOpenChange={setIsDirectionsOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" type="button" className="w-full">
                    <Settings className="mr-2 h-4 w-4" />
                    Customize Analysis Directions
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Analysis Directions</DialogTitle>
                    <DialogDescription>
                      Customize how the AI analyzes your transcript. These directions guide the CIM generation process.
                    </DialogDescription>
                  </DialogHeader>
                  <Textarea
                    className="min-h-[400px]"
                    {...form.register("directions")}
                  />
                  <div className="text-sm text-muted-foreground mt-2">
                    {currentDocId && (
                      <>
                        Regenerations remaining: {Math.max(0, subscriptionPlans[user?.subscriptionStatus as keyof typeof subscriptionPlans]?.regenerationLimit - (analysis?.regenerationCount || 0))}
                      </>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <Button
              type="submit"
              disabled={generateMutation.isPending}
              className="w-full"
            >
              {generateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {currentDocId ? "Regenerate CIM" : "Generate CIM"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {analysis && (
        <Card>
          <CardHeader>
            <CardTitle>Confidential Information Memorandum</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-8 max-w-4xl mx-auto">
              {/* Section: Business Overview */}
              <section>
                <h2 className="text-2xl font-bold border-b pb-2 mb-4">Business Overview</h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Background</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="font-medium">Founded</p>
                        <p className="text-muted-foreground">{analysis.story.yearStarted}</p>
                      </div>
                      <div>
                        <p className="font-medium">Structure</p>
                        <p className="text-muted-foreground">{analysis.story.businessStructure}</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-2">Business Description</h3>
                    <p className="text-muted-foreground">{analysis.story.businessModel}</p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-2">Growth History</h3>
                    <p className="text-muted-foreground">{analysis.story.growthHistory}</p>
                  </div>
                </div>
              </section>

              {/* Section: Investment Highlights */}
              <section>
                <h2 className="text-2xl font-bold border-b pb-2 mb-4">Investment Highlights</h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Key Attractions</h3>
                    <ul className="list-disc pl-6 space-y-1">
                      {analysis.executiveSummary.buyerAttractions.map((item: string, i: number) => (
                        <li key={i} className="text-muted-foreground">{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-2">Growth Opportunities</h3>
                    <ul className="list-disc pl-6 space-y-1">
                      {analysis.executiveSummary.growthOpportunities.map((item: string, i: number) => (
                        <li key={i} className="text-muted-foreground">{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </section>

              {/* Section: Market Position */}
              <section>
                <h2 className="text-2xl font-bold border-b pb-2 mb-4">Market Position</h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Target Market</h3>
                    <p className="text-muted-foreground">{analysis.marketAnalysis.customerProfile}</p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-2">Competitive Landscape</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2">Competitors</th>
                            <th className="text-left py-2">Business Strengths</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="py-2 pr-4">
                              <ul className="list-disc pl-6 space-y-1">
                                {analysis.marketAnalysis.competitors.map((competitor: string, i: number) => (
                                  <li key={i} className="text-muted-foreground">{competitor}</li>
                                ))}
                              </ul>
                            </td>
                            <td className="py-2">
                              <ul className="list-disc pl-6 space-y-1">
                                {analysis.marketAnalysis.strengths.map((strength: string, i: number) => (
                                  <li key={i} className="text-muted-foreground">{strength}</li>
                                ))}
                              </ul>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section: Operations */}
              <section>
                <h2 className="text-2xl font-bold border-b pb-2 mb-4">Operations</h2>

                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Customer Relationships</h3>
                    <div className="bg-muted rounded-lg p-4">
                      <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <dt className="font-medium">Recurring Revenue</dt>
                          <dd className="text-muted-foreground">{analysis.operations.customers.recurring}</dd>
                        </div>
                        <div>
                          <dt className="font-medium">Customer Base</dt>
                          <dd className="text-muted-foreground">{analysis.operations.customers.relationships}</dd>
                        </div>
                        <div>
                          <dt className="font-medium">Revenue Concentration</dt>
                          <dd className="text-muted-foreground">{analysis.operations.customers.concentration}</dd>
                        </div>
                        <div>
                          <dt className="font-medium">Contract Terms</dt>
                          <dd className="text-muted-foreground">{analysis.operations.customers.contracts}</dd>
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
                          <dd className="text-muted-foreground">{analysis.operations.suppliers.count}</dd>
                        </div>
                        <div>
                          <dt className="font-medium">Supplier Terms</dt>
                          <dd className="text-muted-foreground">{analysis.operations.suppliers.terms}</dd>
                        </div>
                        <div>
                          <dt className="font-medium">Concentration</dt>
                          <dd className="text-muted-foreground">{analysis.operations.suppliers.concentration}</dd>
                        </div>
                        <div>
                          <dt className="font-medium">Relationship Transfer</dt>
                          <dd className="text-muted-foreground">{analysis.operations.suppliers.transferability}</dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section: Team */}
              <section>
                <h2 className="text-2xl font-bold border-b pb-2 mb-4">Team Structure</h2>

                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Ownership & Management</h3>
                    <div className="space-y-2">
                      <p><strong>Owner's Role:</strong> {analysis.team.ownerResponsibilities}</p>
                      <p><strong>Required Hours:</strong> {analysis.team.ownerHours}</p>
                      <p><strong>Management Structure:</strong> {analysis.team.management}</p>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-3">Employee Overview</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2">Role</th>
                            <th className="text-left py-2">Status</th>
                            <th className="text-left py-2">Compensation</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analysis.team.employees.map((employee: any, i: number) => (
                            <tr key={i} className="border-b">
                              <td className="py-2">{employee.role}</td>
                              <td className="py-2">{employee.status}</td>
                              <td className="py-2">{employee.compensation}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-3">Team Stability</h3>
                    <div className="space-y-2">
                      <p><strong>Turnover Rate:</strong> {analysis.team.turnover}</p>
                      <p><strong>Hiring Environment:</strong> {analysis.team.hiring}</p>
                      <p><strong>Post-Sale Retention:</strong> {analysis.team.retention}</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section: Facilities */}
              <section>
                <h2 className="text-2xl font-bold border-b pb-2 mb-4">Facilities</h2>
                <div className="bg-muted rounded-lg p-4">
                  <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <dt className="font-medium">Ownership Status</dt>
                      <dd className="text-muted-foreground">{analysis.facility.ownership}</dd>
                    </div>
                    <div>
                      <dt className="font-medium">Size</dt>
                      <dd className="text-muted-foreground">{analysis.facility.size}</dd>
                    </div>
                    <div>
                      <dt className="font-medium">Monthly Cost</dt>
                      <dd className="text-muted-foreground">{analysis.facility.cost}</dd>
                    </div>
                    {analysis.facility.leaseDetails && (
                      <div>
                        <dt className="font-medium">Lease Details</dt>
                        <dd className="text-muted-foreground">{analysis.facility.leaseDetails}</dd>
                      </div>
                    )}
                  </dl>
                </div>
              </section>

              {/* Export Button */}
              <div className="pt-4">
                <div className="flex items-center space-x-2 ml-auto">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Download className="mr-2 h-4 w-4" />
                        Export
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={handleCopyToClipboard}>
                        <Copy className="mr-2 h-4 w-4" />
                        Copy to Clipboard
                      </DropdownMenuItem>
                      {user?.subscriptionStatus !== "free" && (
                        <>
                          <DropdownMenuItem onClick={() => handleExport('word')}>
                            <File className="mr-2 h-4 w-4" />
                            Export to Word
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleExport('pdf')}>
                            <FileText className="mr-2 h-4 w-4" />
                            Export to PDF
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}