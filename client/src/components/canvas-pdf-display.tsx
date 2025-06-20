import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useDrop, useDrag } from 'react-dnd';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Trash2, Type, FileSignature, Calendar, Mail, AlignLeft, ExternalLink, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker with fallback
if (typeof window !== 'undefined') {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.js',
      import.meta.url
    ).toString();
  } catch {
    // Fallback to disable worker if there are issues
    pdfjsLib.GlobalWorkerOptions.workerSrc = '';
  }
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

interface CanvasPdfDisplayProps {
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

export default function CanvasPdfDisplay({
  pdfBase64,
  signatureFields,
  onFieldsChange,
  selectedFieldType
}: CanvasPdfDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');

  // Load PDF document
  useEffect(() => {
    const loadPdf = async () => {
      if (!pdfBase64) return;
      
      setIsLoading(true);
      setError('');
      
      try {
        console.log('Loading PDF with canvas renderer, base64 length:', pdfBase64.length);
        
        // Convert base64 to Uint8Array
        const binaryString = atob(pdfBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        const loadingTask = pdfjsLib.getDocument({
          data: bytes,
          disableWorker: true, // Disable worker to avoid setup issues
          verbosity: 0,
        });
        
        const pdf = await loadingTask.promise;
        console.log('PDF loaded successfully, pages:', pdf.numPages);
        
        setPdfDoc(pdf);
        setTotalPages(pdf.numPages);
        setCurrentPage(1);
      } catch (error) {
        console.error('Error loading PDF:', error);
        setError('Failed to load PDF. The file may be corrupted or unsupported.');
      } finally {
        setIsLoading(false);
      }
    };

    loadPdf();
  }, [pdfBase64]);

  // Render current page to canvas
  useEffect(() => {
    const renderPage = async () => {
      if (!pdfDoc || !canvasRef.current) return;

      try {
        const page = await pdfDoc.getPage(currentPage);
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        
        if (!context) return;

        const viewport = page.getViewport({ scale });
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        // Clear canvas
        context.clearRect(0, 0, canvas.width, canvas.height);

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        await page.render(renderContext).promise;
        console.log('Page rendered successfully to canvas');
      } catch (error) {
        console.error('Error rendering page:', error);
        setError('Failed to render PDF page');
      }
    };

    renderPage();
  }, [pdfDoc, currentPage, scale]);

  // Auto-scale to fit container
  useEffect(() => {
    const updateScale = async () => {
      if (!pdfDoc || !containerRef.current) return;

      try {
        const page = await pdfDoc.getPage(1);
        const viewport = page.getViewport({ scale: 1 });
        const containerWidth = containerRef.current.clientWidth - 40;
        const optimalScale = Math.min(containerWidth / viewport.width, 1.2);
        setScale(optimalScale);
      } catch (error) {
        console.error('Error calculating scale:', error);
      }
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
        addField(x, y, item.type);
      } else if (item.id) {
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
      x: Math.max(0, x - 75),
      y: Math.max(0, y - 15),
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

  const openPdfInNewTab = () => {
    const dataUrl = `data:application/pdf;base64,${pdfBase64}`;
    window.open(dataUrl, '_blank');
  };

  const currentPageFields = signatureFields.filter(field => field.pageNumber === currentPage);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-sm text-gray-600">Rendering PDF to canvas...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-sm text-red-600 mb-2">{error}</p>
          <Button onClick={openPdfInNewTab} variant="outline">
            <ExternalLink className="w-4 h-4 mr-2" />
            Open PDF Externally
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
          
          <Button variant="outline" size="sm" onClick={openPdfInNewTab} className="ml-2">
            <ExternalLink className="w-4 h-4 mr-1" />
            Open PDF
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
          className={`relative inline-block ${isOver ? 'shadow-lg' : ''}`}
        >
          <canvas
            ref={canvasRef}
            className="border border-gray-300 bg-white cursor-crosshair"
            onClick={handleCanvasClick}
          />
          
          {/* Signature Fields Overlay */}
          {currentPageFields.map((field) => (
            <FieldComponent
              key={field.id}
              field={field}
              onUpdate={updateField}
              onDelete={deleteField}
              scale={scale}
            />
          ))}
          
          {/* Click instruction */}
          {currentPageFields.length === 0 && (
            <div className="absolute top-4 left-4 pointer-events-none">
              <div className="bg-blue-600 text-white px-3 py-1 rounded text-xs">
                Click anywhere on PDF to add {selectedFieldType} field
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Instructions */}
      <Card className="p-4">
        <h4 className="font-medium mb-2">Canvas PDF Template Editor</h4>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• PDF rendered directly to canvas - click anywhere to add signature fields</li>
          <li>• Use page navigation and zoom controls above</li>
          <li>• Drag fields to reposition them precisely on the document</li>
          <li>• Double-click field labels to edit them</li>
          <li>• Field coordinates are saved with exact precision for signature placement</li>
        </ul>
      </Card>
    </div>
  );
}