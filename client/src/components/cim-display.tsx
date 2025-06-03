import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InlineEditor } from "./inline-editor";
import { InsertableSection, CustomSection } from "./insertable-section";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Save, Download, X, Building2, TrendingUp, Target, Megaphone, Settings, Package, Users, MapPin, FileText, BarChart3, Trash2, Share2, Mail } from "lucide-react";
import { DocumentExport } from "./document-export";
import { BrokerContactForm } from "./broker-contact-form";
import { AddCustomSection } from "./add-custom-section";
import { FinancialsSection } from "./financials-section";
import { OwnerFinancialsSection } from "./owner-financials-section";
import { EmailShareDialog } from "./email-share-dialog";
import { useAuth } from "@/hooks/use-auth";
import { CollaborationBanner } from "./collaboration-banner";
import { UploadedCimFileManager } from "./uploaded-cim-file-manager";
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
import { GripVertical } from 'lucide-react';

interface CimDisplayProps {
  analysis: any;
  docId: number;
  websiteUrl?: string;
  logoUrl?: string;
  selectedImages?: string[];
  title?: string;
  isSharedView?: boolean;
  userProfile?: any;
  autoTriggerShare?: boolean;
  onShareTriggered?: () => void;
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

export function CimDisplay({ analysis, docId, websiteUrl, logoUrl, selectedImages, title, isSharedView, userProfile, cimDocument, autoTriggerShare, onShareTriggered }: CimDisplayProps & { cimDocument?: any }) {
  // Check if this is a new flexible CIM format
  const isFlexibleFormat = analysis?.sections && Array.isArray(analysis.sections);
  
  // If it's the new flexible format, render the flexible display
  if (isFlexibleFormat) {
    return (
      <div className="space-y-6">
        <div className="p-4 border rounded-lg bg-blue-50 border-blue-200">
          <h3 className="font-medium text-blue-800">Flexible CIM Document</h3>
          <p className="text-sm text-blue-600 mt-1">
            This document was created using the new flexible system with {analysis.sections?.length || 0} sections.
          </p>
        </div>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">{analysis.title || title}</h2>
            <div className="flex gap-2 text-sm">
              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">
                {analysis.metadata?.purpose || 'Business Overview'}
              </span>
              <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded">
                {analysis.metadata?.tone || 'Professional'}
              </span>
              <span className="px-2 py-1 bg-green-100 text-green-700 rounded">
                {analysis.metadata?.audience || 'Investors'}
              </span>
            </div>
          </div>
          
          {logoUrl && (
            <div className="flex justify-center mb-6">
              <img src={logoUrl} alt="Company Logo" className="h-16" />
            </div>
          )}
          
          {selectedImages && selectedImages.length > 0 && (
            <div className="mb-6">
              <h3 className="font-medium mb-3">Business Images</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {selectedImages.map((image, index) => (
                  <img 
                    key={index} 
                    src={image} 
                    alt={`Business image ${index + 1}`}
                    className="w-full h-48 object-cover rounded-lg"
                  />
                ))}
              </div>
            </div>
          )}
          
          {analysis.sections?.map((section: any, index: number) => (
            <Card key={section.id || index} className="mb-4">
              <CardHeader>
                <CardTitle className="text-lg">{section.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none whitespace-pre-wrap">
                  {section.content}
                </div>
              </CardContent>
            </Card>
          ))}
          
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium mb-2">Document Metadata</h4>
            <div className="text-sm text-gray-600 space-y-1">
              <p>Generated: {new Date(analysis.generatedAt).toLocaleString()}</p>
              <p>Word Count: {analysis.metadata?.wordCount || 0}</p>
              <p>Custom Directions: {analysis.metadata?.customDirections}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }
  const { toast } = useToast();
  const { user } = useAuth();
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState<any>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [selectedImageModal, setSelectedImageModal] = useState<string | null>(null);
  const [deletedFields, setDeletedFields] = useState<Set<string>>(new Set());
  const [deletedSections, setDeletedSections] = useState<Set<string>>(new Set());
  const [confirmDeleteSection, setConfirmDeleteSection] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);

  const handleDeleteSection = (sectionId: string) => {
    setDeletedSections(prev => new Set([...Array.from(prev), sectionId]));
    setConfirmDeleteSection(null);
    setHasUnsavedChanges(true);
    toast({
      title: "Section Deleted",
      description: "Section removed. Click 'Save All Changes' to persist changes.",
    });
  };

  const handleRestoreSection = (sectionId: string) => {
    setDeletedSections(prev => {
      const newSet = new Set(prev);
      newSet.delete(sectionId);
      return newSet;
    });
    setHasUnsavedChanges(true);
    toast({
      title: "Section Restored",
      description: "Section restored. Click 'Save All Changes' to persist changes.",
    });
  };

  // Filter to detect and remove synthetic/placeholder data
  const filterSyntheticData = (value: any): any => {
    if (!value) return value;
    
    if (typeof value === 'string') {
      // Detect common synthetic data patterns - expanded to catch all AI-generated content
      const syntheticPatterns = [
        /Product [A-Z]:/,
        /margin of \d+%/,
        /High-demand product/,
        /Seasonal product/,
        /Core product/,
        /Founder [12]/,
        /ecommerce platform/i,
        /customer service team/i,
        /inventory management system/i,
        /order process begins/i,
        /products are packed and shipped/i,
        /tracking information provided/i,
        /customer inquiries and product selections/i,
        /online payment methods/i,
        /customer feedback is collected/i,
        /accounting methods including/,
        /contingency plans in place/,
        /categorized by profitability/,
        /relationships are transferable/i,
        /customer data and purchase history/i,
        /ongoing marketing efforts/i,
        /alternative sources identified/i,
        /payment terms being primarily/i,
        /terms and conditions for purchases/i,
        /managed through the ecommerce platform/i
      ];
      
      // Check if the value contains synthetic patterns
      const isSynthetic = syntheticPatterns.some(pattern => pattern.test(value));
      if (isSynthetic) {
        return ""; // Return empty string for synthetic data
      }
    }
    
    if (Array.isArray(value)) {
      const filtered = value
        .map(item => filterSyntheticData(item))
        .filter(item => item && (typeof item !== 'string' || item.trim() !== ''));
      return filtered.length > 0 ? filtered : [];
    }
    
    if (typeof value === 'object' && value !== null) {
      const filtered: any = {};
      
      for (const [key, val] of Object.entries(value)) {
        const filteredVal = filterSyntheticData(val);
        if (filteredVal !== null && filteredVal !== undefined) {
          filtered[key] = filteredVal;
        }
      }
      
      return filtered;
    }
    
    return value;
  };
  
  // Define the main sections for drag and drop
  const mainSections = [
    'executive-summary',
    'financials',
    'business-website', 
    'business-images',
    'business-overview',
    'market-position',
    'sales-marketing',
    'operations',
    'inventory',
    'team',
    'facilities',
    'assets-ownership'
  ];
  
  const [sectionOrder, setSectionOrder] = useState(mainSections);

  // Drag and drop sensors for main sections
  const mainSectionSensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end for main sections
  const handleMainSectionDragEnd = (event: any) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setSectionOrder((items) => {
        const oldIndex = items.indexOf(active.id);
        const newIndex = items.indexOf(over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  // Fetch custom sections
  const { data: customSections = [], refetch: refetchSections } = useQuery({
    queryKey: [`/api/cim/${docId}/custom-sections`],
    enabled: !!docId,
  });

  // Type guard for custom sections
  const typedCustomSections = Array.isArray(customSections) ? customSections as Array<{
    id: number;
    title: string;
    content: string;
    insertAfterSection: string;
    position: number;
  }> : [];

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Custom section handlers
  const handleSectionAdded = () => {
    refetchSections();
  };

  const handleSectionDelete = async (sectionId: number) => {
    try {
      await apiRequest("DELETE", `/api/custom-section/${sectionId}`);
      refetchSections();
      toast({
        title: "Section Deleted",
        description: "Custom section has been removed successfully",
      });
    } catch (error) {
      toast({
        title: "Delete Failed",
        description: "Failed to delete custom section. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSectionUpdate = async (sectionId: number, content: string) => {
    try {
      await apiRequest('PUT', `/api/custom-section/${sectionId}`, { content });
    } catch (error) {
      toast({
        title: "Update failed",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  // Handle drag end for reordering sections
  const handleDragEnd = async (event: any) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      const oldIndex = typedCustomSections.findIndex((item) => item.id === active.id);
      const newIndex = typedCustomSections.findIndex((item) => item.id === over.id);
      
      const reorderedSections = arrayMove(typedCustomSections, oldIndex, newIndex);
      
      // Update positions in database
      try {
        const sectionsWithNewPositions = reorderedSections.map((section: any, index: number) => ({
          id: section.id,
          position: index + 1
        }));
        
        await apiRequest('PUT', `/api/cim/${docId}/custom-sections/reorder`, {
          sections: sectionsWithNewPositions
        });
        
        refetchSections();
      } catch (error) {
        toast({
          title: "Reorder failed",
          description: "Please try again",
          variant: "destructive",
        });
      }
    }
  };

  // Helper function to get custom sections for a specific location
  const getCustomSectionsAfter = (sectionName: string) => {
    return typedCustomSections.filter((section) => section.insertAfterSection === sectionName);
  };

  // Helper function to render a section with insertable zones
  const renderSectionWithInsertables = (sectionName: string, sectionContent: JSX.Element) => {
    const sectionsAfter = getCustomSectionsAfter(sectionName);
    
    return (
      <>
        {sectionContent}
        
        {/* Show custom sections that come after this section */}
        {sectionsAfter.length > 0 && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext 
              items={sectionsAfter.map((section: any) => section.id)}
              strategy={verticalListSortingStrategy}
            >
              {sectionsAfter.map((section: any) => (
                <CustomSection
                  key={section.id}
                  id={section.id}
                  type={section.type}
                  content={section.content}
                  imageUrl={section.imageUrl}
                  onDelete={handleSectionDelete}
                  onUpdate={handleSectionUpdate}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
        
        {/* Show insertable zone if user is authenticated and not in shared view */}
        {user && !isSharedView && (
          <InsertableSection
            afterSection={sectionName}
            docId={docId}
            onSectionAdded={handleSectionAdded}
          />
        )}
      </>
    );
  };

  // Deep merge function to combine original analysis with edited content
  const getMergedContent = () => {
    const mergeDeep = (target: any, source: any): any => {
      for (const key in source) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          if (!target[key]) target[key] = {};
          mergeDeep(target[key], source[key]);
        } else {
          target[key] = source[key];
        }
      }
      return target;
    };
    
    const merged = mergeDeep(JSON.parse(JSON.stringify(analysis)), editedContent);
    // Apply synthetic data filter to ensure data integrity
    return filterSyntheticData(merged) || merged;
  };

  const getCurrentValue = (path: string) => {
    const keys = path.split('.');
    let current = getMergedContent();
    
    for (const key of keys) {
      if (current && typeof current === 'object') {
        current = current[key];
      } else {
        return '';
      }
    }
    
    return current || '';
  };

  const setValueByPath = (path: string, value: any) => {
    const keys = path.split('.');
    const newEditedContent = { ...editedContent };
    
    let current = newEditedContent;
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!current[key]) {
        current[key] = {};
      }
      current = current[key];
    }
    
    current[keys[keys.length - 1]] = value;
    setEditedContent(newEditedContent);
    setHasUnsavedChanges(true);
  };

  const handleEdit = (fieldPath: string) => {
    if (!canEdit) {
      toast({
        title: "Cannot Edit",
        description: "Document is currently being edited by another user or you don't have edit permissions.",
        variant: "destructive"
      });
      return;
    }
    setEditingField(fieldPath);
  };

  const handleSave = (fieldPath: string, value: string | string[]) => {
    setValueByPath(fieldPath, value);
    setEditingField(null);
    toast({
      title: "Field Updated",
      description: "Your changes have been saved locally. Click 'Save All Changes' to persist them.",
    });
  };

  const handleCancel = () => {
    setEditingField(null);
  };

  const handleDelete = (fieldPath: string) => {
    // Add field to deleted fields set to hide it completely
    setDeletedFields(prev => new Set([...Array.from(prev), fieldPath]));
    setHasUnsavedChanges(true);
    toast({
      title: "Field Deleted",
      description: "Field has been removed from display. Click 'Save All Changes' to persist changes.",
    });
  };

  const saveAllChangesMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("PUT", `/api/cim/${docId}/content`, {
        editedContent
      });
      return response.json();
    },
    onSuccess: () => {
      setHasUnsavedChanges(false);
      queryClient.invalidateQueries({ queryKey: ["/api/cim"] });
      toast({
        title: "Changes Saved",
        description: "All your edits have been saved successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Save Failed",
        description: "Failed to save changes. Please try again.",
        variant: "destructive",
      });
    },
  });

  const renderField = (
    title: string, 
    path: string, 
    multiline: boolean = false, 
    isArray: boolean = false,
    placeholder?: string
  ) => {
    // Hide field completely if it's been deleted
    if (deletedFields.has(path)) {
      return null;
    }
    
    return (
      <div className="space-y-2">
        <h4 className="font-semibold text-sm text-gray-700">{title}</h4>
        <InlineEditor
          value={getCurrentValue(path)}
          fieldPath={path}
          isEditing={!isSharedView && editingField === path}
          onEdit={isSharedView ? () => {} : handleEdit}
          onSave={handleSave}
          onCancel={handleCancel}
          onDelete={isSharedView ? undefined : handleDelete}
          multiline={multiline}
          isArray={isArray}
          placeholder={placeholder}
          readOnly={isSharedView}
        />
      </div>
    );
  };

  const mergedAnalysis = getMergedContent();

  // Move export button to header in shared view
  const exportButtonPortal = isSharedView && (user || userProfile) && document.getElementById('export-button-container') ? 
    createPortal(
      <div className="flex justify-center">
        <DocumentExport 
          analysis={mergedAnalysis}
          docId={docId}
          websiteUrl={websiteUrl}
          logoUrl={logoUrl}
          selectedImages={selectedImages}
          user={user || userProfile}
          isSharedView={isSharedView}
        />
      </div>,
      document.getElementById('export-button-container')!
    ) : null;

  // Helper function to check if inventory section should be shown
  const shouldShowInventorySection = () => {
    const content = getMergedContent();
    const inventory = content?.inventory || {};
    
    // Check if any inventory fields have meaningful content
    const hasContent = inventory.leadTime !== "not applicable" ||
                      inventory.sourcing !== "not applicable" ||
                      inventory.value !== "not applicable" ||
                      inventory.skuCount !== "not applicable" ||
                      (inventory.topProducts && inventory.topProducts.length > 0 && 
                       !inventory.topProducts.every((item: string) => item === "not applicable"));
    
    return hasContent;
  };

  // Function to render a section with conditional drag handle
  const renderSectionWithDragHandle = (sectionId: string, content: React.ReactNode) => {
    if (isSharedView) {
      return content;
    }
    return (
      <DraggableSection id={sectionId} isSharedView={isSharedView}>
        {content}
      </DraggableSection>
    );
  };

  // Create a map of section components
  const getSectionContent = (sectionId: string) => {
    switch (sectionId) {
      case 'executive-summary':
        return (
          <Card className={`group ${isSharedView ? "bg-white shadow-lg rounded-2xl border-0 mb-8" : "border-blue-200"}`}>
            <CardHeader className={isSharedView ? "border-b border-gray-100/50 bg-gradient-to-r from-slate-100 to-blue-100/50 px-8 py-6" : "bg-blue-50"}>
              <div className="flex items-center justify-between">
                <CardTitle className={isSharedView ? "text-2xl font-bold text-slate-800" : "text-xl text-blue-900"}>Executive Summary</CardTitle>
                {!isSharedView && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100 hover:text-red-600"
                    onClick={() => setConfirmDeleteSection('executive-summary')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className={`space-y-6 ${isSharedView ? "px-8 pb-8 pt-8" : "pt-6"}`}>
              <div className="text-lg leading-relaxed">
                {renderField("Business Overview", "story.businessSummary", true, false, "Comprehensive business overview and description...")}
              </div>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className={`font-semibold text-md mb-3 ${isSharedView ? "text-green-800" : "text-green-700"}`}>Investment Highlights</h4>
                  {renderField("Key Buyer Attractions", "story.keyAttractions", false, true, "What makes this business attractive to buyers")}
                </div>
                <div>
                  <h4 className={`font-semibold text-md mb-3 ${isSharedView ? "text-blue-800" : "text-blue-700"}`}>Growth Opportunities</h4>
                  {renderField("Growth Potential", "executiveSummary.growthOpportunities", false, true, "Future growth opportunities")}
                </div>
              </div>

              <div className="border-t pt-4">
                {renderField("Reason for Sale", "story.saleReason", true, false, "Why is the business being sold?")}
              </div>
            </CardContent>
          </Card>
        );

      case 'financials':
        return isSharedView ? (
          <FinancialsSection docId={docId} isSharedView={isSharedView} cimDocument={cimDocument} />
        ) : (
          <OwnerFinancialsSection docId={docId} />
        );

      case 'business-website':
        return websiteUrl ? (
          <Card className={isSharedView ? "bg-white shadow-lg rounded-2xl border-0 mb-8" : ""}>
            <CardHeader className={isSharedView ? "border-b border-gray-100/50 bg-gradient-to-r from-slate-100 to-blue-100/50 px-8 py-6" : ""}>
              <CardTitle className={isSharedView ? "text-2xl font-bold text-slate-800" : ""}>Business Website</CardTitle>
            </CardHeader>
            <CardContent className={isSharedView ? "px-8 pb-8 pt-6" : ""}>
              <div className={`p-6 rounded-lg border-l-4 border-blue-500 ${isSharedView ? "bg-gradient-to-r from-blue-50/50 to-indigo-50/30" : "bg-gray-50"}`}>
                <a 
                  href={websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className={`font-medium ${isSharedView ? "text-blue-700 hover:text-blue-900 text-lg" : "text-blue-600 hover:text-blue-800"}`}
                >
                  {websiteUrl}
                </a>
              </div>
            </CardContent>
          </Card>
        ) : null;

      case 'business-images':
        return selectedImages && selectedImages.length > 0 ? (
          <Card className={isSharedView ? "bg-white shadow-lg rounded-2xl border-0 mb-8" : ""}>
            <CardHeader className={isSharedView ? "border-b border-gray-100/50 bg-gradient-to-r from-slate-100 to-blue-100/50 px-8 py-6" : ""}>
              <CardTitle className={isSharedView ? "text-2xl font-bold text-slate-800" : ""}>Business Images</CardTitle>
            </CardHeader>
            <CardContent className={isSharedView ? "px-8 pb-8 pt-6" : "pt-6"}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {selectedImages.map((imageUrl, index) => (
                  <div 
                    key={index} 
                    className="cursor-pointer transition-all duration-300 group relative"
                    onClick={() => setSelectedImageModal(imageUrl)}
                  >
                    <img 
                      src={imageUrl} 
                      alt={`Business image ${index + 1}`} 
                      className={`w-full object-cover shadow-md transition-all duration-300 ${isSharedView ? "h-64 rounded-[30px] group-hover:shadow-lg group-hover:scale-[1.02]" : "h-48 rounded-[30px] hover:opacity-80"}`}
                      onError={(e) => {
                        console.error('Image failed to load:', imageUrl);
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null;

      case 'business-overview':
        return (
          <Card className={`group ${isSharedView ? "bg-white shadow-lg rounded-2xl border-0 mb-8" : ""}`}>
            <CardHeader className={isSharedView ? "border-b border-gray-100/50 bg-gradient-to-r from-slate-100 to-blue-100/50 px-8 py-6" : ""}>
              <div className="flex items-center justify-between">
                <CardTitle className={isSharedView ? "text-2xl font-bold text-slate-800 flex items-center gap-3" : ""}>
                  {isSharedView && <Building2 className="h-6 w-6 text-blue-600" />}
                  Business Overview & History
                </CardTitle>
                {!isSharedView && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100 hover:text-red-600"
                    onClick={() => setConfirmDeleteSection('business-overview')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className={`space-y-4 ${isSharedView ? "px-8 pb-8 pt-8" : "pt-6"}`}>
              <div className="grid md:grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
                <div>
                  <h4 className="font-semibold text-sm text-gray-600 mb-1">Founded</h4>
                  {renderField("Year Started", "story.yearStarted", false, false, "When was the business founded?")}
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-gray-600 mb-1">Business Structure</h4>
                  {renderField("Legal Structure", "story.businessStructure", false, false, "Legal structure and organization")}
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-gray-600 mb-1">Business Model</h4>
                  {renderField("How It Works", "story.businessModel", true, false, "How does the business operate and make money?")}
                </div>
              </div>
              
              {renderField("Origin Story", "story.businessIdea", true, false, "How did the business idea come about?")}
              {renderField("Growth Journey", "story.growthHistory", true, false, "How has the business grown over time?")}
              {renderField("Order Process", "story.orderProcess", true, false, "Step-by-step process from order to completion")}
            </CardContent>
          </Card>
        );

      case 'market-position':
        return (
          <Card className={`group ${isSharedView ? "bg-white shadow-lg rounded-2xl border-0 mb-8" : ""}`}>
            <CardHeader className={isSharedView ? "border-b border-gray-100/50 bg-gradient-to-r from-slate-100 to-blue-100/50 px-8 py-6" : ""}>
              <div className="flex items-center justify-between">
                <CardTitle className={isSharedView ? "text-2xl font-bold text-slate-800 flex items-center gap-3" : ""}>
                  {isSharedView && <Target className="h-6 w-6 text-green-600" />}
                  Market Position
                </CardTitle>
                {!isSharedView && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100 hover:text-red-600"
                    onClick={() => setConfirmDeleteSection('market-position')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className={`space-y-4 ${isSharedView ? "px-8 pb-8 pt-8" : "pt-6"}`}>
              {renderField("Competitive Advantages", "marketAnalysis.uniqueFeatures", false, true, "What sets this business apart")}
              {renderField("Market Strengths", "marketAnalysis.strengths", false, true, "Key business strengths")}
              {renderField("Target Customers", "marketAnalysis.customerProfile", true, false, "Who are the customers")}
              {renderField("Main Competitors", "marketAnalysis.competitors", false, true, "Key competitors in the market")}
            </CardContent>
          </Card>
        );

      case 'sales-marketing':
        return (
          <Card className={`group ${isSharedView ? "bg-white shadow-lg rounded-2xl border-0 mb-8" : ""}`}>
            <CardHeader className={isSharedView ? "border-b border-gray-100/50 bg-gradient-to-r from-slate-100 to-blue-100/50 px-8 py-6" : ""}>
              <div className="flex items-center justify-between">
                <CardTitle className={isSharedView ? "text-2xl font-bold text-slate-800 flex items-center gap-3" : ""}>
                  {isSharedView && <Megaphone className="h-6 w-6 text-purple-600" />}
                  Sales & Marketing
                </CardTitle>
                {!isSharedView && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100 hover:text-red-600"
                    onClick={() => setConfirmDeleteSection('sales-marketing')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className={`space-y-4 ${isSharedView ? "px-8 pb-8 pt-8" : "pt-6"}`}>
              {renderField("Marketing Strategies", "marketing.strategies", false, true, "How the business attracts customers")}
              {renderField("Paid Advertising", "marketing.paidAdvertising.channels", false, true, "Advertising channels used")}
              {renderField("Email Marketing", "marketing.emailMarketing.usage", true, false, "Email marketing strategy")}
              {renderField("SEO Efforts", "marketing.seoEfforts", true, false, "Search engine optimization activities")}
              {renderField("Average Order Value", "sales.averageOrderValue", false, false, "Average transaction size")}
              {renderField("Payment Methods", "sales.paymentMethods", false, true, "Accepted payment methods")}
            </CardContent>
          </Card>
        );

      case 'operations':
        return (
          <Card className={`group ${isSharedView ? "bg-white shadow-lg rounded-2xl border-0 mb-8" : ""}`}>
            <CardHeader className={isSharedView ? "border-b border-gray-100/50 bg-gradient-to-r from-slate-100 to-blue-100/50 px-8 py-6" : ""}>
              <div className="flex items-center justify-between">
                <CardTitle className={isSharedView ? "text-2xl font-bold text-slate-800 flex items-center gap-3" : ""}>
                  {isSharedView && <Settings className="h-6 w-6 text-orange-600" />}
                  Operations
                </CardTitle>
                {!isSharedView && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100 hover:text-red-600"
                    onClick={() => setConfirmDeleteSection('operations')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className={`space-y-4 ${isSharedView ? "px-8 pb-8 pt-8" : "pt-6"}`}>
              {renderField("Supplier Information", "operations.suppliers.count", true, false, "Key supplier relationships")}
              {renderField("Customer Relationships", "operations.customers.relationships", true, false, "Customer relationship management")}
              {renderField("Operational Processes", "story.orderProcess", true, false, "Key operational workflows")}
            </CardContent>
          </Card>
        );

      case 'inventory':
        const content = getMergedContent();
        const inventory = content?.inventory || {};
        const hasInventoryContent = inventory.leadTime !== "not applicable" ||
                                  inventory.sourcing !== "not applicable" ||
                                  inventory.value !== "not applicable" ||
                                  inventory.skuCount !== "not applicable" ||
                                  (inventory.topProducts && inventory.topProducts.length > 0 && 
                                   !inventory.topProducts.every((item: string) => item === "not applicable"));
        
        return hasInventoryContent ? (
          <Card className={`group ${isSharedView ? "bg-white shadow-lg rounded-2xl border-0 mb-8" : ""}`}>
            <CardHeader className={isSharedView ? "border-b border-gray-100/50 bg-gradient-to-r from-slate-100 to-blue-100/50 px-8 py-6" : ""}>
              <div className="flex items-center justify-between">
                <CardTitle className={isSharedView ? "text-2xl font-bold text-slate-800" : ""}>Products & Inventory Management</CardTitle>
                {!isSharedView && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100 hover:text-red-600"
                    onClick={() => setConfirmDeleteSection('inventory')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className={`space-y-4 ${isSharedView ? "px-8 pb-8 pt-8" : "pt-6"}`}>
              {renderField("Lead Times", "inventory.leadTime", false, false, "Inventory lead times")}
              {renderField("Storage & Sourcing", "inventory.sourcing", true, false, "How inventory is sourced and stored")}
              {renderField("Inventory Value", "inventory.value", false, false, "Current inventory value")}
              {renderField("Product Count", "inventory.skuCount", false, false, "Number of SKUs/products")}
              {renderField("Top Products", "inventory.topProducts", false, true, "Best-selling products")}
            </CardContent>
          </Card>
        ) : null;

      case 'team':
        return (
          <Card className={`group ${isSharedView ? "bg-white shadow-lg rounded-2xl border-0 mb-8" : ""}`}>
            <CardHeader className={isSharedView ? "border-b border-gray-100/50 bg-gradient-to-r from-slate-100 to-blue-100/50 px-8 py-6" : ""}>
              <div className="flex items-center justify-between">
                <CardTitle className={isSharedView ? "text-2xl font-bold text-slate-800" : ""}>Team & Management</CardTitle>
                {!isSharedView && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100 hover:text-red-600"
                    onClick={() => setConfirmDeleteSection('team')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className={`space-y-4 ${isSharedView ? "px-8 pb-8 pt-8" : "pt-6"}`}>
              {renderField("Owner Responsibilities", "team.ownerResponsibilities", true, false, "What the owner currently handles")}
              {renderField("Owner Hours", "team.ownerHours", false, false, "Hours per week owner works")}
              {renderField("Employee Summary", "team.employeeSummary", true, false, "Overview of team structure")}
              {renderField("Employee Count", "team.employeeCount", false, false, "Total number of employees")}
              {renderField("Key Staff", "team.keyEmployees", false, true, "Critical team members")}
            </CardContent>
          </Card>
        );

      case 'facilities':
        return (
          <Card className={`group ${isSharedView ? "bg-white shadow-lg rounded-2xl border-0 mb-8" : ""}`}>
            <CardHeader className={isSharedView ? "border-b border-gray-100/50 bg-gradient-to-r from-slate-100 to-blue-100/50 px-8 py-6" : ""}>
              <div className="flex items-center justify-between">
                <CardTitle className={isSharedView ? "text-2xl font-bold text-slate-800" : ""}>Facilities & Location</CardTitle>
                {!isSharedView && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100 hover:text-red-600"
                    onClick={() => setConfirmDeleteSection('facilities')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className={`space-y-4 ${isSharedView ? "px-8 pb-8 pt-8" : "pt-6"}`}>
              {renderField("Location", "assets.location", false, false, "Business location")}
              {renderField("Facility Ownership", "facility.ownership", false, false, "Owned or leased")}
              {renderField("Facility Size", "facility.size", false, false, "Square footage or size description")}
              {renderField("Occupancy Cost", "facility.cost", false, false, "Monthly rent or ownership costs")}
              {renderField("Lease Terms", "facility.leaseDetails", true, false, "Lease terms and conditions")}
            </CardContent>
          </Card>
        );

      case 'assets-ownership':
        return (
          <Card className={`group ${isSharedView ? "bg-white shadow-lg rounded-2xl border-0 mb-8" : ""}`}>
            <CardHeader className={isSharedView ? "border-b border-gray-100/50 bg-gradient-to-r from-slate-100 to-blue-100/50 px-8 py-6" : ""}>
              <div className="flex items-center justify-between">
                <CardTitle className={isSharedView ? "text-2xl font-bold text-slate-800" : ""}>Assets & Ownership</CardTitle>
                {!isSharedView && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100 hover:text-red-600"
                    onClick={() => setConfirmDeleteSection('assets-ownership')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className={`space-y-4 ${isSharedView ? "px-8 pb-8" : ""}`}>
              {renderField("Digital Assets", "assets.digitalAssets", false, true, "Websites, social media, digital properties")}
              {renderField("Equipment Value", "assets.equipmentValue", false, false, "Value of equipment and assets")}
              {renderField("Equipment Details", "assets.equipmentDetails", true, false, "Description of key equipment")}
              {renderField("Intellectual Property", "ownership.intellectualProperty", false, true, "Trademarks, patents, copyrights")}
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  const isOwner = user?.id === cimDocument?.userId;

  return (
    <div className="space-y-6">
      {/* Only show export button portal in shared view */}
      {isSharedView && exportButtonPortal}

      {/* Collaboration Banner - Hidden in shared view */}
      {!isSharedView && docId && user && (
        <CollaborationBanner 
          docId={docId} 
          isOwner={isOwner}
          onEditingStatusChange={setCanEdit}
          shareToken={cimDocument?.shareToken}
          shareEnabled={cimDocument?.shareEnabled}
          title={title}
          analysis={analysis}
          websiteUrl={websiteUrl}
          logoUrl={logoUrl}
          selectedImages={selectedImages}
          autoTriggerShare={autoTriggerShare}
          onShareTriggered={onShareTriggered}
        />
      )}

      {/* Save Changes Bar - Hidden in shared view */}
      {!isSharedView && hasUnsavedChanges && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium">You have unsaved changes</span>
              </div>
              <Button 
                onClick={() => saveAllChangesMutation.mutate()}
                disabled={saveAllChangesMutation.isPending}
                className="flex items-center gap-2"
              >
                {saveAllChangesMutation.isPending ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {saveAllChangesMutation.isPending ? "Saving..." : "Save All Changes"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Title and Logo Header - White card in shared view */}
      {isSharedView ? (
        <Card className="mb-8 bg-white rounded-2xl border-0 shadow-none">
          <CardHeader className="px-8 py-8">
            <div className="flex flex-col items-center gap-6">
              {logoUrl && (
                <div className="mx-auto flex justify-center">
                  <img 
                    src={logoUrl} 
                    alt="Company Logo" 
                    className="h-40 w-40 object-contain rounded-2xl"
                    onError={(e) => {
                      console.error('Logo failed to load:', logoUrl);
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>
          </CardHeader>
        </Card>
      ) : !cimDocument?.isUploadedFile ? (
        <Card className="mb-8 border shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex flex-col items-center gap-6 flex-1">
                <div className="text-center space-y-4">
                  <CardTitle className="text-2xl text-center">{title || "Confidential Information Memorandum"}</CardTitle>
                  
                  {logoUrl && (
                    <div className="mx-auto flex justify-center">
                      <img 
                        src={logoUrl} 
                        alt="Company Logo" 
                        className="h-20 w-20 object-contain rounded-[30px]"
                        onError={(e) => {
                          console.error('Logo failed to load:', logoUrl);
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>

            </div>
          </CardHeader>
        </Card>
      ) : null}

      {/* Conditional Content: File Management for Uploaded CIMs or Template Sections for Generated CIMs */}
      {cimDocument?.isUploadedFile ? (
        <UploadedCimFileManager 
          docId={docId}
          cimTitle={title || "Uploaded CIM Document"}
        />
      ) : (
        <>
          {/* Main Sections with Drag and Drop */}
          <DndContext
            sensors={mainSectionSensors}
            collisionDetection={closestCenter}
            onDragEnd={handleMainSectionDragEnd}
          >
            <SortableContext items={sectionOrder} strategy={verticalListSortingStrategy}>
              {sectionOrder.map((sectionId) => {
                // Show deleted sections as restore options (only in edit mode)
                if (deletedSections.has(sectionId)) {
                  return !isSharedView ? (
                    <Card key={sectionId} className="border-dashed border-2 border-gray-300 bg-gray-50">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-gray-600">
                            <span className="text-sm">
                              {sectionId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} section deleted
                            </span>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRestoreSection(sectionId)}
                            className="text-blue-600 border-blue-300 hover:bg-blue-50"
                          >
                            Restore Section
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ) : null;
                }

                const content = getSectionContent(sectionId);
                if (!content) return null;
                
                const sectionWithInsertables = renderSectionWithInsertables(sectionId, content);
                
                return (
                  <div key={sectionId}>
                    {renderSectionWithDragHandle(sectionId, sectionWithInsertables)}
                  </div>
                );
              })}
            </SortableContext>
          </DndContext>
        </>
      )}









      {/* Add Custom Section - Only shown in edit mode for generated CIMs */}
      {!isSharedView && !cimDocument?.isUploadedFile && (
        <AddCustomSection 
          docId={docId}
          onSectionAdded={handleSectionAdded}
        />
      )}

      {/* Ask the Broker Form - Only shown in shared view */}
      {isSharedView && (
        <BrokerContactForm 
          shareSlug={window.location.pathname.split('/').pop() || ''}
          cimTitle={title || "Confidential Information Memorandum"}
          userProfile={userProfile}
        />
      )}

      {/* Contact Information Footer - Only for generated CIMs */}
      {!cimDocument?.isUploadedFile && (
        <Card className={isSharedView ? "bg-white shadow-lg rounded-2xl border-0 mb-8 mt-8" : "mt-8 border-blue-200"}>
          <CardHeader className={isSharedView ? "border-b border-gray-100/50 bg-gradient-to-r from-slate-100 to-blue-100/50 px-8 py-6" : "bg-blue-50"}>
            <CardTitle className={isSharedView ? "text-2xl font-bold text-slate-800" : "text-xl text-blue-900"}>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className={`${isSharedView ? "px-8 pb-8 pt-8" : "pt-6"}`}>
            <div className="flex flex-col md:flex-row items-center gap-6">
              {(user?.profilePhoto || userProfile?.profilePhoto) && (
                <img 
                  src={user?.profilePhoto || userProfile?.profilePhoto} 
                  alt="Profile" 
                  className={isSharedView ? "w-48 h-48 object-cover rounded-[30px]" : "w-40 h-40 object-cover rounded-[30px]"}
                />
              )}
              <div className="text-center md:text-left">
                <h3 className="text-lg font-semibold">{user?.name || userProfile?.name || user?.email || userProfile?.email || 'Contact Information'}</h3>
                {(user?.title || userProfile?.title) && <p className="text-sm text-gray-600">{user?.title || userProfile?.title}</p>}
                {(user?.businessName || userProfile?.businessName) && <p className="text-sm font-medium">{user?.businessName || userProfile?.businessName}</p>}
                {(user?.phoneNumber || userProfile?.phoneNumber) && <p className="text-sm text-gray-600">{user?.phoneNumber || userProfile?.phoneNumber}</p>}
                {(user?.email || userProfile?.email) && <p className="text-sm text-gray-600">{user?.email || userProfile?.email}</p>}
                {!user?.email && !userProfile?.email && isSharedView && <p className="text-sm text-gray-600">For more information, please contact the document owner.</p>}
              </div>
              {(user?.businessLogo || userProfile?.businessLogo) && (
                <img 
                  src={user?.businessLogo || userProfile?.businessLogo} 
                  alt="Business Logo" 
                  className={isSharedView ? "w-64 h-64 object-contain rounded-[30px] ml-auto" : "w-48 h-48 object-contain rounded-[30px] ml-auto"}
                />
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Image Modal */}
      <Dialog open={!!selectedImageModal} onOpenChange={() => setSelectedImageModal(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Business Image</DialogTitle>
          </DialogHeader>
          {selectedImageModal && (
            <div className="flex justify-center">
              <img 
                src={selectedImageModal} 
                alt="Business image enlarged"
                className="max-w-full max-h-[70vh] object-contain rounded-[30px]"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Section Delete Confirmation Dialog */}
      <Dialog open={!!confirmDeleteSection} onOpenChange={(open) => !open && setConfirmDeleteSection(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Section</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-600">
              Are you sure you want to delete the <strong>{confirmDeleteSection?.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</strong> section? 
              This action cannot be undone, but you can restore the section before saving.
            </p>
          </div>
          <div className="flex justify-end space-x-2">
            <Button 
              variant="outline" 
              onClick={() => setConfirmDeleteSection(null)}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => confirmDeleteSection && handleDeleteSection(confirmDeleteSection)}
            >
              Delete Section
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}