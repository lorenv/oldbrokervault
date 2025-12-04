import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { DndContext, DragEndEvent, DragOverlay, useSensor, useSensors, PointerSensor, useDroppable, useDraggable } from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Upload,
  Plus,
  Trash2,
  GripVertical,
  Pen,
  User,
  Mail,
  Calendar,
  Type,
  Edit3,
  Save,
  ArrowLeft,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ESIGN_RECIPIENT_COLORS, ESIGN_CC_COLOR } from "@shared/schema";
import { v4 as uuidv4 } from "uuid";

interface PlaceholderRecipient {
  id: string;
  label: string;
  role: 'signer' | 'cc';
  color: string;
  order: number;
}

interface TemplateField {
  id: string;
  type: 'signature' | 'name' | 'email' | 'date' | 'text' | 'initials';
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  assignedTo: string;
  required: boolean;
}

const FIELD_TYPES = [
  { type: 'signature', label: 'Signature', icon: Pen, defaultSize: { width: 20, height: 6 } },
  { type: 'initials', label: 'Initials', icon: Edit3, defaultSize: { width: 10, height: 5 } },
  { type: 'name', label: 'Name', icon: User, defaultSize: { width: 20, height: 4 } },
  { type: 'email', label: 'Email', icon: Mail, defaultSize: { width: 25, height: 4 } },
  { type: 'date', label: 'Date', icon: Calendar, defaultSize: { width: 15, height: 4 } },
  { type: 'text', label: 'Text', icon: Type, defaultSize: { width: 20, height: 4 } },
] as const;

// Draggable Field Palette Item
function DraggableFieldType({ type, label, icon: Icon, disabled }: {
  type: string;
  label: string;
  icon: any;
  disabled?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${type}`,
    data: { type, fromPalette: true },
    disabled,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`flex items-center gap-2 p-2 rounded-md border cursor-grab active:cursor-grabbing transition-all ${
        isDragging ? 'opacity-50 scale-95' : 'hover:bg-gray-50'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <Icon className="h-4 w-4 text-gray-600" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

// Draggable Field on Canvas
function DraggableField({
  field,
  recipient,
  isSelected,
  onSelect,
  onDelete,
  zoom,
}: {
  field: TemplateField;
  recipient: PlaceholderRecipient | undefined;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  zoom: number;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: field.id,
    data: { field },
  });

  const style: React.CSSProperties = {
    position: 'absolute',
    left: `${field.x}%`,
    top: `${field.y}%`,
    width: `${field.width}%`,
    height: `${field.height}%`,
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    zIndex: isDragging || isSelected ? 100 : 10,
    opacity: isDragging ? 0.7 : 1,
  };

  const fieldConfig = FIELD_TYPES.find(f => f.type === field.type);
  const Icon = fieldConfig?.icon || Type;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`rounded border-2 cursor-move flex items-center justify-center gap-1 text-white text-xs font-medium transition-shadow ${
        isSelected ? 'ring-2 ring-offset-1 ring-blue-500' : ''
      }`}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <div
        className="w-full h-full flex items-center justify-center gap-1 rounded"
        style={{ backgroundColor: recipient?.color || '#888', opacity: 0.9 }}
      >
        <Icon className="h-3 w-3" />
        <span className="truncate">{fieldConfig?.label}</span>
      </div>
      {isSelected && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

// Document Canvas with Droppable Area - Single Page
function DocumentCanvas({
  pageImage,
  pageNumber,
  fields,
  recipients,
  selectedFieldId,
  onSelectField,
  onDeleteField,
  zoom,
  onDrop,
}: {
  pageImage: string;
  pageNumber: number;
  fields: TemplateField[];
  recipients: PlaceholderRecipient[];
  selectedFieldId: string | null;
  onSelectField: (id: string | null) => void;
  onDeleteField: (id: string) => void;
  zoom: number;
  onDrop: (x: number, y: number, type: string) => void;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const { setNodeRef, isOver } = useDroppable({
    id: `canvas-page-${pageNumber}`,
  });

  const pageFields = fields.filter(f => f.page === pageNumber);

  // Calculate display width based on zoom
  const baseWidth = 612; // Standard letter width in points
  const displayWidth = baseWidth * zoom;

  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        (canvasRef as any).current = node;
      }}
      className={`relative border-2 rounded-lg overflow-hidden transition-colors flex-shrink-0 ${
        isOver ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
      }`}
      style={{
        width: displayWidth,
      }}
      onClick={() => onSelectField(null)}
    >
      <img
        src={pageImage}
        alt={`Page ${pageNumber}`}
        className="w-full h-auto block"
        draggable={false}
      />

      {/* Fields overlay */}
      <div className="absolute inset-0">
        {pageFields.map((field) => {
          const recipient = recipients.find(r => r.id === field.assignedTo);
          return (
            <DraggableField
              key={field.id}
              field={field}
              recipient={recipient}
              isSelected={selectedFieldId === field.id}
              onSelect={() => onSelectField(field.id)}
              onDelete={() => onDeleteField(field.id)}
              zoom={zoom}
            />
          );
        })}
      </div>

      {/* Page number indicator */}
      <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
        Page {pageNumber}
      </div>
    </div>
  );
}

export default function EsignTemplateEditor() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/esign/templates/:id/edit");
  const templateId = params?.id ? parseInt(params.id) : null;
  const isEditing = templateId !== null && !isNaN(templateId);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [documentUrl, setDocumentUrl] = useState("");
  const [pageImages, setPageImages] = useState<string[]>([]);
  const [recipients, setRecipients] = useState<PlaceholderRecipient[]>([]);
  const [fields, setFields] = useState<TemplateField[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [isUploading, setIsUploading] = useState(false);
  const [activeRecipientId, setActiveRecipientId] = useState<string | null>(null);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  // Fetch existing template if editing
  const { data: template, isLoading: isLoadingTemplate } = useQuery({
    queryKey: ["/api/esign/templates", templateId],
    queryFn: async () => {
      if (!templateId) return null;
      const res = await fetch(`/api/esign/templates/${templateId}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch template');
      return res.json();
    },
    enabled: isEditing,
  });

  // Load template data when fetched
  useEffect(() => {
    if (template) {
      setName(template.name || "");
      setDescription(template.description || "");
      setDocumentUrl(template.documentUrl || "");
      setPageImages(template.pageImages || []);
      setRecipients(template.placeholderRecipients || []);
      setFields(template.fields || []);
    }
  }, [template]);

  // File upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('document', file);

    try {
      const res = await fetch('/api/esign/templates/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Upload failed');
      }

      const data = await res.json();
      setDocumentUrl(data.documentUrl);
      setPageImages(data.pageImages);

      toast({
        title: "Document uploaded",
        description: `Successfully processed ${data.pageCount} page(s).`,
      });
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Add recipient
  const addRecipient = (role: 'signer' | 'cc') => {
    const signerCount = recipients.filter(r => r.role === 'signer').length;
    const newRecipient: PlaceholderRecipient = {
      id: uuidv4(),
      label: role === 'signer' ? `Signer ${signerCount + 1}` : `CC ${recipients.filter(r => r.role === 'cc').length + 1}`,
      role,
      color: role === 'cc' ? ESIGN_CC_COLOR : ESIGN_RECIPIENT_COLORS[signerCount % ESIGN_RECIPIENT_COLORS.length],
      order: recipients.length + 1,
    };
    setRecipients([...recipients, newRecipient]);
    setActiveRecipientId(newRecipient.id);
  };

  // Remove recipient
  const removeRecipient = (id: string) => {
    setRecipients(recipients.filter(r => r.id !== id));
    setFields(fields.filter(f => f.assignedTo !== id));
    if (activeRecipientId === id) {
      setActiveRecipientId(recipients[0]?.id || null);
    }
  };

  // Update recipient
  const updateRecipient = (id: string, updates: Partial<PlaceholderRecipient>) => {
    setRecipients(recipients.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || !activeRecipientId) return;

    // Check if dropped on canvas
    if (over.id.toString().startsWith('canvas-page-')) {
      const pageNumber = parseInt(over.id.toString().split('-').pop() || '1');

      // Calculate drop position as percentage
      const overRect = over.rect;
      if (overRect && event.delta) {
        const x = ((event.delta.x + (active.rect.current.translated?.left || 0) - overRect.left) / overRect.width) * 100;
        const y = ((event.delta.y + (active.rect.current.translated?.top || 0) - overRect.top) / overRect.height) * 100;

        // Check if from palette or existing field
        if (active.data.current?.fromPalette) {
          const type = active.data.current.type as TemplateField['type'];
          const fieldConfig = FIELD_TYPES.find(f => f.type === type);

          const newField: TemplateField = {
            id: uuidv4(),
            type,
            x: Math.max(0, Math.min(100 - (fieldConfig?.defaultSize.width || 20), x)),
            y: Math.max(0, Math.min(100 - (fieldConfig?.defaultSize.height || 4), y)),
            width: fieldConfig?.defaultSize.width || 20,
            height: fieldConfig?.defaultSize.height || 4,
            page: pageNumber,
            assignedTo: activeRecipientId,
            required: true,
          };

          setFields([...fields, newField]);
          setSelectedFieldId(newField.id);
        } else if (active.data.current?.field) {
          // Moving existing field
          const field = active.data.current.field as TemplateField;
          setFields(fields.map(f =>
            f.id === field.id
              ? {
                  ...f,
                  x: Math.max(0, Math.min(100 - f.width, x)),
                  y: Math.max(0, Math.min(100 - f.height, y)),
                  page: pageNumber,
                }
              : f
          ));
        }
      }
    }
  };

  // Save template
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        description: description || null,
        documentUrl,
        pageImages,
        totalPages: pageImages.length,
        placeholderRecipients: recipients,
        fields,
      };

      if (isEditing) {
        return apiRequest("PUT", `/api/esign/templates/${templateId}`, { body: payload });
      } else {
        return apiRequest("POST", "/api/esign/templates", { body: payload });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/esign/templates"] });
      toast({
        title: isEditing ? "Template updated" : "Template created",
        description: "Your template has been saved successfully.",
      });
      setLocation("/esign/templates");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save template. Please try again.",
        variant: "destructive",
      });
    },
  });

  const canSave = name && documentUrl && pageImages.length > 0 && recipients.length > 0;

  if (isEditing && isLoadingTemplate) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="min-h-screen bg-gray-100">
        {/* Header */}
        <div className="bg-white border-b shadow-sm sticky top-0 z-50">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button variant="ghost" onClick={() => setLocation("/esign/templates")}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <div>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Template Name"
                    className="font-semibold text-lg border-0 focus-visible:ring-0 px-0"
                  />
                </div>
              </div>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={!canSave || saveMutation.isPending}
              >
                <Save className="h-4 w-4 mr-2" />
                {saveMutation.isPending ? "Saving..." : "Save Template"}
              </Button>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-6">
          <div className="grid grid-cols-12 gap-6">
            {/* Left Sidebar - Recipients & Fields */}
            <div className="col-span-3 space-y-4">
              {/* Recipients */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center justify-between">
                    Recipients (Roles)
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => addRecipient('signer')}>
                        <Plus className="h-3 w-3 mr-1" />
                        Signer
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => addRecipient('cc')}>
                        <Plus className="h-3 w-3 mr-1" />
                        CC
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {recipients.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">
                      Add recipients to assign fields
                    </p>
                  ) : (
                    recipients.map((recipient) => (
                      <div
                        key={recipient.id}
                        className={`p-2 rounded-md border cursor-pointer transition-colors ${
                          activeRecipientId === recipient.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'hover:bg-gray-50'
                        }`}
                        onClick={() => setActiveRecipientId(recipient.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-4 h-4 rounded-full"
                              style={{ backgroundColor: recipient.color }}
                            />
                            <Input
                              value={recipient.label}
                              onChange={(e) => updateRecipient(recipient.id, { label: e.target.value })}
                              className="h-6 text-sm px-1 border-0 bg-transparent focus-visible:ring-0"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            <Badge variant="secondary" className="text-xs">
                              {recipient.role}
                            </Badge>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeRecipient(recipient.id);
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Field Palette */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">
                    Field Types
                  </CardTitle>
                  <p className="text-xs text-gray-500">
                    Drag fields onto the document
                  </p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {FIELD_TYPES.map((fieldType) => (
                    <DraggableFieldType
                      key={fieldType.type}
                      type={fieldType.type}
                      label={fieldType.label}
                      icon={fieldType.icon}
                      disabled={!activeRecipientId}
                    />
                  ))}
                  {!activeRecipientId && (
                    <p className="text-xs text-amber-600 mt-2">
                      Select a recipient first to add fields
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Main Canvas */}
            <div className="col-span-9">
              <Card className="h-[calc(100vh-180px)] flex flex-col">
                <CardHeader className="border-b flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">
                      Document Preview {pageImages.length > 0 && `(${pageImages.length} page${pageImages.length > 1 ? 's' : ''})`}
                    </CardTitle>
                    {pageImages.length > 0 && (
                      <div className="flex items-center gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
                        >
                          <ZoomOut className="h-4 w-4" />
                        </Button>
                        <span className="text-sm w-12 text-center">{Math.round(zoom * 100)}%</span>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setZoom(Math.min(1.5, zoom + 0.1))}
                        >
                          <ZoomIn className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-0 flex-1 overflow-hidden">
                  {pageImages.length === 0 ? (
                    <div className="h-full flex items-center justify-center">
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
                        <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                          Upload a Document
                        </h3>
                        <p className="text-gray-500 mb-4">
                          Upload a PDF or Word document to get started
                        </p>
                        <div>
                          <input
                            type="file"
                            id="template-file-upload"
                            accept=".pdf,.doc,.docx"
                            className="hidden"
                            onChange={handleFileUpload}
                            disabled={isUploading}
                          />
                          <Button
                            disabled={isUploading}
                            onClick={() => document.getElementById('template-file-upload')?.click()}
                            type="button"
                          >
                            {isUploading ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                                Processing...
                              </>
                            ) : (
                              <>
                                <Upload className="h-4 w-4 mr-2" />
                                Choose File
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full overflow-auto bg-gray-100 p-6">
                      <div className="flex flex-col items-center gap-4">
                        {pageImages.map((pageImage, index) => (
                          <DocumentCanvas
                            key={index}
                            pageImage={pageImage}
                            pageNumber={index + 1}
                            fields={fields}
                            recipients={recipients}
                            selectedFieldId={selectedFieldId}
                            onSelectField={setSelectedFieldId}
                            onDeleteField={(id) => {
                              setFields(fields.filter(f => f.id !== id));
                              if (selectedFieldId === id) setSelectedFieldId(null);
                            }}
                            zoom={zoom}
                            onDrop={() => {}}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </DndContext>
  );
}
