import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { SettingsLayout, useSettingsAccess } from "@/components/layout/settings-layout";
import {
  Upload,
  Download,
  FileSpreadsheet,
  Users,
  Building2,
  Briefcase,
  ChevronRight,
  ChevronLeft,
  Check,
  X,
  AlertTriangle,
  RefreshCw,
  History,
  Lock,
  ArrowRight,
  Plus,
  Link,
  SkipForward,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type EntityType = 'contact' | 'company' | 'deal';

interface ImportField {
  key: string;
  label: string;
  required?: boolean;
  unique?: boolean;
  fieldType?: string;
}

interface ImportFields {
  standard: ImportField[];
  associations: ImportField[];
  custom: ImportField[];
}

interface UploadResult {
  fileName: string;
  fileSize: number;
  headers: string[];
  totalRows: number;
  preview: Record<string, any>[];
  suggestedMapping: Record<string, string>;
  rawData: Record<string, any>[];
}

interface PreviewRow {
  rowIndex: number;
  originalData: Record<string, any>;
  mappedData: Record<string, any>;
  errors: string[];
  duplicateOf: { id: number; displayName: string } | null;
  associations: {
    company?: {
      inputValue: string;
      match: { id: number; name: string } | null;
      action: 'link' | 'create' | 'skip';
    };
    contacts?: Array<{
      email: string;
      match: { id: number; email: string } | null;
    }>;
    pipeline?: {
      inputValue: string;
      match: { id: number; name: string } | null;
    };
    stage?: {
      inputValue: string;
      match: { id: number; name: string } | null;
    };
    owner?: {
      inputValue: string;
      match: { id: number; email: string } | null;
    };
  };
  action: 'create' | 'skip' | 'error';
}

interface PreviewSummary {
  total: number;
  valid: number;
  duplicates: number;
  errors: number;
  newCompanies: number;
}

interface ImportHistoryItem {
  id: number;
  entityType: string;
  fileName: string;
  totalRows: number;
  importedCount: number;
  skippedCount: number;
  duplicateCount: number;
  errorCount: number;
  status: string;
  createdAt: string;
  completedAt: string | null;
  createdByName: string;
  createdByEmail: string;
}

const ENTITY_TYPES = [
  { value: 'contact' as EntityType, label: 'Contacts', icon: Users, description: 'People and leads' },
  { value: 'company' as EntityType, label: 'Companies', icon: Building2, description: 'Organizations' },
  { value: 'deal' as EntityType, label: 'Deals', icon: Briefcase, description: 'Opportunities' },
];

function ImportWizard({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(1);
  const [entityType, setEntityType] = useState<EntityType>('contact');
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [previewSummary, setPreviewSummary] = useState<PreviewSummary | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  // Fetch field definitions for the selected entity type
  const { data: fields } = useQuery<ImportFields>({
    queryKey: ['/api/crm/import/fields', entityType],
    queryFn: () => apiRequest('GET', `/api/crm/import/fields/${entityType}`).then(res => res.json()),
  });

  const allFields = fields ? [...fields.standard, ...fields.associations, ...fields.custom] : [];

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entityType', entityType);

      const response = await fetch('/api/crm/import/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      const result = await response.json();
      setUploadResult(result);
      setMapping(result.suggestedMapping || {});
      setStep(2);
    } catch (error: any) {
      toast({
        title: 'Upload failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch(`/api/crm/import/template/${entityType}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to download template');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${entityType}s-import-template.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast({
        title: 'Download failed',
        description: 'Failed to download template',
        variant: 'destructive',
      });
    }
  };

  const handlePreview = async () => {
    if (!uploadResult) return;

    setIsUploading(true);
    try {
      const response = await apiRequest('POST', '/api/crm/import/preview', {
        body: {
          entityType,
          data: uploadResult.rawData,
          mapping,
        },
      });
      const result = await response.json();
      setPreviewRows(result.preview);
      setPreviewSummary(result.summary);
      setStep(3);
    } catch (error: any) {
      toast({
        title: 'Preview failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleImport = async () => {
    if (!uploadResult || previewRows.length === 0) return;

    setIsImporting(true);
    try {
      const response = await apiRequest('POST', '/api/crm/import/execute', {
        body: {
          entityType,
          rows: previewRows,
          mapping,
          fileName: uploadResult.fileName,
          fileSize: uploadResult.fileSize,
        },
      });
      const result = await response.json();
      setImportResult(result);
      setStep(4);
      queryClient.invalidateQueries({ queryKey: ['/api/crm/import/history'] });
      queryClient.invalidateQueries({ queryKey: [`/api/crm/${entityType === 'contact' ? 'contacts' : entityType === 'company' ? 'companies' : 'deals'}`] });
    } catch (error: any) {
      toast({
        title: 'Import failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
    }
  };

  const updateRowAction = (rowIndex: number, action: 'create' | 'skip') => {
    setPreviewRows(rows =>
      rows.map(r => r.rowIndex === rowIndex ? { ...r, action } : r)
    );
  };

  const updateAssociationAction = (rowIndex: number, action: 'link' | 'create' | 'skip') => {
    setPreviewRows(rows =>
      rows.map(r => {
        if (r.rowIndex === rowIndex && r.associations.company) {
          return {
            ...r,
            associations: {
              ...r.associations,
              company: { ...r.associations.company, action },
            },
          };
        }
        return r;
      })
    );
  };

  return (
    <div className="flex flex-col h-full max-h-[80vh]">
      {/* Progress steps */}
      <div className="flex items-center justify-center gap-2 py-4 border-b">
        {[1, 2, 3, 4].map(s => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step === s ? 'bg-blue-600 text-white' :
                step > s ? 'bg-green-600 text-white' :
                'bg-gray-200 text-gray-500'
              }`}
            >
              {step > s ? <Check className="h-4 w-4" /> : s}
            </div>
            <span className={`text-sm ${step === s ? 'font-medium text-gray-900' : 'text-gray-500'}`}>
              {s === 1 ? 'Upload' : s === 2 ? 'Map Fields' : s === 3 ? 'Review' : 'Complete'}
            </span>
            {s < 4 && <ChevronRight className="h-4 w-4 text-gray-300" />}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Step 1: Upload */}
        {step === 1 && (
          <div className="max-w-xl mx-auto space-y-6">
            <div>
              <Label className="text-gray-900 text-base">Select entity type</Label>
              <div className="grid grid-cols-3 gap-3 mt-2">
                {ENTITY_TYPES.map(type => (
                  <button
                    key={type.value}
                    onClick={() => setEntityType(type.value)}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      entityType === type.value
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <type.icon className={`h-6 w-6 mb-2 ${entityType === type.value ? 'text-blue-600' : 'text-gray-400'}`} />
                    <p className="font-medium text-gray-900">{type.label}</p>
                    <p className="text-xs text-gray-500">{type.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-gray-900 text-base">Upload your file</Label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-gray-400 transition-colors"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <FileSpreadsheet className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                {isUploading ? (
                  <div className="flex items-center justify-center gap-2 text-gray-600">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Uploading...
                  </div>
                ) : (
                  <>
                    <p className="text-gray-600">Click to upload or drag and drop</p>
                    <p className="text-sm text-gray-400 mt-1">CSV or Excel files (max 25MB)</p>
                  </>
                )}
              </div>

              <div className="flex items-center justify-between pt-2">
                <p className="text-sm text-gray-500">Need a template?</p>
                <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                  <Download className="h-4 w-4 mr-2" />
                  Download Template
                </Button>
              </div>
            </div>

            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-gray-700">
                <strong className="text-gray-900">Recommended order:</strong> Import Companies first, then Contacts, then Deals. This ensures associations can be properly linked.
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Step 2: Map Fields */}
        {step === 2 && uploadResult && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">{uploadResult.fileName}</p>
                <p className="text-sm text-gray-500">{uploadResult.totalRows} rows found</p>
              </div>
              <Badge variant="outline">{ENTITY_TYPES.find(t => t.value === entityType)?.label}</Badge>
            </div>

            <div className="space-y-4">
              <Label className="text-gray-900 text-base">Map your columns to fields</Label>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Your Column</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Maps To</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Preview</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {uploadResult.headers.map((header, index) => (
                      <tr key={index}>
                        <td className="px-4 py-3">
                          <span className="font-mono text-sm text-gray-900">{header}</span>
                        </td>
                        <td className="px-4 py-3">
                          <Select
                            value={mapping[header] || '_unmapped'}
                            onValueChange={value => setMapping(m => ({
                              ...m,
                              [header]: value === '_unmapped' ? '' : value,
                            }))}
                          >
                            <SelectTrigger className="w-[200px]">
                              <SelectValue placeholder="Don't import" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="_unmapped">Don't import</SelectItem>
                              {fields?.standard.map(f => (
                                <SelectItem key={f.key} value={f.key}>
                                  {f.label} {f.required && '*'}
                                </SelectItem>
                              ))}
                              {fields?.associations && fields.associations.length > 0 && (
                                <>
                                  <SelectItem value="_divider_assoc" disabled>
                                    --- Associations ---
                                  </SelectItem>
                                  {fields.associations.map(f => (
                                    <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                                  ))}
                                </>
                              )}
                              {fields?.custom && fields.custom.length > 0 && (
                                <>
                                  <SelectItem value="_divider_custom" disabled>
                                    --- Custom Fields ---
                                  </SelectItem>
                                  {fields.custom.map(f => (
                                    <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                                  ))}
                                </>
                              )}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 max-w-[200px] truncate">
                          {uploadResult.preview[0]?.[header] || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Required fields warning */}
            {fields?.standard.some(f => f.required && !Object.values(mapping).includes(f.key)) && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Required fields not mapped:{' '}
                  {fields.standard
                    .filter(f => f.required && !Object.values(mapping).includes(f.key))
                    .map(f => f.label)
                    .join(', ')}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Step 3: Review */}
        {step === 3 && previewSummary && (
          <div className="space-y-6">
            {/* Summary cards */}
            <div className="grid grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <p className="text-2xl font-bold text-gray-900">{previewSummary.total}</p>
                  <p className="text-sm text-gray-500">Total rows</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-2xl font-bold text-green-600">{previewSummary.valid}</p>
                  <p className="text-sm text-gray-500">Ready to import</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-2xl font-bold text-amber-600">{previewSummary.duplicates}</p>
                  <p className="text-sm text-gray-500">Duplicates</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-2xl font-bold text-red-600">{previewSummary.errors}</p>
                  <p className="text-sm text-gray-500">Errors</p>
                </CardContent>
              </Card>
            </div>

            {previewSummary.newCompanies > 0 && (
              <Alert>
                <Building2 className="h-4 w-4" />
                <AlertDescription className="text-gray-700">
                  <strong className="text-gray-900">{previewSummary.newCompanies} new companies</strong> will be created for records with unmatched company associations.
                </AlertDescription>
              </Alert>
            )}

            {/* Row preview */}
            <div className="space-y-2">
              <Label className="text-gray-900 text-base">Review rows</Label>
              <ScrollArea className="h-[350px] border rounded-lg">
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                      {entityType !== 'company' && (
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Company</th>
                      )}
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {previewRows.map(row => (
                      <tr key={row.rowIndex} className={row.action === 'skip' ? 'bg-gray-50' : ''}>
                        <td className="px-4 py-3">
                          {row.duplicateOf ? (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                              Duplicate
                            </Badge>
                          ) : row.errors.length > 0 ? (
                            <Badge variant="destructive">Error</Badge>
                          ) : row.action === 'skip' ? (
                            <Badge variant="secondary">Skip</Badge>
                          ) : (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              Ready
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900 text-sm">
                            {entityType === 'contact' && `${row.mappedData.firstName || ''} ${row.mappedData.lastName || ''} ${row.mappedData.email ? `(${row.mappedData.email})` : ''}`}
                            {entityType === 'company' && row.mappedData.name}
                            {entityType === 'deal' && `${row.mappedData.name} ${row.mappedData.amount ? `- $${row.mappedData.amount}` : ''}`}
                          </p>
                          {row.duplicateOf && (
                            <p className="text-xs text-amber-600">Matches: {row.duplicateOf.displayName}</p>
                          )}
                          {row.errors.length > 0 && (
                            <p className="text-xs text-red-600">{row.errors.join(', ')}</p>
                          )}
                        </td>
                        {entityType !== 'company' && (
                          <td className="px-4 py-3 text-sm">
                            {row.associations.company ? (
                              <div className="flex items-center gap-2">
                                {row.associations.company.match ? (
                                  <>
                                    <Link className="h-3 w-3 text-green-600" />
                                    <span className="text-green-700">{row.associations.company.match.name}</span>
                                  </>
                                ) : (
                                  <Select
                                    value={row.associations.company.action}
                                    onValueChange={(value: 'link' | 'create' | 'skip') => updateAssociationAction(row.rowIndex, value)}
                                  >
                                    <SelectTrigger className="h-7 text-xs w-[140px]">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="create">
                                        <span className="flex items-center gap-1">
                                          <Plus className="h-3 w-3" /> Create "{row.associations.company.inputValue}"
                                        </span>
                                      </SelectItem>
                                      <SelectItem value="skip">
                                        <span className="flex items-center gap-1">
                                          <X className="h-3 w-3" /> Leave empty
                                        </span>
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                        )}
                        <td className="px-4 py-3">
                          {row.duplicateOf || row.errors.length > 0 ? (
                            <div className="flex items-center gap-2">
                              <Checkbox
                                id={`skip-${row.rowIndex}`}
                                checked={row.action === 'skip'}
                                onCheckedChange={(checked) => updateRowAction(row.rowIndex, checked ? 'skip' : 'create')}
                              />
                              <label htmlFor={`skip-${row.rowIndex}`} className="text-xs text-gray-500">
                                Skip this row
                              </label>
                            </div>
                          ) : (
                            <Check className="h-4 w-4 text-green-600" />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </div>
          </div>
        )}

        {/* Step 4: Complete */}
        {step === 4 && importResult && (
          <div className="max-w-md mx-auto text-center space-y-6 py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900">Import Complete</h3>
              <p className="text-gray-500 mt-1">Your records have been imported successfully.</p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-left">
              <Card>
                <CardContent className="pt-4">
                  <p className="text-2xl font-bold text-green-600">{importResult.summary.imported}</p>
                  <p className="text-sm text-gray-500">Imported</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-2xl font-bold text-gray-500">{importResult.summary.skipped + importResult.summary.duplicates}</p>
                  <p className="text-sm text-gray-500">Skipped</p>
                </CardContent>
              </Card>
            </div>

            {importResult.errors && importResult.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {importResult.summary.errors} rows had errors and were skipped.
                </AlertDescription>
              </Alert>
            )}

            <Button onClick={onClose} className="mt-4">
              Done
            </Button>
          </div>
        )}
      </div>

      {/* Footer with navigation */}
      {step < 4 && (
        <div className="border-t p-4 flex justify-between">
          <Button
            variant="outline"
            onClick={() => step === 1 ? onClose() : setStep(s => s - 1)}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            {step === 1 ? 'Cancel' : 'Back'}
          </Button>

          {step === 2 && (
            <Button onClick={handlePreview} disabled={isUploading}>
              {isUploading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  Continue
                  <ChevronRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          )}

          {step === 3 && (
            <Button
              onClick={handleImport}
              disabled={isImporting || previewRows.filter(r => r.action === 'create').length === 0}
            >
              {isImporting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  Import {previewRows.filter(r => r.action === 'create').length} Records
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function ImportHistory() {
  const { data: history, isLoading } = useQuery<ImportHistoryItem[]>({
    queryKey: ['/api/crm/import/history'],
    queryFn: () => apiRequest('GET', '/api/crm/import/history').then(res => res.json()),
  });

  if (isLoading) {
    return <div className="animate-pulse h-32 bg-gray-100 rounded" />;
  }

  if (!history || history.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center">
            <History className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No imports yet</p>
            <p className="text-sm text-gray-400 mt-1">Your import history will appear here</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">File</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Results</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {history.map(item => (
            <tr key={item.id}>
              <td className="px-4 py-3">
                <p className="font-medium text-gray-900 text-sm">{item.fileName}</p>
                <p className="text-xs text-gray-500">by {item.createdByName || item.createdByEmail}</p>
              </td>
              <td className="px-4 py-3">
                <Badge variant="outline">
                  {item.entityType === 'contact' ? 'Contacts' : item.entityType === 'company' ? 'Companies' : 'Deals'}
                </Badge>
              </td>
              <td className="px-4 py-3 text-sm">
                <span className="text-green-600">{item.importedCount} imported</span>
                {item.duplicateCount > 0 && (
                  <span className="text-amber-600 ml-2">{item.duplicateCount} dupes</span>
                )}
                {item.errorCount > 0 && (
                  <span className="text-red-600 ml-2">{item.errorCount} errors</span>
                )}
              </td>
              <td className="px-4 py-3">
                <Badge
                  variant={item.status === 'completed' ? 'outline' : item.status === 'failed' ? 'destructive' : 'secondary'}
                  className={item.status === 'completed' ? 'bg-green-50 text-green-700 border-green-200' : ''}
                >
                  {item.status}
                </Badge>
              </td>
              <td className="px-4 py-3 text-sm text-gray-500">
                {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DataManagementPage() {
  const { canEdit, isViewOnly } = useSettingsAccess();
  const [isImportOpen, setIsImportOpen] = useState(false);

  return (
    <SettingsLayout
      title="Data Management"
      description="Import records and manage duplicates"
    >
      <div className="max-w-4xl space-y-6">
        {isViewOnly && (
          <Alert className="bg-amber-50 border-amber-200">
            <Lock className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-700">
              You have view-only access to data management. Contact an admin or owner to import data.
            </AlertDescription>
          </Alert>
        )}

        {/* Import section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gray-900">
              <Upload className="h-5 w-5" />
              Import Records
            </CardTitle>
            <CardDescription className="text-gray-600">
              Import contacts, companies, or deals from CSV or Excel files
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm text-gray-600">
                  Upload a file to import records into your CRM. We'll help you map columns and detect duplicates.
                </p>
                <p className="text-xs text-gray-500">
                  Supported formats: CSV, XLSX, XLS (max 25MB)
                </p>
              </div>
              <Button onClick={() => setIsImportOpen(true)} disabled={!canEdit}>
                <Upload className="h-4 w-4 mr-2" />
                Start Import
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Import History */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Import History</h3>
          <ImportHistory />
        </div>

        {/* Import Dialog */}
        <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] p-0">
            <DialogHeader className="p-6 pb-0">
              <DialogTitle className="text-gray-900">Import Records</DialogTitle>
              <DialogDescription className="text-gray-600">
                Upload a CSV or Excel file to import records into your CRM
              </DialogDescription>
            </DialogHeader>
            <ImportWizard onClose={() => setIsImportOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>
    </SettingsLayout>
  );
}
