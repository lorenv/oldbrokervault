import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useDrop, useDrag } from 'react-dnd';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Trash2, Type, FileSignature, Calendar, Mail, AlignLeft, ExternalLink, FileText } from 'lucide-react';

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

interface FallbackPdfEditorProps {
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
        zIndex: 100,
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

export default function FallbackPdfEditor({
  pdfBase64,
  signatureFields,
  onFieldsChange,
  selectedFieldType
}: FallbackPdfEditorProps) {
  const [currentPage] = useState(1);
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const containerRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);

  // Create blob URL for PDF viewing
  useEffect(() => {
    if (pdfBase64) {
      try {
        console.log('Creating PDF workspace from base64, length:', pdfBase64.length);
        
        const binaryString = atob(pdfBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        const blob = new Blob([bytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
        
        console.log('PDF workspace ready');
        
        return () => {
          URL.revokeObjectURL(url);
        };
      } catch (error) {
        console.error('Error creating PDF workspace:', error);
      }
    }
  }, [pdfBase64]);

  // Drop handler for new fields
  const [{ isOver }, drop] = useDrop({
    accept: ['new-field', 'field'],
    drop: (item: any, monitor) => {
      const offset = monitor.getClientOffset();
      const containerRect = workspaceRef.current?.getBoundingClientRect();
      
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

  const handleWorkspaceClick = useCallback((e: React.MouseEvent) => {
    if (e.target === workspaceRef.current || (e.target as HTMLElement).classList.contains('pdf-workspace')) {
      const rect = workspaceRef.current?.getBoundingClientRect();
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

  const currentPageFields = signatureFields.filter(field => field.pageNumber === currentPage);

  if (!pdfUrl) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-sm text-gray-600">Setting up PDF workspace...</p>
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
            onClick={openPdfInNewTab}
          >
            <ExternalLink className="w-4 h-4 mr-1" />
            View PDF Externally
          </Button>
        </div>

        <div className="text-sm text-gray-600">
          {currentPageFields.length} field{currentPageFields.length !== 1 ? 's' : ''} positioned
        </div>
      </div>

      {/* PDF Template Workspace */}
      <div
        ref={containerRef}
        className="relative border rounded-lg overflow-hidden bg-gray-50"
        style={{ height: '600px' }}
      >
        <div
          ref={(el) => {
            drop(el);
            workspaceRef.current = el;
          }}
          className={`absolute inset-0 pdf-workspace cursor-crosshair ${
            isOver ? 'bg-blue-50 border-blue-300' : ''
          }`}
          onClick={handleWorkspaceClick}
          style={{
            backgroundImage: `
              linear-gradient(to right, #e5e7eb 1px, transparent 1px),
              linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
            backgroundPosition: '20px 20px'
          }}
        >
          {/* PDF Representation */}
          <div className="absolute inset-4 bg-white shadow-lg rounded flex items-center justify-center">
            <div className="text-center">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-700 mb-2">PDF Template Workspace</h3>
              <p className="text-sm text-gray-600 mb-4">
                Your PDF template is loaded and ready for signature field placement
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={openPdfInNewTab}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                View Full PDF
              </Button>
            </div>
          </div>
          
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
            <div className="absolute top-8 left-8 pointer-events-none">
              <div className="bg-blue-600 text-white px-3 py-1 rounded text-xs">
                Click anywhere to add {selectedFieldType} field
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Instructions */}
      <Card className="p-4">
        <h4 className="font-medium mb-2">Template Editor Instructions</h4>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• PDF is loaded and ready - click anywhere in the workspace to add signature fields</li>
          <li>• Drag fields to reposition them precisely</li>
          <li>• Double-click field labels to edit them</li>
          <li>• Use the trash icon to delete fields</li>
          <li>• Click "View PDF Externally" to see the full document</li>
          <li>• Field coordinates are saved for exact signature placement</li>
        </ul>
      </Card>
    </div>
  );
}