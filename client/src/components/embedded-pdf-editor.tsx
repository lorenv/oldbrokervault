import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useDrop, useDrag } from 'react-dnd';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Trash2, Type, FileSignature, Calendar, Mail, AlignLeft, ExternalLink, RefreshCw } from 'lucide-react';

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

interface EmbeddedPdfEditorProps {
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

const FieldComponent = ({ field, onUpdate, onDelete }: {
  field: SignatureField;
  onUpdate: (id: string, updates: Partial<SignatureField>) => void;
  onDelete: (id: string) => void;
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
        left: field.x,
        top: field.y,
        width: field.width,
        height: field.height,
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

export default function EmbeddedPdfEditor({
  pdfBase64,
  signatureFields,
  onFieldsChange,
  selectedFieldType
}: EmbeddedPdfEditorProps) {
  const [currentPage] = useState(1);
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [isLoaded, setIsLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const embedRef = useRef<HTMLEmbedElement>(null);

  // Create blob URL for PDF
  useEffect(() => {
    if (pdfBase64) {
      try {
        console.log('Creating PDF embed URL from base64, length:', pdfBase64.length);
        
        const binaryString = atob(pdfBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        const blob = new Blob([bytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
        
        console.log('PDF embed URL created successfully');
        
        return () => {
          URL.revokeObjectURL(url);
        };
      } catch (error) {
        console.error('Error creating PDF embed URL:', error);
      }
    }
  }, [pdfBase64]);

  // Drop handler for new fields
  const [{ isOver }, drop] = useDrop({
    accept: ['new-field', 'field'],
    drop: (item: any, monitor) => {
      const offset = monitor.getClientOffset();
      const containerRect = containerRef.current?.getBoundingClientRect();
      
      if (!offset || !containerRect) return;
      
      const x = offset.x - containerRect.left;
      const y = offset.y - containerRect.top;
      
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

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        addField(x, y, selectedFieldType);
      }
    }
  }, [addField, selectedFieldType]);

  const openPdfInNewTab = () => {
    if (pdfUrl) {
      window.open(pdfUrl, '_blank');
    }
  };

  const reloadPdf = () => {
    setIsLoaded(false);
    if (embedRef.current) {
      embedRef.current.src = pdfUrl + '#toolbar=0&navpanes=0&scrollbar=0&zoom=page-fit';
    }
  };

  const currentPageFields = signatureFields.filter(field => field.pageNumber === currentPage);

  if (!pdfUrl) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-sm text-gray-600">Preparing PDF...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
        <div className="flex items-center gap-2">
          <span className="text-sm">
            PDF Template Editor - Page 1
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={reloadPdf}
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Reload
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={openPdfInNewTab}
          >
            <ExternalLink className="w-4 h-4 mr-1" />
            View Externally
          </Button>
        </div>

        <div className="text-sm text-gray-600">
          {currentPageFields.length} field{currentPageFields.length !== 1 ? 's' : ''} positioned
        </div>
      </div>

      {/* PDF Container with Embedded Viewer */}
      <div
        ref={(el) => {
          drop(el);
          containerRef.current = el;
        }}
        className={`relative border rounded-lg overflow-hidden bg-white ${
          isOver ? 'border-blue-300 shadow-lg' : 'border-gray-300'
        }`}
        style={{ height: '600px' }}
      >
        {/* PDF Embed */}
        <embed
          ref={embedRef}
          src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0&zoom=page-fit`}
          type="application/pdf"
          className="w-full h-full"
          onLoad={() => {
            console.log('PDF embed loaded successfully');
            setIsLoaded(true);
          }}
          onError={() => {
            console.log('PDF embed failed, trying alternative method');
            setIsLoaded(false);
          }}
        />
        
        {/* Fallback iframe if embed fails */}
        {!isLoaded && (
          <iframe
            src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0`}
            className="absolute inset-0 w-full h-full"
            title="PDF Template"
            onLoad={() => {
              console.log('PDF iframe fallback loaded');
              setIsLoaded(true);
            }}
          />
        )}
        
        {/* Interactive Overlay */}
        <div
          ref={overlayRef}
          className="absolute inset-0 cursor-crosshair bg-transparent"
          onClick={handleOverlayClick}
          style={{ 
            zIndex: 500,
            pointerEvents: 'auto'
          }}
        >
          {/* Signature Fields */}
          {currentPageFields.map((field) => (
            <FieldComponent
              key={field.id}
              field={field}
              onUpdate={updateField}
              onDelete={deleteField}
            />
          ))}
          
          {/* Click instruction */}
          {currentPageFields.length === 0 && (
            <div className="absolute top-4 left-4 pointer-events-none">
              <div className="bg-blue-600 text-white px-3 py-1 rounded text-xs opacity-90">
                Click anywhere on PDF to add {selectedFieldType} field
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Instructions */}
      <Card className="p-4">
        <h4 className="font-medium mb-2">Interactive PDF Template Editor</h4>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• PDF is embedded above - click anywhere to add signature fields</li>
          <li>• Drag fields to reposition them precisely on the document</li>
          <li>• Double-click field labels to edit them</li>
          <li>• Use the trash icon to delete fields</li>
          <li>• If PDF doesn't display, click "Reload" or "View Externally"</li>
          <li>• Field coordinates are saved for exact signature placement</li>
        </ul>
      </Card>
    </div>
  );
}