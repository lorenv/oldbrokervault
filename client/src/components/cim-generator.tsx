import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertCimDocumentSchema } from "@shared/schema";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { DocumentExport } from "./document-export";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export function CimGenerator() {
  const [analysis, setAnalysis] = useState<any>(null);

  const form = useForm({
    resolver: zodResolver(insertCimDocumentSchema),
  });

  const generateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/cim", data);
      return res.json();
    },
    onSuccess: (data) => {
      setAnalysis(data.analysis);
      queryClient.invalidateQueries({ queryKey: ["/api/cim"] });
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Generate CIM Document</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={form.handleSubmit((data) => generateMutation.mutate(data))}
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
            <Button
              type="submit"
              disabled={generateMutation.isPending}
              className="w-full"
            >
              {generateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Generate CIM
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
            <div className="space-y-6">
              <Accordion type="single" collapsible className="w-full">
                {/* The Story */}
                <AccordionItem value="story">
                  <AccordionTrigger>The Story</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-semibold">When did the business begin?</h4>
                        <p className="text-muted-foreground">{analysis.story.yearStarted}</p>
                      </div>
                      <div>
                        <h4 className="font-semibold">How did you get the idea?</h4>
                        <p className="text-muted-foreground">{analysis.story.businessIdea}</p>
                      </div>
                      <div>
                        <h4 className="font-semibold">Business Model</h4>
                        <p className="text-muted-foreground">{analysis.story.businessModel}</p>
                      </div>
                      <div>
                        <h4 className="font-semibold">Order/Process Flow</h4>
                        <p className="text-muted-foreground">{analysis.story.orderProcess}</p>
                      </div>
                      <div>
                        <h4 className="font-semibold">Growth History</h4>
                        <p className="text-muted-foreground">{analysis.story.growthHistory}</p>
                      </div>
                      <div>
                        <h4 className="font-semibold">Business Structure</h4>
                        <p className="text-muted-foreground">{analysis.story.businessStructure}</p>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Executive Summary */}
                <AccordionItem value="summary">
                  <AccordionTrigger>Executive Summary</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-semibold">Why is this business attractive to buyers?</h4>
                        <ul className="list-disc pl-5 text-muted-foreground">
                          {analysis.executiveSummary.buyerAttractions.map((item: string, i: number) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-semibold">Growth Opportunities</h4>
                        <ul className="list-disc pl-5 text-muted-foreground">
                          {analysis.executiveSummary.growthOpportunities.map((item: string, i: number) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Market Analysis */}
                <AccordionItem value="market">
                  <AccordionTrigger>Market Analysis</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-semibold">What makes this business unique?</h4>
                        <ul className="list-disc pl-5 text-muted-foreground">
                          {analysis.marketAnalysis.uniqueFeatures.map((feature: string, i: number) => (
                            <li key={i}>{feature}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-semibold">Customer Profile</h4>
                        <p className="text-muted-foreground">{analysis.marketAnalysis.customerProfile}</p>
                      </div>
                      <div>
                        <h4 className="font-semibold">Why is the business being sold?</h4>
                        <p className="text-muted-foreground">{analysis.marketAnalysis.saleReason}</p>
                      </div>
                      <div>
                        <h4 className="font-semibold">Top Competitors</h4>
                        <ul className="list-disc pl-5 text-muted-foreground">
                          {analysis.marketAnalysis.competitors.map((competitor: string, i: number) => (
                            <li key={i}>{competitor}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Operations */}
                <AccordionItem value="operations">
                  <AccordionTrigger>Operations</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-6">
                      <div>
                        <h4 className="font-semibold mb-3">Suppliers</h4>
                        <div className="space-y-2 text-muted-foreground">
                          <p><strong>Count:</strong> {analysis.operations.suppliers.count}</p>
                          <p><strong>Will relationships transfer?</strong> {analysis.operations.suppliers.transferability}</p>
                          <p><strong>Concentration:</strong> {analysis.operations.suppliers.concentration}</p>
                          <p><strong>Terms:</strong> {analysis.operations.suppliers.terms}</p>
                          <p><strong>Ease of replacement:</strong> {analysis.operations.suppliers.replaceability}</p>
                        </div>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-3">Customers</h4>
                        <div className="space-y-2 text-muted-foreground">
                          <p><strong>Recurring customers:</strong> {analysis.operations.customers.recurring}</p>
                          <p><strong>Number of relationships:</strong> {analysis.operations.customers.relationships}</p>
                          <p><strong>Concentration:</strong> {analysis.operations.customers.concentration}</p>
                          <p><strong>Contract terms:</strong> {analysis.operations.customers.contracts}</p>
                          <p><strong>Ease of replacement:</strong> {analysis.operations.customers.replaceability}</p>
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Team */}
                <AccordionItem value="team">
                  <AccordionTrigger>Team</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-semibold">Owner's Responsibilities</h4>
                        <p className="text-muted-foreground">{analysis.team.ownerResponsibilities}</p>
                      </div>
                      <div>
                        <h4 className="font-semibold">Expected Hours for Buyer</h4>
                        <p className="text-muted-foreground">{analysis.team.ownerHours}</p>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">Employees</h4>
                        <div className="space-y-3">
                          {analysis.team.employees.map((employee: any, i: number) => (
                            <div key={i} className="p-3 bg-muted rounded-lg">
                              <p className="font-medium">{employee.role}</p>
                              <p className="text-sm">{employee.status}</p>
                              <p className="text-sm text-muted-foreground">{employee.compensation}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h4 className="font-semibold">Employee Turnover</h4>
                        <p className="text-muted-foreground">{analysis.team.turnover}</p>
                      </div>
                      <div>
                        <h4 className="font-semibold">Hiring Difficulty</h4>
                        <p className="text-muted-foreground">{analysis.team.hiring}</p>
                      </div>
                      <div>
                        <h4 className="font-semibold">Employee Retention Post-Sale</h4>
                        <p className="text-muted-foreground">{analysis.team.retention}</p>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Facility */}
                <AccordionItem value="facility">
                  <AccordionTrigger>Facility</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 text-muted-foreground">
                      <p><strong>Ownership:</strong> {analysis.facility.ownership}</p>
                      <p><strong>Size:</strong> {analysis.facility.size}</p>
                      <p><strong>Monthly Cost:</strong> {analysis.facility.cost}</p>
                      {analysis.facility.leaseDetails && (
                        <p><strong>Lease Details:</strong> {analysis.facility.leaseDetails}</p>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <DocumentExport analysis={analysis} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}