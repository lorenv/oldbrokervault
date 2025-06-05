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
  const [confirmDeleteSectionId, setConfirmDeleteSectionId] = useState<string | null>(null);
  
  // Local state for immediate UI updates
  const [localLogoUrl, setLocalLogoUrl] = useState<string | undefined>(logoUrl || undefined);
  const [localSelectedImages, setLocalSelectedImages] = useState(selectedImages || []);

  // Share settings dialog state
  const [shareDialogOpen, setShareDialogOpen] = useState(false);

  // Update local state when props change
  useEffect(() => {
    setLocalLogoUrl(logoUrl);
    setLocalSelectedImages(selectedImages || []);
  }, [logoUrl, selectedImages]);

  // Handle auto-trigger share settings
  useEffect(() => {
    if (autoTriggerShare && !isSharedView) {
      setShareDialogOpen(true);
      if (onShareTriggered) {
        onShareTriggered();
      }
    }
  }, [autoTriggerShare, isSharedView, onShareTriggered]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end
  const handleDragEnd = async (event: any) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      const oldIndex = sections.findIndex((section: any) => (section.id || section.title) === active.id);
      const newIndex = sections.findIndex((section: any) => (section.id || section.title) === over.id);

      const newSections = arrayMove(sections, oldIndex, newIndex);
      setSections(newSections);

      // Save to backend
      try {
        const updatedAnalysis = { ...analysis, sections: newSections };
        const response = await apiRequest("PATCH", `/api/cim/${docId}`, {
          analysis: updatedAnalysis
        });
        
        if (response.ok) {
          queryClient.invalidateQueries({ queryKey: ['/api/cim', docId] });
          queryClient.invalidateQueries({ queryKey: ['/api/cim'] });
          toast({ title: "Sections Reordered", description: "Section order saved successfully." });
        }
      } catch (error) {
        toast({ title: "Save Failed", description: "Failed to save section order.", variant: "destructive" });
        setSections(analysis.sections); // Revert on error
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
        
        {/* Draggable Sections */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sections.map((section: any, index: number) => section.id || section.title || `section-${index}`)}
            strategy={verticalListSortingStrategy}
          >
            {sections.map((section: any, index: number) => {
              const sectionId = section.id || section.title || `section-${index}`;
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
                                strong: ({ children }) => <strong className="font-semibold">{children}</strong>
                              }}
                            >
                              {section.content}
                            </ReactMarkdown>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </DraggableSection>
              );
            })}
          </SortableContext>
        </DndContext>

        {/* Add Custom Section Button - Only in Edit View */}
        {!isSharedView && (
          <div className="flex justify-center py-4">
            <Dialog>
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
                      onClick={async () => {
                        try {
                          const response = await apiRequest('POST', `/api/cim/${docId}/custom-section/text`, {
                            content: 'Click to edit this text section...',
                            afterSection: 'end'
                          });

                          if (response.ok) {
                            queryClient.invalidateQueries({ queryKey: ['/api/cim', docId] });
                            queryClient.invalidateQueries({ queryKey: ['/api/cim'] });
                            toast({
                              title: "Text Section Added",
                              description: "Your new text section has been added to the document.",
                            });
                          }
                        } catch (error) {
                          toast({
                            title: "Failed to Add Section",
                            description: "Please try again.",
                            variant: "destructive",
                          });
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
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/*';
                        input.multiple = true;
                        input.onchange = async (e) => {
                          const files = Array.from((e.target as HTMLInputElement).files || []);
                          if (files.length === 0) return;

                          try {
                            const formData = new FormData();
                            files.forEach(file => formData.append('images', file));
                            formData.append('afterSection', 'end');

                            const response = await fetch(`/api/cim/${docId}/custom-section/image`, {
                              method: 'POST',
                              body: formData,
                            });

                            if (response.ok) {
                              queryClient.invalidateQueries({ queryKey: ['/api/cim', docId] });
                              queryClient.invalidateQueries({ queryKey: ['/api/cim'] });
                              toast({
                                title: "Image Section Added",
                                description: "Your new image section has been added to the document.",
                              });
                            }
                          } catch (error) {
                            toast({
                              title: "Failed to Add Images",
                              description: "Please try again.",
                              variant: "destructive",
                            });
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
    </div>
  );
}