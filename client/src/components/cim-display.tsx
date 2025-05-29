import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InlineEditor } from "./inline-editor";
import { InsertableSection, CustomSection } from "./insertable-section";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Save, Download } from "lucide-react";
import { DocumentExport } from "./document-export";
import { useAuth } from "@/hooks/use-auth";
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
} from '@dnd-kit/sortable';

interface CimDisplayProps {
  analysis: any;
  docId: number;
  websiteUrl?: string;
  logoUrl?: string;
  selectedImages?: string[];
}

export function CimDisplay({ analysis, docId, websiteUrl, logoUrl, selectedImages }: CimDisplayProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState<any>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Fetch custom sections
  const { data: customSections = [], refetch: refetchSections } = useQuery({
    queryKey: [`/api/cim/${docId}/custom-sections`],
    enabled: !!docId,
  });

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

  const handleSectionDelete = (sectionId: number) => {
    refetchSections();
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
      const oldIndex = customSections.findIndex((item: any) => item.id === active.id);
      const newIndex = customSections.findIndex((item: any) => item.id === over.id);
      
      const reorderedSections = arrayMove(customSections, oldIndex, newIndex);
      
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
    return customSections.filter((section: any) => section.insertAfterSection === sectionName);
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
        
        {/* Show insertable zone if user is authenticated */}
        {user && (
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
    
    return mergeDeep(JSON.parse(JSON.stringify(analysis)), editedContent);
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
  ) => (
    <div className="space-y-2">
      <h4 className="font-semibold text-sm text-gray-700">{title}</h4>
      <InlineEditor
        value={getCurrentValue(path)}
        fieldPath={path}
        isEditing={editingField === path}
        onEdit={handleEdit}
        onSave={handleSave}
        onCancel={handleCancel}
        multiline={multiline}
        isArray={isArray}
        placeholder={placeholder}
      />
    </div>
  );

  const mergedAnalysis = getMergedContent();

  return (
    <div className="space-y-6">
      {/* Save Changes Bar */}
      {hasUnsavedChanges && (
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
                <Save className="h-4 w-4" />
                Save All Changes
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Export Options */}
      <DocumentExport 
        analysis={mergedAnalysis}
        docId={docId}
        websiteUrl={websiteUrl}
        logoUrl={logoUrl}
        selectedImages={selectedImages}
        user={user}
      />

      {/* Business Summary */}
      {renderSectionWithInsertables("business-summary", 
        <Card>
          <CardHeader>
            <CardTitle>Business Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {renderField("Business Summary", "story.businessSummary", true, false, "Comprehensive business overview...")}
            {renderField("Key Attractions", "story.keyAttractions", false, true, "What makes this business attractive to buyers")}
            {renderField("Reason for Sale", "story.saleReason", true, false, "Why is the business being sold?")}
          </CardContent>
        </Card>
      )}

      {/* Business Images */}
      {selectedImages && selectedImages.length > 0 && renderSectionWithInsertables("business-images",
        <Card>
          <CardHeader>
            <CardTitle>Business Images</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {selectedImages.map((imageUrl, index) => (
                <div key={index} className="flex justify-center">
                  <img 
                    src={imageUrl} 
                    alt={`Business image ${index + 1}`} 
                    className="max-w-full h-auto shadow-md"
                    style={{ borderRadius: '30px' }}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Business Story */}
      {renderSectionWithInsertables("business-story",
        <Card>
          <CardHeader>
            <CardTitle>The Business Story</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {renderField("Year Started", "story.yearStarted", false, false, "When was the business founded?")}
            {renderField("Business Idea", "story.businessIdea", true, false, "How did the business idea come about?")}
            {renderField("Business Model", "story.businessModel", true, false, "How does the business operate and make money?")}
            {renderField("Order Process", "story.orderProcess", true, false, "Step-by-step process from order to completion")}
            {renderField("Growth History", "story.growthHistory", true, false, "How has the business grown over time?")}
            {renderField("Business Structure", "story.businessStructure", true, false, "Legal structure and organization")}
          </CardContent>
        </Card>
      )}

      {/* Market Analysis */}
      {renderSectionWithInsertables("market-analysis",
        <Card>
          <CardHeader>
            <CardTitle>Market Position</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {renderField("Unique Features", "marketAnalysis.uniqueFeatures", false, true, "What sets this business apart")}
            {renderField("Customer Profile", "marketAnalysis.customerProfile", true, false, "Describe the typical customer")}
            {renderField("Competitors", "marketAnalysis.competitors", false, true, "Key competitors in the market")}
            {renderField("Competitive Strengths", "marketAnalysis.strengths", false, true, "Advantages over competitors")}
          </CardContent>
        </Card>
      )}

      {/* Operations */}
      <Card>
        <CardHeader>
          <CardTitle>Operations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="font-semibold">Suppliers</h3>
              {renderField("Supplier Count", "operations.suppliers.count", false, false, "Number of suppliers")}
              {renderField("Transferability", "operations.suppliers.transferability", true, false, "How easily can suppliers transfer to new owner?")}
              {renderField("Concentration Risk", "operations.suppliers.concentration", true, false, "Dependency on key suppliers")}
              {renderField("Payment Terms", "operations.suppliers.terms", true, false, "Standard payment terms with suppliers")}
            </div>
            
            <div className="space-y-4">
              <h3 className="font-semibold">Customers</h3>
              {renderField("Recurring Business", "operations.customers.recurring", true, false, "Percentage of repeat customers")}
              {renderField("Customer Relationships", "operations.customers.relationships", true, false, "How are customer relationships maintained?")}
              {renderField("Customer Concentration", "operations.customers.concentration", true, false, "Dependency on key customers")}
              {renderField("Contracts", "operations.customers.contracts", true, false, "Types of customer contracts")}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Team Structure */}
      <Card>
        <CardHeader>
          <CardTitle>Team & Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {renderField("Owner Responsibilities", "team.ownerResponsibilities", true, false, "What does the owner currently do?")}
          {renderField("Owner Hours", "team.ownerHours", false, false, "How many hours per week does owner work?")}
          {renderField("Employee Summary", "team.employeeSummary", true, false, "Overview of all employees and their roles")}
          {renderField("Employee Count", "team.employeeCount", false, false, "Total number of employees")}
          {renderField("Key Employees", "team.keyEmployees", false, true, "Critical team members and their roles")}
          {renderField("Turnover Rate", "team.turnover", true, false, "Employee retention and turnover")}
        </CardContent>
      </Card>

      {/* Inventory */}
      <Card>
        <CardHeader>
          <CardTitle>Inventory & Products</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {renderField("Lead Time", "inventory.leadTime", false, false, "How long to restock inventory?")}
          {renderField("Sourcing", "inventory.sourcing", true, false, "Where and how is inventory sourced?")}
          {renderField("Storage", "inventory.storage", true, false, "How and where is inventory stored?")}
          {renderField("Inventory Value", "inventory.value", false, false, "Total value of current inventory")}
          {renderField("SKU Count", "inventory.skuCount", false, false, "Number of different products/SKUs")}
          {renderField("Top Products", "inventory.topProducts", false, true, "Best-selling products or services")}
        </CardContent>
      </Card>

      {/* Sales & Marketing */}
      <Card>
        <CardHeader>
          <CardTitle>Sales & Marketing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {renderField("Seasonality", "sales.seasonality", true, false, "How do sales vary throughout the year?")}
          {renderField("Average Order Value", "sales.averageOrderValue", false, false, "Typical transaction size")}
          {renderField("Pricing Model", "sales.pricingModel", true, false, "How are products/services priced?")}
          {renderField("Payment Methods", "sales.paymentMethods", false, true, "How do customers pay?")}
          {renderField("Marketing Strategies", "marketing.strategies", false, true, "Current marketing approaches")}
          {renderField("Client Acquisition", "marketing.clientAcquisition", true, false, "How are new customers found?")}
        </CardContent>
      </Card>

      {/* Facilities */}
      <Card>
        <CardHeader>
          <CardTitle>Facilities</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {renderField("Ownership Status", "facility.ownership", false, false, "Owned or leased?")}
          {renderField("Size", "facility.size", false, false, "Square footage or size description")}
          {renderField("Cost", "facility.cost", false, false, "Monthly rent or ownership costs")}
          {renderField("Lease Details", "facility.leaseDetails", true, false, "Lease terms and conditions")}
        </CardContent>
      </Card>

      {/* Assets & Ownership */}
      <Card>
        <CardHeader>
          <CardTitle>Assets & Ownership</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {renderField("Digital Assets", "assets.digitalAssets", false, true, "Websites, social media, digital properties")}
          {renderField("Equipment Value", "assets.equipmentValue", false, false, "Value of equipment and assets")}
          {renderField("Equipment Details", "assets.equipmentDetails", true, false, "Description of key equipment")}
          {renderField("Intellectual Property", "ownership.intellectualProperty", false, true, "Trademarks, patents, copyrights")}
        </CardContent>
      </Card>
    </div>
  );
}