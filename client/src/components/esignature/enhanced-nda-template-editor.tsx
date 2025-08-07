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
import { Save, Settings, Users, FileText, ZoomIn, ZoomOut, Grid, Eye } from 'lucide-react';

import RecipientManager from './recipient-manager';
import FieldPalette from './field-palette';
import CanvasOverlay from './canvas-overlay';
import ImageDocumentViewer from './image-document-viewer';
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
}

export default function EnhancedNdaTemplateEditor({ 
  initialTemplate, 
  onSave, 
  isLoading 
}: EnhancedNdaTemplateEditorProps) {
  const [templateName, setTemplateName] = useState(initialTemplate?.name || '');
  const [pdfBase64, setPdfBase64] = useState(initialTemplate?.fileContent || '');
  const [fields, setFields] = useState<EnhancedSignatureField[]>([]);
  const [recipients, setRecipients] = useState<Partial<NdaRecipient>[]>([]);
  const [pageImages, setPageImages] = useState<PageImage[]>([]);
  const [selectedField, setSelectedField] = useState<EnhancedSignatureField | null>(null);
  const [selectedRecipient, setSelectedRecipient] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
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
      });

      if (!response.ok) {
        throw new Error('Failed to upload PDF');
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
        description: "Failed to upload PDF file",
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

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="flex flex-col h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
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

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar */}
          <div className="w-80 bg-white border-r flex flex-col">
            <Tabs defaultValue="fields" className="flex-1 flex flex-col">
              <TabsList className="grid w-full grid-cols-3 m-4">
                <TabsTrigger value="fields">Fields</TabsTrigger>
                <TabsTrigger value="recipients">Recipients</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>
              
              <div className="flex-1 overflow-auto px-4 pb-4">
                <TabsContent value="fields" className="mt-0">
                  <FieldPalette
                    recipients={recipients as NdaRecipient[]}
                    selectedRecipient={selectedRecipient}
                    onRecipientChange={setSelectedRecipient}
                  />
                </TabsContent>
                
                <TabsContent value="recipients" className="mt-0">
                  <RecipientManager
                    recipients={recipients as NdaRecipient[]}
                    onRecipientsChange={setRecipients}
                  />
                </TabsContent>
                
                <TabsContent value="settings" className="mt-0">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Settings className="w-5 h-5" />
                        Editor Settings
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Template name */}
                      <div>
                        <Label htmlFor="template-name">Template Name</Label>
                        <Input
                          id="template-name"
                          value={templateName}
                          onChange={(e) => setTemplateName(e.target.value)}
                          placeholder="Enter template name"
                        />
                      </div>
                      
                      {/* PDF upload */}
                      <div>
                        <Label htmlFor="pdf-upload">PDF Template</Label>
                        <Input
                          id="pdf-upload"
                          type="file"
                          accept=".pdf"
                          onChange={handleFileUpload}
                          disabled={isUploading}
                        />
                        {isUploading && (
                          <p className="text-sm text-gray-600 mt-1">Uploading...</p>
                        )}
                      </div>
                      
                      {/* Editor options */}
                      <div className="space-y-3 pt-4">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="show-grid">Show Grid</Label>
                          <Switch
                            id="show-grid"
                            checked={showGrid}
                            onCheckedChange={setShowGrid}
                          />
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <Label htmlFor="snap-to-grid">Snap to Grid</Label>
                          <Switch
                            id="snap-to-grid"
                            checked={snapToGrid}
                            onCheckedChange={setSnapToGrid}
                          />
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <Label htmlFor="preview-mode">Preview Mode</Label>
                          <Switch
                            id="preview-mode"
                            checked={isPreviewMode}
                            onCheckedChange={setIsPreviewMode}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </div>
            </Tabs>
          </div>

          {/* Document Editor */}
          <div className="flex-1 flex flex-col">
            {/* Toolbar */}
            <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-4">
                {/* Page navigation */}
                {totalPages > 1 && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                    >
                      ←
                    </Button>
                    <span className="text-sm">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                    >
                      →
                    </Button>
                  </div>
                )}
                
                {/* Field info */}
                {selectedField && (
                  <div className="flex items-center gap-2 text-sm">
                    <Badge variant="secondary">
                      {selectedField.type} field selected
                    </Badge>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={deleteSelectedField}
                    >
                      Delete
                    </Button>
                  </div>
                )}
              </div>
              
              {/* Zoom controls */}
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={zoomOut}>
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <span className="text-sm w-12 text-center">{Math.round(zoom * 100)}%</span>
                <Button variant="outline" size="sm" onClick={zoomIn}>
                  <ZoomIn className="w-4 h-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setShowGrid(!showGrid)}
                  className={showGrid ? 'bg-blue-50' : ''}
                >
                  <Grid className="w-4 h-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setIsPreviewMode(!isPreviewMode)}
                  className={isPreviewMode ? 'bg-green-50' : ''}
                >
                  <Eye className="w-4 h-4" />
                </Button>
              </div>
            </div>

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
                      <Input
                        type="file"
                        accept=".pdf"
                        onChange={handleFileUpload}
                        disabled={isUploading}
                        className="cursor-pointer"
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
      </div>
    </DndProvider>
  );
}