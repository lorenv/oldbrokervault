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

interface DebugPdfRendererProps {
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

export default function DebugPdfRenderer({
  pdfBase64,
  signatureFields,
  onFieldsChange,
  selectedFieldType
}: DebugPdfRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [debugInfo, setDebugInfo] = useState<string>('');

  useEffect(() => {
    if (pdfBase64) {
      console.log('Debug PDF Renderer - PDF Base64 length:', pdfBase64.length);
      
      // Create data URL
      const url = `data:application/pdf;base64,${pdfBase64}`;
      setPdfUrl(url);
      
      // Try to validate PDF header
      try {
        const binaryString = atob(pdfBase64);
        const header = binaryString.substring(0, 8);
        console.log('PDF header:', header);
        setDebugInfo(`PDF size: ${pdfBase64.length} chars, Header: ${header}`);
      } catch (e) {
        console.error('Error checking PDF:', e);
        setDebugInfo(`PDF size: ${pdfBase64.length} chars, Error: ${e}`);
      }
    }
  }, [pdfBase64]);

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
        updateField(item.id, { x, y });
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
      pageNumber: 1,
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

  const handleWorkspaceClick = useCallback((e: React.MouseEvent) => {
    if (e.target === containerRef.current || (e.target as HTMLElement).classList.contains('workspace-area')) {
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

  return (
    <div className="space-y-4">
      {/* Debug Info */}
      <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
        <h4 className="text-sm font-medium text-yellow-800 mb-1">Debug Information</h4>
        <p className="text-xs text-yellow-700">{debugInfo}</p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
        <div className="flex items-center gap-2">
          <span className="text-sm">PDF Template Editor (Debug Mode)</span>
          <Button variant="outline" size="sm" onClick={openPdfInNewTab}>
            <ExternalLink className="w-4 h-4 mr-1" />
            Test PDF
          </Button>
        </div>
        <div className="text-sm text-gray-600">
          {signatureFields.length} field{signatureFields.length !== 1 ? 's' : ''} positioned
        </div>
      </div>

      {/* Main Editor Area */}
      <div
        ref={(el) => {
          drop(el);
          containerRef.current = el;
        }}
        className={`relative border rounded-lg overflow-hidden ${
          isOver ? 'border-blue-300 shadow-lg' : 'border-gray-300'
        }`}
        style={{ height: '600px' }}
        onClick={handleWorkspaceClick}
      >
        {/* PDF Preview Attempt */}
        <div className="absolute inset-0">
          <object
            data={pdfUrl}
            type="application/pdf"
            className="w-full h-full"
            style={{ zIndex: 1 }}
          >
            <iframe
              src={pdfUrl}
              className="w-full h-full border-0"
              title="PDF Preview"
              style={{ zIndex: 1 }}
            >
              {/* Fallback workspace */}
              <div 
                className="absolute inset-0 bg-gradient-to-br from-blue-50 to-indigo-50 workspace-area flex items-center justify-center"
                style={{ zIndex: 1 }}
              >
                <div className="text-center p-8">
                  <div className="w-24 h-32 mx-auto mb-6 bg-white rounded-lg shadow-lg border-2 border-gray-200 flex items-center justify-center">
                    <span className="text-4xl text-blue-600">📄</span>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-800 mb-3">PDF Template Editor</h3>
                  <p className="text-gray-600 mb-4 max-w-md">
                    PDF loaded but cannot display inline. Click "Test PDF" to verify the file, 
                    or click here to add signature fields based on your document layout.
                  </p>
                  <Button variant="outline" onClick={openPdfInNewTab}>
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Test PDF
                  </Button>
                </div>
              </div>
            </iframe>
          </object>
        </div>
        
        {/* Signature Fields Overlay */}
        <div className="absolute inset-0" style={{ zIndex: 500 }}>
          {signatureFields.map((field) => (
            <FieldComponent
              key={field.id}
              field={field}
              onUpdate={updateField}
              onDelete={deleteField}
            />
          ))}
          
          {/* Click instruction */}
          {signatureFields.length === 0 && (
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
        <h4 className="font-medium mb-2">PDF Template Editor (Debug Mode)</h4>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• Click "Test PDF" to verify your PDF opens correctly in a new tab</li>
          <li>• Click anywhere in the workspace to add signature fields</li>
          <li>• Drag fields to reposition them precisely</li>
          <li>• Double-click field labels to edit them</li>
          <li>• Field coordinates are saved for exact signature placement</li>
        </ul>
      </Card>
    </div>
  );
}