import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useDrop, useDrag, DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Type, FileSignature, Calendar, Mail, AlignLeft, Save, Upload } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { useToast } from '@/hooks/use-toast';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

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

interface NdaTemplateEditorProps {
  templateId?: number;
  onSave: (templateData: {
    name: string;
    fileContent: string;
    signatureFields: SignatureField[];
  }) => Promise<void>;
  onCancel: () => void;
}

const FIELD_TYPES = [
  { type: 'signature', label: 'Signature', icon: FileSignature, color: 'bg-blue-100 text-blue-800' },
  { type: 'name', label: 'Full Name', icon: Type, color: 'bg-green-100 text-green-800' },
  { type: 'date', label: 'Date', icon: Calendar, color: 'bg-purple-100 text-purple-800' },
  { type: 'email', label: 'Email', icon: Mail, color: 'bg-orange-100 text-orange-800' },
  { type: 'text', label: 'Text Field', icon: AlignLeft, color: 'bg-gray-100 text-gray-800' }
];

const DraggableField = ({ field, onRemove, onUpdate, selected, onSelect }: {
  field: SignatureField;
  onRemove: (id: string) => void;
  onUpdate: (id: string, updates: Partial<SignatureField>) => void;
  selected: boolean;
  onSelect: (id: string) => void;
}) => {
  const [{ isDragging }, drag] = useDrag({
    type: 'field',
    item: { id: field.id, type: field.type },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const fieldType = FIELD_TYPES.find(t => t.type === field.type);

  return (
    <div
      ref={drag}
      className={`
        absolute border-2 border-dashed cursor-move rounded
        ${selected ? 'border-blue-500 bg-blue-50' : 'border-gray-400 bg-white/90'}
        ${isDragging ? 'opacity-50' : ''}
        hover:border-blue-400 transition-colors
      `}
      style={{
        left: field.x,
        top: field.y,
        width: field.width,
        height: field.height,
      }}
      onClick={() => onSelect(field.id)}
    >
      <div className={`
        px-2 py-1 text-xs font-medium rounded-t flex items-center justify-between
        ${fieldType?.color || 'bg-gray-100 text-gray-800'}
      `}>
        <div className="flex items-center gap-1">
          {fieldType?.icon && <fieldType.icon className="w-3 h-3" />}
          {field.label}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(field.id);
          }}
          className="text-red-600 hover:text-red-800"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
      <div className="px-2 py-1 text-xs text-gray-600">
        {field.type === 'signature' ? 'Sign here' : field.placeholder || `Enter ${field.label.toLowerCase()}`}
      </div>
    </div>
  );
};

const FieldPalette = ({ onDragStart }: { onDragStart: (type: string) => void }) => {
  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="text-sm">Field Types</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          {FIELD_TYPES.map((fieldType) => {
            const [{ isDragging }, drag] = useDrag({
              type: 'new-field',
              item: { fieldType: fieldType.type },
              collect: (monitor) => ({
                isDragging: monitor.isDragging(),
              }),
            });

            return (
              <div
                key={fieldType.type}
                ref={drag}
                className={`
                  p-2 rounded cursor-grab border-2 border-dashed border-gray-300
                  hover:border-blue-400 transition-colors flex items-center gap-2
                  ${isDragging ? 'opacity-50' : ''}
                  ${fieldType.color}
                `}
              >
                <fieldType.icon className="w-4 h-4" />
                <span className="text-xs font-medium">{fieldType.label}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default function NdaTemplateEditor({ templateId, onSave, onCancel }: NdaTemplateEditorProps) {
  const [templateName, setTemplateName] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [fields, setFields] = useState<SignatureField[]>([]);
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [canvasScale, setCanvasScale] = useState(1);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || file.type !== 'application/pdf') {
      toast({
        title: "Invalid file",
        description: "Please upload a PDF file",
        variant: "destructive"
      });
      return;
    }

    setPdfFile(file);
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      setPdfDoc(pdf);
      setTotalPages(pdf.numPages);
      setCurrentPage(1);
      renderPage(pdf, 1);
    } catch (error) {
      console.error('Error loading PDF:', error);
      toast({
        title: "Error",
        description: "Failed to load PDF file",
        variant: "destructive"
      });
    }
  };

  const renderPage = async (pdf: any, pageNum: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1 });
    
    // Calculate scale to fit container
    const container = containerRef.current;
    if (container) {
      const containerWidth = container.clientWidth - 40; // Account for padding
      const scale = Math.min(containerWidth / viewport.width, 1.5);
      setCanvasScale(scale);
      
      const scaledViewport = page.getViewport({ scale });
      canvas.width = scaledViewport.width;
      canvas.height = scaledViewport.height;
      
      const context = canvas.getContext('2d');
      if (context) {
        await page.render({ canvasContext: context, viewport: scaledViewport }).promise;
      }
    }
  };

  const [{ isOver }, drop] = useDrop({
    accept: ['new-field', 'field'],
    drop: (item: any, monitor) => {
      const offset = monitor.getClientOffset();
      const canvasRect = canvasRef.current?.getBoundingClientRect();
      
      if (!offset || !canvasRect) return;
      
      const x = offset.x - canvasRect.left;
      const y = offset.y - canvasRect.top;
      
      if (item.fieldType) {
        // New field from palette
        const newField: SignatureField = {
          id: `field_${Date.now()}`,
          type: item.fieldType,
          label: FIELD_TYPES.find(t => t.type === item.fieldType)?.label || 'Field',
          x: x / canvasScale,
          y: y / canvasScale,
          width: item.fieldType === 'signature' ? 200 : 150,
          height: item.fieldType === 'signature' ? 60 : 30,
          pageNumber: currentPage,
          required: true,
          fontSize: 12,
          placeholder: item.fieldType === 'date' ? 'MM/DD/YYYY' : undefined
        };
        setFields(prev => [...prev, newField]);
        setSelectedField(newField.id);
      } else if (item.id) {
        // Existing field being moved
        setFields(prev => prev.map(field => 
          field.id === item.id 
            ? { ...field, x: x / canvasScale, y: y / canvasScale, pageNumber: currentPage }
            : field
        ));
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  const removeField = (fieldId: string) => {
    setFields(prev => prev.filter(f => f.id !== fieldId));
    if (selectedField === fieldId) {
      setSelectedField(null);
    }
  };

  const updateField = (fieldId: string, updates: Partial<SignatureField>) => {
    setFields(prev => prev.map(field => 
      field.id === fieldId ? { ...field, ...updates } : field
    ));
  };

  const handleSave = async () => {
    if (!templateName || !pdfFile) {
      toast({
        title: "Missing information",
        description: "Please provide a template name and upload a PDF",
        variant: "destructive"
      });
      return;
    }

    try {
      const arrayBuffer = await pdfFile.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      
      await onSave({
        name: templateName,
        fileContent: base64,
        signatureFields: fields
      });
      
      toast({
        title: "Success",
        description: "NDA template saved successfully"
      });
    } catch (error) {
      console.error('Error saving template:', error);
      toast({
        title: "Error",
        description: "Failed to save template",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    if (pdfDoc && currentPage) {
      renderPage(pdfDoc, currentPage);
    }
  }, [pdfDoc, currentPage]);

  const selectedFieldData = selectedField ? fields.find(f => f.id === selectedField) : null;
  const currentPageFields = fields.filter(f => f.pageNumber === currentPage);

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="flex h-screen bg-gray-50">
        {/* Left Sidebar */}
        <div className="w-80 bg-white border-r overflow-y-auto p-4">
          <div className="space-y-4">
            {/* Template Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Template Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="template-name">Template Name</Label>
                  <Input
                    id="template-name"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="Enter template name"
                  />
                </div>
                
                <div>
                  <Label htmlFor="pdf-upload">Upload PDF Template</Label>
                  <Input
                    id="pdf-upload"
                    type="file"
                    accept=".pdf"
                    onChange={handleFileUpload}
                    className="mt-1"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Field Palette */}
            <FieldPalette onDragStart={() => {}} />

            {/* Field Properties */}
            {selectedFieldData && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Field Properties</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Label</Label>
                    <Input
                      value={selectedFieldData.label}
                      onChange={(e) => updateField(selectedField!, { label: e.target.value })}
                    />
                  </div>
                  
                  <div>
                    <Label>Width</Label>
                    <Input
                      type="number"
                      value={selectedFieldData.width}
                      onChange={(e) => updateField(selectedField!, { width: parseInt(e.target.value) })}
                    />
                  </div>
                  
                  <div>
                    <Label>Height</Label>
                    <Input
                      type="number"
                      value={selectedFieldData.height}
                      onChange={(e) => updateField(selectedField!, { height: parseInt(e.target.value) })}
                    />
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={selectedFieldData.required}
                      onCheckedChange={(checked) => updateField(selectedField!, { required: checked })}
                    />
                    <Label>Required</Label>
                  </div>
                  
                  {selectedFieldData.type !== 'signature' && (
                    <div>
                      <Label>Placeholder</Label>
                      <Input
                        value={selectedFieldData.placeholder || ''}
                        onChange={(e) => updateField(selectedField!, { placeholder: e.target.value })}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <div className="space-y-2">
              <Button onClick={handleSave} className="w-full">
                <Save className="w-4 h-4 mr-2" />
                Save Template
              </Button>
              <Button onClick={onCancel} variant="outline" className="w-full">
                Cancel
              </Button>
            </div>
          </div>
        </div>

        {/* Main Canvas Area */}
        <div className="flex-1 flex flex-col">
          {/* Toolbar */}
          {pdfDoc && (
            <div className="bg-white border-b p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage <= 1}
                >
                  Previous
                </Button>
                <span className="text-sm">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage >= totalPages}
                >
                  Next
                </Button>
              </div>
              
              <div className="text-sm text-gray-600">
                {currentPageFields.length} field{currentPageFields.length !== 1 ? 's' : ''} on this page
              </div>
            </div>
          )}

          {/* Canvas */}
          <div ref={containerRef} className="flex-1 p-8 overflow-auto">
            {pdfDoc ? (
              <div 
                ref={drop}
                className={`relative mx-auto border rounded-lg shadow-lg ${isOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300'}`}
                style={{ width: 'fit-content' }}
              >
                <canvas ref={canvasRef} className="block" />
                
                {/* Render fields for current page */}
                {currentPageFields.map(field => (
                  <DraggableField
                    key={field.id}
                    field={{
                      ...field,
                      x: field.x * canvasScale,
                      y: field.y * canvasScale,
                      width: field.width * canvasScale,
                      height: field.height * canvasScale,
                    }}
                    onRemove={removeField}
                    onUpdate={updateField}
                    selected={selectedField === field.id}
                    onSelect={setSelectedField}
                  />
                ))}
                
                {isOver && (
                  <div className="absolute inset-0 border-2 border-dashed border-blue-400 bg-blue-50/20 pointer-events-none" />
                )}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <Upload className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                  <p className="text-lg font-medium">Upload a PDF template to get started</p>
                  <p className="text-sm">Drag and drop signature fields onto your PDF</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DndProvider>
  );
}