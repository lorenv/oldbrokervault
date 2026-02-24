import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, Loader2, AlertCircle, CheckCircle2, Building2 } from "lucide-react";
import { FormRenderer } from "@/components/form-renderer";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface IntakeFormData {
  organizationName: string;
  logoUrl: string | null;
  questions: any[];
  formTitle: string;
  formDescription: string;
}

export function SellerIntakePage() {
  const [, params] = useRoute("/sell/:slug");
  const slug = params?.slug;
  const { toast } = useToast();
  const [values, setValues] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);

  const { data, isLoading, error } = useQuery<IntakeFormData>({
    queryKey: [`/api/seller-intake/${slug}`],
    enabled: !!slug,
  });

  const submitMutation = useMutation({
    mutationFn: async (responses: Record<string, any>) => {
      const res = await apiRequest("POST", `/api/seller-intake/${slug}`, { body: { responses } });
      return res.json();
    },
    onSuccess: () => {
      setSubmitted(true);
      toast({ title: "Submitted", description: "Your information has been received." });
    },
    onError: (err: any) => {
      toast({
        title: "Submission failed",
        description: err.message || "Please check required fields and try again.",
        variant: "destructive",
      });
    },
  });

  const handleChange = (questionId: string, value: any) => {
    setValues((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitMutation.mutate(values);
  };

  if (!slug) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 p-4">
        <div className="flex justify-center items-center min-h-[50vh]">
          <Card className="max-w-md">
            <CardContent className="pt-6 text-center">
              <AlertCircle className="h-8 w-8 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">Invalid form link. Please check the URL and try again.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 p-4">
        <div className="flex justify-center items-center min-h-[50vh]">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-emerald-600 mb-3" />
              <p className="text-gray-600">Loading form...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 p-4">
        <div className="flex justify-center items-center min-h-[50vh]">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6 text-center">
              <AlertCircle className="h-8 w-8 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-700 font-medium mb-1">Form Not Found</p>
              <p className="text-gray-500 text-sm">This organization may not exist or the link is invalid.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 p-4">
        <div className="flex justify-center items-center min-h-[50vh]">
          <Card className="max-w-lg w-full">
            <CardContent className="pt-6 text-center">
              <div className="mx-auto mb-4 p-3 rounded-full bg-green-50 w-fit">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Submitted Successfully</h2>
              <p className="text-gray-600 mb-4">
                Thank you for your interest! A broker from <strong>{data.organizationName}</strong> will review your information and be in touch.
              </p>
              <p className="text-sm text-gray-500">
                You can close this page.
              </p>
              <div className="text-center pt-4">
                <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400">
                  <Shield className="h-3 w-3" />
                  <span>Secured by BrokerVault</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 p-4 py-8">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 p-3 rounded-full bg-emerald-50 w-fit">
              {data.logoUrl ? (
                <img src={data.logoUrl} alt={data.organizationName} className="h-6 w-6 rounded" />
              ) : (
                <Building2 className="h-6 w-6 text-emerald-600" />
              )}
            </div>
            <CardTitle className="text-xl">{data.formTitle}</CardTitle>
            <CardDescription className="text-gray-600">
              {data.organizationName}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <p className="text-sm text-gray-600">
                {data.formDescription}
              </p>

              <FormRenderer
                questions={data.questions}
                values={values}
                onChange={handleChange}
                groupBySection={true}
              />

              <div className="pt-4 border-t">
                <Button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                  disabled={submitMutation.isPending}
                >
                  {submitMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit"
                  )}
                </Button>
              </div>

              <div className="text-center">
                <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400">
                  <Shield className="h-3 w-3" />
                  <span>Secured by BrokerVault</span>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default SellerIntakePage;
