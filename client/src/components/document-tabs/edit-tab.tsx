import { CimDisplay } from "@/components/cim-display";
import { UploadedCimFileManager } from "@/components/uploaded-cim-file-manager";

interface DocumentEditTabProps {
  cimDocument: any;
  financialFiles: any[];
  customSections: any[];
}

export function DocumentEditTab({ cimDocument, financialFiles, customSections }: DocumentEditTabProps) {
  // Check if this is an uploaded file CIM or AI-generated CIM
  const isUploadedFile = cimDocument.isUploadedFile;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b pb-4">
        <h2 className="text-2xl font-semibold text-gray-900">Edit Document</h2>
        <p className="text-gray-600 mt-1">
          {isUploadedFile 
            ? "Manage your uploaded document and attachments" 
            : "Customize your CIM content, images, and sections"
          }
        </p>
      </div>

      {/* Content */}
      {isUploadedFile ? (
        // For uploaded files, show the file manager
        <UploadedCimFileManager 
          docId={cimDocument.id}
          cimTitle={cimDocument.title}
        />
      ) : (
        // For AI-generated CIMs, show the CIM display editor
        <CimDisplay
          analysis={cimDocument.analysis}
          docId={cimDocument.id}
          logoUrl={cimDocument.logoUrl}
          selectedImages={cimDocument.selectedImages}
          cimDocument={cimDocument}
          isSharedView={false}
          autoTriggerShare={false}
        />
      )}
    </div>
  );
}