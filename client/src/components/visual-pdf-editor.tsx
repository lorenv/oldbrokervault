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

interface VisualPdfEditorProps {
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

export default function VisualPdfEditor({
  pdfBase64,
  signatureFields,
  onFieldsChange,
  selectedFieldType
}: VisualPdfEditorProps) {
  const [currentPage] = useState(1);
  const [pdfDataUrl, setPdfDataUrl] = useState<string>('');
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Create data URL for PDF
  useEffect(() => {
    if (pdfBase64) {
      const dataUrl = `data:application/pdf;base64,${pdfBase64}`;
      setPdfDataUrl(dataUrl);
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

  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    // Only add field if clicking on the container itself, not on existing fields or buttons
    if (e.target === containerRef.current || (e.target as HTMLElement).classList.contains('pdf-layer')) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        addField(x, y, selectedFieldType);
      }
    }
  }, [addField, selectedFieldType]);

  const openPdfInNewTab = () => {
    if (pdfDataUrl) {
      window.open(pdfDataUrl, '_blank');
    }
  };

  const togglePdfPreview = () => {
    setShowPdfPreview(!showPdfPreview);
  };

  const currentPageFields = signatureFields.filter(field => field.pageNumber === currentPage);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
        <div className="flex items-center gap-2">
          <span className="text-sm">
            PDF Template Editor - Page 1
          </span>
          <Button
            variant={showPdfPreview ? "default" : "outline"}
            size="sm"
            onClick={togglePdfPreview}
          >
            {showPdfPreview ? "Hide PDF" : "Show PDF"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={openPdfInNewTab}
          >
            <ExternalLink className="w-4 h-4 mr-1" />
            Open PDF
          </Button>
        </div>

        <div className="text-sm text-gray-600">
          {currentPageFields.length} field{currentPageFields.length !== 1 ? 's' : ''} positioned
        </div>
      </div>

      {/* PDF Editor Container */}
      <div
        ref={(el) => {
          drop(el);
          containerRef.current = el;
        }}
        className={`relative border rounded-lg overflow-hidden bg-white ${
          isOver ? 'border-blue-300 shadow-lg' : 'border-gray-300'
        }`}
        style={{ height: '600px' }}
        onClick={handleContainerClick}
      >
        {/* PDF Background Layer */}
        {showPdfPreview && pdfDataUrl && (
          <iframe
            ref={iframeRef}
            src={`${pdfDataUrl}#toolbar=0&navpanes=0&scrollbar=0&zoom=page-fit`}
            className="absolute inset-0 w-full h-full border-0 pointer-events-none"
            title="PDF Preview"
            style={{ zIndex: 1 }}
          />
        )}
        
        {/* Workspace Layer */}
        {!showPdfPreview && (
          <div 
            className="absolute inset-0 bg-gradient-to-br from-blue-50 to-indigo-50 pdf-layer"
            style={{
              backgroundImage: `
                linear-gradient(to right, #e0e7ff 1px, transparent 1px),
                linear-gradient(to bottom, #e0e7ff 1px, transparent 1px)
              `,
              backgroundSize: '40px 40px',
              backgroundPosition: '20px 20px'
            }}
          >
            {/* Document representation */}
            <div className="absolute inset-6 bg-white shadow-xl rounded-lg border border-gray-200 flex items-center justify-center pdf-layer">
              <div className="text-center">
                <div className="w-20 h-24 mx-auto mb-4 bg-blue-100 rounded-lg border-2 border-blue-200 flex items-center justify-center">
                  <span className="text-3xl text-blue-600">📄</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">PDF Template Editor</h3>
                <p className="text-sm text-gray-600 mb-4 max-w-md">
                  Your PDF is loaded and ready. Click "Show PDF" to see the document, or click anywhere here to add signature fields.
                </p>
                <div className="flex gap-2 justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={togglePdfPreview}
                  >
                    Show PDF Background
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={openPdfInNewTab}
                  >
                    <ExternalLink className="w-3 h-3 mr-1" />
                    Open PDF
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Interactive Overlay for Fields */}
        <div
          className="absolute inset-0 pdf-layer"
          style={{ zIndex: 500 }}
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
                Click anywhere to add {selectedFieldType} field
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Instructions */}
      <Card className="p-4">
        <h4 className="font-medium mb-2">PDF Template Editor Instructions</h4>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• Click "Show PDF" to see your document as background while positioning fields</li>
          <li>• Click anywhere in the editor area to add signature fields</li>
          <li>• Drag fields to reposition them precisely</li>
          <li>• Double-click field labels to edit them</li>
          <li>• Use "Open PDF" to view the full document in a new tab</li>
          <li>• Field coordinates are saved for exact signature placement</li>
        </ul>
      </Card>
    </div>
  );
}