import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Upload, X, Download, FileText, DollarSign, TrendingUp, BarChart3, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { Financials, FinancialFile } from '@shared/schema';

interface FinancialsSectionProps {
  docId: number;
  isSharedView?: boolean;
  cimDocument?: any;
}

export function FinancialsSection({ docId, isSharedView = false, cimDocument: propCimDocument }: FinancialsSectionProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch CIM document with financial data (only if not provided as prop)
  const { data: fetchedCimDocument } = useQuery({
    queryKey: [`/api/cim/${docId}`],
    enabled: !!docId && !propCimDocument
  });

  // Use prop data if available, otherwise use fetched data
  const cimDocument = propCimDocument || fetchedCimDocument;

  // Extract financial data from CIM document
  const financials = cimDocument ? {
    enabled: (cimDocument as any).financialsEnabled || false,
    askingPrice: (cimDocument as any).askingPrice || null,
    askingPriceIncluded: (cimDocument as any).askingPriceIncluded || false,
    revenue: (cimDocument as any).revenue || null,
    revenueIncluded: (cimDocument as any).revenueIncluded || false,
    ebitda: (cimDocument as any).ebitda || null,
    ebitdaIncluded: (cimDocument as any).ebitdaIncluded || false,
  } : null;

  // Debug financial data
  console.log("=== FINANCIALS SECTION DEBUG ===");
  console.log("Prop CIM Document:", propCimDocument);
  console.log("Fetched CIM Document:", fetchedCimDocument);
  console.log("Final CIM Document:", cimDocument);
  console.log("Extracted financials:", financials);
  console.log("Is shared view:", isSharedView);
  console.log("Should render section:", (financials?.enabled || isSharedView));

  // Fetch financial files
  const { data: files = [] } = useQuery<FinancialFile[]>({
    queryKey: [`/api/cim/${docId}/financial-files`],
    enabled: !!docId
  });

  // Update financials mutation
  const updateFinancialsMutation = useMutation({
    mutationFn: async (data: Partial<Financials>) => {
      const response = await fetch(`/api/cim/${docId}/financials`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update financials');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/cim/${docId}/financials`] });
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

  const handleToggleEnabled = (enabled: boolean) => {
    updateFinancialsMutation.mutate({ enabled });
  };

  const handleFieldUpdate = (field: string, value: string | boolean) => {
    updateFinancialsMutation.mutate({ [field]: value });
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

  const formatCurrency = (value: string) => {
    if (!value) return '';
    const numericValue = value.replace(/[^0-9.]/g, '');
    const number = parseFloat(numericValue);
    if (isNaN(number)) return value;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(number);
  };

  // Don't render if not enabled and in shared view
  if (isSharedView && !financials?.enabled) {
    return null;
  }

  return (
    <Card className={isSharedView ? "bg-white shadow-lg rounded-2xl border-0 mb-8" : ""}>
      <CardHeader className={isSharedView ? "border-b border-gray-100/50 bg-gradient-to-r from-slate-100 to-blue-100/50 px-8 py-6" : ""}>
        <div className="flex items-center justify-between">
          <CardTitle className={isSharedView ? "text-2xl font-bold text-slate-800" : ""}>
            Financial Information
          </CardTitle>
          {!isSharedView && (
            <div className="flex items-center space-x-2">
              <Label htmlFor="financials-enabled">Enable Section</Label>
              <Switch
                id="financials-enabled"
                checked={financials?.enabled || false}
                onCheckedChange={handleToggleEnabled}
              />
            </div>
          )}
        </div>
      </CardHeader>

      {(financials?.enabled || isSharedView) && (
        <CardContent className={`space-y-6 pt-6 ${isSharedView ? "px-8 pb-8" : ""}`}>
          {/* Financial Fields */}
          <div className="grid md:grid-cols-3 gap-6">
            {/* Asking Price */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                {!isSharedView && (
                  <Checkbox
                    checked={financials?.askingPriceIncluded || false}
                    onCheckedChange={(checked) => 
                      handleFieldUpdate('askingPriceIncluded', checked)
                    }
                  />
                )}
                <DollarSign className="h-4 w-4 text-green-600" />
                <Label>Asking Price</Label>
              </div>
              {isSharedView ? (
                financials?.askingPriceIncluded && financials?.askingPrice && (
                  <div className="text-lg font-semibold text-green-600">
                    {formatCurrency(financials.askingPrice)}
                  </div>
                )
              ) : (
                <Input
                  placeholder="$1,000,000"
                  value={financials?.askingPrice || ''}
                  onChange={(e) => handleFieldUpdate('askingPrice', e.target.value)}
                />
              )}
            </div>

            {/* Revenue */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                {!isSharedView && (
                  <Checkbox
                    checked={financials?.revenueIncluded || false}
                    onCheckedChange={(checked) => 
                      handleFieldUpdate('revenueIncluded', checked)
                    }
                  />
                )}
                <TrendingUp className="h-4 w-4 text-blue-600" />
                <Label>Annual Revenue</Label>
              </div>
              {isSharedView ? (
                financials?.revenueIncluded && financials?.revenue && (
                  <div className="text-lg font-semibold text-blue-600">
                    {formatCurrency(financials.revenue)}
                  </div>
                )
              ) : (
                <Input
                  placeholder="$500,000"
                  value={financials?.revenue || ''}
                  onChange={(e) => handleFieldUpdate('revenue', e.target.value)}
                />
              )}
            </div>

            {/* EBITDA */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                {!isSharedView && (
                  <Checkbox
                    checked={financials?.ebitdaIncluded || false}
                    onCheckedChange={(checked) => 
                      handleFieldUpdate('ebitdaIncluded', checked)
                    }
                  />
                )}
                <BarChart3 className="h-4 w-4 text-purple-600" />
                <Label>EBITDA</Label>
              </div>
              {isSharedView ? (
                financials?.ebitdaIncluded && financials?.ebitda && (
                  <div className="text-lg font-semibold text-purple-600">
                    {formatCurrency(financials.ebitda)}
                  </div>
                )
              ) : (
                <Input
                  placeholder="$150,000"
                  value={financials?.ebitda || ''}
                  onChange={(e) => handleFieldUpdate('ebitda', e.target.value)}
                />
              )}
            </div>
          </div>

          {/* File Upload Section */}
          {!isSharedView && (
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
                  multiple={false}
                />
              </div>
            </div>
          )}

          {/* Uploaded Files */}
          {files.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Uploaded Documents</Label>
                {isSharedView && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBulkDownload}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download All
                  </Button>
                )}
              </div>
              
              <div className="grid gap-3">
                {files.map((file) => (
                  <div key={file.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      {!isSharedView && (
                        <Checkbox
                          checked={file.included}
                          onCheckedChange={(checked) =>
                            updateFileInclusionMutation.mutate({
                              fileId: file.id,
                              included: Boolean(checked)
                            })
                          }
                        />
                      )}
                      <FileText className="h-5 w-5 text-gray-500" />
                      <div>
                        <div className="font-medium">{file.originalName}</div>
                        <div className="text-sm text-gray-500">
                          {(file.fileSize / 1024 / 1024).toFixed(2)} MB
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {isSharedView ? (
                        file.included && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(`/api/cim/${docId}/financial-files/${file.id}/download`, '_blank')}
                          >
                            Download
                          </Button>
                        )
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteFileMutation.mutate(file.id)}
                          disabled={deleteFileMutation.isPending}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}


        </CardContent>
      )}
    </Card>
  );
}