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
  GripVertical
} from "lucide-react";
import { OwnerFinancialsSection } from "./owner-financials-section";
import ReactMarkdown from 'react-markdown';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
      <div className="space-y-3">
        {multiline ? (
          <textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="w-full min-h-[120px] p-3 border rounded-lg resize-none text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder={placeholder}
            autoFocus
          />
        ) : (
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="w-full p-3 border rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder={placeholder}
            autoFocus
          />
        )}
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSave} className="min-h-[44px] px-4">Save</Button>
          <Button size="sm" variant="outline" onClick={handleCancel} className="min-h-[44px] px-4">Cancel</Button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="group cursor-pointer hover:bg-gray-50 p-2 rounded-lg min-h-[44px] lg:min-h-[24px] transition-colors" 
      onClick={() => setIsEditing(true)}
    >
      <div className="flex items-center gap-2">
        <span className={`${multiline ? "whitespace-pre-wrap" : ""} ${!value ? "text-gray-400 italic" : ""} text-base lg:text-sm`}>
          {value || placeholder}
        </span>
        <Edit className="h-4 w-4 opacity-0 group-hover:opacity-100 text-gray-400 flex-shrink-0" />
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

interface EnhancedCimDisplayProps {
  analysis: any;
  docId: number;
  websiteUrl?: string;
  logoUrl?: string;
  selectedImages?: string[];
  title?: string;
  isSharedView?: boolean;
  userProfile?: any;
  cimDocument?: any;
}

export function EnhancedCimDisplay({
  analysis,
  docId,
  logoUrl,
  selectedImages,
  isSharedView,
  cimDocument
}: EnhancedCimDisplayProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // State for section management
  const [sections, setSections] = useState(analysis?.sections || []);
  const [confirmDeleteSectionId, setConfirmDeleteSectionId] = useState<string | null>(null);

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

  return (
    <div className="space-y-10">
      <div className="space-y-8">

        {/* Financial Information Section at Top */}
        {!isSharedView && cimDocument && (
          <div className="mb-10">
            {/* Website extracted logo */}
            {logoUrl && (
              <div className="flex justify-center mb-10">
                <div className="p-6 bg-white rounded-2xl shadow-sm border border-gray-100">
                  <img 
                    src={logoUrl} 
                    alt="Company Logo" 
                    className="h-20 object-contain"
                  />
                </div>
              </div>
            )}

            {/* Financial Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
              {cimDocument.askingPriceIncluded && (
                <div className="flex items-center gap-4 p-6 bg-gradient-to-br from-green-50 to-green-100 rounded-2xl border border-green-200">
                  <div className="p-3 bg-green-200 rounded-xl">
                    <DollarSign className="h-6 w-6 text-green-700" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-green-700">Asking Price</div>
                    <div className="text-xl font-bold text-green-900">${parseInt(cimDocument.askingPrice || '0').toLocaleString()}</div>
                  </div>
                </div>
              )}
              {cimDocument.revenueIncluded && (
                <div className="flex items-center gap-4 p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl border border-blue-200">
                  <div className="p-3 bg-blue-200 rounded-xl">
                    <TrendingUpIcon className="h-6 w-6 text-blue-700" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-blue-700">Annual Revenue</div>
                    <div className="text-xl font-bold text-blue-900">${parseInt(cimDocument.revenue || '0').toLocaleString()}</div>
                  </div>
                </div>
              )}
              {cimDocument.ebitdaIncluded && (
                <div className="flex items-center gap-4 p-6 bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl border border-purple-200">
                  <div className="p-3 bg-purple-200 rounded-xl">
                    <Banknote className="h-6 w-6 text-purple-700" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-purple-700">EBITDA</div>
                    <div className="text-xl font-bold text-purple-900">${parseInt(cimDocument.ebitda || '0').toLocaleString()}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Financial Management Section */}
            <OwnerFinancialsSection docId={docId} cimDocument={cimDocument} />
          </div>
        )}
        
        {/* Business Images */}
        {selectedImages && selectedImages.length > 0 && (
          <div className="mb-10">
            <div className="mb-8">
              <h3 className="text-xl font-semibold text-slate-800 mb-2">Business Images</h3>
              <p className="text-gray-600">Visual representation of your business operations and facilities</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {selectedImages.map((image, index) => (
                <div key={index} className="group relative overflow-hidden rounded-2xl shadow-md hover:shadow-lg transition-all duration-300">
                  <img 
                    src={image} 
                    alt={`Business image ${index + 1}`}
                    className="w-full h-56 object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
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
                  <Card className={`mb-8 relative group bg-white shadow-sm rounded-2xl border-0 hover:shadow-lg transition-all duration-200 cim-section ${index === 0 ? 'cim-section-first' : ''}`}>
                    {!isSharedView && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-700 hover:bg-red-50 z-10"
                        onClick={() => setConfirmDeleteSectionId(sectionId)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                    <CardHeader className="pb-6 pt-8 px-8">
                      <CardTitle className="text-xl pr-10 font-semibold text-slate-800">
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
                    <CardContent className="px-8 pb-8 pt-0">
                      <div className="prose prose-base max-w-none text-slate-700 leading-relaxed">
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
                                code: ({ children }) => <>{children}</>, // Render code as plain text
                                pre: ({ children }) => <>{children}</> // Render code blocks as plain text
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
      </div>
    </div>
  );
}