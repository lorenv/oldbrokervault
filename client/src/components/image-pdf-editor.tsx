import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ZoomIn, ZoomOut, RotateCcw, ExternalLink, Trash2 } from 'lucide-react';
import { useDrop } from 'react-dnd';
import { SignatureField } from '@/types/signature';

// Field type icons mapping
const FIELD_ICONS = {
  signature: () => <div className="w-3 h-3 bg-blue-500 rounded" />,
  name: () => <div className="w-3 h-3 bg-green-500 rounded" />,
  date: () => <div className="w-3 h-3 bg-purple-500 rounded" />,
  email: () => <div className="w-3 h-3 bg-orange-500 rounded" />,
  text: () => <div className="w-3 h-3 bg-gray-500 rounded" />
};

interface PageImage {
  pageNumber: number;
  imageDataUrl: string;
  height: number;
  width: number;
}

interface ImagePdfEditorProps {
  pdfBase64: string;
  signatureFields: SignatureField[];
  onFieldsChange: (fields: SignatureField[]) => void;
}

export default function ImagePdfEditor({
  pdfBase64,
  signatureFields,
  onFieldsChange
}: ImagePdfEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pageImages, setPageImages] = useState<PageImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [totalPages, setTotalPages] = useState(1);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [resizingField, setResizingField] = useState<string | null>(null);

  // Helper functions for field management
  const addField = useCallback((x: number, y: number, type: SignatureField['type'], pageNumber: number) => {
    const newField: SignatureField = {
      id: `field_${Date.now()}`,
      type,
      x: Math.max(0, x),
      y: Math.max(0, y),
      width: type === 'signature' ? 150 : type === 'text' ? 200 : 120,
      height: type === 'signature' ? 60 : 30,
      pageNumber,
      label: type === 'signature' ? 'Signature' : 
             type === 'name' ? 'Full Name' : 
             type === 'date' ? 'Date' : 
             type === 'email' ? 'Email Address' : 'Text Field'
    };
    
    console.log('Creating new field:', newField);
    const updatedFields = [...signatureFields, newField];
    onFieldsChange(updatedFields);
  }, [signatureFields, onFieldsChange]);

  const updateField = useCallback((fieldId: string, updates: Partial<SignatureField>) => {
    const updatedFields = signatureFields.map(field => 
      field.id === fieldId ? { ...field, ...updates } : field
    );
    console.log('Updated field:', fieldId, updates);
    onFieldsChange(updatedFields);
  }, [signatureFields, onFieldsChange]);

  const deleteField = useCallback((fieldId: string) => {
    const updatedFields = signatureFields.filter(field => field.id !== fieldId);
    onFieldsChange(updatedFields);
  }, [signatureFields, onFieldsChange]);

  // Convert PDF to images via server
  useEffect(() => {
    if (!pdfBase64) return;

    const convertPdfToImage = async () => {
      console.log('Starting PDF conversion, setting loading to true');
      setIsLoading(true);
      setError('');

      try {
        console.log('Converting all PDF pages to images via server');
        const response = await fetch('/api/pdf-to-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pdfBase64, convertAllPages: true })
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('All', data.totalPages, 'PDF pages converted successfully');

        const processedPages = await Promise.all(
          data.pages.map((page: any) => {
            return new Promise<PageImage>((resolve) => {
              const img = new Image();
              // Use the imageUrl directly from the API response
              const imageUrl = page.imageUrl || `/api/temp-image/${page.filename}`;
              img.onload = () => {
                console.log(`Image loaded for page ${page.pageNumber}: ${img.width}x${img.height}`);
                resolve({
                  pageNumber: page.pageNumber,
                  imageDataUrl: imageUrl,
                  height: img.height,
                  width: img.width
                });
              };
              img.onerror = () => {
                console.error(`Failed to load image for page ${page.pageNumber}, URL: ${imageUrl}`);
                resolve({
                  pageNumber: page.pageNumber,
                  imageDataUrl: imageUrl,
                  height: 800,
                  width: 600
                });
              };
              img.src = imageUrl;
            });
          })
        );

        console.log('All page images processed:', processedPages.length);
        setPageImages(processedPages);
        setTotalPages(data.totalPages || 1);
        setIsLoading(false);

      } catch (error: any) {
        console.error('PDF to image conversion error:', error);
        setError(`Failed to convert PDF to image: ${error.message}`);
        setIsLoading(false);
      }
    };

    convertPdfToImage();
  }, [pdfBase64]);

  const openPdfInNewTab = () => {
    if (pageImages.length > 0) {
      window.open(pageImages[0]?.imageDataUrl, '_blank');
    }
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-50 rounded-lg">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Button variant="outline" onClick={openPdfInNewTab}>
            <ExternalLink className="w-4 h-4 mr-2" />
            Open Original PDF
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Zoom Controls */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">
          {totalPages} page{totalPages !== 1 ? 's' : ''} • {signatureFields.length} fields positioned
        </div>
        <div className="flex items-center gap-3">
          {/* Zoom Controls */}
          <div className="flex items-center gap-2 border rounded-lg p-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setZoomLevel(Math.max(25, zoomLevel - 25))}
              disabled={zoomLevel <= 25}
              className="h-8 w-8 p-0"
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
            <span className="text-sm font-medium w-12 text-center">{zoomLevel}%</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setZoomLevel(Math.min(200, zoomLevel + 25))}
              disabled={zoomLevel >= 200}
              className="h-8 w-8 p-0"
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setZoomLevel(100)}
              className="h-8 w-8 p-0"
              title="Reset zoom"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={openPdfInNewTab}>
            <ExternalLink className="w-4 h-4 mr-1" />
            View Original PDF
          </Button>
        </div>
      </div>

      {/* PDF Preview Container */}
      <Card className="relative overflow-hidden">
        {isLoading && (
          <div className="flex items-center justify-center h-96 bg-gray-50">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Converting PDF pages to images...</p>
              <p className="text-xs text-gray-500 mt-2">Processing {totalPages} pages...</p>
            </div>
          </div>
        )}

        <div
          ref={containerRef}
          className="relative max-h-[800px] overflow-y-auto p-4 border-2 border-gray-200 rounded-lg"
          style={{ minHeight: isLoading ? '400px' : 'auto' }}
        >
          {pageImages.length > 0 && !isLoading && (
            <div className="space-y-8">
              {pageImages.map((page) => {
                // Calculate display dimensions with zoom support
                const baseDisplayWidth = 800;
                const displayWidth = (baseDisplayWidth * zoomLevel) / 100;
                const displayHeight = (page.height / page.width) * displayWidth;
                
                // Scale factors for coordinate conversion (zoom doesn't affect field positioning)
                const scaleX = page.width / baseDisplayWidth;
                const scaleY = page.height / (baseDisplayWidth * (page.height / page.width));

                return (
                  <div key={page.pageNumber} className="relative mb-8">
                    {/* Page number indicator */}
                    <div className="absolute -top-4 left-0 bg-blue-600 text-white px-3 py-1 rounded text-sm font-medium z-20">
                      Page {page.pageNumber}
                    </div>
                    
                    {/* Page container with proper sizing */}
                    <div 
                      className="relative bg-white border-2 border-gray-200 rounded-lg shadow-sm overflow-hidden"
                      style={{ width: displayWidth, height: displayHeight }}
                    >
                      {/* PDF Image */}
                      <img
                        src={page.imageDataUrl}
                        alt={`PDF Page ${page.pageNumber}`}
                        className="w-full h-full object-contain select-none"
                        onDragStart={(e) => e.preventDefault()}
                        style={{ pointerEvents: 'none' }}
                      />
                      
                      {/* Transparent Drop Zone Overlay */}
                      <div
                        className="absolute inset-0 w-full h-full cursor-crosshair"
                        style={{ zIndex: 10 }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.border = 'none';
                          
                          console.log('🎯 DROP EVENT on page', page.pageNumber);
                          
                          const rect = e.currentTarget.getBoundingClientRect();
                          const relativeX = e.clientX - rect.left;
                          const relativeY = e.clientY - rect.top;
                          
                          // Apply scale factors for accurate coordinate mapping
                          const x = relativeX * scaleX;
                          const y = relativeY * scaleY;
                          
                          console.log('📐 Drop coordinates:', { relativeX, relativeY, scaledX: x, scaledY: y });
                          
                          // Check if it's a new field or existing field move
                          const fieldId = e.dataTransfer.getData('application/field-id');
                          const fieldType = e.dataTransfer.getData('application/field-type');
                          const textPlain = e.dataTransfer.getData('text/plain');
                          
                          console.log('🔍 Retrieved data:', { fieldId, fieldType, textPlain, allTypes: Array.from(e.dataTransfer.types) });
                          
                          // Check for existing field movement first (field ID in either field-id or text/plain)
                          const existingFieldId = fieldId || (textPlain && textPlain.startsWith('field_') ? textPlain : null);
                          
                          if (existingFieldId && existingFieldId.startsWith('field_')) {
                            // Moving existing field
                            console.log('✅ Moving existing field', existingFieldId, 'to page', page.pageNumber, 'at', x, y);
                            updateField(existingFieldId, { 
                              x: Math.max(0, x - 50), 
                              y: Math.max(0, y - 10), 
                              pageNumber: page.pageNumber 
                            });
                          } else if (fieldType && ['signature', 'name', 'date', 'email', 'text'].includes(fieldType)) {
                            // Adding new field
                            console.log('✅ Adding new field', fieldType, 'at coordinates', x, y);
                            addField(Math.max(0, x - 50), Math.max(0, y - 10), fieldType as SignatureField['type'], page.pageNumber);
                          } else if (textPlain && ['signature', 'name', 'date', 'email', 'text'].includes(textPlain)) {
                            // Fallback for new field creation via text/plain
                            console.log('✅ Adding new field (fallback)', textPlain, 'at coordinates', x, y);
                            addField(Math.max(0, x - 50), Math.max(0, y - 10), textPlain as SignatureField['type'], page.pageNumber);
                          } else {
                            console.log('❌ NO FIELD DATA FOUND - fieldId:', fieldId, 'fieldType:', fieldType, 'textPlain:', textPlain);
                          }
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          e.dataTransfer.dropEffect = 'copy';
                          // Enhanced visual feedback
                          e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
                          e.currentTarget.style.border = '2px dashed #3b82f6';
                          e.currentTarget.style.borderRadius = '8px';
                        }}
                        onDragLeave={(e) => {
                          e.preventDefault();
                          e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.border = 'none';
                        }}
                        onDragEnter={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          console.log('🚪 DRAG ENTER page', page.pageNumber);
                        }}
                      />

                      {/* Signature Fields for this page */}
                      {signatureFields
                        .filter(field => field.pageNumber === page.pageNumber)
                        .map((field) => {
                          // Convert PDF coordinates to display coordinates
                          const fieldXPercent = (field.x / page.width) * 100;
                          const fieldYPercent = (field.y / page.height) * 100;
                          const fieldWidthPercent = (field.width / page.width) * 100;
                          const fieldHeightPercent = (field.height / page.height) * 100;

                          return (
                            <div
                              key={field.id}
                              className="absolute border-2 border-dashed border-blue-500 bg-blue-50 bg-opacity-70 rounded px-2 py-1 text-xs select-none cursor-move group hover:bg-blue-100 transition-colors"
                              draggable={true}
                              style={{
                                left: `${fieldXPercent}%`,
                                top: `${fieldYPercent}%`,
                                width: `${fieldWidthPercent}%`,
                                height: `${fieldHeightPercent}%`,
                                minWidth: '80px',
                                minHeight: '20px',
                                zIndex: 20,
                              }}
                              onDragStart={(e) => {
                                console.log('🔄 FIELD DRAG START:', field.id);
                                e.dataTransfer.clearData();
                                e.dataTransfer.setData('application/field-id', field.id);
                                e.dataTransfer.setData('text/plain', field.id);
                                e.dataTransfer.effectAllowed = 'move';
                                e.currentTarget.style.opacity = '0.5';
                                e.currentTarget.style.transform = 'scale(1.05)';
                                e.currentTarget.style.zIndex = '1000';
                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
                              }}
                              onDragEnd={(e) => {
                                console.log('🔄 FIELD DRAG END:', field.id);
                                e.currentTarget.style.opacity = '1';
                                e.currentTarget.style.transform = 'scale(1)';
                                e.currentTarget.style.zIndex = '20';
                                e.currentTarget.style.boxShadow = 'none';
                              }}
                            >
                              <div className="flex items-center justify-between h-full">
                                <div className="flex items-center gap-1 flex-1 min-w-0">
                                  {React.createElement(FIELD_ICONS[field.type], { className: "w-3 h-3 flex-shrink-0" })}
                                  <span className="truncate text-xs flex-1 min-w-0">{field.label}</span>
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="opacity-0 group-hover:opacity-100 h-4 w-4 p-0 hover:bg-red-100 flex-shrink-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteField(field.id);
                                  }}
                                >
                                  <Trash2 className="h-2 w-2" />
                                </Button>
                              </div>
                              
                              {/* Optimized resize handle */}
                              <div
                                className={`absolute bottom-0 right-0 w-3 h-3 bg-blue-500 cursor-se-resize rounded-tl transition-opacity ${
                                  resizingField === field.id ? 'ring-2 ring-blue-500 opacity-100' : 'opacity-60 hover:opacity-100'
                                }`}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setResizingField(field.id);
                                  
                                  const startX = e.clientX;
                                  const startY = e.clientY;
                                  const startWidth = field.width;
                                  const startHeight = field.height;
                                  
                                  // Throttle resize updates for better performance
                                  let resizeTimeout: NodeJS.Timeout;

                                  const handleMouseMove = (e: MouseEvent) => {
                                    clearTimeout(resizeTimeout);
                                    resizeTimeout = setTimeout(() => {
                                      const deltaX = e.clientX - startX;
                                      const deltaY = e.clientY - startY;
                                      
                                      const widthDelta = deltaX / (displayWidth / page.width);
                                      const heightDelta = deltaY / (displayHeight / page.height);
                                      
                                      const newWidth = Math.max(50, startWidth + widthDelta);
                                      const newHeight = Math.max(20, startHeight + heightDelta);
                                      
                                      updateField(field.id, { width: newWidth, height: newHeight });
                                    }, 16); // ~60fps throttling
                                  };

                                  const handleMouseUp = () => {
                                    clearTimeout(resizeTimeout);
                                    setResizingField(null);
                                    document.removeEventListener('mousemove', handleMouseMove);
                                    document.removeEventListener('mouseup', handleMouseUp);
                                  };

                                  document.addEventListener('mousemove', handleMouseMove);
                                  document.addEventListener('mouseup', handleMouseUp);
                                }}
                              />
                            </div>
                          );
                        })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}