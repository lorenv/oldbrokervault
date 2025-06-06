import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";
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
  ImageIcon
} from "lucide-react";
import { OwnerFinancialsSection } from "./owner-financials-section";
import { CoverImageManager } from "./cover-image-manager";
import { CoverImageDisplay } from "./cover-image-display";
import { DocumentExport } from "./document-export";

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
            className="w-full min-h-[100px] p-2 border rounded resize-none"
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

  // State for section management
  const [sections, setSections] = useState(analysis?.sections || []);
  const [customSections, setCustomSections] = useState<any[]>([]);
  const [confirmDeleteSectionId, setConfirmDeleteSectionId] = useState<string | null>(null);
  const [addSectionDialogOpen, setAddSectionDialogOpen] = useState(false);
  const [isAddingSectionLoading, setIsAddingSectionLoading] = useState(false);
  
  // Local state for immediate UI updates
  const [localLogoUrl, setLocalLogoUrl] = useState<string | undefined>(logoUrl || undefined);
  const [localSelectedImages, setLocalSelectedImages] = useState(selectedImages || []);
  const [localTitle, setLocalTitle] = useState<string>(cimDocument?.title || "");

  // Share settings dialog state
  const [shareDialogOpen, setShareDialogOpen] = useState(false);

  // Update local state when props change
  useEffect(() => {
    setLocalLogoUrl(logoUrl);
    setLocalSelectedImages(selectedImages || []);
    setLocalTitle(cimDocument?.title || "");
  }, [logoUrl, selectedImages, cimDocument?.title]);

  // Handle auto-trigger share settings
  useEffect(() => {
    if (autoTriggerShare && !isSharedView) {
      setShareDialogOpen(true);
      if (onShareTriggered) {
        onShareTriggered();
      }
    }
  }, [autoTriggerShare, isSharedView, onShareTriggered]);

  // Fetch custom sections
  useEffect(() => {
    const fetchCustomSections = async () => {
      if (!docId) return;
      
      try {
        const response = await fetch(`/api/cim/${docId}/custom-sections`);
        if (response.ok) {
          const sections = await response.json();
          setCustomSections(sections);
        }
      } catch (error) {
        console.error('Failed to fetch custom sections:', error);
      }
    };

    fetchCustomSections();
  }, [docId]);

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
        queryClient.invalidateQueries({ queryKey: ['/api/cim', docId] });
        queryClient.invalidateQueries({ queryKey: ['/api/cim'] });
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
        queryClient.invalidateQueries({ queryKey: ['/api/cim', docId] });
        queryClient.invalidateQueries({ queryKey: ['/api/cim'] });
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

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {/* Document Title Editor - Only in Edit View */}
        {!isSharedView && cimDocument && (
          <div className="mb-6">
            <div className="text-3xl font-bold">
              <FlexibleSectionEditor
                value={localTitle}
                onSave={async (newTitle: string) => {
                  try {
                    // Update local state immediately for instant UI feedback
                    setLocalTitle(newTitle);
                    
                    const response = await apiRequest("PATCH", `/api/cim/${docId}`, {
                      title: newTitle
                    });
                    
                    if (response.ok) {
                      queryClient.invalidateQueries({ queryKey: ['/api/cim', docId] });
                      queryClient.invalidateQueries({ queryKey: ['/api/cim'] });
                      toast({ title: "Title Updated", description: "Document title saved successfully." });
                    } else {
                      // Revert on error
                      setLocalTitle(cimDocument.title);
                    }
                  } catch (error) {
                    // Revert on error
                    setLocalTitle(cimDocument.title);
                    toast({ title: "Save Failed", description: "Failed to save title changes.", variant: "destructive" });
                  }
                }}
                placeholder="Enter document title"
                multiline={false}
              />
            </div>
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
        {!isSharedView && cimDocument && (
          <OwnerFinancialsSection docId={docId} />
        )}

        {/* Logo only in edit view, not share view (header handles it there) */}
        {!isSharedView && localLogoUrl && (
          <div className="flex justify-center mb-6 relative group">
            <img src={localLogoUrl} alt="Company Logo" className="h-32" />
            <Button
              variant="ghost"
              size="sm"
              className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-red-50 hover:bg-red-100 text-red-600"
              onClick={handleDeleteLogo}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
        
        {/* Business Images */}
        {localSelectedImages && localSelectedImages.length > 0 && (
          <div className="mb-6">
            <h3 className="font-medium mb-3">Business Images</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {localSelectedImages.map((image, index) => (
                <div key={index} className="relative group">
                  <img 
                    src={image} 
                    alt={`Business image ${index + 1}`}
                    className="w-full h-48 object-cover rounded-lg"
                  />
                  {!isSharedView && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-red-50 hover:bg-red-100 text-red-600"
                      onClick={() => handleDeleteImage(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
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
                        <div className="prose prose-sm max-w-none">
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
                            <div className="prose prose-sm max-w-none">
                              <ReactMarkdown 
                                components={{
                                  ul: ({ children }) => <ul className="list-disc pl-4">{children}</ul>,
                                  li: ({ children }) => <li className="mb-1">{children}</li>,
                                  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                                  text: ({ children }) => <>{restoreEscapedCharacters(String(children))}</>
                                }}
                              >
                                {processMarkdownWithEscaping(section.content)}
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
                          <div className="prose prose-sm max-w-none">
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
                              <div className="prose prose-sm max-w-none">
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
            <Dialog open={addSectionDialogOpen} onOpenChange={setAddSectionDialogOpen}>
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
                            // Refresh custom sections
                            const sectionsResponse = await fetch(`/api/cim/${docId}/custom-sections`);
                            if (sectionsResponse.ok) {
                              const sections = await sectionsResponse.json();
                              setCustomSections(sections);
                            }
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
                              // Refresh custom sections
                              const sectionsResponse = await fetch(`/api/cim/${docId}/custom-sections`);
                              if (sectionsResponse.ok) {
                                const sections = await sectionsResponse.json();
                                setCustomSections(sections);
                              }
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
          <Dialog open={!!confirmDeleteSectionId} onOpenChange={() => setConfirmDeleteSectionId(null)}>
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