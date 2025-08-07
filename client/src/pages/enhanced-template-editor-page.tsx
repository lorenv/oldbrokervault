import { useParams, useLocation } from "wouter";
import { EnhancedNdaTemplateEditor } from "@/components/esignature/enhanced-nda-template-editor";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function EnhancedTemplateEditorPage() {
  const { id } = useParams();
  const [, setLocation] = useLocation();

  const handleSave = (data: {
    name: string;
    fileContent: string;
    signatureFields: any[];
    recipients?: any[];
  }) => {
    console.log('Template saved:', data);
    // Navigate back to account settings
    setLocation('/account');
  };

  const handleBack = () => {
    setLocation('/account');
  };

  // Full-screen layout without navbar constraints
  return (
    <div className="h-screen flex flex-col bg-gray-50">
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
              Back to Account
            </Button>
            <div className="border-l border-gray-300 h-6"></div>
            <div>
              <div id="template-name-header">
                {/* Template name will be rendered here by the editor component */}
              </div>
              <p className="text-sm text-gray-600">
                Design your e-signature template with drag-and-drop fields
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
        <EnhancedNdaTemplateEditor
          onSave={handleSave}
          isLoading={false}
          showBackButton={false}
          fullScreen={true}
        />
      </div>
    </div>
  );
}