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
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Edit Document
              </h2>
            </div>
            <p className="text-gray-700 text-lg">
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
                px-8 py-4 rounded-xl font-semibold text-sm transition-all duration-300 flex items-center gap-3 backdrop-blur-sm border shadow-xl
                ${cimDocument.shareSlug 
                  ? 'bg-white/95 hover:bg-white text-blue-700 hover:text-blue-800 border-white/30 hover:shadow-2xl transform hover:-translate-y-1 hover:scale-105' 
                  : 'bg-white/20 text-white/50 cursor-not-allowed border-white/10 shadow-sm'
                }
              `}
            >
              <div className={`p-2 rounded-lg ${cimDocument.shareSlug ? 'bg-blue-100' : 'bg-white/10'}`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              <span className="font-bold">Preview Share Link</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
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