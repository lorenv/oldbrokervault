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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, Copy, File, FileText } from "lucide-react";
import { LoadingAnimation } from "@/components/ui/loading-animation";
import { DocumentExport } from './document-export';  // Fixed import path

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
      if (data.transcript.length > 4000) {
        const file = new Blob([data.transcript], { type: 'text/plain' });
        const formData = new FormData();
        formData.append('transcript', file, 'transcript.txt');
        formData.append('title', data.title);
        formData.append('directions', data.directions);
        if (currentDocId) {
          formData.append('docId', currentDocId.toString());
        }

        const res = await fetch('/api/cim/upload', {
          method: 'POST',
          body: formData,
          credentials: 'include'
        });

        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.error || "Failed to generate CIM");
        }

        return res.json();
      } else {
        const res = await apiRequest("POST", "/api/cim", {
          ...data,
          docId: currentDocId
        });
        return res.json();
      }
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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Generate CIM Document</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(handleGenerate)} className="space-y-4">
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
              className="w-full h-10 flex items-center justify-center"
            >
              {generateMutation.isPending ? (
                <LoadingAnimation size="sm" text="Analyzing transcript..." />
              ) : currentDocId ? (
                "Regenerate CIM"
              ) : (
                "Generate CIM"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {analysis && (
        <Card>
          <CardHeader>
            <CardTitle>Generated CIM</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-8 max-w-4xl mx-auto">
              <section>
                <h2 className="text-2xl font-bold border-b pb-2 mb-4">Business Overview</h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Background</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="font-medium">Founded</p>
                        <p className="text-muted-foreground">{renderValue(analysis.story.yearStarted)}</p>
                      </div>
                      <div>
                        <p className="font-medium">Structure</p>
                        <p className="text-muted-foreground">{renderValue(analysis.story.businessStructure)}</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-2">Business Summary</h3>
                    <p className="text-muted-foreground">{renderValue(analysis.story.businessSummary)}</p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-2">Growth History</h3>
                    <p className="text-muted-foreground">{renderValue(analysis.story.growthHistory)}</p>
                  </div>

                  {analysis.story.saleReason && (
                    <div>
                      <h3 className="text-lg font-semibold mb-2">Reason for Sale</h3>
                      <p className="text-muted-foreground">{renderValue(analysis.story.saleReason)}</p>
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
                      {analysis.story.keyAttractions?.map((item: string, i: number) => (
                        <li key={i} className="text-muted-foreground">{renderValue(item)}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-2">Growth Opportunities</h3>
                    <ul className="list-disc pl-6 space-y-1">
                      {analysis.executiveSummary.growthOpportunities?.map((item: string, i: number) => (
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
                    <p className="text-muted-foreground">{renderValue(analysis.marketAnalysis.customerProfile)}</p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-2">Competitive Landscape</h3>
                    <div className="bg-muted rounded-lg p-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h4 className="font-medium mb-2">Key Competitors</h4>
                          <ul className="list-disc pl-6 space-y-1">
                            {analysis.marketAnalysis.competitors?.map((competitor: string, i: number) => (
                              <li key={i} className="text-muted-foreground">{renderValue(competitor)}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <h4 className="font-medium mb-2">Business Strengths</h4>
                          <ul className="list-disc pl-6 space-y-1">
                            {analysis.marketAnalysis.strengths?.map((strength: string, i: number) => (
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
                          <dd className="text-muted-foreground">{renderValue(analysis.operations.customers.recurring)}</dd>
                        </div>
                        <div>
                          <dt className="font-medium">Customer Base</dt>
                          <dd className="text-muted-foreground">{renderValue(analysis.operations.customers.relationships)}</dd>
                        </div>
                        <div>
                          <dt className="font-medium">Revenue Concentration</dt>
                          <dd className="text-muted-foreground">{renderValue(analysis.operations.customers.concentration)}</dd>
                        </div>
                        <div>
                          <dt className="font-medium">Contract Terms</dt>
                          <dd className="text-muted-foreground">{renderValue(analysis.operations.customers.contracts)}</dd>
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
                          <dd className="text-muted-foreground">{renderValue(analysis.operations.suppliers.count)}</dd>
                        </div>
                        <div>
                          <dt className="font-medium">Supplier Terms</dt>
                          <dd className="text-muted-foreground">{renderValue(analysis.operations.suppliers.terms)}</dd>
                        </div>
                        <div>
                          <dt className="font-medium">Concentration</dt>
                          <dd className="text-muted-foreground">{renderValue(analysis.operations.suppliers.concentration)}</dd>
                        </div>
                        <div>
                          <dt className="font-medium">Relationship Transfer</dt>
                          <dd className="text-muted-foreground">{renderValue(analysis.operations.suppliers.transferability)}</dd>
                        </div>
                      </dl>
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
                      <p><strong>Owner's Role:</strong> {renderValue(analysis.team.ownerResponsibilities)}</p>
                      <p><strong>Required Hours:</strong> {renderValue(analysis.team.ownerHours)}</p>
                      <p><strong>Management Structure:</strong> {renderValue(analysis.team.management)}</p>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-3">Employee Overview</h3>
                    <div className="space-y-2">
                      <p><strong>Total Employees:</strong> {renderValue(analysis.team.employeeCount)}</p>
                      {analysis.team.contractorCount && (
                        <p><strong>Contractors:</strong> {renderValue(analysis.team.contractorCount)}</p>
                      )}
                      <p className="text-muted-foreground">{renderValue(analysis.team.employeeSummary)}</p>

                      {analysis.team.keyEmployees?.length > 0 && (
                        <div className="mt-4">
                          <p className="font-medium">Key Team Members:</p>
                          <ul className="list-disc pl-6 mt-2">
                            {analysis.team.keyEmployees.map((employee: string, i: number) => (
                              <li key={i} className="text-muted-foreground">{renderValue(employee)}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-3">Equipment & Assets</h3>
                    <div className="space-y-2">
                      <p className="text-muted-foreground">{renderValue(analysis.assets.equipmentDetails)}</p>
                      <p className="text-muted-foreground">{renderValue(analysis.assets.inventoryDetails)}</p>
                      <p><strong>Equipment Value:</strong> {renderValue(analysis.assets.equipmentValue)}</p>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-3">Contract Terms</h3>
                    <div className="space-y-2">
                      <div>
                        <p className="font-medium">Customer Contracts:</p>
                        <p className="text-muted-foreground">{renderValue(analysis.sales.contractTerms)}</p>
                      </div>
                      <div>
                        <p className="font-medium">Supplier Terms:</p>
                        <p className="text-muted-foreground">{renderValue(analysis.operations.suppliers.terms)}</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-3">Marketing & Client Acquisition</h3>
                    <div className="space-y-2">
                      <p className="text-muted-foreground">{renderValue(analysis.marketing.clientAcquisition)}</p>
                      <div className="mt-2">
                        <p className="font-medium">Marketing Strategies:</p>
                        <ul className="list-disc pl-6 mt-2">
                          {analysis.marketing.strategies.map((strategy: string, i: number) => (
                            <li key={i} className="text-muted-foreground">{renderValue(strategy)}</li>
                          ))}
                        </ul>
                      </div>
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
                      <dd className="text-muted-foreground">{renderValue(analysis.facility.ownership)}</dd>
                    </div>
                    <div>
                      <dt className="font-medium">Size</dt>
                      <dd className="text-muted-foreground">{renderValue(analysis.facility.size)}</dd>
                    </div>
                    <div>
                      <dt className="font-medium">Monthly Cost</dt>
                      <dd className="text-muted-foreground">{renderValue(analysis.facility.cost)}</dd>
                    </div>
                    {analysis.facility.leaseDetails && (
                      <div>
                        <dt className="font-medium">Lease Details</dt>
                        <dd className="text-muted-foreground">{renderValue(analysis.facility.leaseDetails)}</dd>
                      </div>
                    )}
                  </dl>
                </div>
              </section>

              {analysis && (
                <div className="pt-4">
                  <DocumentExport analysis={analysis} docId={currentDocId!} user={user} />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}