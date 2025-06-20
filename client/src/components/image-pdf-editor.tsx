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
  selectedFieldType: SignatureField['type'];
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

export default function ImagePdfEditor({
  pdfBase64,
  signatureFields,
  onFieldsChange,
  selectedFieldType
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

  // Auto-scale images to fit container
  useEffect(() => {
    if (containerRef.current && pageImages.length > 0) {
      const container = containerRef.current;
      const containerWidth = container.clientWidth - 64; // Account for padding
      const firstPageWidth = pageImages[0]?.width || 1200;
      
      if (firstPageWidth > 0) {
        const calculatedScale = containerWidth / firstPageWidth;
        setScale(calculatedScale);
        console.log('Image scale set to:', calculatedScale);
      }
    }
  }, [pageImages]);

  // Drop handler for field placement
  const [{ isOver }, dropProps] = useDrop({
    accept: ['new-field', 'field'],
    drop: (item: any, monitor) => {
      const offset = monitor.getClientOffset();
      const imageRect = imageRef.current?.getBoundingClientRect();
      
      if (!offset || !imageRect) return;
      
      const x = (offset.x - imageRect.left) / scale;
      const y = (offset.y - imageRect.top) / scale;
      
      // Calculate which page this drop is on
      let cumulativeHeight = 0;
      let targetPage = 1;
      let adjustedY = y;
      
      for (const page of pageImages) {
        const pageHeight = page.height * scale;
        if (y >= cumulativeHeight && y < cumulativeHeight + pageHeight) {
          targetPage = page.pageNumber;
          // Adjust y coordinate to be relative to the page
          adjustedY = y - cumulativeHeight;
          break;
        }
        cumulativeHeight += pageHeight + 20; // 20px gap between pages
      }
      
      if (item.type && !item.id) {
        addField(x, adjustedY, item.type, targetPage);
      } else if (item.id) {
        updateField(item.id, { x, y: adjustedY, pageNumber: targetPage });
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

  const handleImageClick = useCallback((e: React.MouseEvent, pageNumber: number) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect) return;

    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;
    addField(x, y, selectedFieldType, pageNumber);
  }, [addField, selectedFieldType, scale]);

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
      {/* Toolbar */}
      <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {totalPages} page{totalPages !== 1 ? 's' : ''} • Scroll to position fields
          </span>
          
          <Button variant="outline" size="sm" onClick={openPdfInNewTab} className="ml-2">
            <ExternalLink className="w-4 h-4 mr-1" />
            View Original PDF
          </Button>
        </div>
        
        <div className="text-sm text-gray-600">
          {signatureFields.length} field{signatureFields.length !== 1 ? 's' : ''} positioned
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
          className={`relative max-h-[800px] overflow-y-auto p-4 ${isOver ? 'bg-blue-50 border-2 border-blue-300 border-dashed' : ''}`}
          {...dropProps}
          style={{ minHeight: isLoading ? '400px' : 'auto' }}
        >
          {pageImages.length > 0 && !isLoading && (
            <div className="space-y-5">
              {pageImages.map((page, index) => {
                return (
                  <div key={page.pageNumber} className="relative">
                    {/* Page number indicator */}
                    <div className="absolute -top-3 left-0 bg-blue-600 text-white px-2 py-1 rounded text-xs font-medium z-10">
                      Page {page.pageNumber}
                    </div>
                    
                    {/* Page image */}
                    <img
                      src={page.imageDataUrl}
                      alt={`PDF Page ${page.pageNumber}`}
                      className="w-full h-auto border rounded shadow-sm cursor-crosshair select-none"
                      onClick={(e) => handleImageClick(e, page.pageNumber)}
                      onDragStart={(e) => e.preventDefault()}
                      style={{
                        transform: `scale(${scale})`,
                        transformOrigin: 'top left',
                        pointerEvents: 'auto'
                      }}
                    />
                    
                    {/* Signature Fields Overlay for this page */}
                    <div className="absolute inset-0 pointer-events-none">
                      {signatureFields
                        .filter(field => field.pageNumber === page.pageNumber)
                        .map((field) => (
                          <div key={field.id} className="pointer-events-auto">
                            <FieldComponent
                              field={field}
                              onUpdate={updateField}
                              onDelete={deleteField}
                              scale={scale}
                            />
                          </div>
                        ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          
          {/* Instructions overlay */}
          {signatureFields.length === 0 && pageImages.length > 0 && (
            <div className="absolute top-8 left-4 pointer-events-none z-10">
              <div className="bg-blue-600 text-white px-3 py-1 rounded text-xs opacity-90">
                Click on any page or drag fields from the sidebar to add {selectedFieldType} fields
              </div>
            </div>
          )}
          
          {/* Drop zone indicator */}
          {isOver && (
            <div className="absolute inset-4 pointer-events-none z-20 flex items-center justify-center">
              <div className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg opacity-90">
                Drop field here to position on the PDF
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Instructions */}
      <Card className="p-4">
        <h4 className="font-medium mb-2">PDF Template Editor</h4>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• All PDF pages converted to images and displayed vertically</li>
          <li>• Scroll through pages to position signature fields anywhere</li>
          <li>• Click anywhere on any page to add signature fields</li>
          <li>• Drag fields to reposition them precisely</li>
          <li>• Double-click field labels to edit them</li>
          <li>• Field coordinates are saved for exact signature placement in the final PDF</li>
        </ul>
      </Card>
    </div>
  );
}