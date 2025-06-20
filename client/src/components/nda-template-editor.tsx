import React, { useState, useRef, useCallback } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { FileText, Plus, Save, X, Upload } from 'lucide-react';

interface SignatureField {
  id: string;
  type: 'signature' | 'name' | 'date' | 'email' | 'text';
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  pageNumber: number;
  required: boolean;
  fontSize: number;
  placeholder?: string;
}

interface NdaTemplateEditorProps {
  templateId?: number | null;
  onSave: (data: {
    name: string;
    fileContent: string;
    signatureFields: SignatureField[];
  }) => void;
  onCancel: () => void;
}

export default function NdaTemplateEditor({ templateId, onSave, onCancel }: NdaTemplateEditorProps) {
  const [templateName, setTemplateName] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfBase64, setPdfBase64] = useState('');
  const [signatureFields, setSignatureFields] = useState<SignatureField[]>([]);
  const [selectedFieldType, setSelectedFieldType] = useState<SignatureField['type']>('signature');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF file",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);
    try {
      // Convert to base64
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        const base64 = result.split(',')[1]; // Remove data:application/pdf;base64, prefix
        setPdfFile(file);
        setPdfBase64(base64);
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: "Upload failed",
        description: "Failed to upload PDF file",
        variant: "destructive"
      });
      setIsUploading(false);
    }
  }, [toast]);

  const addSignatureField = useCallback(() => {
    const newField: SignatureField = {
      id: `field-${Date.now()}`,
      type: selectedFieldType,
      label: `${selectedFieldType.charAt(0).toUpperCase() + selectedFieldType.slice(1)} Field`,
      x: 100,
      y: 100,
      width: selectedFieldType === 'signature' ? 200 : 150,
      height: selectedFieldType === 'signature' ? 80 : 30,
      pageNumber: 1,
      required: true,
      fontSize: 12,
      placeholder: selectedFieldType === 'text' ? 'Enter text...' : undefined
    };
    setSignatureFields(prev => [...prev, newField]);
  }, [selectedFieldType]);

  const removeSignatureField = useCallback((fieldId: string) => {
    setSignatureFields(prev => prev.filter(field => field.id !== fieldId));
  }, []);

  const handleSave = useCallback(async () => {
    if (!templateName.trim()) {
      toast({
        title: "Missing template name",
        description: "Please enter a name for your template",
        variant: "destructive"
      });
      return;
    }

    if (!pdfBase64) {
      toast({
        title: "Missing PDF file",
        description: "Please upload a PDF template",
        variant: "destructive"
      });
      return;
    }

    try {
      await onSave({
        name: templateName,
        fileContent: pdfBase64,
        signatureFields
      });
      
      toast({
        title: "Template saved",
        description: "Your NDA template has been saved successfully"
      });
    } catch (error) {
      console.error('Save error:', error);
      toast({
        title: "Save failed",
        description: "Failed to save template",
        variant: "destructive"
      });
    }
  }, [templateName, pdfBase64, signatureFields, onSave, toast]);

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              {templateId ? 'Edit NDA Template' : 'Create NDA Template'}
            </h1>
            <p className="text-gray-600">
              Upload a PDF template and configure signature fields
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel}>
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={handleSave}>
              <Save className="w-4 h-4 mr-2" />
              Save Template
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Template Configuration */}
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Template Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="templateName">Template Name</Label>
                  <Input
                    id="templateName"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="Enter template name..."
                  />
                </div>

                <div>
                  <Label htmlFor="pdfFile">PDF Template</Label>
                  <div className="mt-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <Button
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="w-full"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {isUploading ? 'Uploading...' : pdfFile ? 'Change PDF' : 'Upload PDF'}
                    </Button>
                    {pdfFile && (
                      <p className="text-sm text-gray-600 mt-2">
                        Selected: {pdfFile.name}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Add Signature Fields</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="fieldType">Field Type</Label>
                  <select
                    id="fieldType"
                    value={selectedFieldType}
                    onChange={(e) => setSelectedFieldType(e.target.value as SignatureField['type'])}
                    className="w-full mt-2 p-2 border border-gray-300 rounded-md"
                  >
                    <option value="signature">Signature</option>
                    <option value="name">Name</option>
                    <option value="date">Date</option>
                    <option value="email">Email</option>
                    <option value="text">Text</option>
                  </select>
                </div>
                <Button onClick={addSignatureField} className="w-full">
                  <Plus className="w-4 h-4 mr-2" />
                  Add {selectedFieldType.charAt(0).toUpperCase() + selectedFieldType.slice(1)} Field
                </Button>
              </CardContent>
            </Card>

            {/* Fields List */}
            {signatureFields.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Signature Fields ({signatureFields.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {signatureFields.map((field) => (
                      <div key={field.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{field.label}</p>
                          <p className="text-xs text-gray-600">
                            {field.type} - Page {field.pageNumber}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => removeSignatureField(field.id)}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* PDF Preview */}
          <div className="lg:col-span-2">
            <Card className="h-full">
              <CardHeader>
                <CardTitle>PDF Preview</CardTitle>
              </CardHeader>
              <CardContent>
                {pdfBase64 ? (
                  <div className="relative border rounded-lg overflow-hidden" style={{ height: '600px' }}>
                    <iframe
                      src={`data:application/pdf;base64,${pdfBase64}`}
                      className="w-full h-full"
                      title="PDF Preview"
                    />
                    <div className="absolute top-4 right-4 bg-blue-600 text-white px-3 py-1 rounded text-sm">
                      Template Preview - Field positioning available after save
                    </div>
                  </div>
                ) : (
                  <div className="h-96 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600 mb-2">Upload a PDF to start creating your template</p>
                      <Button
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Upload PDF
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DndProvider>
  );
}