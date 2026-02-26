import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SettingsLayout } from "@/components/layout/settings-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { FormBuilder, type FormQuestion } from "@/components/form-builder";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface BuyerSurvey {
  id: number;
  name: string;
  questions: FormQuestion[];
  isDefault: boolean;
  isRequired: boolean;
  createdAt: string;
  updatedAt: string;
}

const SURVEY_SECTIONS = ["About You", "Deal Criteria"];

const CRM_FIELD_OPTIONS = [
  { label: "Buyer Type", value: "buyerType" },
  { label: "Financial Capability", value: "financialCapability" },
  { label: "Estimated Budget", value: "estimatedBudget" },
  { label: "Prior Acquisitions", value: "priorAcquisitions" },
  { label: "LinkedIn URL", value: "linkedinUrl" },
  { label: "Phone", value: "phone" },
  { label: "Target Industries", value: "acquisitionCriteria.industries" },
  { label: "Target Revenue Range", value: "acquisitionCriteria.revenueRange" },
  { label: "Target EBITDA Range", value: "acquisitionCriteria.ebitdaRange" },
  { label: "Preferred Geography", value: "acquisitionCriteria.geographies" },
  { label: "Preferred Deal Size", value: "acquisitionCriteria.dealSize" },
  { label: "Transaction Types", value: "acquisitionCriteria.transactionTypes" },
];

export function BuyerSurveysPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editingSurvey, setEditingSurvey] = useState<BuyerSurvey | null>(null);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [deletingSurvey, setDeletingSurvey] = useState<BuyerSurvey | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formQuestions, setFormQuestions] = useState<FormQuestion[]>([]);
  const [formIsDefault, setFormIsDefault] = useState(false);
  const [formIsRequired, setFormIsRequired] = useState(false);

  const { data: surveys = [], isLoading } = useQuery<BuyerSurvey[]>({
    queryKey: ["/api/buyer-surveys"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/buyer-surveys", { body: data });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/buyer-surveys"] });
      closeDialog();
      toast({ title: "Survey created" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to create survey", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PATCH", `/api/buyer-surveys/${id}`, { body: data });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/buyer-surveys"] });
      closeDialog();
      toast({ title: "Survey updated" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to update survey", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/buyer-surveys/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/buyer-surveys"] });
      setDeletingSurvey(null);
      toast({ title: "Survey deleted" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to delete survey", description: err.message, variant: "destructive" });
    },
  });

  const openCreate = () => {
    setIsCreateMode(true);
    setFormName("");
    setFormQuestions([]);
    setFormIsDefault(false);
    setFormIsRequired(false);
    setEditingSurvey({} as BuyerSurvey); // triggers dialog open
  };

  const openEdit = (survey: BuyerSurvey) => {
    setIsCreateMode(false);
    setFormName(survey.name);
    setFormQuestions(survey.questions);
    setFormIsDefault(survey.isDefault);
    setFormIsRequired(survey.isRequired);
    setEditingSurvey(survey);
  };

  const closeDialog = () => {
    setEditingSurvey(null);
    setIsCreateMode(false);
  };

  const handleSave = () => {
    if (!formName.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    if (formQuestions.length === 0) {
      toast({ title: "Add at least one question", variant: "destructive" });
      return;
    }

    const payload = {
      name: formName,
      questions: formQuestions,
      isDefault: formIsDefault,
      isRequired: formIsRequired,
    };

    if (isCreateMode) {
      createMutation.mutate(payload);
    } else if (editingSurvey?.id) {
      updateMutation.mutate({ id: editingSurvey.id, data: payload });
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <SettingsLayout title="Buyer Surveys" description="Configure qualification forms sent to NDA signers">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">
              Buyer surveys are sent to NDA signers to collect qualification data. Responses automatically enrich CRM contacts.
            </p>
          </div>
          <Button variant="outline" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" /> New Survey
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : surveys.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-gray-500">No surveys yet. A default survey will be created automatically.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {surveys.map((survey) => (
              <Card key={survey.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-gray-900">{survey.name}</h3>
                          {survey.isDefault && (
                            <Badge variant="secondary" className="text-xs">Default</Badge>
                          )}
                          {survey.isRequired && (
                            <Badge variant="outline" className="text-xs text-amber-700 border-amber-200">Required</Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 mt-0.5">
                          {(survey.questions as any[]).length} questions
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(survey)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-700"
                        onClick={() => setDeletingSurvey(survey)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={!!editingSurvey} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isCreateMode ? "Create Survey" : "Edit Survey"}</DialogTitle>
            <DialogDescription>
              Configure your buyer qualification survey. Questions with CRM field mappings will auto-update contact records.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label className="text-sm text-gray-700">Survey Name</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., Buyer Qualification Survey"
                className="mt-1"
              />
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={formIsDefault} onCheckedChange={setFormIsDefault} />
                <Label className="text-sm text-gray-700">Default survey</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={formIsRequired} onCheckedChange={setFormIsRequired} />
                <Label className="text-sm text-gray-700">Required to complete</Label>
              </div>
            </div>

            <div className="border-t pt-4">
              <Label className="text-sm font-medium text-gray-700">Questions</Label>
              <div className="mt-2">
                <FormBuilder
                  questions={formQuestions}
                  onChange={setFormQuestions}
                  sections={SURVEY_SECTIONS}
                  crmFieldOptions={CRM_FIELD_OPTIONS}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isCreateMode ? "Create Survey" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deletingSurvey} onOpenChange={(open) => !open && setDeletingSurvey(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Survey</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingSurvey?.name}"? This action cannot be undone. Existing responses will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deletingSurvey && deleteMutation.mutate(deletingSurvey.id)}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsLayout>
  );
}

export default BuyerSurveysPage;
