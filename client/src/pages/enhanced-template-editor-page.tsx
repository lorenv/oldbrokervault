import { useParams, useLocation } from "wouter";
import { EnhancedNdaTemplateEditor } from "@/components/esignature/enhanced-nda-template-editor";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

export default function EnhancedTemplateEditorPage() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Check if we're editing an existing template
  const isEditingTemplate = !!id;
  
  // Fetch template data if editing
  const { data: template, isLoading: templateLoading } = useQuery({
    queryKey: ['/api/nda-templates', id],
    queryFn: async () => {
      if (!id) return null;
      const response = await apiRequest('GET', `/api/nda-templates/${id}`);
      return response.json();
    },
    enabled: isEditingTemplate
  });

  const handleSave = async (data: {
    name: string;
    fileContent: string;
    signatureFields: any[];
    recipients?: any[];
    totalPages?: number;
    pageImages?: any[];
  }) => {
    
    try {
      if (isEditingTemplate && id) {
        // Update existing template
        await apiRequest('PUT', `/api/nda-templates/${id}`, {
          body: {
            name: data.name,
            fileContent: data.fileContent,
            signatureFields: data.signatureFields,
            recipients: data.recipients || [],
            totalPages: data.totalPages,
            pageImages: data.pageImages
          }
        });

        toast({
          title: "Template updated",
          description: "NDA template has been updated successfully"
        });
      } else {
        // Create new template
        await apiRequest('POST', '/api/nda-templates', {
          body: {
            name: data.name,
            fileContent: data.fileContent,
            signatureFields: data.signatureFields,
            recipients: data.recipients || [],
            totalPages: data.totalPages,
            pageImages: data.pageImages
          }
        });

        toast({
          title: "Template saved",
          description: "NDA template has been saved successfully"
        });
      }

      // Invalidate the templates cache and wait for it to complete
      await queryClient.invalidateQueries({ queryKey: ['/api/nda-templates'] });

      // Small delay to ensure the cache is updated
      setTimeout(() => {
        // Navigate back to NDA templates page
        setLocation('/nda-templates');
      }, 100);
    } catch (error) {
      
      // Try to parse the error if it's a response error
      if (error && typeof error === 'object' && 'json' in error) {
        try {
          const errorData = await (error as any).json();
        } catch (jsonError) {
        }
      }
      
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Failed to save template",
        variant: "destructive"
      });
      // Still navigate back so user can see their templates
      setLocation('/nda-templates');
    }
  };

  const handleBack = () => {
    setLocation('/nda-templates');
  };

  // Full-screen layout without navbar constraints
  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-gray-50">
      {/* Header with back button and save button */}
      <div className="bg-white border-b px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Templates
            </Button>
            <div className="border-l border-gray-300 h-6"></div>
            <div>
              <div id="template-name-header">
                {/* Template name will be rendered here by the editor component */}
              </div>
              <p className="text-sm text-gray-600">
                {isEditingTemplate ? 'Edit your e-signature template' : 'Design your e-signature template with drag-and-drop fields'}
              </p>
            </div>
          </div>
          
          <div id="save-button-container">
            {/* Save button will be rendered here by the template editor */}
          </div>
        </div>
      </div>

      {/* Enhanced Template Editor - Full Width */}
      <div className="flex-1 overflow-hidden">
        {templateLoading && isEditingTemplate ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <EnhancedNdaTemplateEditor
            initialTemplate={isEditingTemplate ? template : null}
            onSave={handleSave}
            isLoading={false}
            showBackButton={false}
            fullScreen={true}
          />
        )}
      </div>
    </div>
  );
}