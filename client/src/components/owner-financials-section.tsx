import { useRef, useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, FileText, X, Download, CheckCircle, Loader2, BarChart3, DollarSign, TrendingUp, Banknote } from "lucide-react";
import { useCimDocument, useFinancialFiles } from "@/hooks/use-cim-document";

interface Financials {
  enabled: boolean; // Kept for backward compatibility but always true
  askingPrice: string | null;
  askingPriceIncluded: boolean; // Always true
  revenue: string | null;
  revenueIncluded: boolean; // Always true
  ebitda: string | null;
  ebitdaIncluded: boolean; // Always true
}

interface FinancialFile {
  id: number;
  cimDocumentId: number;
  filename: string;
  filePath: string;
  fileSize: number;
  uploadedAt: string;
}

interface OwnerFinancialsSectionProps {
  docId: number;
  cimDocument?: any;
}

export function OwnerFinancialsSection({ docId, cimDocument: propCimDocument }: OwnerFinancialsSectionProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Local state for input values to enable debouncing
  const [localFinancials, setLocalFinancials] = useState({
    askingPrice: '',
    revenue: '',
    ebitda: ''
  });

  // Debounce timer ref
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Drag and drop state
  const [isDragOver, setIsDragOver] = useState(false);

  // Use centralized hook to eliminate duplicate API calls
  const { data: fetchedCimDocument, isLoading: cimLoading } = useCimDocument(docId, !propCimDocument);
  
  // Use prop data if available, otherwise use fetched data
  const cimDocument = propCimDocument || fetchedCimDocument;

  // Extract financial data from main CIM document - make it reactive to updates (always enabled)
  const getFinancials = (): Financials => {
    if (!cimDocument) {
      return {
        enabled: true, // Always enabled
        askingPrice: null,
        askingPriceIncluded: true, // Always included
        revenue: null,
        revenueIncluded: true, // Always included
        ebitda: null,
        ebitdaIncluded: true, // Always included
      };
    }
    
    return {
      enabled: true, // Always enabled regardless of database value
      askingPrice: (cimDocument as any).askingPrice || (cimDocument as any).asking_price || null,
      askingPriceIncluded: true, // Always included
      revenue: (cimDocument as any).revenue || null,
      revenueIncluded: true, // Always included
      ebitda: (cimDocument as any).ebitda || null,
      ebitdaIncluded: true, // Always included
    };
  };
  
  const financials = getFinancials();

  // Sync local state with server data when document loads or changes
  useEffect(() => {
    if (cimDocument) {
      setLocalFinancials({
        askingPrice: financials.askingPrice || '',
        revenue: financials.revenue || '',
        ebitda: financials.ebitda || ''
      });
    }
  }, [cimDocument?.id, cimDocument?.askingPrice, cimDocument?.revenue, cimDocument?.ebitda]);
  


  // Use centralized hook for financial files to eliminate duplicate requests
  const { data: files = [] } = useFinancialFiles(docId);



  // Update financials mutation - save to main CIM document
  const updateFinancialsMutation = useMutation({
    mutationFn: async (data: Partial<Financials>) => {
      // Convert Financials format to CIM document format (always enabled)
      const cimUpdateData: any = {};
      cimUpdateData.financialsEnabled = true; // Always enabled
      if (data.askingPrice !== undefined) cimUpdateData.askingPrice = data.askingPrice;
      cimUpdateData.askingPriceIncluded = true; // Always included
      if (data.revenue !== undefined) cimUpdateData.revenue = data.revenue;
      cimUpdateData.revenueIncluded = true; // Always included
      if (data.ebitda !== undefined) cimUpdateData.ebitda = data.ebitda;
      cimUpdateData.ebitdaIncluded = true; // Always included
      
      const response = await fetch(`/api/cim/${docId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(cimUpdateData),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update financials: ${response.status} - ${errorText}`);
      }
      
      const result = await response.json();
      return result;
    },
    onMutate: async (newData) => {
      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: [`/api/cim/${docId}`] });
      
      // Snapshot the previous value
      const previousCim = queryClient.getQueryData([`/api/cim/${docId}`]);
      
      // Optimistically update to the new value (always enabled)
      queryClient.setQueryData([`/api/cim/${docId}`], (old: any) => {
        if (!old) return old;
        const updated = { ...old };
        updated.financialsEnabled = true; // Always enabled
        if (newData.askingPrice !== undefined) updated.askingPrice = newData.askingPrice;
        updated.askingPriceIncluded = true; // Always included
        if (newData.revenue !== undefined) updated.revenue = newData.revenue;
        updated.revenueIncluded = true; // Always included
        if (newData.ebitda !== undefined) updated.ebitda = newData.ebitda;
        updated.ebitdaIncluded = true; // Always included
        return updated;
      });
      
      return { previousCim };
    },
    onSuccess: () => {
      // Only show success toast on actual success
      toast({ title: "Financials updated successfully" });
    },
    onError: (err, newData, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      queryClient.setQueryData([`/api/cim/${docId}`], context?.previousCim);
      toast({ title: "Failed to update financials", variant: "destructive" });
    },
    onSettled: () => {
      // Always refetch after error or success to ensure server state
      queryClient.invalidateQueries({ queryKey: [`/api/cim/${docId}`] });
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

  // Debounced field update handler with 2-second delay
  const debouncedFieldUpdate = useCallback((field: string, value: string) => {
    // Clear existing timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Set new timer for 2 seconds
    debounceTimer.current = setTimeout(() => {
      updateFinancialsMutation.mutate({ [field]: value });
    }, 2000);
  }, [updateFinancialsMutation]);

  // Handle local input changes with debounced saving
  const handleFieldChange = useCallback((field: string, value: string) => {
    // Update local state immediately for responsive UI
    setLocalFinancials(prev => ({
      ...prev,
      [field]: value
    }));

    // Trigger debounced save
    debouncedFieldUpdate(field, value);
  }, [debouncedFieldUpdate]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      // Upload files one by one
      Array.from(files).forEach(file => {
        uploadFileMutation.mutate(file);
      });
    }
  };

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set false if leaving the drag area completely
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length === 0) return;

    // Upload files one by one
    Array.from(droppedFiles).forEach(file => {
      uploadFileMutation.mutate(file);
    });
  }, [uploadFileMutation]);

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
    <Card className="bg-white shadow-lg rounded-2xl border-0 mb-12">
      <CardHeader className="bg-gradient-to-r from-blue-100 to-blue-200 pb-6 pt-8 px-8">
        <CardTitle className="text-2xl font-bold text-slate-800 flex items-center gap-3">
          <BarChart3 className="h-7 w-7" />
          Financial Information
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-10 pt-8 px-8 pb-10">
        {/* Financial Fields - Simplified, always included */}
        <div className="space-y-6">
          <div className="grid md:grid-cols-3 gap-8">
            {/* Asking Price */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-600" />
                Asking Price
              </Label>
              <Input
                placeholder="$1,000,000"
                value={localFinancials.askingPrice}
                onChange={(e) => handleFieldChange('askingPrice', e.target.value)}
                className="h-11 text-base"
              />
            </div>

            {/* Revenue */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                Annual Revenue
              </Label>
              <Input
                placeholder="$500,000"
                value={localFinancials.revenue}
                onChange={(e) => handleFieldChange('revenue', e.target.value)}
                className="h-11 text-base"
              />
            </div>

            {/* EBITDA */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Banknote className="h-4 w-4 text-purple-600" />
                EBITDA
              </Label>
              <Input
                placeholder="$150,000"
                value={localFinancials.ebitda}
                onChange={(e) => handleFieldChange('ebitda', e.target.value)}
                className="h-11 text-base"
              />
            </div>
          </div>
        </div>

        {/* File Upload Section - Compact Design */}
        <div className="space-y-4">
          <div className="border-t border-gray-100 pt-6">
            <Label className="text-base font-semibold text-slate-800 flex items-center gap-2 mb-4">
              <FileText className="h-4 w-4 text-indigo-600" />
              Financial Documents
            </Label>
            <div 
              className={`border-2 border-dashed rounded-lg p-4 transition-all duration-300 ${
                isDragOver ? 'border-blue-400 bg-blue-50' :
                uploadFileMutation.isPending 
                  ? 'border-blue-300 bg-blue-50' 
                  : uploadFileMutation.isSuccess 
                    ? 'border-green-300 bg-green-50' 
                    : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
            >
              <div className="text-center">
                <div className="flex items-center justify-center gap-3 mb-2">
                  {uploadFileMutation.isPending ? (
                    <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                  ) : uploadFileMutation.isSuccess ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <Upload className="h-5 w-5 text-gray-400" />
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadFileMutation.isPending}
                    className="h-8 px-4 text-sm"
                  >
                    {uploadFileMutation.isPending ? 'Uploading...' : 'Browse Files'}
                  </Button>
                </div>
                <p className="text-xs text-gray-500">
                  {isDragOver ? 'Drop files here' : 'Drag & drop files here or click to browse'}
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileUpload}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                multiple={true}
              />
            </div>
          </div>
        </div>

        {/* Uploaded Files - Compact */}
        {files.length > 0 && (
          <div className="space-y-3">
            <div className="border-t border-gray-100 pt-4">
              <div className="flex items-center justify-between mb-3">
                <Label className="text-sm font-semibold text-slate-800">Uploaded Documents ({files.length})</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkDownload}
                  className="h-8 px-3 text-xs"
                >
                  <Download className="h-3 w-3 mr-1" />
                  Download All
                </Button>
              </div>
              
              <div className="grid gap-2">
                {files.map((file: any) => (
                  <div key={file.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors bg-white hover:bg-gray-50">
                    <div className="flex items-center space-x-3 min-w-0 flex-1">
                      <div className="p-1.5 bg-blue-50 rounded">
                        <FileText className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <a
                          href={`/api/cim/${docId}/financial-files/${file.id}/download`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-sm text-slate-800 hover:text-blue-600 hover:underline transition-colors block truncate"
                          title={file.filename}
                        >
                          {file.filename}
                        </a>
                        <div className="text-xs text-gray-500">
                          {file.fileSize >= 1024 * 1024 ? 
                            `${(file.fileSize / 1024 / 1024).toFixed(2)} MB` : 
                            `${(file.fileSize / 1024).toFixed(1)} KB`}
                        </div>
                      </div>
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteFileMutation.mutate(file.id)}
                      disabled={deleteFileMutation.isPending}
                      className="h-7 w-7 p-0 hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors flex-shrink-0 ml-2"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}