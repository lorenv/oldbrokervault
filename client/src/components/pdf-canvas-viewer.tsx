import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useDrop, useDrag } from 'react-dnd';
import * as pdfjsLib from 'pdfjs-dist';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';

// Configure PDF.js worker - disable for better compatibility
if (typeof window !== 'undefined') {
  // Disable worker for better compatibility in development
  pdfjsLib.GlobalWorkerOptions.workerSrc = false;
}

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

interface PdfCanvasViewerProps {
  pdfBase64: string;
  signatureFields: SignatureField[];
  onFieldsChange: (fields: SignatureField[]) => void;
  selectedFieldType: SignatureField['type'];
}

const FIELD_COLORS = {
  signature: 'border-blue-500 bg-blue-50',
  name: 'border-green-500 bg-green-50',
  date: 'border-purple-500 bg-purple-50',
  email: 'border-orange-500 bg-orange-50',
  text: 'border-gray-500 bg-gray-50'
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

  return (
    <div
      ref={drag}
      className={`absolute cursor-move border-2 border-dashed rounded px-2 py-1 text-xs select-none ${
        FIELD_COLORS[field.type]
      } ${isDragging ? 'opacity-50' : ''}`}
      style={{
        left: field.x * scale,
        top: field.y * scale,
        width: field.width * scale,
        height: field.height * scale,
        fontSize: Math.max(8, field.fontSize * scale),
      }}
      onDoubleClick={() => setIsEditing(true)}
    >
      <div className="flex items-center justify-between h-full">
        {isEditing ? (
          <Input
            value={editLabel}
            onChange={(e) => setEditLabel(e.target.value)}
            onBlur={handleLabelUpdate}
            onKeyDown={(e) => e.key === 'Enter' && handleLabelUpdate()}
            className="h-4 text-xs border-0 p-0 bg-transparent"
            autoFocus
          />
        ) : (
          <span className="truncate">{field.label}</span>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-3 w-3 p-0 hover:bg-red-100"
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

export default function PdfCanvasViewer({
  pdfBase64,
  signatureFields,
  onFieldsChange,
  selectedFieldType
}: PdfCanvasViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  // Load PDF document
  useEffect(() => {
    if (!pdfBase64) return;

    const loadPdf = async () => {
      setIsLoading(true);
      try {
        console.log('Loading PDF with base64 length:', pdfBase64.length);
        
        // Try multiple loading methods for better compatibility
        let loadingTask;
        
        try {
          // Method 1: Direct data URL
          const dataUrl = `data:application/pdf;base64,${pdfBase64}`;
          loadingTask = pdfjsLib.getDocument({
            url: dataUrl,
            disableWorker: true,
            isEvalSupported: false,
          });
        } catch (error) {
          console.log('Data URL method failed, trying Uint8Array method');
          
          // Method 2: Uint8Array conversion
          const binaryString = atob(pdfBase64);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          
          loadingTask = pdfjsLib.getDocument({
            data: bytes,
            disableWorker: true,
            isEvalSupported: false,
          });
        }
        
        const pdf = await loadingTask.promise;
        console.log('PDF loaded successfully, pages:', pdf.numPages);
        setPdfDoc(pdf);
        setTotalPages(pdf.numPages);
        setCurrentPage(1);
      } catch (error) {
        console.error('Error loading PDF:', error);
        console.error('PDF base64 preview:', pdfBase64.substring(0, 100) + '...');
      } finally {
        setIsLoading(false);
      }
    };

    loadPdf();
  }, [pdfBase64]);

  // Render current page
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    const renderPage = async () => {
      try {
        console.log('Rendering page:', currentPage, 'with scale:', scale);
        const page = await pdfDoc.getPage(currentPage);
        const canvas = canvasRef.current!;
        const context = canvas.getContext('2d')!;

        const viewport = page.getViewport({ scale });
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        // Clear canvas before rendering
        context.clearRect(0, 0, canvas.width, canvas.height);

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        await page.render(renderContext).promise;
        console.log('Page rendered successfully');
      } catch (error) {
        console.error('Error rendering page:', error);
      }
    };

    renderPage();
  }, [pdfDoc, currentPage, scale]);

  // Auto-scale to fit container
  useEffect(() => {
    if (!pdfDoc || !containerRef.current) return;

    const updateScale = async () => {
      const page = await pdfDoc.getPage(1);
      const viewport = page.getViewport({ scale: 1 });
      const containerWidth = containerRef.current!.clientWidth - 40;
      const optimalScale = Math.min(containerWidth / viewport.width, 1.5);
      setScale(optimalScale);
    };

    updateScale();
  }, [pdfDoc]);

  // Drop handler for new fields
  const [{ isOver }, drop] = useDrop({
    accept: ['new-field', 'field'],
    drop: (item: any, monitor) => {
      const offset = monitor.getClientOffset();
      const canvasRect = canvasRef.current?.getBoundingClientRect();
      
      if (!offset || !canvasRect) return;
      
      const x = (offset.x - canvasRect.left) / scale;
      const y = (offset.y - canvasRect.top) / scale;
      
      if (item.type && !item.id) {
        // New field from palette
        addField(x, y, item.type);
      } else if (item.id) {
        // Moving existing field
        updateField(item.id, { x, y, pageNumber: currentPage });
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  const addField = useCallback((x: number, y: number, type: SignatureField['type']) => {
    const newField: SignatureField = {
      id: `field_${Date.now()}`,
      type,
      label: `${type.charAt(0).toUpperCase() + type.slice(1)} Field`,
      x,
      y,
      width: type === 'signature' ? 200 : 150,
      height: type === 'signature' ? 60 : 30,
      pageNumber: currentPage,
      required: true,
      fontSize: 12,
      placeholder: type === 'date' ? 'MM/DD/YYYY' : undefined
    };
    onFieldsChange([...signatureFields, newField]);
  }, [signatureFields, onFieldsChange, currentPage]);

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

  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;
    addField(x, y, selectedFieldType);
  }, [addField, selectedFieldType, scale]);

  const currentPageFields = signatureFields.filter(field => field.pageNumber === currentPage);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-sm text-gray-600">Loading PDF...</p>
        </div>
      </div>
    );
  }

  if (!pdfDoc) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-sm text-red-600 mb-2">Failed to load PDF</p>
          <p className="text-xs text-gray-500">Please try uploading the PDF again</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm px-3">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage >= totalPages}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setScale(scale * 0.8)}
            disabled={scale <= 0.5}
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-sm px-2">{Math.round(scale * 100)}%</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setScale(scale * 1.25)}
            disabled={scale >= 2}
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
        </div>

        <div className="text-sm text-gray-600">
          {currentPageFields.length} field{currentPageFields.length !== 1 ? 's' : ''} on this page
        </div>
      </div>

      {/* Canvas Container */}
      <div
        ref={containerRef}
        className="relative border rounded-lg overflow-auto bg-gray-100 p-4"
        style={{ height: '600px' }}
      >
        <div
          ref={drop}
          className={`relative inline-block ${isOver ? 'bg-blue-50' : ''}`}
          style={{ minWidth: '100%', minHeight: '100%' }}
        >
          <canvas
            ref={canvasRef}
            className="border border-gray-300 bg-white cursor-crosshair"
            onClick={handleCanvasClick}
          />
          
          {/* Render signature fields for current page */}
          {currentPageFields.map((field) => (
            <FieldComponent
              key={field.id}
              field={field}
              onUpdate={updateField}
              onDelete={deleteField}
              scale={scale}
            />
          ))}
          
          {/* Click instruction overlay */}
          {currentPageFields.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">
                Click anywhere to add a {selectedFieldType} field
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Field Instructions */}
      <Card className="p-4">
        <h4 className="font-medium mb-2">Field Instructions</h4>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• Click anywhere on the PDF to add a {selectedFieldType} field</li>
          <li>• Drag fields to reposition them</li>
          <li>• Double-click field labels to edit them</li>
          <li>• Use the trash icon to delete fields</li>
          <li>• Fields are saved per page automatically</li>
        </ul>
      </Card>
    </div>
  );
}