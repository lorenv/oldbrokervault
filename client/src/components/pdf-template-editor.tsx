import React, { useState, useCallback, useRef } from 'react';
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

interface PdfTemplateEditorProps {
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
      className={`absolute cursor-move border-2 border-dashed rounded px-2 py-1 text-xs select-none z-20 ${
        FIELD_COLORS[field.type]
      } ${isDragging ? 'opacity-50' : ''}`}
      style={{
        left: field.x,
        top: field.y,
        width: field.width,
        height: field.height,
        minHeight: '30px',
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

export default function PdfTemplateEditor({
  pdfBase64,
  signatureFields,
  onFieldsChange,
  selectedFieldType
}: PdfTemplateEditorProps) {
  const [currentPage] = useState(1);
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Create blob URL for PDF
  React.useEffect(() => {
    if (pdfBase64) {
      try {
        console.log('Creating PDF blob URL from base64, length:', pdfBase64.length);
        
        // Convert base64 to blob
        const binaryString = atob(pdfBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        const blob = new Blob([bytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
        
        console.log('PDF blob URL created successfully');
        
        // Cleanup function
        return () => {
          URL.revokeObjectURL(url);
        };
      } catch (error) {
        console.error('Error creating PDF blob URL:', error);
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
      x: Math.max(0, x - 75), // Center the field on click
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

  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('pdf-overlay')) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      addField(x, y, selectedFieldType);
    }
  }, [addField, selectedFieldType]);

  const openPdfInNewTab = () => {
    if (pdfUrl) {
      window.open(pdfUrl, '_blank');
    } else {
      // Fallback to data URL
      const dataUrl = `data:application/pdf;base64,${pdfBase64}`;
      window.open(dataUrl, '_blank');
    }
  };

  const currentPageFields = signatureFields.filter(field => field.pageNumber === currentPage);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
        <div className="flex items-center gap-2">
          <span className="text-sm px-3">
            Page 1 (Interactive PDF Editor)
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={openPdfInNewTab}
            className="ml-2"
          >
            <ExternalLink className="w-4 h-4 mr-1" />
            View PDF
          </Button>
        </div>
        
        <div className="text-sm text-gray-600">
          {currentPageFields.length} field{currentPageFields.length !== 1 ? 's' : ''} positioned
        </div>
      </div>

      {/* PDF Container - Simplified approach */}
      <div
        ref={(el) => {
          drop(el);
          containerRef.current = el;
        }}
        className={`relative border rounded-lg overflow-hidden ${
          isOver ? 'bg-blue-50 border-blue-300' : 'bg-white'
        }`}
        style={{ height: '600px' }}
        onClick={handleContainerClick}
      >
        {/* PDF Preview Area */}
        <div className="absolute inset-0 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
          <div className="text-center">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-sm text-gray-600 mb-2">PDF Template Loaded</p>
            <p className="text-xs text-gray-500 mb-4">Click anywhere to add signature fields</p>
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
        
        {/* Interactive Overlay */}
        <div
          className="absolute inset-0 pdf-overlay cursor-crosshair"
          style={{ zIndex: 10 }}
        >
          {/* Render signature fields for current page */}
          {currentPageFields.map((field) => (
            <FieldComponent
              key={field.id}
              field={field}
              onUpdate={updateField}
              onDelete={deleteField}
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

        {/* PDF Grid for reference */}
        <div 
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(to right, #e5e7eb 1px, transparent 1px),
              linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px'
          }}
        />
      </div>

      {/* Field Instructions */}
      <Card className="p-4">
        <h4 className="font-medium mb-2">Field Instructions</h4>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• Click anywhere in the template area to add a {selectedFieldType} field</li>
          <li>• Drag fields to reposition them precisely</li>
          <li>• Double-click field labels to edit them</li>
          <li>• Use the trash icon to delete fields</li>
          <li>• Click "View PDF" to see the full document with exact positioning</li>
          <li>• Fields are saved with precise coordinates for signature placement</li>
        </ul>
      </Card>
    </div>
  );
}