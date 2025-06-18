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

  if (isUploadedFile) {
    // For uploaded files, show the file manager
    return (
      <UploadedCimFileManager 
        docId={cimDocument.id}
        cimTitle={cimDocument.title}
      />
    );
  }

  // For AI-generated CIMs, show the CIM display editor
  return (
    <CimDisplay
      analysis={cimDocument.analysis}
      docId={cimDocument.id}
      logoUrl={cimDocument.logoUrl}
      selectedImages={cimDocument.selectedImages}
      cimDocument={cimDocument}
      isSharedView={false}
      autoTriggerShare={false}
    />
  );
}