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
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

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
            <CardTitle>CIM Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <section>
                <h3 className="font-semibold mb-2">Business Summary</h3>
                <p className="text-muted-foreground">{analysis.summary}</p>
              </section>

              {analysis.financials?.revenue && (
                <section>
                  <h3 className="font-semibold mb-4">Revenue Breakdown</h3>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={Object.entries(analysis.financials.revenue.breakdown).map(
                          ([name, value]) => ({
                            name,
                            value,
                          })
                        )}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="value" fill="hsl(var(--primary))" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              )}

              {analysis.team?.employees && (
                <section>
                  <h3 className="font-semibold mb-2">Team Structure</h3>
                  <div className="space-y-2">
                    {analysis.team.employees.map((employee, i) => (
                      <div
                        key={i}
                        className="p-3 bg-muted rounded-lg"
                      >
                        <div className="font-medium">{employee.role}</div>
                        <div className="text-sm text-muted-foreground">
                          Tenure: {employee.tenure}
                        </div>
                        <div className="text-sm mt-1">
                          {employee.description}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <DocumentExport analysis={analysis} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
