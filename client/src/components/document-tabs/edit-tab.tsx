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
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Edit Document</h2>
            <p className="text-gray-600 mt-1">
              {isUploadedFile 
                ? "Manage your uploaded document and attachments" 
                : "Customize your CIM content, images, and sections"
              }
            </p>
          </div>
          
          {/* Preview Share Link Button */}
          <div className="flex-shrink-0">
            <button
              onClick={() => {
                const baseUrl = window.location.hostname === 'localhost' ? window.location.origin : 'https://cimshare.com';
                const shareUrl = `${baseUrl}/share/${cimDocument.shareSlug || 'not-shared'}`;
                if (cimDocument.shareSlug) {
                  window.open(shareUrl, '_blank');
                } else {
                  // Could show a toast or alert that sharing isn't enabled
                  alert('Please enable sharing for this document first in the Share tab');
                }
              }}
              disabled={!cimDocument.shareSlug}
              className={`
                px-6 py-3 rounded-lg font-medium text-sm transition-all duration-200 flex items-center gap-2
                ${cimDocument.shareSlug 
                  ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transform hover:-translate-y-0.5' 
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }
              `}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Preview Share Link
            </button>
          </div>
        </div>
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