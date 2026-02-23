import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, Loader2, AlertCircle, CheckCircle2, ClipboardList } from "lucide-react";
import { FormRenderer } from "@/components/form-renderer";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface BuyerFormData {
  survey: {
    id: number;
    name: string;
    questions: any[];
  } | null;
  response: {
    id: number;
    responses: Record<string, any>;
  } | null;
  signerName: string;
  documentTitle: string;
}

export function BuyerFormPage() {
  const [, params] = useRoute("/buyer-form/:token");
  const token = params?.token;
  const { toast } = useToast();
  const [values, setValues] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);

  const { data, isLoading, error } = useQuery<BuyerFormData>({
    queryKey: [`/api/buyer-form/${token}`],
    enabled: !!token,
  });

  // Pre-fill values from existing response
  const effectiveValues = Object.keys(values).length > 0
    ? values
    : (data?.response?.responses || {});

  const submitMutation = useMutation({
    mutationFn: async (responses: Record<string, any>) => {
      const res = await apiRequest("POST", `/api/buyer-form/${token}`, { body: { responses } });
      return res.json();
    },
    onSuccess: () => {
      setSubmitted(true);
      toast({ title: "Profile submitted", description: "Your buyer profile has been saved." });
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
    const finalValues = { ...effectiveValues, ...values };
    submitMutation.mutate(finalValues);
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="flex justify-center items-center min-h-[50vh]">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600 mb-3" />
              <p className="text-gray-600">Loading buyer form...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="flex justify-center items-center min-h-[50vh]">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6 text-center">
              <AlertCircle className="h-8 w-8 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-700 font-medium mb-1">Form Not Found</p>
              <p className="text-gray-500 text-sm">This form link may have expired or is invalid.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!data.survey) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="flex justify-center items-center min-h-[50vh]">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6 text-center">
              <ClipboardList className="h-8 w-8 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-700 font-medium mb-1">No Survey Available</p>
              <p className="text-gray-500 text-sm">There is no buyer qualification form configured for this document.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Success state
  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="flex justify-center items-center min-h-[50vh]">
          <Card className="max-w-lg w-full">
            <CardContent className="pt-6 text-center">
              <div className="mx-auto mb-4 p-3 rounded-full bg-green-50 w-fit">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Profile Submitted</h2>
              <p className="text-gray-600 mb-4">
                Thank you, {data.signerName}! Your buyer profile for <strong>{data.documentTitle}</strong> has been saved.
              </p>
              <p className="text-sm text-gray-500">
                You can close this page. Your profile information will help the broker review your NDA request.
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

  const alreadySubmitted = !!data.response;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 py-8">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 p-3 rounded-full bg-blue-50 w-fit">
              <ClipboardList className="h-6 w-6 text-blue-600" />
            </div>
            <CardTitle className="text-xl">Buyer Qualification Profile</CardTitle>
            <CardDescription>
              {data.documentTitle}
              {alreadySubmitted && (
                <span className="block mt-1 text-green-600 font-medium">
                  You previously submitted this form. You can update your responses below.
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <p className="text-sm text-gray-600">
                Hello {data.signerName}, please fill out the information below to help expedite the review of your NDA request.
              </p>

              <FormRenderer
                questions={data.survey.questions}
                values={effectiveValues}
                onChange={handleChange}
                groupBySection={true}
              />

              <div className="pt-4 border-t">
                <Button
                  type="submit"
                  className="w-full"
                  disabled={submitMutation.isPending}
                >
                  {submitMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : alreadySubmitted ? (
                    "Update Profile"
                  ) : (
                    "Submit Profile"
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

export default BuyerFormPage;
