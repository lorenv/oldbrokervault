import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import {
  FileSignature,
  Send,
  ArrowLeft,
  Upload,
  FileText,
  Users,
  Mail,
  User,
  Plus,
  Trash2,
  GripVertical,
  Clock,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ESIGN_RECIPIENT_COLORS, ESIGN_CC_COLOR } from "@shared/schema";
import { v4 as uuidv4 } from "uuid";

interface EsignTemplate {
  id: number;
  name: string;
  description: string | null;
  documentUrl: string;
  pageImages: string[];
  totalPages: number;
  placeholderRecipients: PlaceholderRecipient[];
  fields: TemplateField[];
}

interface PlaceholderRecipient {
  id: string;
  label: string;
  role: 'signer' | 'cc';
  color: string;
  order: number;
}

interface TemplateField {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  assignedTo: string;
  required: boolean;
}

interface Recipient {
  id: string;
  name: string;
  email: string;
  role: 'signer' | 'cc';
  order: number;
  placeholderRecipientId?: string; // Maps to template placeholder
}

export default function EsignSend() {
  const [, setLocation] = useLocation();
  const searchParams = useSearch();
  const templateIdFromUrl = new URLSearchParams(searchParams).get('template');

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Step state
  const [currentStep, setCurrentStep] = useState(1);

  // Form state
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(
    templateIdFromUrl ? parseInt(templateIdFromUrl) : null
  );
  const [signingOrder, setSigningOrder] = useState<'sequential' | 'parallel'>('sequential');
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [pageImages, setPageImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Fetch templates
  const { data: templates = [], isLoading: isLoadingTemplates } = useQuery<EsignTemplate[]>({
    queryKey: ["/api/esign/templates"],
  });

  // Fetch selected template details
  const { data: selectedTemplate } = useQuery<EsignTemplate>({
    queryKey: ["/api/esign/templates", selectedTemplateId],
    queryFn: async () => {
      if (!selectedTemplateId) return null;
      const res = await fetch(`/api/esign/templates/${selectedTemplateId}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch template');
      return res.json();
    },
    enabled: !!selectedTemplateId,
  });

  // Initialize recipients when template is selected
  useEffect(() => {
    if (selectedTemplate) {
      setTitle(selectedTemplate.name);
      setDocumentUrl(selectedTemplate.documentUrl);
      setPageImages(selectedTemplate.pageImages);

      // Create recipients from placeholder recipients
      const newRecipients: Recipient[] = selectedTemplate.placeholderRecipients.map((placeholder, idx) => ({
        id: uuidv4(),
        name: "",
        email: "",
        role: placeholder.role,
        order: placeholder.order,
        placeholderRecipientId: placeholder.id,
      }));
      setRecipients(newRecipients);
    }
  }, [selectedTemplate]);

  // Handle direct document upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('document', file);

    try {
      const res = await fetch('/api/esign/templates/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Upload failed');
      }

      const data = await res.json();
      setDocumentUrl(data.documentUrl);
      setPageImages(data.pageImages);
      setTitle(file.name.replace(/\.[^/.]+$/, "")); // Remove extension
      setSelectedTemplateId(null);

      // Initialize with one signer
      if (recipients.length === 0) {
        setRecipients([{
          id: uuidv4(),
          name: "",
          email: "",
          role: 'signer',
          order: 1,
        }]);
      }

      toast({
        title: "Document uploaded",
        description: `Successfully processed ${data.pageCount} page(s).`,
      });
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Add recipient
  const addRecipient = (role: 'signer' | 'cc') => {
    const maxOrder = Math.max(...recipients.map(r => r.order), 0);
    const newRecipient: Recipient = {
      id: uuidv4(),
      name: "",
      email: "",
      role,
      order: maxOrder + 1,
    };
    setRecipients([...recipients, newRecipient]);
  };

  // Remove recipient
  const removeRecipient = (id: string) => {
    setRecipients(recipients.filter(r => r.id !== id));
  };

  // Update recipient
  const updateRecipient = (id: string, updates: Partial<Recipient>) => {
    setRecipients(recipients.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  // Move recipient order
  const moveRecipient = (id: string, direction: 'up' | 'down') => {
    const idx = recipients.findIndex(r => r.id === id);
    if (idx === -1) return;

    const newRecipients = [...recipients];
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;

    if (swapIdx < 0 || swapIdx >= newRecipients.length) return;

    // Swap orders
    const tempOrder = newRecipients[idx].order;
    newRecipients[idx].order = newRecipients[swapIdx].order;
    newRecipients[swapIdx].order = tempOrder;

    // Re-sort
    newRecipients.sort((a, b) => a.order - b.order);
    setRecipients(newRecipients);
  };

  // Get placeholder label for a recipient
  const getPlaceholderLabel = (recipient: Recipient): string | null => {
    if (!selectedTemplate || !recipient.placeholderRecipientId) return null;
    const placeholder = selectedTemplate.placeholderRecipients.find(
      p => p.id === recipient.placeholderRecipientId
    );
    return placeholder?.label || null;
  };

  // Get color for a recipient
  const getRecipientColor = (recipient: Recipient, index: number): string => {
    if (recipient.role === 'cc') return ESIGN_CC_COLOR;
    if (selectedTemplate && recipient.placeholderRecipientId) {
      const placeholder = selectedTemplate.placeholderRecipients.find(
        p => p.id === recipient.placeholderRecipientId
      );
      if (placeholder) return placeholder.color;
    }
    return ESIGN_RECIPIENT_COLORS[index % ESIGN_RECIPIENT_COLORS.length];
  };

  // Send envelope mutation
  const sendMutation = useMutation({
    mutationFn: async () => {
      // Build the fields array based on template if using one
      let fields: any[] = [];
      if (selectedTemplate) {
        fields = selectedTemplate.fields.map(field => {
          // Find the recipient that maps to this field's placeholder
          const recipient = recipients.find(
            r => r.placeholderRecipientId === field.assignedTo
          );
          return {
            ...field,
            recipientId: recipient?.id || null,
          };
        });
      }

      const payload = {
        title,
        message: message || null,
        documentUrl,
        pageImages,
        totalPages: pageImages.length,
        signingOrder,
        templateId: selectedTemplateId,
        recipients: recipients.map((r, idx) => ({
          name: r.name,
          email: r.email,
          role: r.role,
          order: r.order,
          color: getRecipientColor(r, idx),
        })),
        fields,
      };

      return apiRequest("POST", "/api/esign/envelopes", { body: payload });
    },
    onSuccess: async (response) => {
      const envelope = await response.json();
      queryClient.invalidateQueries({ queryKey: ["/api/esign/envelopes"] });
      toast({
        title: "Document sent!",
        description: "Recipients will receive an email with signing instructions.",
      });
      setLocation(`/esign/envelope/${envelope.id}`);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send document. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Validation
  const signers = recipients.filter(r => r.role === 'signer');
  const isStep1Valid = documentUrl && pageImages.length > 0;
  const isStep2Valid = signers.length > 0 && signers.every(r => r.name && r.email);
  const isStep3Valid = title.trim().length > 0;
  const canSend = isStep1Valid && isStep2Valid && isStep3Valid;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 via-slate-700 to-slate-600 border-b border-slate-200 shadow-lg">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                <Send className="h-8 w-8" />
                Send Document for Signature
              </h1>
              <p className="text-slate-200">
                Upload a document or use a template and send it for signing
              </p>
            </div>
            <Button
              variant="outline"
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              onClick={() => setLocation("/esign")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 py-8">
        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center gap-4">
            {[
              { step: 1, label: "Document" },
              { step: 2, label: "Recipients" },
              { step: 3, label: "Review & Send" },
            ].map(({ step, label }) => (
              <div key={step} className="flex items-center">
                <button
                  onClick={() => {
                    if (step < currentStep || (step === 2 && isStep1Valid) || (step === 3 && isStep1Valid && isStep2Valid)) {
                      setCurrentStep(step);
                    }
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full transition-colors ${
                    currentStep === step
                      ? 'bg-blue-600 text-white'
                      : currentStep > step
                        ? 'bg-green-100 text-green-700 cursor-pointer hover:bg-green-200'
                        : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {currentStep > step ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : (
                    <span className="w-5 h-5 flex items-center justify-center rounded-full bg-current/10 text-sm font-medium">
                      {step}
                    </span>
                  )}
                  <span className="font-medium">{label}</span>
                </button>
                {step < 3 && (
                  <div className={`w-16 h-0.5 mx-2 ${currentStep > step ? 'bg-green-300' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step 1: Document Selection */}
        {currentStep === 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Upload Document */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Upload Document
                </CardTitle>
                <CardDescription>
                  Upload a PDF or Word document to send for signature
                </CardDescription>
              </CardHeader>
              <CardContent>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={isUploading}
                  />
                  <div className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    isUploading ? 'bg-gray-50' : 'hover:border-blue-400 hover:bg-blue-50'
                  }`}>
                    {isUploading ? (
                      <>
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
                        <p className="text-gray-600">Processing document...</p>
                      </>
                    ) : (
                      <>
                        <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                        <p className="text-gray-600 mb-2">
                          Drag and drop or click to upload
                        </p>
                        <p className="text-sm text-gray-400">
                          PDF, DOC, or DOCX files
                        </p>
                      </>
                    )}
                  </div>
                </label>

                {documentUrl && !selectedTemplateId && (
                  <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium text-green-800">{title}</p>
                      <p className="text-sm text-green-600">{pageImages.length} page(s)</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Use Template */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Use a Template
                </CardTitle>
                <CardDescription>
                  Select a saved template with pre-configured fields
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingTemplates ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                  </div>
                ) : templates.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="h-12 w-12 mx-auto opacity-30 mb-4" />
                    <p>No templates yet</p>
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => setLocation("/esign/templates/new")}
                    >
                      Create Template
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {templates.map((template) => (
                      <button
                        key={template.id}
                        onClick={() => setSelectedTemplateId(template.id)}
                        className={`w-full p-3 rounded-lg border text-left transition-colors ${
                          selectedTemplateId === template.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{template.name}</p>
                            <p className="text-sm text-gray-500">
                              {template.totalPages} page(s) • {template.placeholderRecipients.length} recipient(s)
                            </p>
                          </div>
                          {selectedTemplateId === template.id && (
                            <CheckCircle className="h-5 w-5 text-blue-600" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 2: Recipients */}
        {currentStep === 2 && (
          <div className="max-w-2xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Recipients
                </CardTitle>
                <CardDescription>
                  Add the people who need to sign or receive a copy
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Signing Order */}
                <div>
                  <Label className="mb-3 block">Signing Order</Label>
                  <RadioGroup
                    value={signingOrder}
                    onValueChange={(v) => setSigningOrder(v as 'sequential' | 'parallel')}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="sequential" id="sequential" />
                      <Label htmlFor="sequential" className="cursor-pointer">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-gray-500" />
                          Sequential
                        </div>
                        <p className="text-xs text-gray-500 font-normal">
                          Recipients sign one at a time in order
                        </p>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="parallel" id="parallel" />
                      <Label htmlFor="parallel" className="cursor-pointer">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-gray-500" />
                          Parallel
                        </div>
                        <p className="text-xs text-gray-500 font-normal">
                          All recipients can sign at the same time
                        </p>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <Separator />

                {/* Recipients List */}
                <div className="space-y-3">
                  {recipients.map((recipient, index) => {
                    const placeholderLabel = getPlaceholderLabel(recipient);
                    const color = getRecipientColor(recipient, index);

                    return (
                      <div
                        key={recipient.id}
                        className="p-4 rounded-lg border bg-gray-50"
                      >
                        <div className="flex items-center gap-2 mb-3">
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: color }}
                          />
                          {placeholderLabel && (
                            <Badge variant="secondary" className="text-xs">
                              {placeholderLabel}
                            </Badge>
                          )}
                          <Badge
                            variant={recipient.role === 'signer' ? 'default' : 'outline'}
                            className="text-xs"
                          >
                            {recipient.role === 'signer' ? 'Signer' : 'CC'}
                          </Badge>
                          <span className="text-xs text-gray-500 ml-auto">
                            #{recipient.order}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs">Full Name</Label>
                            <Input
                              value={recipient.name}
                              onChange={(e) => updateRecipient(recipient.id, { name: e.target.value })}
                              placeholder="John Smith"
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Email Address</Label>
                            <Input
                              type="email"
                              value={recipient.email}
                              onChange={(e) => updateRecipient(recipient.id, { email: e.target.value })}
                              placeholder="john@example.com"
                              className="mt-1"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between mt-3">
                          <div className="flex gap-1">
                            {signingOrder === 'sequential' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => moveRecipient(recipient.id, 'up')}
                                  disabled={index === 0}
                                >
                                  Up
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => moveRecipient(recipient.id, 'down')}
                                  disabled={index === recipients.length - 1}
                                >
                                  Down
                                </Button>
                              </>
                            )}
                          </div>
                          {!recipient.placeholderRecipientId && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => removeRecipient(recipient.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Remove
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Add Recipient Buttons */}
                {!selectedTemplate && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => addRecipient('signer')}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Signer
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => addRecipient('cc')}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add CC
                    </Button>
                  </div>
                )}

                {signers.length === 0 && (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-600" />
                    <p className="text-sm text-amber-800">
                      At least one signer is required
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 3: Review & Send */}
        {currentStep === 3 && (
          <div className="max-w-2xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5" />
                  Review & Send
                </CardTitle>
                <CardDescription>
                  Review the details before sending
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Document Title */}
                <div>
                  <Label>Document Title</Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter a title for this document"
                    className="mt-1"
                  />
                </div>

                {/* Email Message */}
                <div>
                  <Label>Email Message (Optional)</Label>
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Add a message for the recipients..."
                    className="mt-1"
                    rows={3}
                  />
                </div>

                <Separator />

                {/* Summary */}
                <div className="space-y-4">
                  <h3 className="font-medium">Summary</h3>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-gray-500">Document</p>
                      <p className="font-medium">{title || "Untitled"}</p>
                      <p className="text-xs text-gray-400">{pageImages.length} page(s)</p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-gray-500">Signing Order</p>
                      <p className="font-medium capitalize">{signingOrder}</p>
                    </div>
                  </div>

                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-gray-500 mb-2">Recipients</p>
                    <div className="space-y-2">
                      {recipients.map((recipient, index) => (
                        <div key={recipient.id} className="flex items-center gap-2 text-sm">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: getRecipientColor(recipient, index) }}
                          />
                          <span className="font-medium">{recipient.name || "No name"}</span>
                          <span className="text-gray-500">{recipient.email || "No email"}</span>
                          <Badge variant="outline" className="text-xs ml-auto">
                            {recipient.role}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Validation Warnings */}
                {!canSend && (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="font-medium text-amber-800 mb-2">Please fix the following:</p>
                    <ul className="list-disc list-inside text-sm text-amber-700 space-y-1">
                      {!isStep1Valid && <li>Upload a document or select a template</li>}
                      {!isStep2Valid && <li>Add at least one signer with name and email</li>}
                      {!isStep3Valid && <li>Enter a document title</li>}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-8 max-w-2xl mx-auto">
          <Button
            variant="outline"
            onClick={() => setCurrentStep(currentStep - 1)}
            disabled={currentStep === 1}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>

          {currentStep < 3 ? (
            <Button
              onClick={() => setCurrentStep(currentStep + 1)}
              disabled={
                (currentStep === 1 && !isStep1Valid) ||
                (currentStep === 2 && !isStep2Valid)
              }
            >
              Continue
            </Button>
          ) : (
            <Button
              onClick={() => sendMutation.mutate()}
              disabled={!canSend || sendMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {sendMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send for Signature
                </>
              )}
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}
