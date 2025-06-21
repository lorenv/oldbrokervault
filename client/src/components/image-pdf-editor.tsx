import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useDrop, useDrag } from 'react-dnd';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Trash2, Type, FileSignature, Calendar, Mail, AlignLeft, ExternalLink } from 'lucide-react';

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
      if (!pdfBase64) return;

      setIsLoading(true);
      setError('');

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
                resolve({
                  pageNumber: page.pageNumber,
                  imageDataUrl: page.imageDataUrl,
                  height: img.height,
                  width: img.width
                });
              };
              img.src = page.imageDataUrl;
            });
          })
        );
        
        setPageImages(processedPages);
        setTotalPages(data.totalPages || 1);
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
        // Calculate actual displayed height (no scale transform, just max-width constraint)
        const maxWidth = 1000;
        const actualWidth = Math.min(page.width, maxWidth);
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
      x: Math.max(0, x - 75),
      y: Math.max(0, y - 15),
      width: type === 'signature' ? 200 : 150,
      height: type === 'signature' ? 60 : 30,
      pageNumber,
      required: true,
      fontSize: 12,
      placeholder: type === 'date' ? 'MM/DD/YYYY' : undefined
    };
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
    for (let i = 0; i < pageNumber - 1; i++) {
      if (pageImages[i]) {
        offset += pageImages[i].height * scale + 20; // 20px gap between pages
      }
    }
    return offset;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-sm text-gray-600">Processing PDF...</p>
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
        <h3 className="text-lg font-medium">PDF Template Editor</h3>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-600">
            {totalPages} page{totalPages !== 1 ? 's' : ''} • {signatureFields.length} fields positioned
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
              <p className="text-gray-600">Converting all PDF pages to images...</p>
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
                // Calculate display dimensions with max width constraint
                const maxWidth = 800;
                const displayWidth = Math.min(maxWidth, page.width);
                const displayHeight = (page.height * displayWidth) / page.width;
                
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
                          
                          const rect = e.currentTarget.getBoundingClientRect();
                          const x = ((e.clientX - rect.left) * page.width) / displayWidth;
                          const y = ((e.clientY - rect.top) * page.height) / displayHeight;
                          
                          // Check if it's a new field or existing field move
                          const fieldId = e.dataTransfer.getData('application/field-id');
                          const fieldType = e.dataTransfer.getData('application/field-type') || e.dataTransfer.getData('text/plain');
                          
                          if (fieldId) {
                            // Moving existing field
                            updateField(fieldId, { x, y, pageNumber: page.pageNumber });
                          } else if (fieldType) {
                            // Adding new field
                            addField(x, y, fieldType as SignatureField['type'], page.pageNumber);
                          }
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'copy';
                        }}
                        onDragEnter={(e) => {
                          e.preventDefault();
                        }}
                        onDragLeave={(e) => {
                          e.preventDefault();
                        }}
                      />

                      {/* Signature Fields for this page */}
                      {signatureFields
                        .filter(field => field.pageNumber === page.pageNumber)
                        .map(field => {
                          // Scale field position to match display
                          const fieldX = (field.x * displayWidth) / page.width;
                          const fieldY = (field.y * displayHeight) / page.height;
                          const fieldWidth = (field.width * displayWidth) / page.width;
                          const fieldHeight = (field.height * displayHeight) / page.height;
                          
                          return (
                            <div
                              key={field.id}
                              draggable
                              className={`absolute border-2 ${FIELD_COLORS[field.type]} rounded px-2 py-1 text-xs group hover:shadow-md transition-all cursor-move select-none`}
                              style={{
                                left: fieldX,
                                top: fieldY,
                                width: fieldWidth,
                                height: fieldHeight,
                                minWidth: '80px',
                                minHeight: '20px',
                                zIndex: 20,
                              }}
                              onDragStart={(e) => {
                                e.dataTransfer.setData('application/field-id', field.id);
                                e.dataTransfer.effectAllowed = 'move';
                                e.currentTarget.style.opacity = '0.5';
                              }}
                              onDragEnd={(e) => {
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

      {/* Instructions */}
      <Card className="p-4">
        <h4 className="font-medium mb-2">How to Use</h4>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• Drag signature field types from the left sidebar onto the document</li>
          <li>• Drop fields precisely where you want signers to fill them in</li>
          <li>• Drag existing fields to reposition them</li>
          <li>• Double-click field labels to edit them</li>
          <li>• Field coordinates are saved for exact placement in the final PDF</li>
        </ul>
      </Card>
    </div>
  );
}