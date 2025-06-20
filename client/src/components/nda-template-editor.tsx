import React, { useState, useRef, useCallback } from 'react';
import { DndProvider, useDrag } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { FileText, Plus, Save, X, Upload, Type, FileSignature, Calendar, Mail, AlignLeft } from 'lucide-react';
import ImagePdfEditor from './image-pdf-editor';

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

  const FIELD_TYPES = [
    { type: 'signature' as const, label: 'Signature', icon: FileSignature, color: 'bg-blue-100 border-blue-300' },
    { type: 'name' as const, label: 'Name', icon: Type, color: 'bg-green-100 border-green-300' },
    { type: 'date' as const, label: 'Date', icon: Calendar, color: 'bg-purple-100 border-purple-300' },
    { type: 'email' as const, label: 'Email', icon: Mail, color: 'bg-orange-100 border-orange-300' },
    { type: 'text' as const, label: 'Text', icon: AlignLeft, color: 'bg-gray-100 border-gray-300' }
  ];

  const DraggableFieldType = ({ fieldType }: { fieldType: typeof FIELD_TYPES[0] }) => {
    const [{ isDragging }, drag] = useDrag({
      type: 'new-field',
      item: { type: fieldType.type },
      collect: (monitor) => ({
        isDragging: monitor.isDragging(),
      }),
    });

    const Icon = fieldType.icon;

    return (
      <div
        ref={drag}
        className={`p-3 border-2 border-dashed rounded-lg cursor-move transition-all ${
          fieldType.color
        } ${isDragging ? 'opacity-50 scale-95' : 'hover:scale-105'}`}
      >
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4" />
          <span className="text-sm font-medium">{fieldType.label}</span>
        </div>
      </div>
    );
  };

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

  console.log('NdaTemplateEditor rendering with DndProvider');
  
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
                <CardTitle>Drag Field Types</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-gray-600 mb-3">
                  Drag field types onto the PDF to add fields
                </p>
                <div className="space-y-2">
                  {FIELD_TYPES.map((fieldType) => (
                    <DraggableFieldType
                      key={fieldType.type}
                      fieldType={fieldType}
                    />
                  ))}
                </div>

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

          {/* PDF Canvas Editor */}
          <div className="lg:col-span-2">
            <Card className="h-full">
              <CardHeader>
                <CardTitle>PDF Template Editor</CardTitle>
              </CardHeader>
              <CardContent>
                {pdfBase64 ? (
                  <ImagePdfEditor
                    pdfBase64={pdfBase64}
                    signatureFields={signatureFields}
                    onFieldsChange={setSignatureFields}
                  />
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