import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { FieldCanvas } from "./field-canvas";
import type { Document, SignatureField, Recipient } from "@shared/schema";

interface DocumentViewerProps {
  document: Document;
  fields: SignatureField[];
  recipients: Recipient[];
  onFieldDrop: (fieldType: string, x: number, y: number, pageNumber: number) => void;
  onFieldSelect: (field: SignatureField) => void;
  onFieldMove?: (fieldId: number, x: number, y: number) => void;
  onFieldResize?: (fieldId: number, width: number, height: number) => void;
  onFieldDelete?: (fieldId: number) => void;
  selectedField: SignatureField | null;
  isTemplate?: boolean; // Flag to determine if this is a template or document
}

export function DocumentViewer({
  document,
  fields,
  recipients,
  onFieldDrop,
  onFieldSelect,
  onFieldMove,
  onFieldResize,
  onFieldDelete,
  selectedField,
  isTemplate = false
}: DocumentViewerProps) {
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
              <Button variant="outline" size="sm">
                Preview
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
                      src={isTemplate ? `/api/templates/${document.id}/image/${pageNumber}` : `/api/documents/${document.id}/image/${pageNumber}`}
                      alt={`Page ${pageNumber}`}
                      className="w-full h-auto block"
                      style={{ maxWidth: 'none' }}
                      onError={(e) => {
                        console.error(`Failed to load image for page ${pageNumber}`);
                      }}
                    />
                  )}

                  {/* Loading state for missing images */}
                  {(!document.imageUrls || document.imageUrls.length < pageNumber) && (
                    <div className="flex items-center justify-center h-96">
                      <div className="text-center">
                        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-slate-600">Processing page {pageNumber}...</p>
                      </div>
                    </div>
                  )}

                  {/* Field Canvas Overlay for this page */}
                  <FieldCanvas
                    fields={pageFields}
                    recipients={recipients}
                    onFieldDrop={(fieldType, x, y) => onFieldDrop(fieldType, x, y, pageNumber)}
                    onFieldSelect={onFieldSelect}
                    onFieldMove={onFieldMove}
                    onFieldResize={onFieldResize}
                    onFieldDelete={onFieldDelete}
                    selectedField={selectedField}
                    containerRef={null}
                    pageNumber={pageNumber}
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