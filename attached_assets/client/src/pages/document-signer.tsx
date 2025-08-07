import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { SigningDocumentViewer } from "@/components/signing/signing-document-viewer";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, FileText, Clock } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { Document, Recipient, SignatureField } from "@shared/schema";

interface SigningData {
  document: Document;
  recipient: Recipient;
  fields: SignatureField[];
}

interface FieldValue {
  fieldId: number;
  value: string;
}

export default function DocumentSigner() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  const [currentFieldIndex, setCurrentFieldIndex] = useState(0);
  const [fieldValues, setFieldValues] = useState<FieldValue[]>([]);
  const [isCompleted, setIsCompleted] = useState(false);
  const [activeFieldId, setActiveFieldId] = useState<number | null>(null);

  const { data, isLoading, error } = useQuery<SigningData>({
    queryKey: [`/api/sign/${token}`],
    enabled: !!token,
  });

  const completeMutation = useMutation({
    mutationFn: async (signatures: FieldValue[]) => {
      return apiRequest(`/api/sign/${token}/complete`, "POST", { signatures });
    },
    onSuccess: (response: any) => {
      setIsCompleted(true);
      toast({
        title: "Document signed successfully",
        description: response.completed 
          ? "All recipients have signed. The document is now complete."
          : "Your signature has been recorded. Waiting for other signers.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to complete signing process",
        variant: "destructive",
      });
    },
  });

  const handleFieldValue = (fieldId: number, value: string) => {
    setFieldValues(prev => {
      const existing = prev.find(fv => fv.fieldId === fieldId);
      if (existing) {
        return prev.map(fv => fv.fieldId === fieldId ? { ...fv, value } : fv);
      }
      return [...prev, { fieldId, value }];
    });
  };

  const handleFieldClick = (field: SignatureField) => {
    setActiveFieldId(field.id);
    // Update current field index to match the clicked field
    const fieldIndex = data?.fields.findIndex(f => f.id === field.id) ?? 0;
    setCurrentFieldIndex(fieldIndex);
  };

  const handleNextField = () => {
    if (data && currentFieldIndex < data.fields.length - 1) {
      const nextIndex = currentFieldIndex + 1;
      setCurrentFieldIndex(nextIndex);
      setActiveFieldId(data.fields[nextIndex].id);
    }
  };

  const handlePrevField = () => {
    if (data && currentFieldIndex > 0) {
      const prevIndex = currentFieldIndex - 1;
      setCurrentFieldIndex(prevIndex);
      setActiveFieldId(data.fields[prevIndex].id);
    }
  };

  const handleComplete = () => {
    if (!data) return;

    // Validate all required fields are filled
    const requiredFields = data.fields.filter(f => f.required);
    const missingFields = requiredFields.filter(f => 
      !fieldValues.find(fv => fv.fieldId === f.id && fv.value)
    );

    if (missingFields.length > 0) {
      toast({
        title: "Missing required fields",
        description: `Please complete all required fields before signing`,
        variant: "destructive",
      });
      return;
    }

    completeMutation.mutate(fieldValues);
  };

  const getCurrentField = () => {
    return data?.fields[currentFieldIndex];
  };

  const getFieldValue = (fieldId: number) => {
    return fieldValues.find(fv => fv.fieldId === fieldId)?.value || "";
  };

  const progress = data ? ((currentFieldIndex + 1) / data.fields.length) * 100 : 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading document...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <p className="text-red-600 mb-4">Invalid or expired signing link</p>
            <p className="text-slate-600">Please contact the document sender for a new link.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // CC recipients see a different interface
  if (data.recipient.role === 'cc') {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-4xl mx-auto py-8 px-4">
          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="text-center mb-6">
                <div className="text-blue-500 mb-4">
                  <FileText className="h-12 w-12 mx-auto" />
                </div>
                <h1 className="text-2xl font-bold text-slate-900 mb-2">
                  Document Copy Notification
                </h1>
                <p className="text-slate-600 text-lg">
                  You've been copied on this e-signature request. No action is needed.
                </p>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-blue-900 mb-2">Document Details:</h3>
                <p className="text-blue-800"><strong>Title:</strong> {data.document.title}</p>
                <p className="text-blue-800 text-sm mt-1">
                  You can view this document for reference, but you don't need to sign it.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Document viewer for CC recipients (read-only) */}
          <SigningDocumentViewer
            document={data.document}
            fields={data.fields}
            recipient={data.recipient}
            getFieldValue={getFieldValue}
            onFieldClick={handleFieldClick}
            activeFieldId={activeFieldId}
            isCompleted={true} // Show as completed/read-only for CC
          />
        </div>
      </div>
    );
  }

  if (isCompleted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-900 mb-2">
              Document Signed Successfully
            </h2>
            <p className="text-slate-600 mb-4">
              Thank you for signing "{data.document.title}". You will receive a copy via email.
            </p>
            <Badge className="bg-green-100 text-green-800">
              Completed
            </Badge>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentField = getCurrentField();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Sign Document</h1>
              <p className="text-sm text-slate-500">{data.document.title}</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-slate-600">
                Field {currentFieldIndex + 1} of {data.fields.length}
              </div>
              <Progress value={progress} className="w-32" />
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Document Viewer - Full Width */}
        <div className="flex-1 flex">
          <SigningDocumentViewer
            document={data.document}
            fields={data.fields}
            recipient={data.recipient}
            onFieldComplete={handleFieldValue}
            getFieldValue={getFieldValue}
            currentFieldId={data.fields[currentFieldIndex]?.id}
            onFieldClick={handleFieldClick}
          />
        </div>

        {/* Sidebar - Progress and Controls */}
        <div className="w-80 bg-white border-l border-slate-200 p-4 space-y-4 overflow-y-auto">
          {/* Progress Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Signing Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data.fields.map((field, index) => (
                  <div
                    key={field.id}
                    className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors ${
                      index === currentFieldIndex
                        ? "bg-blue-100 border border-blue-300"
                        : getFieldValue(field.id)
                        ? "bg-green-100 hover:bg-green-200"
                        : "bg-slate-50 hover:bg-slate-100"
                    }`}
                    onClick={() => {
                      setCurrentFieldIndex(index);
                      setActiveFieldId(field.id);
                    }}
                  >
                    <span className="text-sm">{field.label}</span>
                    {getFieldValue(field.id) ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : index === currentFieldIndex ? (
                      <Clock className="h-4 w-4 text-blue-600" />
                    ) : (
                      <div className="w-4 h-4 border border-slate-300 rounded-full" />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Navigation Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Navigation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <Button
                  variant="outline"
                  onClick={handlePrevField}
                  disabled={currentFieldIndex === 0}
                  size="sm"
                >
                  Previous
                </Button>
                
                {currentFieldIndex === data.fields.length - 1 ? (
                  <Button
                    onClick={handleComplete}
                    disabled={completeMutation.isPending}
                    className="bg-green-600 hover:bg-green-700"
                    size="sm"
                  >
                    {completeMutation.isPending ? "Completing..." : "Complete"}
                  </Button>
                ) : (
                  <Button onClick={handleNextField} size="sm">
                    Next
                  </Button>
                )}
              </div>
              
              <div className="text-center text-sm text-slate-600">
                Click any field in the document to complete it directly
              </div>
            </CardContent>
          </Card>

          {/* Instructions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Instructions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm text-slate-600">
                <p>• Click on any highlighted field in the document to complete it</p>
                <p>• Use the zoom controls to adjust the document size</p>
                <p>• Navigate between fields using the buttons above</p>
                <p>• All required fields must be completed before finalizing</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
