import { useState, useEffect, memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  DollarSign, 
  Banknote, 
  TrendingUp as TrendingUpIcon, 
  BarChart3, 
  Trash2, 
  Edit,
  GripVertical,
  X,
  Plus,
  Type,
  ImageIcon,
  Upload,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Eye
} from "lucide-react";
import { OwnerFinancialsSection } from "./owner-financials-section";
import { CoverImageManager } from "./cover-image-manager";
import { CoverImageDisplay } from "./cover-image-display";
import { DocumentExport } from "./document-export";
import { useCustomSections } from "@/hooks/use-cim-document";

import ReactMarkdown from 'react-markdown';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MarkdownGuide } from "./markdown-guide";
import { processMarkdownWithEscaping, restoreEscapedCharacters } from "@/lib/markdown-utils";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Simple inline editor for flexible CIM sections
interface FlexibleSectionEditorProps {
  value: string;
  onSave: (value: string) => Promise<void>;
  placeholder?: string;
  multiline?: boolean;
}

function FlexibleSectionEditor({ value, onSave, placeholder = "Enter text...", multiline = false }: FlexibleSectionEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  // Update editValue when value prop changes
  useEffect(() => {
    setEditValue(value);
  }, [value]);

  const handleSave = async () => {
    await onSave(editValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="space-y-2">
        {multiline ? (
          <textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="w-full min-h-[100px] max-h-[400px] p-2 border rounded resize-y"
            placeholder={placeholder}
            autoFocus
          />
        ) : (
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="w-full p-2 border rounded"
            placeholder={placeholder}
            autoFocus
          />
        )}
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSave}>Save</Button>
          <Button size="sm" variant="outline" onClick={handleCancel}>Cancel</Button>
        </div>
        {multiline && <MarkdownGuide />}
      </div>
    );
  }

  return (
    <div 
      className="group cursor-pointer hover:bg-gray-50 p-1 rounded min-h-[24px]" 
      onClick={() => setIsEditing(true)}
    >
      <div className="flex items-center gap-2">
        <span className={multiline ? "whitespace-pre-wrap" : ""}>{value || placeholder}</span>
        <Edit className="h-4 w-4 opacity-0 group-hover:opacity-100 text-gray-400" />
      </div>
    </div>
  );
}

// Draggable Section Wrapper Component
interface DraggableSectionProps {
  id: string;
  children: React.ReactNode;
  isSharedView?: boolean;
}

function DraggableSection({ id, children, isSharedView }: DraggableSectionProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  if (isSharedView) {
    return <div>{children}</div>;
  }

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      <div
        {...attributes}
        {...listeners}
        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-8 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing z-10"
      >
        <div className="bg-gray-200 hover:bg-gray-300 rounded p-1">
          <GripVertical className="h-4 w-4 text-gray-600" />
        </div>
      </div>
      {children}
    </div>
  );
}

interface CimDisplayProps {
  analysis: any;
  docId: number;
  websiteUrl?: string;
  logoUrl?: string;
  selectedImages?: string[];
  title?: string;
  isSharedView?: boolean;
  userProfile?: any;
  cimDocument?: any;
  autoTriggerShare?: boolean;
  onShareTriggered?: () => void;
}

export function CimDisplay({
  analysis,
  docId,
  logoUrl,
  selectedImages,
  isSharedView,
  cimDocument,
  autoTriggerShare,
  onShareTriggered
}: CimDisplayProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // State for section management - convert sections object to array if needed
  const initializeSections = () => {
    if (!analysis?.sections) return [];
    
    // If sections is already an array, use it directly
    if (Array.isArray(analysis.sections)) {
      return analysis.sections;
    }
    
    // If sections is an object, convert to array format
    if (typeof analysis.sections === 'object') {
      return Object.entries(analysis.sections).map(([key, value]: [string, any]) => ({
        id: key,
        title: value.title || key,
        content: value.content || value,
        ...value
      }));
    }
    
    return [];
  };
  
  const [sections, setSections] = useState(initializeSections());
  const [customSections, setCustomSections] = useState<any[]>([]);
  
  // Update sections when analysis changes (e.g., when switching documents)
  useEffect(() => {
    setSections(initializeSections());
  }, [analysis]);
  const [confirmDeleteSectionId, setConfirmDeleteSectionId] = useState<string | null>(null);
  const [addSectionDialogOpen, setAddSectionDialogOpen] = useState(false);
  const [isAddingSectionLoading, setIsAddingSectionLoading] = useState(false);
  
  // Local state for immediate UI updates - properly initialize from cimDocument
  const [localLogoUrl, setLocalLogoUrl] = useState<string | undefined>(
    logoUrl || cimDocument?.logoUrl || undefined
  );
  const [localSelectedImages, setLocalSelectedImages] = useState(
    selectedImages || cimDocument?.selectedImages || []
  );
  
  // Update local state when props change (important for shared views)
  useEffect(() => {
    if (selectedImages && selectedImages.length > 0) {
      console.log("Updating localSelectedImages from props:", selectedImages);
      setLocalSelectedImages(selectedImages);
      setBrokenImages(new Set()); // Reset broken images when new images arrive
    }
  }, [selectedImages]);
  
  // State for tracking broken images
  const [brokenImages, setBrokenImages] = useState<Set<number>>(new Set());
  const [logoError, setLogoError] = useState(false);
  
  // Debug selectedImages prop
  useEffect(() => {
    console.log("CimDisplay selectedImages prop:", selectedImages);
    console.log("CimDisplay localSelectedImages state:", localSelectedImages);
  }, [selectedImages]);
  const [isLogoUploading, setIsLogoUploading] = useState(false);
  const [isBusinessImagesUploading, setIsBusinessImagesUploading] = useState(false);

  // Share settings dialog state
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  
  // Lightbox state for business images
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Update local state when props change with debouncing
  useEffect(() => {
    const timer = setTimeout(() => {
      setLocalLogoUrl(logoUrl || cimDocument?.logoUrl);
      setLocalSelectedImages(selectedImages || cimDocument?.selectedImages || []);
      // Reset error states when images change
      setLogoError(false);
      setBrokenImages(new Set());
    }, 50);
    
    return () => clearTimeout(timer);
  }, [logoUrl, selectedImages, cimDocument?.logoUrl, cimDocument?.selectedImages]);

  // Handle auto-trigger share settings with simplified approach
  useEffect(() => {
    if (autoTriggerShare && !isSharedView) {
      setShareDialogOpen(true);
      if (onShareTriggered) {
        onShareTriggered();
      }
    }
  }, [autoTriggerShare, isSharedView, onShareTriggered]);

  // Use centralized hook for custom sections to eliminate duplicate requests
  const { data: customSectionsData } = useCustomSections(docId);

  // Update custom sections when data changes
  useEffect(() => {
    if (customSectionsData) {
      setCustomSections(customSectionsData);
    }
  }, [customSectionsData]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag and drop reordering for unified sections
  const handleDragEnd = async (event: any) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    // Get the unified sections array
    const unifiedSections = createUnifiedSections();
    const activeIndex = unifiedSections.findIndex(item => item.id === active.id);
    const overIndex = unifiedSections.findIndex(item => item.id === over.id);

    if (activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex) {
      // Reorder the unified sections
      const reorderedSections = arrayMove(unifiedSections, activeIndex, overIndex);
      
      // Separate back into regular and custom sections with new positions
      const newRegularSections: any[] = [];
      const updatedCustomSections: any[] = [];
      
      reorderedSections.forEach((item, index) => {
        if (item.type === 'regular') {
          newRegularSections.push(item.data);
        } else {
          // For custom sections, determine their insertAfterSection based on position
          let insertAfterSection = 'start';
          
          // Look backwards to find the last regular section
          for (let i = index - 1; i >= 0; i--) {
            if (reorderedSections[i].type === 'regular') {
              const regularSection = reorderedSections[i].data;
              insertAfterSection = regularSection.id || regularSection.title || `section-${newRegularSections.length - 1}`;
              break;
            }
          }
          
          // If no regular section found before this, and there are regular sections after, use 'start'
          // If no regular sections at all or all are after, use 'end'
          const hasRegularAfter = reorderedSections.slice(index + 1).some(s => s.type === 'regular');
          if (insertAfterSection === 'start' && !hasRegularAfter && newRegularSections.length > 0) {
            insertAfterSection = 'end';
          }
          
          updatedCustomSections.push({
            ...item.data,
            insertAfterSection,
            position: index + 1 // Use index as position for ordering within the same insertAfterSection group
          });
        }
      });

      try {
        // Save regular sections if they changed
        if (JSON.stringify(newRegularSections) !== JSON.stringify(sections)) {
          const updatedAnalysis = { ...analysis, sections: newRegularSections };
          await apiRequest("PATCH", `/api/cim/${docId}`, {
            analysis: updatedAnalysis
          });
          setSections(newRegularSections);
        }

        // Save custom sections with their new positions and insertAfterSection values
        if (updatedCustomSections.length > 0) {
          const customSectionUpdates = updatedCustomSections.map(s => ({
            id: s.id,
            position: s.position,
            insertAfterSection: s.insertAfterSection
          }));
          
          await apiRequest("PUT", `/api/cim/${docId}/custom-sections/reorder`, {
            sections: customSectionUpdates
          });
          setCustomSections(updatedCustomSections);
        }

        queryClient.invalidateQueries({ queryKey: ['/api/cim', docId] });
        queryClient.invalidateQueries({ queryKey: ['/api/cim'] });
        toast({ title: "Sections Reordered", description: "Section order saved successfully." });
      } catch (error) {
        toast({ title: "Save Failed", description: "Failed to save section order.", variant: "destructive" });
        // Note: In a production app, you'd want to revert the UI state here
      }
    }
  };

  // Handle section deletion
  const handleDeleteSection = async (sectionId: string) => {
    try {
      const newSections = sections.filter((section: any) => (section.id || section.title) !== sectionId);
      setSections(newSections);

      const updatedAnalysis = { ...analysis, sections: newSections };
      const response = await apiRequest("PATCH", `/api/cim/${docId}`, {
        analysis: updatedAnalysis
      });
      
      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ['/api/cim', docId] });
        queryClient.invalidateQueries({ queryKey: ['/api/cim'] });
        toast({ title: "Section Deleted", description: "Section removed successfully." });
      }
    } catch (error) {
      toast({ title: "Delete Failed", description: "Failed to delete section.", variant: "destructive" });
      setSections(analysis.sections); // Revert on error
    }
    setConfirmDeleteSectionId(null);
  };

  // Create truly unified sections list by merging regular and custom sections into one sortable array
  const createUnifiedSections = () => {
    // Start with all regular sections
    const regularSectionItems = sections.map((section: any, index: number) => ({
      id: section.id || section.title || `section-${index}`,
      type: 'regular',
      data: section,
      sortOrder: index * 100 // Give regular sections room for custom sections in between
    }));

    // Add custom sections with calculated sort order based on their insertAfterSection
    const customSectionItems = customSections.map((customSection: any) => {
      let sortOrder = 0;
      
      if (customSection.insertAfterSection === 'start') {
        // Custom sections at start get negative sort order
        sortOrder = -1000 + customSection.position;
      } else if (customSection.insertAfterSection === 'end') {
        // Custom sections at end get high sort order
        sortOrder = 10000 + customSection.position;
      } else {
        // Find the regular section this should come after
        const afterSectionIndex = sections.findIndex((section: any, index: number) => {
          const sectionId = section.id || section.title || `section-${index}`;
          return sectionId === customSection.insertAfterSection;
        });
        
        if (afterSectionIndex !== -1) {
          // Place after the found section with micro-positioning
          sortOrder = (afterSectionIndex * 100) + 50 + customSection.position;
        } else {
          // Fallback to end if section not found
          sortOrder = 10000 + customSection.position;
        }
      }

      return {
        id: `custom-${customSection.id}`,
        type: 'custom',
        data: customSection,
        sortOrder
      };
    });

    // Combine and sort by sortOrder
    const allSections = [...regularSectionItems, ...customSectionItems];
    allSections.sort((a, b) => a.sortOrder - b.sortOrder);
    
    return allSections;
  };

  // Handle logo deletion
  const handleDeleteLogo = async () => {
    try {
      // Immediately update local state for instant UI feedback
      setLocalLogoUrl(undefined);
      
      const response = await apiRequest("DELETE", `/api/cim/${docId}/logo`);
      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: [`/api/cim/${docId}`] });
        toast({ title: "Logo Deleted", description: "Website logo removed successfully." });
      } else {
        // Revert on error
        setLocalLogoUrl(logoUrl || undefined);
      }
    } catch (error) {
      // Revert on error
      setLocalLogoUrl(logoUrl || undefined);
      toast({ title: "Delete Failed", description: "Failed to delete logo.", variant: "destructive" });
    }
  };

  // Handle business image deletion
  const handleDeleteImage = async (imageIndex: number) => {
    try {
      // Immediately update local state for instant UI feedback
      const updatedImages = localSelectedImages.filter((_, index) => index !== imageIndex);
      setLocalSelectedImages(updatedImages);
      
      const response = await apiRequest("DELETE", `/api/cim/${docId}/business-image/${imageIndex}`);
      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: [`/api/cim/${docId}`] });
        toast({ title: "Image Deleted", description: "Business image removed successfully." });
      } else {
        // Revert on error
        setLocalSelectedImages(selectedImages || []);
      }
    } catch (error) {
      // Revert on error
      setLocalSelectedImages(selectedImages || []);
      toast({ title: "Delete Failed", description: "Failed to delete image.", variant: "destructive" });
    }
  };



  // Handle logo upload/replacement
  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast({ title: "Invalid File", description: "Please select an image file.", variant: "destructive" });
        return;
      }

      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: "File Too Large", description: "Image must be smaller than 5MB.", variant: "destructive" });
        return;
      }

      setIsLogoUploading(true);
      
      const formData = new FormData();
      formData.append('logo', file);

      const response = await fetch(`/api/cim/${docId}/logo`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        setLocalLogoUrl(result.logoUrl);
        
        // Invalidate specific query only to avoid affecting modal state
        queryClient.invalidateQueries({ queryKey: [`/api/cim/${docId}`] });
        
        toast({ title: "Logo Updated", description: "Logo uploaded successfully." });
      } else {
        const error = await response.json();
        toast({ title: "Upload Failed", description: error.error || "Failed to upload logo.", variant: "destructive" });
      }
    } catch (error) {
      console.error('Logo upload error:', error);
      toast({ title: "Upload Failed", description: "An error occurred during upload.", variant: "destructive" });
    } finally {
      setIsLogoUploading(false);
    }

    event.target.value = '';
  };

  // Handle business image upload
  const handleBusinessImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    try {
      for (const file of Array.from(files)) {
        // Validate file type
        if (!file.type.startsWith('image/')) {
          toast({ title: "Invalid File", description: `${file.name} is not an image file.`, variant: "destructive" });
          continue;
        }

        // Validate file size (5MB limit)
        if (file.size > 5 * 1024 * 1024) {
          toast({ title: "File Too Large", description: `${file.name} is larger than 5MB.`, variant: "destructive" });
          continue;
        }

        const formData = new FormData();
        formData.append('image', file);

        const response = await fetch(`/api/cim/${docId}/business-image`, {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const result = await response.json();
          // Update local state immediately
          setLocalSelectedImages(prev => [...prev, result.imagePath]);
          
          // Invalidate specific query only to avoid affecting modal state
          queryClient.invalidateQueries({ queryKey: [`/api/cim/${docId}`] });
          
          toast({ title: "Upload Successful", description: `${file.name} uploaded successfully.` });
        } else {
          const error = await response.json();
          toast({ title: "Upload Failed", description: error.error || `Failed to upload ${file.name}.`, variant: "destructive" });
        }
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast({ title: "Upload Failed", description: "An error occurred during upload.", variant: "destructive" });
    }

    // Reset the input
    event.target.value = '';
  };

  // Handle opening lightbox
  const openLightbox = (imageIndex: number) => {
    setCurrentImageIndex(imageIndex);
    setLightboxOpen(true);
  };

  // Navigate lightbox
  const navigateLightbox = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      setCurrentImageIndex(prev => 
        prev === 0 ? localSelectedImages.length - 1 : prev - 1
      );
    } else {
      setCurrentImageIndex(prev => 
        prev === localSelectedImages.length - 1 ? 0 : prev + 1
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">


        {/* Preview Share Link Button */}
        {!isSharedView && cimDocument?.shareSlug && (
          <div className="mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const shareUrl = `${window.location.hostname === "localhost" ? window.location.origin : "https://cimshare.com"}/share/${cimDocument.shareSlug}`;
                window.open(shareUrl, '_blank');
              }}
              className="gap-2"
            >
              <Eye className="h-4 w-4" />
              Preview Share Link
            </Button>
          </div>
        )}

        {/* Cover Image Manager - Only in Edit View */}
        {!isSharedView && cimDocument && (
          <CoverImageManager
            docId={docId}
            currentCoverImage={cimDocument.coverImageUrl}
            currentPosition={cimDocument.coverImagePosition}
            currentAttribution={cimDocument.coverImageAttribution}
            onUpdate={() => {
              queryClient.invalidateQueries({ queryKey: ['/api/cim', docId] });
              queryClient.invalidateQueries({ queryKey: ['/api/cim'] });
            }}
          />
        )}

        {/* Financial Information Section at Top */}
        {!isSharedView && (
          <OwnerFinancialsSection docId={docId} />
        )}

        {/* Logo section - only in edit view */}
        {!isSharedView && (
          <div className="mb-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-medium">Company Logo</h3>
              <div className="flex gap-2">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  id="logo-upload"
                  onChange={handleLogoUpload}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById('logo-upload')?.click()}
                  className="flex items-center gap-2"
                  disabled={isLogoUploading}
                >
                  {isLogoUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {isLogoUploading ? 'Uploading...' : (localLogoUrl ? 'Replace Logo' : 'Upload Logo')}
                </Button>
              </div>
            </div>
            {localLogoUrl && !logoError ? (
              <div className="flex justify-center relative group">
                <img 
                  src={localLogoUrl} 
                  alt="Company Logo" 
                  className="h-32" 
                  onError={() => setLogoError(true)}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-red-50 hover:bg-red-100 text-red-600"
                  onClick={handleDeleteLogo}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                <ImageIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500">No logo uploaded yet</p>
              </div>
            )}
          </div>
        )}
        
        {/* Business Images */}
        {(localSelectedImages && localSelectedImages.length > 0 || !isSharedView) && (
          <div className="mb-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-medium">Business Images</h3>
              {!isSharedView && (
                <div className="flex gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    id="business-image-upload"
                    onChange={handleBusinessImageUpload}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById('business-image-upload')?.click()}
                    className="flex items-center gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    Upload Images
                  </Button>
                </div>
              )}
            </div>
            {localSelectedImages && localSelectedImages.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {localSelectedImages.map((image, index) => (
                  <div key={index} className="relative group">
                    {!brokenImages.has(index) ? (
                      <img 
                        src={image} 
                        alt={`Business image ${index + 1}`}
                        className="w-full h-48 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => openLightbox(index)}
                        onError={(e) => {
                          console.error(`Image failed to load: ${image}`, e);
                          setBrokenImages(prev => new Set([...prev, index]));
                        }}
                        onLoad={() => {
                          console.log(`Image loaded successfully: ${image}`);
                        }}
                      />
                    ) : (
                      <div className="w-full h-48 bg-gray-100 rounded-lg flex flex-col items-center justify-center border-2 border-dashed border-gray-300">
                        <ImageIcon className="h-8 w-8 text-gray-400 mb-2" />
                        <p className="text-sm text-gray-500 mb-2">Image not found</p>
                        {!isSharedView && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => document.getElementById('business-image-upload')?.click()}
                            className="text-xs"
                          >
                            Re-upload
                          </Button>
                        )}
                      </div>
                    )}
                    {!isSharedView && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-red-50 hover:bg-red-100 text-red-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteImage(index);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            ) : !isSharedView ? (
              <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                <ImageIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500">No business images uploaded yet</p>
              </div>
            ) : null}
          </div>
        )}
        
        {/* Combined Draggable Sections */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={createUnifiedSections().map(section => section.id)}
            strategy={verticalListSortingStrategy}
          >
            {/* Unified Sections - Regular and Custom integrated by position */}
            {createUnifiedSections().map((unifiedSection: any) => {
              if (unifiedSection.type === 'regular') {
                const section = unifiedSection.data;
                const sectionId = unifiedSection.id;
                return (
                  <DraggableSection key={sectionId} id={sectionId} isSharedView={isSharedView}>
                    <Card className="mb-4 relative group">
                      {!isSharedView && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => setConfirmDeleteSectionId(sectionId)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                      <CardHeader>
                        <CardTitle className="text-lg pr-8">
                          {!isSharedView ? (
                            <FlexibleSectionEditor
                              value={section.title}
                              onSave={async (newTitle: string) => {
                                try {
                                  const updatedSections = sections.map((sec: any, idx: number) => {
                                    if ((sec.id || sec.title || `section-${idx}`) === sectionId) {
                                      return { ...sec, title: newTitle };
                                    }
                                    return sec;
                                  });
                                  setSections(updatedSections);
                                  
                                  const updatedAnalysis = { ...analysis, sections: updatedSections };
                                  
                                  const response = await apiRequest("PATCH", `/api/cim/${docId}`, {
                                    analysis: updatedAnalysis
                                  });
                                  
                                  if (response.ok) {
                                    queryClient.invalidateQueries({ queryKey: ['/api/cim', docId] });
                                    queryClient.invalidateQueries({ queryKey: ['/api/cim'] });
                                    toast({ title: "Title Updated", description: "Section title saved successfully." });
                                  }
                                } catch (error) {
                                  toast({ title: "Save Failed", description: "Failed to save changes.", variant: "destructive" });
                                }
                              }}
                              placeholder="Section title"
                              multiline={false}
                            />
                          ) : (
                            section.title
                          )}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="prose prose-base max-w-none break-words overflow-hidden text-base leading-relaxed">
                          {!isSharedView ? (
                            <FlexibleSectionEditor
                              value={section.content}
                              onSave={async (newContent: string) => {
                                try {
                                  const updatedSections = sections.map((sec: any, idx: number) => {
                                    if ((sec.id || sec.title || `section-${idx}`) === sectionId) {
                                      return { ...sec, content: newContent };
                                    }
                                    return sec;
                                  });
                                  setSections(updatedSections);
                                  
                                  const updatedAnalysis = { ...analysis, sections: updatedSections };
                                  
                                  const response = await apiRequest("PATCH", `/api/cim/${docId}`, {
                                    analysis: updatedAnalysis
                                  });
                                  
                                  if (response.ok) {
                                    queryClient.invalidateQueries({ queryKey: ['/api/cim', docId] });
                                    queryClient.invalidateQueries({ queryKey: ['/api/cim'] });
                                    toast({ title: "Content Updated", description: "Section content saved successfully." });
                                  }
                                } catch (error) {
                                  toast({ title: "Save Failed", description: "Failed to save changes.", variant: "destructive" });
                                }
                              }}
                              placeholder="Section content"
                              multiline={true}
                            />
                          ) : (
                            <div className="prose prose-base max-w-none break-words overflow-hidden text-base leading-relaxed">
                              <ReactMarkdown 
                                components={{
                                  ul: ({ children }) => <ul className="list-disc pl-4">{children}</ul>,
                                  li: ({ children }) => <li className="mb-1">{children}</li>,
                                  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                                  code: ({ children }) => <>{children}</>, // Render code as plain text
                                  pre: ({ children }) => <>{children}</>, // Render code blocks as plain text
                                  text: ({ children }) => <>{restoreEscapedCharacters(String(children))}</>
                                }}
                              >
                                {processMarkdownWithEscaping(section.content
                                  .replace(/```[\s\S]*?```/g, (match) => {
                                    // Convert code blocks to bullet points
                                    const content = match.replace(/```[\w]*\n?/, '').replace(/```$/, '');
                                    return content.split('\n').filter(line => line.trim()).map(line => `- ${line.trim()}`).join('\n');
                                  })
                                  .replace(/`([^`]+)`/g, '$1') // Remove inline code formatting
                                )}
                              </ReactMarkdown>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </DraggableSection>
                );
              } else {
                // Custom section rendering
                const customSection = unifiedSection.data;
                return (
                  <DraggableSection key={`custom-${customSection.id}`} id={`custom-${customSection.id}`} isSharedView={isSharedView}>
                    <Card className="mb-4 relative group">
                      {!isSharedView && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={async () => {
                            try {
                              const response = await apiRequest("DELETE", `/api/custom-section/${customSection.id}`);
                              if (response.ok) {
                                setCustomSections(prev => prev.filter(s => s.id !== customSection.id));
                                toast({ title: "Section Deleted", description: "Custom section removed successfully." });
                              }
                            } catch (error) {
                              toast({ title: "Delete Failed", description: "Failed to delete custom section.", variant: "destructive" });
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                      <CardHeader>
                        <CardTitle className="text-lg pr-8">
                          {!isSharedView ? (
                            <FlexibleSectionEditor
                              value={customSection.title}
                              onSave={async (newTitle: string) => {
                                try {
                                  const response = await apiRequest("PUT", `/api/custom-section/${customSection.id}`, {
                                    title: newTitle
                                  });
                                  
                                  if (response.ok) {
                                    setCustomSections(prev => prev.map(s => 
                                      s.id === customSection.id ? { ...s, title: newTitle } : s
                                    ));
                                    toast({ title: "Title Updated", description: "Custom section title saved successfully." });
                                  }
                                } catch (error) {
                                  toast({ title: "Save Failed", description: "Failed to save changes.", variant: "destructive" });
                                }
                              }}
                              placeholder="Section title"
                              multiline={false}
                            />
                          ) : (
                            customSection.title
                          )}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {customSection.type === 'text' ? (
                          <div className="prose prose-base max-w-none break-words overflow-hidden text-base leading-relaxed">
                            {!isSharedView ? (
                              <FlexibleSectionEditor
                                value={customSection.content}
                                onSave={async (newContent: string) => {
                                  try {
                                    const response = await apiRequest("PUT", `/api/custom-section/${customSection.id}`, {
                                      content: newContent
                                    });
                                    
                                    if (response.ok) {
                                      setCustomSections(prev => prev.map(s => 
                                        s.id === customSection.id ? { ...s, content: newContent } : s
                                      ));
                                      toast({ title: "Content Updated", description: "Custom section content saved successfully." });
                                    }
                                  } catch (error) {
                                    toast({ title: "Save Failed", description: "Failed to save changes.", variant: "destructive" });
                                  }
                                }}
                                placeholder="Click to edit this text section..."
                                multiline={true}
                              />
                            ) : (
                              <div className="prose prose-base max-w-none break-words overflow-hidden text-base leading-relaxed">
                                <ReactMarkdown 
                                  components={{
                                    ul: ({ children }) => <ul className="list-disc pl-4">{children}</ul>,
                                    li: ({ children }) => <li className="mb-1">{children}</li>,
                                    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                                    text: ({ children }) => <>{restoreEscapedCharacters(String(children))}</>
                                  }}
                                >
                                  {processMarkdownWithEscaping(customSection.content)}
                                </ReactMarkdown>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {customSection.imageUrls && customSection.imageUrls.length > 0 ? (
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {customSection.imageUrls.map((imageUrl: string, index: number) => (
                                  <img 
                                    key={index}
                                    src={imageUrl} 
                                    alt={`Custom section image ${index + 1}`}
                                    className="w-full h-48 object-cover rounded-lg"
                                  />
                                ))}
                              </div>
                            ) : customSection.imageUrl ? (
                              <img 
                                src={customSection.imageUrl} 
                                alt="Custom section image"
                                className="w-full h-48 object-cover rounded-lg"
                              />
                            ) : null}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </DraggableSection>
                );
              }
            })}
          </SortableContext>
        </DndContext>

        {/* Add Custom Section Button - Only in Edit View */}
        {!isSharedView && (
          <div className="flex justify-center py-4">
            <Dialog open={addSectionDialogOpen} onOpenChange={setAddSectionDialogOpen} modal={false}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Custom Section
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Custom Section</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Choose the type of section you'd like to add to your CIM document.
                  </p>
                  <div className="grid grid-cols-1 gap-3">
                    <Button
                      variant="outline"
                      className="h-auto p-4 flex flex-col items-start gap-2"
                      disabled={isAddingSectionLoading}
                      onClick={async () => {
                        try {
                          setIsAddingSectionLoading(true);
                          const response = await apiRequest('POST', `/api/cim/${docId}/custom-section/text`, {
                            content: 'Click to edit this text section...',
                            afterSection: 'end'
                          });

                          if (response.ok) {
                            // Invalidate custom sections query to refresh via centralized hook
                            queryClient.invalidateQueries({ queryKey: [`/api/cim/${docId}/custom-sections`] });
                            queryClient.invalidateQueries({ queryKey: ['/api/cim', docId] });
                            queryClient.invalidateQueries({ queryKey: ['/api/cim'] });
                            toast({
                              title: "Text Section Added",
                              description: "Your new text section has been added to the document.",
                            });
                            setAddSectionDialogOpen(false);
                          }
                        } catch (error) {
                          toast({
                            title: "Failed to Add Section",
                            description: "Please try again.",
                            variant: "destructive",
                          });
                        } finally {
                          setIsAddingSectionLoading(false);
                        }
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <Type className="h-4 w-4" />
                        <span className="font-medium">Text Section</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Add a custom text section with your own content
                      </span>
                    </Button>
                    
                    <Button
                      variant="outline"
                      className="h-auto p-4 flex flex-col items-start gap-2"
                      disabled={isAddingSectionLoading}
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/*';
                        input.multiple = true;
                        input.onchange = async (e) => {
                          const files = Array.from((e.target as HTMLInputElement).files || []);
                          if (files.length === 0) return;

                          try {
                            setIsAddingSectionLoading(true);
                            const formData = new FormData();
                            files.forEach(file => formData.append('images', file));
                            formData.append('afterSection', 'end');

                            const response = await fetch(`/api/cim/${docId}/custom-section/image`, {
                              method: 'POST',
                              body: formData,
                            });

                            if (response.ok) {
                              // Invalidate custom sections query to refresh via centralized hook
                              queryClient.invalidateQueries({ queryKey: [`/api/cim/${docId}/custom-sections`] });
                              queryClient.invalidateQueries({ queryKey: ['/api/cim', docId] });
                              queryClient.invalidateQueries({ queryKey: ['/api/cim'] });
                              toast({
                                title: "Image Section Added",
                                description: "Your new image section has been added to the document.",
                              });
                              setAddSectionDialogOpen(false);
                            }
                          } catch (error) {
                            toast({
                              title: "Failed to Add Images",
                              description: "Please try again.",
                              variant: "destructive",
                            });
                          } finally {
                            setIsAddingSectionLoading(false);
                          }
                        };
                        input.click();
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <ImageIcon className="h-4 w-4" />
                        <span className="font-medium">Image Section</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Upload and add images to your document
                      </span>
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        {confirmDeleteSectionId && (
          <Dialog open={!!confirmDeleteSectionId} onOpenChange={() => setConfirmDeleteSectionId(null)} modal={false}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Section</DialogTitle>
              </DialogHeader>
              <p>Are you sure you want to delete this section? This action cannot be undone.</p>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => setConfirmDeleteSectionId(null)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={() => handleDeleteSection(confirmDeleteSectionId)}>
                  Delete
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}

      {/* DocumentExport component to handle share functionality */}
      {!isSharedView && (
        <DocumentExport
          analysis={analysis}
          docId={docId}
          autoTriggerShare={shareDialogOpen}
          onShareTriggered={() => setShareDialogOpen(false)}
          isSharedView={false}
          logoUrl={localLogoUrl}
          selectedImages={localSelectedImages}
        />
      )}

      </div>
      
      {/* Image Lightbox Dialog */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-4xl w-full max-h-[90vh] p-0 border-0 bg-black [&>button]:hidden">
          <div className="relative">
            {localSelectedImages.length > 0 && (
              <>
                <img
                  src={localSelectedImages[currentImageIndex]}
                  alt={`Business image ${currentImageIndex + 1}`}
                  className="w-full h-auto max-h-[80vh] object-contain"
                />
                
                {/* Navigation buttons */}
                {localSelectedImages.length > 1 && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
                      onClick={() => navigateLightbox('prev')}
                    >
                      <ChevronLeft className="h-6 w-6" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
                      onClick={() => navigateLightbox('next')}
                    >
                      <ChevronRight className="h-6 w-6" />
                    </Button>
                  </>
                )}
                
                {/* Close button */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white z-10"
                  onClick={() => setLightboxOpen(false)}
                >
                  <X className="h-6 w-6" />
                </Button>
                
                {/* Image counter */}
                {localSelectedImages.length > 1 && (
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
                    {currentImageIndex + 1} of {localSelectedImages.length}
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Markdown Reference Guide - Only in Edit View - Bottom of Interface */}
      {!isSharedView && (
        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Formatting Reference</CardTitle>
            </CardHeader>
            <CardContent>
              <MarkdownGuide />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}