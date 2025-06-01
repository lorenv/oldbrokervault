import { useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload, FileText, X, Download } from "lucide-react";

interface Financials {
  enabled: boolean;
  askingPrice: string | null;
  askingPriceIncluded: boolean;
  revenue: string | null;
  revenueIncluded: boolean;
  ebitda: string | null;
  ebitdaIncluded: boolean;
}

interface FinancialFile {
  id: number;
  cimDocumentId: number;
  originalName: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  included: boolean;
  uploadedAt: string;
}

interface OwnerFinancialsSectionProps {
  docId: number;
}

export function OwnerFinancialsSection({ docId }: OwnerFinancialsSectionProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch CIM document with financial data
  const { data: cimDocument } = useQuery({
    queryKey: [`/api/cim/${docId}`],
    enabled: !!docId
  });

  // Fetch financial data from dedicated endpoint
  const { data: financials } = useQuery<Financials>({
    queryKey: [`/api/cim/${docId}/financials`],
    enabled: !!docId,
    initialData: {
      enabled: false,
      askingPrice: null,
      askingPriceIncluded: false,
      revenue: null,
      revenueIncluded: false,
      ebitda: null,
      ebitdaIncluded: false,
    }
  });

  // Fetch financial files
  const { data: files = [] } = useQuery<FinancialFile[]>({
    queryKey: [`/api/cim/${docId}/financial-files`],
    enabled: !!docId
  });

  // Update financials mutation
  const updateFinancialsMutation = useMutation({
    mutationFn: async (data: Partial<Financials>) => {
      console.log("=== FRONTEND FINANCIALS UPDATE ===");
      console.log("DocId:", docId);
      console.log("Data being sent:", data);
      console.log("URL:", `/api/cim/${docId}/financials`);
      
      const response = await fetch(`/api/cim/${docId}/financials`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      console.log("Response status:", response.status);
      console.log("Response ok:", response.ok);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log("Error response:", errorText);
        throw new Error(`Failed to update financials: ${response.status} - ${errorText}`);
      }
      
      const result = await response.json();
      console.log("Success response:", result);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/cim/${docId}/financials`] });
      queryClient.invalidateQueries({ queryKey: [`/api/cim/${docId}`] });
      toast({ title: "Financials updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update financials", variant: "destructive" });
    }
  });

  // Upload file mutation
  const uploadFileMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch(`/api/cim/${docId}/financial-files`, {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) throw new Error('Failed to upload file');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/cim/${docId}/financial-files`] });
      toast({ title: "File uploaded successfully" });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    onError: () => {
      toast({ title: "Failed to upload file", variant: "destructive" });
    }
  });

  // Delete file mutation
  const deleteFileMutation = useMutation({
    mutationFn: async (fileId: number) => {
      const response = await fetch(`/api/cim/${docId}/financial-files/${fileId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete file');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/cim/${docId}/financial-files`] });
      toast({ title: "File deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete file", variant: "destructive" });
    }
  });

  // Update file inclusion mutation
  const updateFileInclusionMutation = useMutation({
    mutationFn: async ({ fileId, included }: { fileId: number; included: boolean }) => {
      const response = await fetch(`/api/cim/${docId}/financial-files/${fileId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ included }),
      });
      if (!response.ok) throw new Error('Failed to update file inclusion');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/cim/${docId}/financial-files`] });
    }
  });

  const handleFieldUpdate = (field: string, value: string | boolean) => {
    // When enabling financials for the first time, automatically check all three fields
    if (field === 'enabled' && value === true && !financials?.enabled) {
      updateFinancialsMutation.mutate({ 
        enabled: true,
        askingPriceIncluded: true,
        revenueIncluded: true,
        ebitdaIncluded: true
      });
    } else {
      updateFinancialsMutation.mutate({ [field]: value });
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadFileMutation.mutate(file);
    }
  };

  const handleBulkDownload = async () => {
    try {
      const response = await fetch(`/api/cim/${docId}/financial-files/bulk-download`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `financial-documents-${docId}.zip`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      toast({ title: "Failed to download files", variant: "destructive" });
    }
  };

  // Always render the financial section in owner view so users can enable it
  return (
    <Card className="bg-white shadow-lg rounded-2xl border-0 mb-8">
      <CardHeader className="border-b border-gray-100/50 bg-gradient-to-r from-slate-100 to-blue-100/50 px-8 py-6">
        <CardTitle className="text-2xl font-bold text-slate-800">
          Financial Information
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6 pt-6 px-8 pb-8">
        {/* Enable/Disable Toggle */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div>
            <Label className="text-base font-medium">Include Financial Information</Label>
            <p className="text-sm text-gray-600 mt-1">
              When enabled, financial data will appear in your CIM and shared documents
            </p>
          </div>
          <Switch
            checked={financials?.enabled || false}
            onCheckedChange={(checked) => handleFieldUpdate('enabled', checked)}
          />
        </div>

        {/* Financial Fields - Always visible in owner view */}
        <div className="grid md:grid-cols-3 gap-6">
          {/* Asking Price */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  checked={financials?.askingPriceIncluded || false}
                  onCheckedChange={(checked) => 
                    handleFieldUpdate('askingPriceIncluded', checked)
                  }
                />
                <Label>Asking Price</Label>
              </div>
              <Input
                placeholder="$1,000,000"
                value={financials?.askingPrice || ''}
                onChange={(e) => handleFieldUpdate('askingPrice', e.target.value)}
              />
            </div>

            {/* Revenue */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  checked={financials?.revenueIncluded || false}
                  onCheckedChange={(checked) => 
                    handleFieldUpdate('revenueIncluded', checked)
                  }
                />
                <Label>Annual Revenue</Label>
              </div>
              <Input
                placeholder="$500,000"
                value={financials?.revenue || ''}
                onChange={(e) => handleFieldUpdate('revenue', e.target.value)}
              />
            </div>

            {/* EBITDA */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  checked={financials?.ebitdaIncluded || false}
                  onCheckedChange={(checked) => 
                    handleFieldUpdate('ebitdaIncluded', checked)
                  }
                />
                <Label>EBITDA</Label>
              </div>
              <Input
                placeholder="$150,000"
                value={financials?.ebitda || ''}
                onChange={(e) => handleFieldUpdate('ebitda', e.target.value)}
              />
            </div>
        </div>

        {/* File Upload Section - Always Visible */}
        <div className="space-y-4">
          <Label>Financial Documents</Label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
            <div className="text-center">
              <Upload className="mx-auto h-12 w-12 text-gray-400" />
              <div className="mt-4">
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadFileMutation.isPending}
                >
                  {uploadFileMutation.isPending ? 'Uploading...' : 'Upload Financial Files'}
                </Button>
                <p className="mt-2 text-sm text-gray-500">
                  Upload financial statements, tax returns, or other relevant documents
                </p>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileUpload}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
              multiple={false}
            />
          </div>
        </div>

        {/* Uploaded Files */}
        {files.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Uploaded Documents</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkDownload}
              >
                <Download className="h-4 w-4 mr-2" />
                Download All
              </Button>
            </div>
            
            <div className="grid gap-3">
              {files.map((file) => (
                <div key={file.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      checked={file.included}
                      onCheckedChange={(checked) =>
                        updateFileInclusionMutation.mutate({
                          fileId: file.id,
                          included: Boolean(checked)
                        })
                      }
                    />
                    <FileText className="h-5 w-5 text-gray-500" />
                    <div>
                      <a
                        href={`/api/cim/${docId}/financial-files/${file.id}/download`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {file.originalName}
                      </a>
                      <div className="text-sm text-gray-500">
                        {(file.fileSize / 1024 / 1024).toFixed(2)} MB
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteFileMutation.mutate(file.id)}
                      disabled={deleteFileMutation.isPending}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}