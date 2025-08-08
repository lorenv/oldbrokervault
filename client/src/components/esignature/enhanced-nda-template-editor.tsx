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
import { Save, Check, Settings, Users, FileText, ZoomIn, ZoomOut, Grid, Eye, ArrowLeft, Loader2, MoreVertical, Edit, Trash2, MousePointer } from 'lucide-react';
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
import { EnhancedSignatureField, getRecipientColor } from './enhanced-signature-field';
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
  // Auto-generate template name with timestamp
  const generateDefaultTemplateName = () => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const year = now.getFullYear().toString().slice(-2);
    const hour = now.getHours();
    const minute = now.getMinutes().toString().padStart(2, '0');
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    
    return `New Template ${month}-${day}-${year} ${displayHour}:${minute} ${ampm}`;
  };

  const [templateName, setTemplateName] = useState(
    initialTemplate?.name || generateDefaultTemplateName()
  );
  const [isEditingName, setIsEditingName] = useState(false);
  const [pdfBase64, setPdfBase64] = useState(initialTemplate?.fileContent || '');
  const [fields, setFields] = useState<EnhancedSignatureField[]>([]);
  const [recipients, setRecipients] = useState<Partial<NdaRecipient>[]>([]);
  const [pageImages, setPageImages] = useState<PageImage[]>([]);
  const [selectedField, setSelectedField] = useState<EnhancedSignatureField | null>(null);
  const [selectedRecipient, setSelectedRecipient] = useState<string>('');
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
  const [isLoadingImages, setIsLoadingImages] = useState(false);

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
      
      // Load recipients from template's recipients field first (primary source)
      if (initialTemplate.recipients && Array.isArray(initialTemplate.recipients) && initialTemplate.recipients.length > 0) {
        setRecipients(initialTemplate.recipients as Partial<NdaRecipient>[]);
      } else {
        // Fallback: try to extract from signature fields if no recipients saved
        const savedRecipients = extractRecipientsFromFields(initialTemplate.signatureFields as EnhancedSignatureField[]);
        if (savedRecipients.length > 0) {
          setRecipients(savedRecipients);
        } else {
          // If no recipients, ensure we have at least one default recipient
          const defaultRecipient: Partial<NdaRecipient> = {
            id: Date.now(),
            name: '',
            email: '',
            role: 'signer',
            status: 'pending'
          };
          setRecipients([defaultRecipient]);
        }
      }
      
      // Load page images from the saved template
      // If we have a fileContent URL, we need to load the converted page images
      if (initialTemplate.fileContent) {
        loadTemplateImages(initialTemplate.fileContent);
      }
    }
  }, [initialTemplate]);

  // Extract unique recipients from signature fields
  const extractRecipientsFromFields = (fields: EnhancedSignatureField[]): Partial<NdaRecipient>[] => {
    const recipientMap = new Map<string, Partial<NdaRecipient>>();
    
    fields.forEach(field => {
      if (field.assignedTo) {
        if (!recipientMap.has(field.assignedTo)) {
          recipientMap.set(field.assignedTo, {
            id: parseInt(field.assignedTo) || Date.now(),
            name: `Recipient ${field.assignedTo}`,
            email: '',
            role: 'signer',
            status: 'pending'
          });
        }
      }
    });
    
    return Array.from(recipientMap.values());
  };

  // Function to load page images from saved template
  const loadTemplateImages = async (fileContent: string) => {
    setIsLoadingImages(true);
    try {
      // Check if fileContent is base64 data or a URL
      const isBase64 = !fileContent.startsWith('/') && !fileContent.startsWith('http');
      
      if (isBase64) {
        console.log('Loading template from base64 content...');
        // Handle base64 PDF content - convert to page images using the upload endpoint
        try {
          // Create a temporary blob from base64
          const byteCharacters = atob(fileContent);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: 'application/pdf' });
          
          // Convert blob to FormData and send to upload endpoint for processing
          const formData = new FormData();
          formData.append('pdf', blob, 'template.pdf');
          
          const response = await fetch('/api/esignature/templates/upload', {
            method: 'POST',
            body: formData,
            credentials: 'include',
          });
          
          if (!response.ok) {
            throw new Error(`Failed to process PDF: ${response.status}`);
          }
          
          const result = await response.json();
          console.log('Template processing result:', result);
          
          // Use the processed template data
          setTotalPages(result.pageCount || 1);
          
          // Create page image objects using the temporary template ID
          const newPageImages: PageImage[] = [];
          for (let i = 1; i <= (result.pageCount || 1); i++) {
            newPageImages.push({
              pageNumber: i,
              imageDataUrl: `/api/esignature/templates/${result.templateId}/image/${i}`,
              width: 800,
              height: 1100,
            });
          }
          
          setPageImages(newPageImages);
          
        } catch (base64Error) {
          console.error('Error processing base64 PDF:', base64Error);
          // Fallback to showing a placeholder
          setTotalPages(1);
          setPageImages([{
            pageNumber: 1,
            imageDataUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjExMDAiIHZpZXdCb3g9IjAgMCA4MDAgMTEwMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjgwMCIgaGVpZ2h0PSIxMTAwIiBmaWxsPSIjRjlGQUZCIiBzdHJva2U9IiNFNUU3RUIiIHN0cm9rZS13aWR0aD0iMiIvPgo8dGV4dCB4PSI0MDAiIHk9IjU1MCIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjI0IiBmaWxsPSIjNkI3MjgwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5Mb2FkaW5nIFBERi4uLjwvdGV4dD4KPHN2Zz4K',
            width: 800,
            height: 1100,
          }]);
        }
        
      } else {
        console.log('Loading template from URL:', fileContent);
        // Handle URL-based file content (existing logic)
        const templateIdMatch = fileContent.match(/\/templates\/(\d+)\//);
        if (!templateIdMatch) {
          console.error('Could not extract template ID from file URL:', fileContent);
          return;
        }
        
        const templateId = templateIdMatch[1];
        
        // For saved templates, we can get page count from the totalPages field
        // or try to derive it from the existing page images in object storage
        let pageCount = initialTemplate?.totalPages || 1;
        
        // If we don't have totalPages, try to discover page count by checking page images
        if (!initialTemplate?.totalPages || initialTemplate.totalPages === 1) {
          try {
            // Try to fetch page 1 to see if it exists
            const testResponse = await fetch(`/api/object-storage/private/templates/${templateId}/pages/page-1.png`);
            if (testResponse.ok) {
              // Count pages by checking which ones exist
              let discoveredPages = 1;
              for (let i = 2; i <= 20; i++) { // Check up to 20 pages
                const checkResponse = await fetch(`/api/object-storage/private/templates/${templateId}/pages/page-${i}.png`);
                if (checkResponse.ok) {
                  discoveredPages = i;
                } else {
                  break;
                }
              }
              pageCount = discoveredPages;
            }
          } catch (error) {
            console.warn('Could not discover page count, using default:', error);
          }
        }
        
        setTotalPages(pageCount);
        
        // Create page image objects for each page
        const newPageImages: PageImage[] = [];
        for (let i = 1; i <= pageCount; i++) {
          newPageImages.push({
            pageNumber: i,
            imageDataUrl: `/api/esignature/templates/${templateId}/image/${i}`,
            width: 800,
            height: 1100,
          });
        }
        
        setPageImages(newPageImages);
      }
      
    } catch (error) {
      console.error('Error loading template images:', error);
      // Fallback to a single page if we can't load the images
      setTotalPages(1);
      setPageImages([]);
    } finally {
      setIsLoadingImages(false);
    }
  };

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
      const saveData = {
        name: templateName,
        fileContent: pdfBase64,
        signatureFields: fields,
        recipients: recipients
      };
      

      
      await onSave(saveData);

      toast({
        title: "Template saved",
        description: "NDA template has been saved successfully",
      });
    } catch (error) {
      console.error('Error saving template:', error);
      toast({
        title: "Save failed", 
        description: error instanceof Error ? error.message : "Failed to save template",
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

  // Render template name in page header for full screen mode
  useEffect(() => {
    if (fullScreen && typeof document !== 'undefined') {
      const container = document.getElementById('template-name-header');
      if (container) {
        container.innerHTML = '';
        
        if (isEditingName) {
          // Render input field
          const input = document.createElement('input');
          input.type = 'text';
          input.value = templateName;
          input.className = 'text-xl font-semibold bg-transparent border-b-2 border-blue-500 focus:outline-none focus:border-blue-600 min-w-0 flex-1';
          input.style.minWidth = '200px';
          
          const handleSave = () => {
            setTemplateName(input.value.trim() || generateDefaultTemplateName());
            setIsEditingName(false);
          };
          
          const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Enter') {
              handleSave();
            } else if (e.key === 'Escape') {
              setIsEditingName(false);
            }
          };
          
          input.addEventListener('blur', handleSave);
          input.addEventListener('keydown', handleKeyDown);
          
          container.appendChild(input);
          input.focus();
          input.select();
        } else {
          // Render clickable title with hover edit icon
          const titleContainer = document.createElement('div');
          titleContainer.className = 'group flex items-center gap-2 cursor-pointer';
          titleContainer.setAttribute('title', 'Click to edit template name');
          
          const title = document.createElement('span');
          title.textContent = templateName;
          title.className = 'text-xl font-semibold group-hover:text-blue-600 transition-colors';
          
          const editIcon = document.createElement('div');
          editIcon.innerHTML = `
            <svg class="w-4 h-4 text-gray-400 group-hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-all duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
            </svg>
          `;
          
          titleContainer.appendChild(title);
          titleContainer.appendChild(editIcon);
          
          titleContainer.addEventListener('click', () => {
            setIsEditingName(true);
          });
          
          container.appendChild(titleContainer);
        }
      }
    }
  }, [fullScreen, templateName, isEditingName, generateDefaultTemplateName]);

  // Render save button in page header for full screen mode
  useEffect(() => {
    if (fullScreen && typeof document !== 'undefined') {
      const container = document.getElementById('save-button-container');
      if (container) {
        // Clear existing content
        container.innerHTML = '';
        
        // Create button element
        const button = document.createElement('button');
        button.id = 'save-template-button';
        button.type = 'button';
        
        // Set classes
        const baseClasses = 'inline-flex items-center px-4 py-2 text-sm font-medium border border-transparent rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors';
        const enabledClasses = 'text-white bg-blue-600 hover:bg-blue-700';
        const disabledClasses = 'text-gray-400 bg-gray-200 cursor-not-allowed';
        
        button.className = `${baseClasses} ${(canSave && !isSaving) ? enabledClasses : disabledClasses}`;
        button.disabled = !canSave || isSaving;
        
        // Set button content with proper Save icon
        button.innerHTML = `
          <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"></path>
            <polyline stroke-linecap="round" stroke-linejoin="round" stroke-width="2" points="17,21 17,13 7,13 7,21"></polyline>
            <polyline stroke-linecap="round" stroke-linejoin="round" stroke-width="2" points="7,3 7,8 15,8"></polyline>
          </svg>
          ${isSaving ? 'Saving...' : 'Save Template'}
        `;
        
        // Add click handler
        button.addEventListener('click', handleSave);
        
        // Append to container
        container.appendChild(button);
        
        // Debug logging
        console.log('Save button state:', {
          canSave,
          isSaving,
          templateName: templateName.trim(),
          hasPdfBase64: !!pdfBase64,
          recipientsCount: recipients.length,
          disabled: button.disabled
        });
      }
    }
    
    return () => {
      // Cleanup
      const container = document.getElementById('save-button-container');
      if (container) {
        container.innerHTML = '';
      }
    };
  }, [fullScreen, canSave, isSaving, handleSave, templateName, pdfBase64, recipients.length]);

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
          <div className="bg-white border-b shadow-sm">
            <div className="max-w-7xl mx-auto px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {showBackButton && onBack && (
                    <Button variant="ghost" size="sm" onClick={onBack} className="text-gray-500 hover:text-gray-700 -ml-2">
                      <ArrowLeft className="w-4 h-4 mr-1" />
                      Back to Account
                    </Button>
                  )}
                  <div className="h-8 w-px bg-gray-200" />
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 rounded-lg">
                      <FileText className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h1 className="text-xl font-semibold text-gray-900">{templateName}</h1>
                      <p className="text-sm text-gray-500">E-signature template editor</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="text-sm text-gray-500">
                    {fields.length} field{fields.length !== 1 ? 's' : ''} • {recipients.length} recipient{recipients.length !== 1 ? 's' : ''}
                  </div>
                  <Button
                    onClick={handleSave}
                    disabled={!canSave || isSaving}
                    className="bg-blue-600 hover:bg-blue-700 shadow-sm"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {isSaving ? 'Saving...' : 'Save Template'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}



        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar */}
          <div className="w-80 bg-gray-50 border-r border-gray-200 flex flex-col">
            {/* Recipients Section */}
            <div className="p-4 border-b border-gray-200 bg-white">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Recipients</h3>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    setEditingRecipient(null);
                    setIsRecipientModalOpen(true);
                  }}
                  className="text-blue-600 border-blue-200 hover:bg-blue-50 hover:border-blue-300"
                >
                  <span className="text-lg mr-1">+</span>
                  Add
                </Button>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {recipients.map((recipient, index) => {
                  const recipientColor = getRecipientColor(index);
                  const isSelected = selectedRecipient === recipient.id?.toString();
                  
                  return (
                    <Card 
                      key={recipient.id} 
                      className={`border cursor-pointer transition-all duration-200 hover:shadow-md ${
                        isSelected 
                          ? `${recipientColor.border} ${recipientColor.bg} shadow-md` 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedRecipient(recipient.id?.toString() || '')}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium shadow-sm ${recipientColor.solid}`}>
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm text-gray-900 truncate">
                              {recipient.name || 'Unnamed Recipient'}
                            </div>
                            <div className="text-xs text-gray-500 truncate">
                              {recipient.email}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <div className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                                {recipient.role}
                              </div>
                              {isSelected && (
                                <div className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                                  <MousePointer className="w-3 h-3 mr-1" />
                                  Active
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}

                {recipients.length === 0 && (
                  <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm font-medium">No recipients added yet</p>
                    <p className="text-xs text-gray-400 mt-1">Add recipients to assign signature fields</p>
                  </div>
                )}
              </div>
            </div>

            {/* Field Types Section */}
            <div className="flex-1 overflow-y-auto bg-white border-t border-gray-200">
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
              ) : isLoadingImages ? (
                <div className="h-full flex items-center justify-center bg-slate-50">
                  <Card className="w-96">
                    <CardContent className="text-center py-8">
                      <FileText className="w-16 h-16 mx-auto mb-4 text-blue-400" />
                      <h3 className="text-lg font-medium mb-2">Loading Template</h3>
                      <p className="text-gray-600 mb-4">
                        Loading saved template images and settings...
                      </p>
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                        <span className="ml-2 text-sm text-gray-600">Loading images...</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <ImageDocumentViewer
                  pageImages={pageImages}
                  zoom={zoom}
                  onZoomChange={setZoom}
                  className="h-full"
                >
                  {/* Field overlay for drag-and-drop placement */}
                  <CanvasOverlay
                    pageImages={pageImages}
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