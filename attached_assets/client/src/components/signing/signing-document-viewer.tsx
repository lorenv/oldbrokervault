import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { SigningFieldOverlay } from "./signing-field-overlay";
import type { Document, SignatureField, Recipient } from "@shared/schema";

interface SigningDocumentViewerProps {
  document: Document;
  fields: SignatureField[];
  recipient: Recipient;
  onFieldComplete: (fieldId: number, value: string) => void;
  getFieldValue: (fieldId: number) => string;
  currentFieldId?: number;
  onFieldClick: (field: SignatureField) => void;
}

export function SigningDocumentViewer({
  document,
  fields,
  recipient,
  onFieldComplete,
  getFieldValue,
  currentFieldId,
  onFieldClick
}: SigningDocumentViewerProps) {
  const [zoom, setZoom] = useState(100);
  const containerRef = useRef<HTMLDivElement>(null);

  if (!document) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-100">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading document...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-slate-100">
      {/* Document Toolbar */}
      <div className="bg-white border-b border-slate-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h2 className="text-lg font-semibold">{document.title}</h2>
            <span className="text-sm text-slate-500">{document.pageCount} pages</span>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Zoom Controls */}
            <div className="flex items-center space-x-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setZoom(zoom => Math.max(zoom - 10, 50))}
              >
                -
              </Button>
              <span className="px-3 py-1 text-sm font-medium bg-slate-100 rounded">
                {zoom}%
              </span>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setZoom(zoom => Math.min(zoom + 10, 200))}
              >
                +
              </Button>
              <Button variant="outline" size="sm" onClick={() => setZoom(100)}>
                Fit to Width
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Document Content - Scrollable with Stacked Pages */}
      <div className="flex-1 overflow-auto bg-slate-50 p-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Render all pages vertically */}
          {Array.from({ length: document.pageCount || 0 }, (_, index) => {
            const pageNumber = index + 1;
            const pageFields = fields.filter(field => field.pageNumber === pageNumber);
            
            return (
              <div key={pageNumber} className="relative">
                {/* Page Number Label */}
                <div className="text-center mb-4">
                  <span className="inline-block px-3 py-1 bg-white border border-slate-200 rounded-full text-sm font-medium text-slate-600">
                    Page {pageNumber}
                  </span>
                </div>
                
                {/* Document Page */}
                <div 
                  className="relative bg-white shadow-lg border border-slate-200 mx-auto"
                  style={{
                    transform: `scale(${zoom / 100})`,
                    transformOrigin: 'top center',
                    width: '210mm', // A4 width
                    minHeight: '297mm', // A4 height
                  }}
                >
                  {/* Document Image */}
                  {document.imageUrls && document.imageUrls.length >= pageNumber && (
                    <img
                      src={`/api/documents/${document.id}/image/${pageNumber}`}
                      alt={`${document.title} - Page ${pageNumber}`}
                      className="w-full h-full object-contain"
                      style={{ maxWidth: '100%', height: 'auto' }}
                    />
                  )}
                  
                  {/* Signing Field Overlay */}
                  <SigningFieldOverlay
                    fields={pageFields}
                    recipient={recipient}
                    onFieldComplete={onFieldComplete}
                    getFieldValue={getFieldValue}
                    currentFieldId={currentFieldId}
                    onFieldClick={onFieldClick}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}