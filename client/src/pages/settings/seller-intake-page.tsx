import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { SettingsLayout } from "@/components/layout/settings-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Copy, Check, ExternalLink } from "lucide-react";
import { FormBuilder, type FormQuestion } from "@/components/form-builder";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface IntakeFormSettings {
  slug: string;
  questions: FormQuestion[];
  formTitle: string;
  formDescription: string;
}

const INTAKE_SECTIONS = ["About You", "About Your Business", "Selling Context"];

const CRM_FIELD_OPTIONS = [
  { label: "Contact: Name", value: "contact.name" },
  { label: "Contact: Email", value: "contact.email" },
  { label: "Contact: Phone", value: "contact.phone" },
  { label: "Contact: LinkedIn", value: "contact.linkedinUrl" },
  { label: "Deal: Business Name", value: "deal.name" },
  { label: "Deal: Industry", value: "deal.industry" },
  { label: "Deal: Description", value: "deal.businessDescription" },
  { label: "Deal: Revenue Range", value: "deal.revenueRange" },
  { label: "Deal: Profit Range", value: "deal.profitRange" },
  { label: "Deal: Asking Price", value: "deal.askingPrice" },
  { label: "Deal: Seller Motivation", value: "deal.sellerMotivation" },
  { label: "Deal: Seller Timeline", value: "deal.sellerTimeline" },
  { label: "Deal: Source", value: "deal.dealSource" },
  { label: "Deal: Referred By", value: "deal.referredBy" },
];

export function SellerIntakePage() {
  const { toast } = useToast();
  const [formTitle, setFormTitle] = useState("Sell Your Business");
  const [formDescription, setFormDescription] = useState("");
  const [questions, setQuestions] = useState<FormQuestion[]>([]);
  const [copied, setCopied] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const { data, isLoading } = useQuery<IntakeFormSettings>({
    queryKey: ["/api/settings/seller-intake-form"],
  });

  useEffect(() => {
    if (data && !initialized) {
      setFormTitle(data.formTitle || "Sell Your Business");
      setFormDescription(data.formDescription || "");
      setQuestions(data.questions || []);
      setInitialized(true);
    }
  }, [data, initialized]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", "/api/settings/seller-intake-form", {
        body: { questions, formTitle, formDescription },
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Saved", description: "Seller intake form updated." });
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: err.message || "Failed to save form settings.",
        variant: "destructive",
      });
    },
  });

  const publicUrl = data?.slug
    ? `${window.location.origin}/sell/${data.slug}`
    : null;

  const handleCopy = () => {
    if (publicUrl) {
      navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <SettingsLayout>
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      </SettingsLayout>
    );
  }

  return (
    <SettingsLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Seller Intake Form</h2>
          <p className="text-sm text-gray-600">
            Customize the public form that potential sellers see when they want to sell their business through you.
          </p>
        </div>

        {/* Public URL */}
        {publicUrl && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-700">Public Form URL</CardTitle>
              <CardDescription className="text-gray-500">Share this link with potential sellers</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input value={publicUrl} readOnly className="font-mono text-sm bg-gray-50" />
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Form Settings */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-700">Form Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-gray-700">Form Title</Label>
              <Input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Sell Your Business"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-gray-700">Form Description</Label>
              <Textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Interested in selling your business? Fill out the form below..."
                rows={2}
                className="mt-1"
              />
            </div>
          </CardContent>
        </Card>

        {/* Form Builder */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-700">Form Questions</CardTitle>
            <CardDescription className="text-gray-500">
              Configure the questions shown to potential sellers. Map each question to a CRM field for automatic data entry.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FormBuilder
              questions={questions}
              onChange={setQuestions}
              sections={INTAKE_SECTIONS}
              crmFieldOptions={CRM_FIELD_OPTIONS}
            />
          </CardContent>
        </Card>

        {/* Save */}
        <div className="flex justify-end">
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </div>
      </div>
    </SettingsLayout>
  );
}

export default SellerIntakePage;
