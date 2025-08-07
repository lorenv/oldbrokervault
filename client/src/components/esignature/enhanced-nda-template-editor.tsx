import React, { useState, useEffect, useCallback } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Save, Settings, Users, FileText, ZoomIn, ZoomOut, Grid, Eye, ArrowLeft, Loader2, MoreVertical, Edit, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import RecipientManager from './recipient-manager';
import FieldPalette from './field-palette';
import CanvasOverlay from './canvas-overlay';
import ImageDocumentViewer from './image-document-viewer';
import RecipientModal from './recipient-modal';
import { EnhancedSignatureField } from './enhanced-signature-field';
import { NdaRecipient, NdaTemplate } from '@shared/schema';

interface PageImage {
  pageNumber: number;
  imageDataUrl: string;
  width: number;
  height: number;
}

interface EnhancedNdaTemplateEditorProps {
  initialTemplate?: NdaTemplate | null;
  onSave: (data: {
    name: string;
    fileContent: string;
    signatureFields: EnhancedSignatureField[];
    recipients: Partial<NdaRecipient>[];
  }) => void;
  isLoading?: boolean;
  showBackButton?: boolean;
  onBack?: () => void;
}

export default function EnhancedNdaTemplateEditor({ 
  initialTemplate, 
  onSave, 
  isLoading: externalLoading = false,
  showBackButton = false,
  onBack,
  fullScreen = false
}: EnhancedNdaTemplateEditorProps & { fullScreen?: boolean }) {
  const [templateName, setTemplateName] = useState(initialTemplate?.name || '');
  const [pdfBase64, setPdfBase64] = useState(initialTemplate?.fileContent || '');
  const [fields, setFields] = useState<EnhancedSignatureField[]>([]);
  const [recipients, setRecipients] = useState<Partial<NdaRecipient>[]>([]);
  const [pageImages, setPageImages] = useState<PageImage[]>([]);
  const [selectedField, setSelectedField] = useState<EnhancedSignatureField | null>(null);
  const [selectedRecipient, setSelectedRecipient] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isRecipientModalOpen, setIsRecipientModalOpen] = useState(false);
  const [editingRecipient, setEditingRecipient] = useState<Partial<NdaRecipient> | null>(null);
  const [totalPages, setTotalPages] = useState(1);

  // Editor settings
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const { toast } = useToast();

  // Auto-select first recipient when recipients change
  useEffect(() => {
    const signers = recipients.filter(r => r.role === 'signer');
    if (signers.length > 0 && !selectedRecipient) {
      setSelectedRecipient(signers[0].id?.toString() || '');
    }
  }, [recipients, selectedRecipient]);

  // Load template data on mount
  useEffect(() => {
    if (initialTemplate) {
      setTemplateName(initialTemplate.name || '');
      setPdfBase64(initialTemplate.fileContent || '');
      setFields((initialTemplate.signatureFields as EnhancedSignatureField[]) || []);
      setTotalPages(initialTemplate.totalPages || 1);

      // Convert page images if available
      if (initialTemplate.pageImages) {
        setPageImages(initialTemplate.pageImages as PageImage[]);
      }
    }
  }, [initialTemplate]);

  // Handle file upload using the new PDF processing endpoint
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
      // Upload PDF using the new processing endpoint
      const formData = new FormData();
      formData.append('pdf', file);

      const response = await fetch('/api/esignature/templates/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include', // Include cookies for authentication
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('Upload failed:', response.status, errorData);
        throw new Error(`Failed to upload PDF: ${response.status} ${errorData}`);
      }

      const result = await response.json();

      // Update state with processed data
      setTotalPages(result.pageCount);
      setPdfBase64(result.originalFileUrl || ''); // Store original file URL

      // Convert image URLs to PageImage format
      const newPageImages: PageImage[] = result.imageUrls.map((url: string, index: number) => ({
        pageNumber: index + 1,
        imageDataUrl: `/api/esignature/templates/${result.templateId}/image/${index + 1}`,
        width: 800, // Standard width from processing
        height: 1100, // Standard height from processing
      }));

      setPageImages(newPageImages);

      toast({
        title: "PDF uploaded successfully",
        description: `Processed ${result.pageCount} pages`,
      });

    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload PDF file",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  }, [toast]);

  // Image-based document viewer (replaces PDF conversion)
  const getCurrentPageImage = () => {
    return pageImages.find(img => img.pageNumber === currentPage);
  };

  // Handle field updates
  const handleFieldsChange = useCallback((updatedFields: EnhancedSignatureField[]) => {
    setFields(updatedFields);
  }, []);

  // Handle field selection
  const handleFieldSelect = useCallback((field: EnhancedSignatureField | null) => {
    setSelectedField(field);
  }, []);

  // Delete selected field
  const deleteSelectedField = useCallback(() => {
    if (selectedField) {
      const updatedFields = fields.filter(f => f.id !== selectedField.id);
      setFields(updatedFields);
      setSelectedField(null);
    }
  }, [selectedField, fields]);

  // Handle save
  const handleSave = async () => {
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

    if (recipients.length === 0) {
      toast({
        title: "Recipients required",
        description: "Please add at least one recipient",
        variant: "destructive"
      });
      return;
    }

    setIsSaving(true);

    try {
      await onSave({
        name: templateName,
        fileContent: pdfBase64,
        signatureFields: fields,
        recipients: recipients
      });

      toast({
        title: "Template saved",
        description: "NDA template has been saved successfully",
      });
    } catch (error) {
      console.error('Error saving template:', error);
      toast({
        title: "Save failed",
        description: "Failed to save template",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Zoom controls
  const zoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3));
  const zoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.5));

  const canSave = templateName.trim() && pdfBase64 && recipients.length > 0;

  // Recipient modal handlers
  const handleSaveRecipient = (recipientData: Partial<NdaRecipient>) => {
    if (editingRecipient) {
      // Update existing recipient
      setRecipients(recipients.map(r => 
        r.id === editingRecipient.id ? recipientData : r
      ));
    } else {
      // Add new recipient
      setRecipients([...recipients, recipientData]);
    }
    setEditingRecipient(null);
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className={`flex flex-col ${fullScreen ? 'h-screen' : 'h-full'} bg-gray-50`}>
        {/* Header - only show when not in fullScreen mode */}
        {!fullScreen && (
          <div className="bg-white border-b px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {showBackButton && onBack && (
                  <Button variant="ghost" size="sm" onClick={onBack}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                )}
                <FileText className="w-6 h-6 text-blue-600" />
                <div>
                  <h1 className="text-xl font-semibold">Enhanced NDA Template Editor</h1>
                  <p className="text-sm text-gray-600">Create and configure e-signature templates</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Button
                  onClick={handleSave}
                  disabled={!canSave || isSaving}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {isSaving ? 'Saving...' : 'Save Template'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Save Button for Full Screen Mode */}
        {fullScreen && (
          <div className="absolute top-4 right-4 z-10">
            <Button
              onClick={handleSave}
              disabled={!canSave || isSaving}
              className="bg-blue-600 hover:bg-blue-700 shadow-lg"
            >
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save Template'}
            </Button>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar */}
          <div className="w-80 bg-white border-r flex flex-col">
            {/* Recipients Section */}
            <div className="p-4 border-b">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Recipients</h3>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    setEditingRecipient(null);
                    setIsRecipientModalOpen(true);
                  }}
                  className="text-blue-600 hover:text-blue-700"
                >
                  <span className="text-lg mr-1">+</span>
                  Add
                </Button>
              </div>

              <div className="space-y-3 max-h-48 overflow-y-auto">
                {recipients.map((recipient, index) => (
                  <Card key={recipient.id} className="border-blue-200">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">
                            {recipient.name || 'Unnamed Recipient'}
                          </div>
                          <div className="text-xs text-gray-500 truncate">
                            {recipient.email}
                          </div>
                          <div className="text-xs text-gray-600 mt-1">
                            {recipient.role}
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setEditingRecipient(recipient);
                                setIsRecipientModalOpen(true);
                              }}
                            >
                              <Edit className="w-4 h-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => {
                                setRecipients(recipients.filter((_, i) => i !== index));
                              }}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Remove
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {recipients.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No recipients added yet</p>
                  </div>
                )}
              </div>
            </div>

            {/* Settings Section */}
            <div className="p-4 border-b">
              <h3 className="text-lg font-semibold mb-4">Template Settings</h3>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="template-name">Template Name</Label>
                  <Input
                    id="template-name"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="Enter template name"
                    className="mt-1"
                  />
                </div>


              </div>
            </div>

            {/* Field Types Section */}
            <div className="flex-1 overflow-y-auto">
              <FieldPalette
                recipients={recipients as NdaRecipient[]}
                selectedRecipient={selectedRecipient}
                onRecipientChange={setSelectedRecipient}
                className="h-full border-0 shadow-none"
              />
            </div>
          </div>

          {/* Document Editor */}
          <div className="flex-1 flex flex-col">
            

            {/* Document Viewer */}
            <div className="flex-1 overflow-hidden">
              {!pdfBase64 ? (
                <div className="h-full flex items-center justify-center bg-slate-50">
                  <Card className="w-96">
                    <CardContent className="text-center py-8">
                      <FileText className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                      <h3 className="text-lg font-medium mb-2">Upload PDF Template</h3>
                      <p className="text-gray-600 mb-4">
                        Upload a PDF document to start creating your e-signature template
                      </p>
                      <div className="flex items-center justify-center gap-3">
                        <label
                          htmlFor="main-pdf-upload"
                          className="flex items-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 border border-blue-300 rounded-md cursor-pointer transition-colors text-sm font-medium text-blue-700"
                        >
                          Choose File
                        </label>
                        <span className="text-sm text-gray-500">
                          {isUploading ? 'Processing...' : 'No file chosen'}
                        </span>
                      </div>
                      <Input
                        id="main-pdf-upload"
                        type="file"
                        accept=".pdf"
                        onChange={handleFileUpload}
                        disabled={isUploading}
                        className="hidden"
                      />
                      {isUploading && (
                        <div className="mt-4 flex items-center justify-center">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                          <span className="ml-2 text-sm text-gray-600">Processing PDF...</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <ImageDocumentViewer
                  pageImages={pageImages}
                  currentPage={currentPage}
                  onPageChange={setCurrentPage}
                  zoom={zoom}
                  onZoomChange={setZoom}
                  className="h-full"
                >
                  {/* Field overlay for drag-and-drop placement */}
                  <CanvasOverlay
                    pageNumber={currentPage}
                    fields={fields}
                    recipients={recipients as NdaRecipient[]}
                    onFieldsChange={handleFieldsChange}
                    onFieldSelect={handleFieldSelect}
                    selectedField={selectedField}
                    imageWidth={getCurrentPageImage()?.width || 800}
                    imageHeight={getCurrentPageImage()?.height || 1100}
                    scale={zoom}
                    snapToGrid={snapToGrid}
                    showGrid={showGrid}
                    isReadOnly={isPreviewMode}
                  />
                </ImageDocumentViewer>
              )}
            </div>
          </div>
        </div>

        {/* Recipient Modal */}
        <RecipientModal
          isOpen={isRecipientModalOpen}
          onClose={() => {
            setIsRecipientModalOpen(false);
            setEditingRecipient(null);
          }}
          onSave={handleSaveRecipient}
          recipient={editingRecipient}
          isEdit={!!editingRecipient}
        />
      </div>
    </DndProvider>
  );
}

// Named export for backwards compatibility  
export { EnhancedNdaTemplateEditor };