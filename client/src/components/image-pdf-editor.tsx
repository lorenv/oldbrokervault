import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useDrop, useDrag } from 'react-dnd';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Trash2, Type, FileSignature, Calendar, Mail, AlignLeft, ExternalLink, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface SignatureField {
  id: string;
  type: 'signature' | 'name' | 'date' | 'email' | 'text';
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  pageNumber: number;
  required: boolean;
  fontSize: number;
  placeholder?: string;
}

interface ImagePdfEditorProps {
  pdfBase64: string;
  signatureFields: SignatureField[];
  onFieldsChange: (fields: SignatureField[]) => void;
}

const FIELD_COLORS = {
  signature: 'border-blue-500 bg-blue-50 bg-opacity-90',
  name: 'border-green-500 bg-green-50 bg-opacity-90',
  date: 'border-purple-500 bg-purple-50 bg-opacity-90',
  email: 'border-orange-500 bg-orange-50 bg-opacity-90',
  text: 'border-gray-500 bg-gray-50 bg-opacity-90'
};

const FIELD_ICONS = {
  signature: FileSignature,
  name: Type,
  date: Calendar,
  email: Mail,
  text: AlignLeft
};

const FieldComponent = ({ field, onUpdate, onDelete, scale }: {
  field: SignatureField;
  onUpdate: (id: string, updates: Partial<SignatureField>) => void;
  onDelete: (id: string) => void;
  scale: number;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(field.label);

  const [{ isDragging }, drag] = useDrag({
    type: 'field',
    item: { id: field.id, type: field.type },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const handleLabelUpdate = () => {
    onUpdate(field.id, { label: editLabel });
    setIsEditing(false);
  };

  const Icon = FIELD_ICONS[field.type];

  return (
    <div
      ref={drag}
      className={`absolute cursor-move border-2 border-dashed rounded px-2 py-1 text-xs select-none shadow-md ${
        FIELD_COLORS[field.type]
      } ${isDragging ? 'opacity-50' : ''}`}
      style={{
        left: field.x * scale,
        top: field.y * scale,
        width: field.width * scale,
        height: field.height * scale,
        minHeight: '30px',
        zIndex: 1000,
      }}
      onDoubleClick={() => setIsEditing(true)}
    >
      <div className="flex items-center justify-between h-full">
        <div className="flex items-center gap-1 flex-1">
          <Icon className="w-3 h-3 flex-shrink-0" />
          {isEditing ? (
            <Input
              value={editLabel}
              onChange={(e) => setEditLabel(e.target.value)}
              onBlur={handleLabelUpdate}
              onKeyDown={(e) => e.key === 'Enter' && handleLabelUpdate()}
              className="h-4 text-xs border-0 p-0 bg-transparent flex-1"
              autoFocus
            />
          ) : (
            <span className="truncate text-xs">{field.label}</span>
          )}
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-4 w-4 p-0 hover:bg-red-100 flex-shrink-0 ml-1"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(field.id);
          }}
        >
          <Trash2 className="h-2 w-2" />
        </Button>
      </div>
    </div>
  );
};

// Draggable field component for the sidebar
const DraggableFieldButton = ({ type, icon: Icon, label }: { 
  type: SignatureField['type'], 
  icon: any, 
  label: string 
}) => {
  return (
    <div
      draggable
      className="flex items-center gap-2 p-3 border-2 border-dashed border-gray-300 rounded-lg cursor-move transition-all hover:border-blue-400 hover:bg-blue-50"
      onDragStart={(e) => {
        e.dataTransfer.setData('application/field-type', type);
        e.dataTransfer.effectAllowed = 'copy';
      }}
    >
      <Icon className="w-4 h-4 text-gray-600" />
      <span className="text-sm font-medium text-gray-700">{label}</span>
    </div>
  );
};

export default function ImagePdfEditor({
  pdfBase64,
  signatureFields,
  onFieldsChange
}: ImagePdfEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pageImages, setPageImages] = useState<Array<{ pageNumber: number; imageDataUrl: string; height: number; width: number }>>([]);
  const [scale, setScale] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [totalPages, setTotalPages] = useState(1);

  // Convert PDF to image via server
  useEffect(() => {
    const convertPdfToImage = async () => {
      if (!pdfBase64) {
        console.log('No PDF base64 provided, skipping conversion');
        return;
      }

      console.log('Starting PDF conversion, setting loading to true');
      setIsLoading(true);
      setError('');
      setPageImages([]); // Clear existing images

      try {
        console.log('Converting all PDF pages to images via server');
        
        const response = await fetch('/api/pdf-to-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pdfBase64 }),
        });

        if (!response.ok) {
          let errorMessage = 'PDF conversion failed';
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch {
            errorMessage = `Server error: ${response.status}`;
          }
          throw new Error(errorMessage);
        }

        const data = await response.json();
        console.log(`All ${data.pages.length} PDF pages converted successfully`);
        
        // Process page images and calculate dimensions
        const processedPages = await Promise.all(
          data.pages.map(async (page: any) => {
            return new Promise<{ pageNumber: number; imageDataUrl: string; height: number; width: number }>((resolve) => {
              const img = new Image();
              img.onload = () => {
                console.log(`Image loaded for page ${page.pageNumber}: ${img.width}x${img.height}`);
                resolve({
                  pageNumber: page.pageNumber,
                  imageDataUrl: page.imageDataUrl || page.imageUrl, // Support both formats
                  height: img.height,
                  width: img.width
                });
              };
              img.onerror = () => {
                console.error(`Failed to load image for page ${page.pageNumber}`);
                resolve({
                  pageNumber: page.pageNumber,
                  imageDataUrl: page.imageDataUrl || page.imageUrl, // Support both formats
                  height: 800,
                  width: 600
                });
              };
              img.src = page.imageDataUrl || page.imageUrl; // Support both formats
            });
          })
        );
        
        console.log('All page images processed:', processedPages.length);
        setPageImages(processedPages);
        setTotalPages(data.totalPages || 1);
        console.log('PDF conversion complete, setting loading to false, pageImages:', processedPages.length);
        setIsLoading(false);

      } catch (error: any) {
        console.error('PDF to image conversion error:', error);
        const errorMessage = error.message || 'Unknown error during PDF conversion';
        setError(`Failed to convert PDF to image: ${errorMessage}`);
        setIsLoading(false);
      }
    };

    convertPdfToImage();
  }, [pdfBase64]);

  // Remove auto-scaling since we're using max-width constraint instead

  // Drop handler for field placement on the entire container
  const [{ isOver }, dropProps] = useDrop({
    accept: ['new-field', 'field'],
    drop: (item: any, monitor) => {
      const offset = monitor.getClientOffset();
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (!offset || !containerRect) return;
      
      // Get relative position within the scrollable container
      const containerScrollTop = containerRef.current?.scrollTop || 0;
      const relativeX = offset.x - containerRect.left - 16; // Account for padding
      const relativeY = offset.y - containerRect.top + containerScrollTop - 16; // Account for padding and scroll
      
      // Calculate which page this drop is on
      let cumulativeHeight = 0;
      let targetPage = 1;
      let adjustedY = relativeY;
      let adjustedX = relativeX;
      
      for (const page of pageImages) {
        // Use consistent 800px display width to match UnifiedPdfDisplay
        const FIXED_DISPLAY_WIDTH = 800;
        const actualWidth = Math.min(page.width, FIXED_DISPLAY_WIDTH);
        const actualHeight = (page.height * actualWidth) / page.width;
        const spacingGap = 20; // Gap between pages
        
        if (relativeY >= cumulativeHeight && relativeY < cumulativeHeight + actualHeight) {
          targetPage = page.pageNumber;
          // Convert display coordinates to original PDF coordinates
          adjustedY = ((relativeY - cumulativeHeight) * page.height) / actualHeight;
          adjustedX = (relativeX * page.width) / actualWidth;
          break;
        }
        cumulativeHeight += actualHeight + spacingGap;
      }
      
      if (item.type && !item.id) {
        addField(adjustedX, adjustedY, item.type, targetPage);
      } else if (item.id) {
        updateField(item.id, { x: adjustedX, y: adjustedY, pageNumber: targetPage });
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  const addField = useCallback((x: number, y: number, type: SignatureField['type'], pageNumber: number = 1) => {
    const newField: SignatureField = {
      id: `field_${Date.now()}`,
      type,
      label: `${type.charAt(0).toUpperCase() + type.slice(1)} Field`,
      x: Math.max(0, x - 75), // Center field on cursor
      y: Math.max(0, y - 15), // Center field on cursor
      width: type === 'signature' ? 200 : 150,
      height: type === 'signature' ? 60 : 30,
      pageNumber,
      required: true,
      fontSize: 12,
      placeholder: type === 'date' ? 'MM/DD/YYYY' : undefined
    };
    console.log('🔧 Adding field at coordinates:', { x: newField.x, y: newField.y, pageNumber });
    onFieldsChange([...signatureFields, newField]);
  }, [signatureFields, onFieldsChange]);

  const updateField = useCallback((id: string, updates: Partial<SignatureField>) => {
    const updatedFields = signatureFields.map(field =>
      field.id === id ? { ...field, ...updates } : field
    );
    onFieldsChange(updatedFields);
  }, [signatureFields, onFieldsChange]);

  const deleteField = useCallback((id: string) => {
    const filteredFields = signatureFields.filter(field => field.id !== id);
    onFieldsChange(filteredFields);
  }, [signatureFields, onFieldsChange]);

  // Remove click-to-add functionality since we're using drag-and-drop only

  const openPdfInNewTab = () => {
    const dataUrl = `data:application/pdf;base64,${pdfBase64}`;
    window.open(dataUrl, '_blank');
  };

  // Calculate cumulative offset for field positioning
  const getFieldOffset = (pageNumber: number) => {
    let offset = 0;
    const FIXED_DISPLAY_WIDTH = 800;
    for (let i = 0; i < pageNumber - 1; i++) {
      if (pageImages[i]) {
        const displayWidth = Math.min(FIXED_DISPLAY_WIDTH, pageImages[i].width);
        const displayHeight = (pageImages[i].height * displayWidth) / pageImages[i].width;
        offset += displayHeight + 20; // 20px gap between pages
      }
    }
    return offset;
  };

  console.log('ImagePdfEditor render state:', { isLoading, pageImagesCount: pageImages.length, hasError: !!error });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-sm text-gray-600">Processing PDF...</p>
          <p className="text-xs text-gray-500 mt-1">Converting pages to images</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center max-w-md">
          <p className="text-sm text-red-600 mb-4">{error}</p>
          <Button onClick={openPdfInNewTab} variant="outline">
            <ExternalLink className="w-4 h-4 mr-2" />
            Open Original PDF
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">
          {totalPages} page{totalPages !== 1 ? 's' : ''} • {signatureFields.length} fields positioned
        </div>
        <Button variant="outline" size="sm" onClick={openPdfInNewTab}>
          <ExternalLink className="w-4 h-4 mr-1" />
          View Original PDF
        </Button>
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
              {pageImages.map((page, index) => {
                // Use consistent 800px display width to match UnifiedPdfDisplay
                const FIXED_DISPLAY_WIDTH = 800;
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
                          e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.border = 'none';
                          
                          console.log('🎯 DROP EVENT on page', page.pageNumber);
                          console.log('📦 DataTransfer types available:', Array.from(e.dataTransfer.types));
                          
                          const rect = e.currentTarget.getBoundingClientRect();
                          const relativeX = e.clientX - rect.left;
                          const relativeY = e.clientY - rect.top;
                          
                          // Apply scale factors for accurate coordinate mapping
                          const x = relativeX * scaleX;
                          const y = relativeY * scaleY;
                          
                          console.log('📐 Drop coordinates:', {
                            clientX: e.clientX,
                            clientY: e.clientY,
                            rectLeft: rect.left,
                            rectTop: rect.top,
                            relativeX,
                            relativeY,
                            scaledX: x,
                            scaledY: y
                          });
                          
                          // Check if it's a new field or existing field move
                          const fieldId = e.dataTransfer.getData('application/field-id');
                          const fieldType = e.dataTransfer.getData('application/field-type') || e.dataTransfer.getData('text/plain');
                          
                          console.log('🔍 Retrieved data:', {
                            fieldId,
                            fieldType,
                            allData: Array.from(e.dataTransfer.types).map(type => ({
                              type,
                              data: e.dataTransfer.getData(type)
                            }))
                          });
                          
                          if (fieldId) {
                            // Moving existing field
                            console.log('✅ Moving existing field', fieldId, 'to', x, y, 'on page', page.pageNumber);
                            updateField(fieldId, { x: Math.max(0, x - 75), y: Math.max(0, y - 15), pageNumber: page.pageNumber });
                          } else if (fieldType) {
                            // Adding new field
                            console.log('✅ Adding new field', fieldType, 'at', x, y, 'on page', page.pageNumber);
                            addField(x - 75, y - 15, fieldType as SignatureField['type'], page.pageNumber);
                          } else {
                            console.log('❌ NO FIELD DATA FOUND - cannot drop');
                          }
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'copy';
                          console.log('🎭 DRAG OVER page', page.pageNumber, 'types:', Array.from(e.dataTransfer.types));
                          // Add visual feedback when hovering over drop zone
                          e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.15)';
                        }}
                        onDragLeave={(e) => {
                          e.preventDefault();
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                        onDragEnter={(e) => {
                          e.preventDefault();
                          console.log('🚪 DRAG ENTER page', page.pageNumber);
                        }}
                      />

                      {/* Signature Fields for this page */}
                      {signatureFields
                        .filter(field => field.pageNumber === page.pageNumber)
                        .map(field => {
                          // Use percentage-based positioning for responsive scaling
                          const fieldXPercent = (field.x / page.width) * 100;
                          const fieldYPercent = (field.y / page.height) * 100;
                          const fieldWidthPercent = (field.width / page.width) * 100;
                          const fieldHeightPercent = (field.height / page.height) * 100;
                          
                          return (
                            <div
                              key={field.id}
                              draggable
                              className={`absolute border-2 ${FIELD_COLORS[field.type]} rounded px-2 py-1 text-xs group hover:shadow-md transition-all cursor-move select-none ${
                                resizingField === field.id ? 'ring-2 ring-blue-500' : ''
                              }`}
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
                                console.log('🚀 Starting drag for placed field:', field.id);
                                e.dataTransfer.clearData(); // Clear any existing data
                                e.dataTransfer.setData('application/field-id', field.id);
                                e.dataTransfer.setData('text/plain', field.id); // Fallback
                                e.dataTransfer.effectAllowed = 'move';
                                e.currentTarget.style.opacity = '0.5';
                                console.log('📦 Set field ID in dataTransfer:', field.id);
                                
                                // Store current position for precise small movements
                                e.dataTransfer.setData('application/field-current-x', field.x.toString());
                                e.dataTransfer.setData('application/field-current-y', field.y.toString());
                              }}
                              onDragEnd={(e) => {
                                console.log('Drag ended for placed field:', field.id);
                                e.currentTarget.style.opacity = '1';
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
                              
                              {/* Resize Handles */}
                              <div
                                className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-500 border border-white rounded-full cursor-se-resize opacity-0 group-hover:opacity-100"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setResizingField(field.id);
                                  
                                  const startX = e.clientX;
                                  const startY = e.clientY;
                                  const startWidth = field.width;
                                  const startHeight = field.height;
                                  
                                  const handleMouseMove = (moveE: MouseEvent) => {
                                    const deltaX = moveE.clientX - startX;
                                    const deltaY = moveE.clientY - startY;
                                    
                                    // Convert screen deltas to PDF coordinates
                                    const newWidth = Math.max(50, startWidth + deltaX * scaleX);
                                    const newHeight = Math.max(20, startHeight + deltaY * scaleY);
                                    
                                    updateField(field.id, { 
                                      width: newWidth, 
                                      height: newHeight 
                                    });
                                  };
                                  
                                  const handleMouseUp = () => {
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