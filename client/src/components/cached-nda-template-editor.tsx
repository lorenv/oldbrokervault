import React, { useState, useRef, useCallback } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { FileText, Plus, Save, Upload, Type, FileSignature, Calendar, Mail, AlignLeft, Trash2 } from 'lucide-react';
import UnifiedPdfDisplay from '@/components/unified-pdf-display';

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

interface CachedNdaTemplateEditorProps {
  initialTemplate?: any;
  onSave: (data: {
    name: string;
    fileContent: string;
    signatureFields: SignatureField[];
  }) => void;
  isLoading?: boolean;
}

const FIELD_TYPES = [
  { type: 'signature', label: 'Signature Field', icon: FileSignature, color: 'border-blue-400 bg-blue-50' },
  { type: 'name', label: 'Name Field', icon: Type, color: 'border-green-400 bg-green-50' },
  { type: 'date', label: 'Date Field', icon: Calendar, color: 'border-purple-400 bg-purple-50' },
  { type: 'email', label: 'Email Field', icon: Mail, color: 'border-orange-400 bg-orange-50' },
  { type: 'text', label: 'Text Field', icon: AlignLeft, color: 'border-gray-400 bg-gray-50' }
] as const;

const FIELD_COLORS = {
  signature: 'border-blue-500 bg-blue-50 bg-opacity-90',
  name: 'border-green-500 bg-green-50 bg-opacity-90',
  date: 'border-purple-500 bg-purple-50 bg-opacity-90',
  email: 'border-orange-500 bg-orange-50 bg-opacity-90',
  text: 'border-gray-500 bg-gray-50 bg-opacity-90'
};

export default function CachedNdaTemplateEditor({ initialTemplate, onSave, isLoading }: CachedNdaTemplateEditorProps) {
  const [templateName, setTemplateName] = useState(initialTemplate?.name || '');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfBase64, setPdfBase64] = useState(initialTemplate?.fileContent || '');
  const [signatureFields, setSignatureFields] = useState<SignatureField[]>(initialTemplate?.signatureFields || []);
  const [pageImages, setPageImages] = useState<any[]>(initialTemplate?.pageImages || []);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Update state when initialTemplate changes
  React.useEffect(() => {
    if (initialTemplate) {
      console.log('Loading cached template data:', {
        name: initialTemplate.name,
        hasFileContent: !!initialTemplate.fileContent,
        fieldsCount: initialTemplate.signatureFields?.length || 0,
        pagesCount: initialTemplate.pageImages?.length || 0,
        pageImages: initialTemplate.pageImages
      });
      setTemplateName(initialTemplate.name || '');
      setPdfBase64(initialTemplate.fileContent || '');
      setSignatureFields(initialTemplate.signatureFields || []);
      setPageImages(initialTemplate.pageImages || []);
    }
  }, [initialTemplate]);

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
        const base64 = result.split(',')[1];
        setPdfFile(file);
        setPdfBase64(base64);
        // Clear existing page images since we have new content
        setPageImages([]);
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

  const handleFieldUpdate = useCallback((fieldId: string, updates: Partial<SignatureField>) => {
    setSignatureFields(prev => 
      prev.map(field => 
        field.id === fieldId ? { ...field, ...updates } : field
      )
    );
  }, []);

  const handleFieldDelete = useCallback((fieldId: string) => {
    setSignatureFields(prev => prev.filter(field => field.id !== fieldId));
  }, []);

  const handleFieldDrop = useCallback((pageNumber: number, x: number, y: number, fieldType: string) => {
    const newField: SignatureField = {
      id: `field_${Date.now()}_${Math.random()}`,
      type: fieldType as SignatureField['type'],
      label: `${fieldType.charAt(0).toUpperCase() + fieldType.slice(1)} Field`,
      x,
      y,
      width: 150,
      height: 30,
      pageNumber,
      required: true,
      fontSize: 12,
      placeholder: `Enter ${fieldType}`
    };

    setSignatureFields(prev => [...prev, newField]);
  }, []);

  const handleSave = useCallback(async () => {
    if (!templateName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a template name",
        variant: "destructive"
      });
      return;
    }

    if (!pdfBase64) {
      toast({
        title: "PDF required", 
        description: "Please upload a PDF template",
        variant: "destructive"
      });
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        name: templateName.trim(),
        fileContent: pdfBase64,
        signatureFields: signatureFields
      });
    } catch (error) {
      console.error('Save failed:', error);
    } finally {
      setIsSaving(false);
    }
  }, [templateName, pdfBase64, signatureFields, onSave, toast]);

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="container mx-auto px-4 py-8">
        

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

                {/* Show current PDF status if available */}
                {(pdfFile || pdfBase64) && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <FileText className="w-8 h-8 text-blue-600" />
                      <div>
                        <p className="font-medium">
                          {pdfFile?.name || initialTemplate?.name || 'PDF Template'}
                        </p>
                        <p className="text-sm text-gray-500">
                          {pageImages.length > 0 ? `${pageImages.length} pages cached` : 'Processing...'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Hidden file input - functionality preserved */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </CardContent>
            </Card>

            {/* Signature Field Types */}
            <Card>
              <CardHeader>
                <CardTitle>Drag Field Types</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-gray-600 mb-3">
                  Drag these field types onto the PDF
                </p>
                <div className="space-y-2">
                  {FIELD_TYPES.map((fieldType) => (
                    <div
                      key={fieldType.type}
                      draggable
                      className={`p-3 border-2 border-dashed rounded-lg cursor-grab transition-all ${
                        fieldType.color
                      } hover:scale-105 select-none`}
                      onDragStart={(e) => {
                        e.dataTransfer.setData('application/field-type', fieldType.type);
                        e.dataTransfer.effectAllowed = 'copy';
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <fieldType.icon className="w-4 h-4" />
                        <span className="text-sm font-medium">{fieldType.label}</span>
                      </div>
                    </div>
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
                          onClick={() => handleFieldDelete(field.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* PDF Template Display */}
          <div className="lg:col-span-2">
            <UnifiedPdfDisplay
              pdfBase64={pdfBase64}
              pageImages={pageImages.length > 0 ? pageImages.map(page => ({
                pageNumber: page.pageNumber,
                imagePath: page.imagePath,
                imageDataUrl: page.imagePath, // Use imagePath as imageDataUrl for cached images
                width: page.width,
                height: page.height
              })) : undefined}
              signatureFields={signatureFields}
              mode="template"
              onFieldDrop={handleFieldDrop}
              onFieldMove={(fieldId, x, y, pageNumber) => {
                handleFieldUpdate(fieldId, { x, y, pageNumber });
              }}
              onFieldDelete={handleFieldDelete}
            />
            
            {/* Upload prompt if no PDF */}
            {!pdfBase64 && pageImages.length === 0 && (
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>PDF Template Editor</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-96 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600 mb-2">Upload a PDF to start creating your template</p>
                      <Button
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-blue-600 text-white hover:bg-blue-700"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Upload PDF
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </DndProvider>
  );
}