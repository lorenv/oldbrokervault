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
        docId: currentDocId
      });
      const responseData = await res.json();
      if (!res.ok) {
        throw new Error(responseData.error || 'Failed to generate CIM');
      }
      return responseData;
    },
    onSuccess: (data) => {
      // Transform API response to match frontend structure
      const transformedAnalysis = {
        BusinessDescription: data.analysis?.BusinessDescription || {},
        SaleReason: data.analysis?.SaleReason || { Text: 'Not provided' },
        TeamStructure: data.analysis?.TeamStructure || {
          TotalHeadcount: 0,
          Roles: [],
          EmploymentStatus: [],
          KeyPersonnel: []
        },
        story: {
          yearStarted: data.analysis?.BusinessDescription?.Founded || 'Not specified',
          businessModel: data.analysis?.BusinessDescription?.Summary?.Text || 'Not specified',
          structure: data.analysis?.BusinessDescription?.Structure?.Text || 'Not specified'
        },
        marketAnalysis: {
          customerProfile: data.analysis?.BusinessDescription?.MarketPosition?.Text || '',
          competitors: data.analysis?.Competitors || [],
          strengths: data.analysis?.BusinessDescription?.KeyDifferentiators || []
        },
        operations: {
          customers: {},
          suppliers: {}
        },
        facility: data.analysis?.facility || null
      };

      setAnalysis(transformedAnalysis);
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
                  {analysis.story.structure || 'Not specified'}
                </p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">Business Description</h3>
            <p className="text-muted-foreground">
              {analysis.story.businessModel || 'Not provided'}
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

  const renderOperations = () => {
    if (!analysis?.operations && !analysis?.BusinessOperations) return null;

    const operations = analysis?.operations || analysis?.BusinessOperations || {};
    const customers = operations?.customers || {};
    const suppliers = operations?.suppliers || {};

    return (
      <section>
        <h2 className="text-2xl font-bold border-b pb-2 mb-4">Operations</h2>
        <div className="space-y-6">
          {/* Customer Relationships */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Customer Relationships</h3>
            <div className="bg-muted rounded-lg p-4">
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <dt className="font-medium">Recurring Revenue</dt>
                  <dd className="text-muted-foreground">{customers?.recurring || 'Not specified'}</dd>
                </div>
                <div>
                  <dt className="font-medium">Customer Base</dt>
                  <dd className="text-muted-foreground">{customers?.relationships || 'Not specified'}</dd>
                </div>
                <div>
                  <dt className="font-medium">Revenue Concentration</dt>
                  <dd className="text-muted-foreground">{customers?.concentration || 'Not specified'}</dd>
                </div>
                <div>
                  <dt className="font-medium">Contract Terms</dt>
                  <dd className="text-muted-foreground">{customers?.contracts || 'Not specified'}</dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Supply Chain */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Supply Chain</h3>
            <div className="bg-muted rounded-lg p-4">
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <dt className="font-medium">Number of Suppliers</dt>
                  <dd className="text-muted-foreground">{suppliers?.count || 'Not specified'}</dd>
                </div>
                <div>
                  <dt className="font-medium">Supplier Terms</dt>
                  <dd className="text-muted-foreground">{suppliers?.terms || 'Not specified'}</dd>
                </div>
                <div>
                  <dt className="font-medium">Concentration</dt>
                  <dd className="text-muted-foreground">{suppliers?.concentration || 'Not specified'}</dd>
                </div>
                <div>
                  <dt className="font-medium">Relationship Transfer</dt>
                  <dd className="text-muted-foreground">{suppliers?.transferability || 'Not specified'}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </section>
    );
  };

  // Only render facility section if data exists
  const renderFacility = () => {
    if (!analysis?.facility) return null;

    return (
      <section>
        <h2 className="text-2xl font-bold border-b pb-2 mb-4">Facilities</h2>
        <div className="bg-muted rounded-lg p-4">
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <dt className="font-medium">Ownership Status</dt>
              <dd className="text-muted-foreground">{analysis.facility.ownership || 'Not specified'}</dd>
            </div>
            <div>
              <dt className="font-medium">Size</dt>
              <dd className="text-muted-foreground">{analysis.facility.size || 'Not specified'}</dd>
            </div>
            <div>
              <dt className="font-medium">Monthly Cost</dt>
              <dd className="text-muted-foreground">{analysis.facility.cost || 'Not specified'}</dd>
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
              {renderOperations()}
              {renderFacility()}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}