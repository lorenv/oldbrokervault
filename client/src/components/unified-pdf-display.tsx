import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ZoomIn, ZoomOut, RotateCcw, ExternalLink } from 'lucide-react';

interface SignatureField {
  id: string;
  type: 'signature' | 'name' | 'date' | 'email' | 'text';
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  pageNumber: number;
  required?: boolean;
  fontSize?: number;
  placeholder?: string;
}

interface PageImage {
  pageNumber: number;
  imagePath?: string;
  imageDataUrl?: string;
  width: number;
  height: number;
}

interface UnifiedPdfDisplayProps {
  pdfBase64: string;
  pageImages?: PageImage[];
  signatureFields: SignatureField[];
  mode: 'template' | 'signing';
  onFieldClick?: (field: SignatureField) => void;
  onFieldDrop?: (pageNumber: number, x: number, y: number, fieldType: string) => void;
  onFieldMove?: (fieldId: string, x: number, y: number, pageNumber: number) => void;
  onFieldDelete?: (fieldId: string) => void;
  fieldValues?: Record<string, string>;
  className?: string;
}

const ZOOM_LEVELS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];
const FIXED_DISPLAY_WIDTH = 800; // Consistent width across all contexts

const FIELD_COLORS = {
  signature: 'border-blue-500 bg-blue-50 bg-opacity-90',
  name: 'border-green-500 bg-green-50 bg-opacity-90',
  date: 'border-purple-500 bg-purple-50 bg-opacity-90',
  email: 'border-orange-500 bg-orange-50 bg-opacity-90',
  text: 'border-gray-500 bg-gray-50 bg-opacity-90'
};

export default function UnifiedPdfDisplay({
  pdfBase64,
  pageImages: providedPageImages,
  signatureFields,
  mode,
  onFieldClick,
  onFieldDrop,
  onFieldMove,
  onFieldDelete,
  fieldValues = {},
  className = ''
}: UnifiedPdfDisplayProps) {
  const [zoom, setZoom] = useState(1);
  const [pageImages, setPageImages] = useState<PageImage[]>(providedPageImages || []);
  const [isLoading, setIsLoading] = useState(!providedPageImages?.length);
  const [error, setError] = useState<string>('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Convert PDF to images if not provided
  useEffect(() => {
    const convertPdfToImages = async () => {
      if (providedPageImages?.length || !pdfBase64) return;
      
      setIsLoading(true);
      setError('');

      try {
        console.log('Converting PDF to images for unified display');
        
        const response = await fetch('/api/pdf-to-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pdfBase64 }),
        });

        if (!response.ok) {
          throw new Error('PDF conversion failed');
        }

        const data = await response.json();
        console.log(`Converted ${data.pages.length} pages for unified display`);
        
        // Process page images
        const processedPages = await Promise.all(
          data.pages.map(async (page: any) => {
            return new Promise<PageImage>((resolve) => {
              const img = new Image();
              img.onload = () => {
                resolve({
                  pageNumber: page.pageNumber,
                  imageDataUrl: page.imageDataUrl,
                  width: img.width,
                  height: img.height
                });
              };
              img.src = page.imageDataUrl;
            });
          })
        );
        
        setPageImages(processedPages);
        setIsLoading(false);

      } catch (error: any) {
        console.error('PDF conversion error:', error);
        setError(`Failed to convert PDF: ${error.message}`);
        setIsLoading(false);
      }
    };

    convertPdfToImages();
  }, [pdfBase64, providedPageImages]);

  // Update page images when provided images change
  useEffect(() => {
    if (providedPageImages?.length) {
      setPageImages(providedPageImages);
      setIsLoading(false);
    }
  }, [providedPageImages]);

  const handleZoomIn = useCallback(() => {
    const currentIndex = ZOOM_LEVELS.indexOf(zoom);
    if (currentIndex < ZOOM_LEVELS.length - 1) {
      setZoom(ZOOM_LEVELS[currentIndex + 1]);
    }
  }, [zoom]);

  const handleZoomOut = useCallback(() => {
    const currentIndex = ZOOM_LEVELS.indexOf(zoom);
    if (currentIndex > 0) {
      setZoom(ZOOM_LEVELS[currentIndex - 1]);
    }
  }, [zoom]);

  const resetZoom = useCallback(() => {
    setZoom(1);
  }, []);

  const openPdfInNewTab = useCallback(() => {
    if (pdfBase64) {
      const dataUrl = `data:application/pdf;base64,${pdfBase64}`;
      window.open(dataUrl, '_blank');
    }
  }, [pdfBase64]);

  const handleFieldInteraction = useCallback((field: SignatureField, event: React.MouseEvent) => {
    if (mode === 'signing' && onFieldClick) {
      onFieldClick(field);
    }
  }, [mode, onFieldClick]);

  const handleDrop = useCallback((e: React.DragEvent, pageNumber: number) => {
    if (mode !== 'template' || !onFieldDrop) return;
    
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    
    // Calculate position relative to the image, accounting for zoom
    const relativeX = (e.clientX - rect.left) / zoom;
    const relativeY = (e.clientY - rect.top) / zoom;
    
    // Find the page to get original dimensions
    const page = pageImages.find(p => p.pageNumber === pageNumber);
    if (!page) return;
    
    // Convert display coordinates to original PDF coordinates
    const displayWidth = Math.min(FIXED_DISPLAY_WIDTH, page.width);
    const displayHeight = (page.height * displayWidth) / page.width;
    
    const scaleX = page.width / displayWidth;
    const scaleY = page.height / displayHeight;
    
    const x = relativeX * scaleX;
    const y = relativeY * scaleY;
    
    const fieldType = e.dataTransfer.getData('application/field-type');
    if (fieldType) {
      onFieldDrop(pageNumber, x, y, fieldType);
    }
    
    // Handle field movement
    const fieldId = e.dataTransfer.getData('application/field-id');
    if (fieldId && onFieldMove) {
      onFieldMove(fieldId, x, y, pageNumber);
    }
  }, [mode, onFieldDrop, onFieldMove, pageImages, zoom]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Processing PDF pages...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center max-w-md">
          <p className="text-red-600 mb-4">{error}</p>
          {pdfBase64 && (
            <Button onClick={openPdfInNewTab} variant="outline">
              <ExternalLink className="w-4 h-4 mr-2" />
              Open Original PDF
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <Card className={`w-full ${className}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>
            {mode === 'template' ? 'PDF Template Editor' : 'Document Review'}
          </CardTitle>
          
          {/* Zoom Controls */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleZoomOut}
              disabled={zoom <= ZOOM_LEVELS[0]}
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
            
            <span className="text-sm font-medium min-w-[4rem] text-center">
              {Math.round(zoom * 100)}%
            </span>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleZoomIn}
              disabled={zoom >= ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={resetZoom}
              disabled={zoom === 1}
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
            
            {pdfBase64 && (
              <Button variant="outline" size="sm" onClick={openPdfInNewTab}>
                <ExternalLink className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
        
        <div className="text-sm text-gray-600">
          {pageImages.length} page{pageImages.length !== 1 ? 's' : ''} • {signatureFields.length} field{signatureFields.length !== 1 ? 's' : ''}
        </div>
      </CardHeader>
      
      <CardContent>
        <div
          ref={containerRef}
          className="max-h-[800px] overflow-auto border-2 border-gray-200 rounded-lg p-4"
          style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
        >
          <div className="space-y-8">
            {pageImages.map((page) => {
              // Calculate consistent display dimensions
              const displayWidth = Math.min(FIXED_DISPLAY_WIDTH, page.width);
              const displayHeight = (page.height * displayWidth) / page.width;
              
              // Calculate scale factors for coordinate conversion
              const scaleX = page.width / displayWidth;
              const scaleY = page.height / displayHeight;
              
              return (
                <div key={page.pageNumber} className="relative mb-8">
                  {/* Page number indicator */}
                  <div className="absolute -top-4 left-0 bg-blue-600 text-white px-3 py-1 rounded text-sm font-medium z-20">
                    Page {page.pageNumber}
                  </div>
                  
                  {/* Page container with fixed sizing */}
                  <div 
                    className="relative bg-white border-2 border-gray-200 rounded-lg shadow-sm overflow-hidden"
                    style={{ width: displayWidth, height: displayHeight }}
                  >
                    {/* PDF Image */}
                    <img
                      src={page.imagePath || page.imageDataUrl}
                      alt={`PDF Page ${page.pageNumber}`}
                      className="w-full h-full object-contain select-none"
                      onDragStart={(e) => e.preventDefault()}
                      style={{ pointerEvents: 'none' }}
                    />
                    
                    {/* Drop Zone for Template Mode */}
                    {mode === 'template' && (
                      <div
                        className="absolute inset-0 w-full h-full"
                        style={{ zIndex: 10 }}
                        onDrop={(e) => handleDrop(e, page.pageNumber)}
                        onDragOver={(e) => e.preventDefault()}
                      />
                    )}

                    {/* Signature Fields */}
                    {signatureFields
                      .filter(field => field.pageNumber === page.pageNumber)
                      .map((field) => {
                        const fieldValue = fieldValues[field.id] || '';
                        const hasValue = fieldValue.trim().length > 0;
                        
                        return (
                          <div
                            key={field.id}
                            className={`absolute border-2 ${FIELD_COLORS[field.type]} rounded cursor-pointer flex items-center justify-center text-xs font-medium ${
                              mode === 'signing' ? 'hover:border-blue-600' : 'cursor-move'
                            }`}
                            style={{
                              left: field.x / scaleX,
                              top: field.y / scaleY,
                              width: field.width / scaleX,
                              height: field.height / scaleY,
                              zIndex: 15,
                              backgroundColor: hasValue ? '#e8f5e8' : undefined
                            }}
                            onClick={(e) => handleFieldInteraction(field, e)}
                            draggable={mode === 'template'}
                            onDragStart={(e) => {
                              if (mode === 'template') {
                                e.dataTransfer.setData('application/field-id', field.id);
                                e.dataTransfer.setData('application/field-current-x', field.x.toString());
                                e.dataTransfer.setData('application/field-current-y', field.y.toString());
                              }
                            }}
                          >
                            {mode === 'signing' ? (
                              <span className="truncate px-1">
                                {hasValue ? '✓' : field.type}
                              </span>
                            ) : (
                              <>
                                <span className="truncate px-1">{field.type}</span>
                                {onFieldDelete && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-4 w-4 p-0 hover:bg-red-100 flex-shrink-0 ml-1"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onFieldDelete(field.id);
                                    }}
                                  >
                                    ×
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}