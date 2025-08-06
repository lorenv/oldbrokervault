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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-2M7 7l10 10M17 7v4h-4" />
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