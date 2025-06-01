import { useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload, FileText, X, Download, CheckCircle, Loader2 } from "lucide-react";

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
  const { data: cimDocument, isLoading: cimLoading } = useQuery({
    queryKey: [`/api/cim/${docId}`],
    enabled: !!docId,
    refetchOnWindowFocus: false,
    staleTime: 0 // Ensure fresh data
  });

  // Extract financial data from main CIM document - make it reactive to updates
  const getFinancials = (): Financials => {
    if (!cimDocument) {
      return {
        enabled: false,
        askingPrice: null,
        askingPriceIncluded: false,
        revenue: null,
        revenueIncluded: false,
        ebitda: null,
        ebitdaIncluded: false,
      };
    }
    
    return {
      enabled: (cimDocument as any).financialsEnabled || (cimDocument as any).financials_enabled || false,
      askingPrice: (cimDocument as any).askingPrice || (cimDocument as any).asking_price || null,
      askingPriceIncluded: (cimDocument as any).askingPriceIncluded || (cimDocument as any).asking_price_included || false,
      revenue: (cimDocument as any).revenue || null,
      revenueIncluded: (cimDocument as any).revenueIncluded || (cimDocument as any).revenue_included || false,
      ebitda: (cimDocument as any).ebitda || null,
      ebitdaIncluded: (cimDocument as any).ebitdaIncluded || (cimDocument as any).ebitda_included || false,
    };
  };
  
  const financials = getFinancials();
  
  // Debug logging to track state changes
  console.log("=== FINANCIALS COMPONENT STATE ===");
  console.log("CIM Document:", cimDocument);
  console.log("Raw financial data from CIM:", {
    financialsEnabled: (cimDocument as any)?.financialsEnabled,
    financials_enabled: (cimDocument as any)?.financials_enabled,
    askingPrice: (cimDocument as any)?.askingPrice,
    asking_price: (cimDocument as any)?.asking_price,
    askingPriceIncluded: (cimDocument as any)?.askingPriceIncluded,
    asking_price_included: (cimDocument as any)?.asking_price_included,
    revenue: (cimDocument as any)?.revenue,
    revenueIncluded: (cimDocument as any)?.revenueIncluded,
    revenue_included: (cimDocument as any)?.revenue_included,
    ebitda: (cimDocument as any)?.ebitda,
    ebitdaIncluded: (cimDocument as any)?.ebitdaIncluded,
    ebitda_included: (cimDocument as any)?.ebitda_included
  });
  console.log("All CIM Document keys:", Object.keys(cimDocument || {}));
  console.log("Financials object:", financials);
  console.log("CIM Loading:", cimLoading);

  // Fetch financial files
  const { data: files = [] } = useQuery<FinancialFile[]>({
    queryKey: [`/api/cim/${docId}/financial-files`],
    enabled: !!docId,
    staleTime: 0, // Always fetch fresh data
    refetchOnWindowFocus: true, // Refetch when window gains focus
    refetchOnMount: true // Always refetch on mount
  });

  // Debug logging for files
  console.log("=== OWNER FINANCIALS FILES DEBUG ===");
  console.log("DocId:", docId);
  console.log("Files fetched:", files);
  console.log("Number of files:", files.length);

  // Update financials mutation - save to main CIM document
  const updateFinancialsMutation = useMutation({
    mutationFn: async (data: Partial<Financials>) => {
      console.log("=== FRONTEND FINANCIALS UPDATE ===");
      console.log("DocId:", docId);
      console.log("Data being sent:", data);
      
      // Convert Financials format to CIM document format
      const cimUpdateData: any = {};
      if (data.enabled !== undefined) cimUpdateData.financialsEnabled = data.enabled;
      if (data.askingPrice !== undefined) cimUpdateData.askingPrice = data.askingPrice;
      if (data.askingPriceIncluded !== undefined) cimUpdateData.askingPriceIncluded = data.askingPriceIncluded;
      if (data.revenue !== undefined) cimUpdateData.revenue = data.revenue;
      if (data.revenueIncluded !== undefined) cimUpdateData.revenueIncluded = data.revenueIncluded;
      if (data.ebitda !== undefined) cimUpdateData.ebitda = data.ebitda;
      if (data.ebitdaIncluded !== undefined) cimUpdateData.ebitdaIncluded = data.ebitdaIncluded;
      
      console.log("CIM update data:", cimUpdateData);
      console.log("URL:", `/api/cim/${docId}`);
      
      const response = await fetch(`/api/cim/${docId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(cimUpdateData),
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
    onMutate: async (newData) => {
      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: [`/api/cim/${docId}`] });
      
      // Snapshot the previous value
      const previousCim = queryClient.getQueryData([`/api/cim/${docId}`]);
      
      // Optimistically update to the new value
      queryClient.setQueryData([`/api/cim/${docId}`], (old: any) => {
        if (!old) return old;
        const updated = { ...old };
        if (newData.enabled !== undefined) updated.financialsEnabled = newData.enabled;
        if (newData.askingPrice !== undefined) updated.askingPrice = newData.askingPrice;
        if (newData.askingPriceIncluded !== undefined) updated.askingPriceIncluded = newData.askingPriceIncluded;
        if (newData.revenue !== undefined) updated.revenue = newData.revenue;
        if (newData.revenueIncluded !== undefined) updated.revenueIncluded = newData.revenueIncluded;
        if (newData.ebitda !== undefined) updated.ebitda = newData.ebitda;
        if (newData.ebitdaIncluded !== undefined) updated.ebitdaIncluded = newData.ebitdaIncluded;
        return updated;
      });
      
      return { previousCim };
    },
    onError: (err, newData, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      queryClient.setQueryData([`/api/cim/${docId}`], context?.previousCim);
      toast({ title: "Failed to update financials", variant: "destructive" });
    },
    onSettled: () => {
      // Always refetch after error or success to ensure server state
      queryClient.invalidateQueries({ queryKey: [`/api/cim/${docId}`] });
      toast({ title: "Financials updated successfully" });
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
      toast({ 
        title: "File uploaded successfully",
        description: "Your financial document has been added to the CIM"
      });
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
          <div className={`border-2 border-dashed rounded-lg p-6 transition-all duration-300 ${
            uploadFileMutation.isPending 
              ? 'border-blue-300 bg-blue-50' 
              : uploadFileMutation.isSuccess 
                ? 'border-green-300 bg-green-50' 
                : 'border-gray-300 hover:border-gray-400'
          }`}>
            <div className="text-center">
              <div className="mx-auto h-12 w-12 flex items-center justify-center">
                {uploadFileMutation.isPending ? (
                  <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
                ) : uploadFileMutation.isSuccess ? (
                  <CheckCircle className="h-8 w-8 text-green-500 animate-pulse" />
                ) : (
                  <Upload className="h-12 w-12 text-gray-400" />
                )}
              </div>
              <div className="mt-4">
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadFileMutation.isPending}
                  className={`transition-all duration-200 ${
                    uploadFileMutation.isPending 
                      ? 'bg-blue-50 border-blue-300' 
                      : uploadFileMutation.isSuccess 
                        ? 'bg-green-50 border-green-300' 
                        : ''
                  }`}
                >
                  {uploadFileMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : uploadFileMutation.isSuccess ? (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Upload Complete
                    </>
                  ) : (
                    'Upload Financial Files'
                  )}
                </Button>
                <p className={`mt-2 text-sm transition-colors duration-200 ${
                  uploadFileMutation.isPending 
                    ? 'text-blue-600' 
                    : uploadFileMutation.isSuccess 
                      ? 'text-green-600' 
                      : 'text-gray-500'
                }`}>
                  {uploadFileMutation.isPending 
                    ? 'Uploading your document...' 
                    : uploadFileMutation.isSuccess 
                      ? 'Document uploaded successfully!' 
                      : 'Upload financial statements, tax returns, or other relevant documents'
                  }
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