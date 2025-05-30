import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InlineEditor } from "./inline-editor";
import { InsertableSection, CustomSection } from "./insertable-section";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Save, Download, X } from "lucide-react";
import { DocumentExport } from "./document-export";
import { BrokerContactForm } from "./broker-contact-form";
import { useAuth } from "@/hooks/use-auth";
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
} from '@dnd-kit/sortable';

interface CimDisplayProps {
  analysis: any;
  docId: number;
  websiteUrl?: string;
  logoUrl?: string;
  selectedImages?: string[];
  title?: string;
  isSharedView?: boolean;
  userProfile?: any;
}

export function CimDisplay({ analysis, docId, websiteUrl, logoUrl, selectedImages, title, isSharedView, userProfile }: CimDisplayProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState<any>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [selectedImageModal, setSelectedImageModal] = useState<string | null>(null);

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
        isEditing={!isSharedView && editingField === path}
        onEdit={isSharedView ? () => {} : handleEdit}
        onSave={handleSave}
        onCancel={handleCancel}
        multiline={multiline}
        isArray={isArray}
        placeholder={placeholder}
        readOnly={isSharedView}
      />
    </div>
  );

  const mergedAnalysis = getMergedContent();

  return (
    <div className="space-y-6">
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

      {/* Title and Logo Header */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {logoUrl && (
                <>
                  {(() => {
                    console.log('Logo Debug:', { logoUrl, isSharedView });
                    return null;
                  })()}
                  <img 
                    src={logoUrl} 
                    alt="Company Logo" 
                    className={isSharedView ? "h-24 w-24 object-contain rounded-[30px]" : "h-16 w-16 object-contain rounded-[30px]"}
                    onError={(e) => {
                      console.error('Logo failed to load:', logoUrl);
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                </>
              )}
              <div>
                <CardTitle className="text-2xl">{title || "Confidential Information Memorandum"}</CardTitle>
              </div>
            </div>
            {(user || isSharedView) && (
              <DocumentExport 
                analysis={mergedAnalysis}
                docId={docId}
                websiteUrl={websiteUrl}
                logoUrl={logoUrl}
                selectedImages={selectedImages}
                user={user || userProfile}
                isSharedView={isSharedView}
              />
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Executive Summary - Lead Section */}
      {renderSectionWithInsertables("executive-summary", 
        <Card className="border-blue-200">
          <CardHeader className="bg-blue-50">
            <CardTitle className="text-xl text-blue-900">Executive Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="text-lg leading-relaxed">
              {renderField("Business Overview", "story.businessSummary", true, false, "Comprehensive business overview and description...")}
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-md mb-3 text-green-700">Investment Highlights</h4>
                {renderField("Key Buyer Attractions", "story.keyAttractions", false, true, "What makes this business attractive to buyers")}
              </div>
              <div>
                <h4 className="font-semibold text-md mb-3 text-blue-700">Growth Opportunities</h4>
                {renderField("Growth Potential", "executiveSummary.growthOpportunities", false, true, "Future growth opportunities")}
              </div>
            </div>

            <div className="border-t pt-4">
              {renderField("Reason for Sale", "story.saleReason", true, false, "Why is the business being sold?")}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Business Website */}
      {websiteUrl && renderSectionWithInsertables("business-website",
        <Card>
          <CardHeader>
            <CardTitle>Business Website</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-4 bg-gray-50 rounded-lg border-l-4 border-blue-500">
              <a 
                href={websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                {websiteUrl}
              </a>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Business Images */}
      {(() => {
        console.log('Business Images Debug:', {
          selectedImages,
          hasImages: selectedImages && selectedImages.length > 0,
          isSharedView,
          imageCount: selectedImages?.length
        });
        return null;
      })()}
      {selectedImages && selectedImages.length > 0 && renderSectionWithInsertables("business-images",
        <Card>
          <CardHeader>
            <CardTitle>Business Gallery</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {selectedImages.map((imageUrl, index) => (
                <div 
                  key={index} 
                  className="cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => setSelectedImageModal(imageUrl)}
                >
                  <img 
                    src={imageUrl} 
                    alt={`Business image ${index + 1}`} 
                    className={isSharedView ? "w-full h-64 object-cover rounded-[30px] shadow-md" : "w-full h-48 object-cover rounded-[30px] shadow-md"}
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
      )}

      {/* Business Overview & History */}
      {renderSectionWithInsertables("business-overview",
        <Card>
          <CardHeader>
            <CardTitle>Business Overview & History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
      )}

      {/* Market Position */}
      {renderSectionWithInsertables("market-position",
        <Card>
          <CardHeader>
            <CardTitle>Market Position & Competitive Advantage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {renderField("Target Customer Profile", "marketAnalysis.customerProfile", true, false, "Who are the ideal customers?")}
            {renderField("Unique Value Proposition", "marketAnalysis.uniqueFeatures", false, true, "What sets this business apart from competitors")}
            {renderField("Competitive Advantages", "marketAnalysis.strengths", false, true, "Key strengths over competitors")}
            {renderField("Main Competitors", "marketAnalysis.competitors", false, true, "Who are the primary competitors?")}
          </CardContent>
        </Card>
      )}

      {/* Sales & Revenue */}
      {renderSectionWithInsertables("sales-revenue",
        <Card>
          <CardHeader>
            <CardTitle>Sales & Revenue Model</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-md mb-3">Revenue Metrics</h4>
                {renderField("Average Order Value", "sales.averageOrderValue", false, false, "Typical transaction size")}
                {renderField("Revenue Seasonality", "sales.seasonality", true, false, "How do sales vary throughout the year?")}
              </div>
              <div>
                <h4 className="font-semibold text-md mb-3">Sales Process</h4>
                {renderField("Pricing Strategy", "sales.pricingModel", true, false, "How are products/services priced?")}
                {renderField("Payment Methods", "sales.paymentMethods", false, true, "How do customers pay?")}
              </div>
            </div>
            
            <div className="border-t pt-4">
              <h4 className="font-semibold text-md mb-3">Customer Acquisition</h4>
              {renderField("Marketing Strategies", "marketing.strategies", false, true, "Current marketing approaches")}
              {renderField("Client Acquisition Process", "marketing.clientAcquisition", true, false, "How are new customers found and converted?")}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Operations & Relationships */}
      {renderSectionWithInsertables("operations",
        <Card>
          <CardHeader>
            <CardTitle>Operations & Key Relationships</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-semibold text-md mb-3">Customer Base</h4>
                {renderField("Customer Retention", "operations.customers.recurring", true, false, "Percentage of repeat customers and retention rate")}
                {renderField("Customer Relationships", "operations.customers.relationships", true, false, "How are customer relationships maintained?")}
                {renderField("Customer Concentration", "operations.customers.concentration", true, false, "Revenue dependency on key customers")}
                {renderField("Contract Structure", "operations.customers.contracts", true, false, "Types of customer contracts and terms")}
              </div>
              
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-semibold text-md mb-3">Supply Chain</h4>
                {renderField("Supplier Network", "operations.suppliers.count", false, false, "Number and types of suppliers")}
                {renderField("Supplier Relationships", "operations.suppliers.transferability", true, false, "How easily can suppliers transfer to new owner?")}
                {renderField("Supply Chain Risk", "operations.suppliers.concentration", true, false, "Dependency on key suppliers")}
                {renderField("Payment Terms", "operations.suppliers.terms", true, false, "Standard payment terms with suppliers")}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Team & Management */}
      {renderSectionWithInsertables("team-management",
        <Card>
          <CardHeader>
            <CardTitle>Team Structure & Management</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg mb-4">
              <h4 className="font-semibold text-md mb-3">Owner Involvement</h4>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  {renderField("Owner Role & Responsibilities", "team.ownerResponsibilities", true, false, "What does the owner currently do?")}
                </div>
                <div>
                  {renderField("Time Commitment", "team.ownerHours", false, false, "Hours per week owner works")}
                </div>
              </div>
            </div>
            
            {renderField("Team Overview", "team.employeeSummary", true, false, "Overview of all employees and their roles")}
            
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                {renderField("Total Employees", "team.employeeCount", false, false, "Total number of employees")}
              </div>
              <div>
                {renderField("Staff Retention", "team.turnover", true, false, "Employee retention and turnover patterns")}
              </div>
            </div>
            
            {renderField("Key Personnel", "team.keyEmployees", false, true, "Critical team members and their roles")}
          </CardContent>
        </Card>
      )}

      {/* Products & Inventory */}
      {renderSectionWithInsertables("products-inventory",
        <Card>
          <CardHeader>
            <CardTitle>Products & Inventory Management</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-md mb-3 text-indigo-700">Product Portfolio</h4>
                {renderField("Best-Selling Products", "inventory.topProducts", false, true, "Top products or services")}
                {renderField("Product Range", "inventory.skuCount", false, false, "Number of different products/SKUs")}
              </div>
              <div>
                <h4 className="font-semibold text-md mb-3 text-teal-700">Inventory Operations</h4>
                {renderField("Current Inventory Value", "inventory.value", false, false, "Total value of current inventory")}
                {renderField("Restocking Lead Time", "inventory.leadTime", false, false, "How long to restock inventory?")}
              </div>
            </div>
            
            {renderField("Sourcing Strategy", "inventory.sourcing", true, false, "Where and how is inventory sourced?")}
            {renderField("Storage & Logistics", "inventory.storage", true, false, "How and where is inventory stored and managed?")}
          </CardContent>
        </Card>
      )}

      {/* Assets & Infrastructure */}
      {renderSectionWithInsertables("assets-infrastructure",
        <Card>
          <CardHeader>
            <CardTitle>Assets & Infrastructure</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-semibold text-md mb-3 text-gray-700">Facilities</h4>
                {renderField("Property Status", "facility.ownership", false, false, "Owned or leased?")}
                {renderField("Facility Size", "facility.size", false, false, "Square footage or size description")}
                {renderField("Occupancy Cost", "facility.cost", false, false, "Monthly rent or ownership costs")}
                {renderField("Lease Terms", "facility.leaseDetails", true, false, "Lease terms and conditions")}
              </div>
              
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-semibold text-md mb-3 text-gray-700">Equipment & Digital Assets</h4>
                {renderField("Equipment Value", "assets.equipmentValue", false, false, "Value of equipment and machinery")}
                {renderField("Digital Properties", "assets.digitalAssets", false, true, "Websites, social media, digital assets")}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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

      {/* Ask the Broker Form - Only shown in shared view */}
      {isSharedView && (
        <BrokerContactForm 
          shareSlug={window.location.pathname.split('/').pop() || ''}
          cimTitle={title || "Confidential Information Memorandum"}
        />
      )}

      {/* Contact Information Footer */}
      <Card className="mt-8 border-t-2">
        <CardContent className="pt-6">
          <hr className="mb-6 border-gray-300" />
          <h3 className="text-lg font-semibold mb-4">Contact Information</h3>
          <div className="flex flex-col md:flex-row items-center gap-6">
            {(user?.profilePhoto || userProfile?.profilePhoto) && (
              <img 
                src={user?.profilePhoto || userProfile?.profilePhoto} 
                alt="Profile" 
                className={isSharedView ? "w-32 h-32 object-cover rounded-[30px]" : "w-16 h-16 object-cover rounded-[30px]"}
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
                className={isSharedView ? "w-36 h-36 object-contain rounded-[30px] ml-auto" : "w-24 h-24 object-contain rounded-[30px] ml-auto"}
              />
            )}
          </div>
        </CardContent>
      </Card>

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
    </div>
  );
}