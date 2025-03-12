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
import { Loader2 } from "lucide-react";
import { DocumentExport } from "./document-export";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { File, FileText } from "lucide-react";
import { chunkTranscript, mergeAnalysisResults } from "@/lib/transcript-chunker"; // Import chunking functions


export function CimGenerator() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [analysis, setAnalysis] = useState<any>(null);
  const [currentDocId, setCurrentDocId] = useState<number | null>(null);

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
      const responseData = await res.json();
      if (!res.ok) {
        throw new Error(responseData.error || 'Failed to generate CIM');
      }
      return responseData;
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

  const handleSubmission = async (data: any) => {
    if (!user) {
      return;
    }

    // Check if transcript is very large and needs chunking
    if (data.transcript.length > 8000) { // Reduced threshold for testing
      toast({
        title: "Processing large transcript",
        description: "Your transcript will be processed in chunks. This may take a little longer.",
      });

      try {
        // Clean the transcript first
        const cleanedTranscript = data.transcript
          .split('\n')
          .filter((line: string) => line.trim().length > 0)
          .join('\n');

        // Split into chunks of ~8000 characters
        const chunks = cleanedTranscript.match(/.{1,8000}/g) || [cleanedTranscript];
        console.log(`Processing transcript in ${chunks.length} chunks`);

        // Process first chunk
        const firstChunkData = { ...data, transcript: chunks[0] };
        const firstResponse = await generateMutation.mutateAsync(firstChunkData);

        if (chunks.length === 1) {
          return; // No additional processing needed
        }

        // Process remaining chunks
        for (let i = 1; i < chunks.length; i++) {
          const chunkData = { 
            ...data, 
            transcript: chunks[i],
            docId: firstResponse.id
          };

          await generateMutation.mutateAsync(chunkData);

          toast({
            title: "Processing chunks",
            description: `Processed chunk ${i + 1} of ${chunks.length}`,
          });
        }

        toast({
          title: "Processing complete",
          description: `Successfully processed all ${chunks.length} chunks`,
        });

      } catch (error) {
        console.error("Error processing chunks:", error);
        toast({
          title: "Error processing transcript",
          description: error instanceof Error ? error.message : "Failed to process the transcript chunks",
          variant: "destructive"
        });
      }
    } else {
      // Standard processing for smaller transcripts
      await generateMutation.mutateAsync(data);
    }
  };

  const handleGenerate = async (data: any) => {
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
    await handleSubmission(data);
  };

  const handlePdfExport = () => {
    // Placeholder for PDF export function
    console.log("Exporting to PDF");
  };

  const handleWordExport = () => {
    // Placeholder for Word export function
    console.log("Exporting to Word");
  };

  const renderBusinessOverview = () => {
    if (!analysis?.story) return null;

    return (
      <section>
        <h2 className="text-2xl font-bold border-b pb-2 mb-4">Business Overview</h2>
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-2">Background</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="font-medium">Founded</p>
                <p className="text-muted-foreground">
                  {analysis.story.yearStarted || 'Not specified'}
                </p>
              </div>
              <div>
                <p className="font-medium">Structure</p>
                <p className="text-muted-foreground">
                  {analysis.story.businessStructure || 'Not specified'}
                </p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">Business Description</h3>
            <p className="text-muted-foreground">
              {analysis.BusinessDescription?.Summary?.Text || analysis.story.businessModel || 'Not provided'}
            </p>
          </div>
        </div>
      </section>
    );
  };

  const renderInvestmentHighlights = () => {
    if (!analysis?.executiveSummary && !analysis?.BusinessDescription) return null;

    return (
      <section>
        <h2 className="text-2xl font-bold border-b pb-2 mb-4">Investment Highlights</h2>
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-2">Key Attractions</h3>
            <ul className="list-disc pl-6 space-y-1">
              {(analysis.executiveSummary?.buyerAttractions || analysis.BusinessDescription?.KeyDifferentiators || []).map((item: string, i: number) => (
                <li key={i} className="text-muted-foreground">{item}</li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">Growth Opportunities</h3>
            <ul className="list-disc pl-6 space-y-1">
              {(analysis.executiveSummary?.growthOpportunities || []).map((item: string, i: number) => (
                <li key={i} className="text-muted-foreground">{item}</li>
              ))}
            </ul>
          </div>

          {(analysis.SaleReason?.Text || analysis.executiveSummary?.saleReason) && (
            <div>
              <h3 className="text-lg font-semibold mb-2">Sale Reason</h3>
              <p className="text-muted-foreground">
                {analysis.SaleReason?.Text || analysis.executiveSummary?.saleReason}
              </p>
            </div>
          )}
        </div>
      </section>
    );
  };

  const renderTeamStructure = () => {
    if (!analysis?.team && !analysis?.TeamStructure) return null;

    const team = analysis.TeamStructure || analysis.team;

    return (
      <section>
        <h2 className="text-2xl font-bold border-b pb-2 mb-4">Team Structure</h2>
        <div className="space-y-6">
          {team.TotalHeadcount && (
            <div>
              <h3 className="text-lg font-semibold mb-2">Total Headcount</h3>
              <p className="text-muted-foreground">{team.TotalHeadcount}</p>
            </div>
          )}

          {(team.Roles?.length > 0 || team.EmploymentStatus?.length > 0) && (
            <div>
              <h3 className="text-lg font-semibold mb-3">Employee Overview</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Role</th>
                      <th className="text-left py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(team.EmploymentStatus || []).map((employee: any, i: number) => (
                      <tr key={i} className="border-b">
                        <td className="py-2">{employee.Role}</td>
                        <td className="py-2">{employee.Status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {team.KeyPersonnel?.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3">Key Personnel</h3>
              {team.KeyPersonnel.map((person: any, i: number) => (
                <div key={i} className="mb-4">
                  <h4 className="font-medium">{person.Name} - {person.Role}</h4>
                  <ul className="list-disc pl-6 mt-2">
                    {person.Responsibilities.map((resp: string, j: number) => (
                      <li key={j} className="text-muted-foreground">{resp}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    );
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
              <Textarea
                placeholder="Analysis Directions"
                className="min-h-[150px]"
                {...form.register("directions")}
              />
              <p className="text-sm text-muted-foreground mt-2">
                {currentDocId ? (
                  <>
                    Regenerations remaining: {Math.max(0, subscriptionPlans[user?.subscriptionStatus as keyof typeof subscriptionPlans]?.regenerationLimit - (analysis?.regenerationCount || 0))}
                  </>
                ) : (
                  "Customize how the AI analyzes your transcript"
                )}
              </p>
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
              {renderBusinessOverview()}
              {renderInvestmentHighlights()}
              {renderTeamStructure()}

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
                  {user?.subscriptionStatus === "free" ? (
                    <div className="flex flex-col items-end">
                      <Button
                        onClick={() => toast({
                          title: "Premium Feature",
                          description: "Export to PDF and Word is available on Standard and Premium plans.",
                          variant: "default"
                        })}
                        variant="outline"
                        size="sm"
                        className="text-xs mb-1"
                      >
                        <FileText className="mr-1 h-3 w-3" />
                        Export PDF
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        Available on paid plans
                      </span>
                    </div>
                  ) : (
                    <>
                      <Button
                        onClick={handlePdfExport}
                        variant="outline"
                        size="sm"
                        className="text-xs"
                      >
                        <FileText className="mr-1 h-3 w-3" />
                        Export PDF
                      </Button>
                      <Button
                        onClick={handleWordExport}
                        variant="outline"
                        size="sm"
                        className="text-xs"
                      >
                        <File className="mr-1 h-3 w-3" />
                        Export Word
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}