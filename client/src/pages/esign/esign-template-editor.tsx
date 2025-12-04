import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { DndContext, DragEndEvent, DragOverlay, useSensor, useSensors, PointerSensor, useDroppable, useDraggable, DragMoveEvent } from "@dnd-kit/core";
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
  Pencil,
  Check,
  X,
  Menu,
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
  name?: string; // Optional - fill in when using template if not set
  email?: string; // Optional - fill in when using template if not set
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
  registerCanvasRef,
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
  registerCanvasRef: (pageNumber: number, ref: HTMLDivElement | null) => void;
}) {
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
        registerCanvasRef(pageNumber, node);
      }}
      data-page={pageNumber}
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

  // Generate default title with timestamp
  const generateDefaultTitle = () => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return `Unnamed Template - ${dateStr} ${timeStr}`;
  };

  // Form state
  const [name, setName] = useState(() => generateDefaultTitle());
  const [description, setDescription] = useState("");
  const [documentUrl, setDocumentUrl] = useState("");
  const [pageImages, setPageImages] = useState<string[]>([]);
  const [recipients, setRecipients] = useState<PlaceholderRecipient[]>([]);
  const [fields, setFields] = useState<TemplateField[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [isUploading, setIsUploading] = useState(false);
  const [activeRecipientId, setActiveRecipientId] = useState<string | null>(null);

  // Title editing state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingTitleValue, setEditingTitleValue] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Mobile sidebar state
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  // Track canvas refs for accurate drop positioning
  const canvasRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const lastPointerPosition = useRef<{ x: number; y: number } | null>(null);

  const registerCanvasRef = useCallback((pageNumber: number, ref: HTMLDivElement | null) => {
    if (ref) {
      canvasRefs.current.set(pageNumber, ref);
    } else {
      canvasRefs.current.delete(pageNumber);
    }
  }, []);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  // Track pointer position during drag for accurate drop placement
  const handleDragMove = useCallback((event: DragMoveEvent) => {
    // Store the current pointer position from the activator event
    const { activatorEvent } = event;
    if (activatorEvent && 'clientX' in activatorEvent) {
      lastPointerPosition.current = {
        x: (activatorEvent as PointerEvent).clientX + (event.delta?.x || 0),
        y: (activatorEvent as PointerEvent).clientY + (event.delta?.y || 0),
      };
    }
  }, []);

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
      setName(template.name || generateDefaultTitle());
      setDescription(template.description || "");
      setDocumentUrl(template.documentUrl || "");
      setPageImages(template.pageImages || []);
      setRecipients(template.placeholderRecipients || []);
      setFields(template.fields || []);
    }
  }, [template]);

  // Focus title input when editing starts
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  // Title editing handlers
  const startEditingTitle = () => {
    setEditingTitleValue(name);
    setIsEditingTitle(true);
  };

  const saveTitle = () => {
    const trimmed = editingTitleValue.trim();
    setName(trimmed || generateDefaultTitle());
    setIsEditingTitle(false);
  };

  const cancelEditingTitle = () => {
    setIsEditingTitle(false);
    setEditingTitleValue("");
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveTitle();
    } else if (e.key === 'Escape') {
      cancelEditingTitle();
    }
  };

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

  // Add recipient (placeholder by default)
  const addRecipient = (role: 'signer' | 'cc') => {
    const signerCount = recipients.filter(r => r.role === 'signer').length;
    const ccCount = recipients.filter(r => r.role === 'cc').length;
    const newRecipient: PlaceholderRecipient = {
      id: uuidv4(),
      label: role === 'signer' ? `Signer ${signerCount + 1}` : `CC ${ccCount + 1}`,
      role,
      color: role === 'cc' ? ESIGN_CC_COLOR : ESIGN_RECIPIENT_COLORS[signerCount % ESIGN_RECIPIENT_COLORS.length],
      order: recipients.length + 1,
      // name and email are optional - can be filled in when using the template
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
    const { active, over, activatorEvent } = event;

    if (!over || !activeRecipientId) {
      lastPointerPosition.current = null;
      return;
    }

    // Check if dropped on canvas
    if (over.id.toString().startsWith('canvas-page-')) {
      const pageNumber = parseInt(over.id.toString().split('-').pop() || '1');
      const canvasRef = canvasRefs.current.get(pageNumber);

      if (!canvasRef) {
        lastPointerPosition.current = null;
        return;
      }

      // Get canvas bounding rect for accurate position calculation
      const canvasRect = canvasRef.getBoundingClientRect();

      // Calculate pointer position - use last tracked position or calculate from event
      let pointerX: number;
      let pointerY: number;

      if (lastPointerPosition.current) {
        pointerX = lastPointerPosition.current.x;
        pointerY = lastPointerPosition.current.y;
      } else if (activatorEvent && 'clientX' in activatorEvent) {
        pointerX = (activatorEvent as PointerEvent).clientX + (event.delta?.x || 0);
        pointerY = (activatorEvent as PointerEvent).clientY + (event.delta?.y || 0);
      } else {
        lastPointerPosition.current = null;
        return;
      }

      // Calculate position relative to canvas, accounting for zoom
      const relativeX = (pointerX - canvasRect.left) / zoom;
      const relativeY = (pointerY - canvasRect.top) / zoom;

      // Convert to percentage of canvas dimensions (unzoomed)
      const baseWidth = 612;
      const x = (relativeX / baseWidth) * 100;
      const y = (relativeY / (canvasRect.height / zoom)) * 100;

      // Check if from palette or existing field
      if (active.data.current?.fromPalette) {
        const type = active.data.current.type as TemplateField['type'];
        const fieldConfig = FIELD_TYPES.find(f => f.type === type);
        const fieldWidth = fieldConfig?.defaultSize.width || 20;
        const fieldHeight = fieldConfig?.defaultSize.height || 4;

        // Center the field on the drop point
        const centeredX = x - fieldWidth / 2;
        const centeredY = y - fieldHeight / 2;

        const newField: TemplateField = {
          id: uuidv4(),
          type,
          x: Math.max(0, Math.min(100 - fieldWidth, centeredX)),
          y: Math.max(0, Math.min(100 - fieldHeight, centeredY)),
          width: fieldWidth,
          height: fieldHeight,
          page: pageNumber,
          assignedTo: activeRecipientId,
          required: true,
        };

        setFields([...fields, newField]);
        setSelectedFieldId(newField.id);
      } else if (active.data.current?.field) {
        // Moving existing field
        const field = active.data.current.field as TemplateField;

        // Center on drop point
        const centeredX = x - field.width / 2;
        const centeredY = y - field.height / 2;

        setFields(fields.map(f =>
          f.id === field.id
            ? {
                ...f,
                x: Math.max(0, Math.min(100 - f.width, centeredX)),
                y: Math.max(0, Math.min(100 - f.height, centeredY)),
                page: pageNumber,
              }
            : f
        ));
      }
    }

    lastPointerPosition.current = null;
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
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/esign/templates"] });
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

  // canSave is always true for name since we auto-generate one
  const canSave = documentUrl && pageImages.length > 0 && recipients.length > 0;

  if (isEditing && isLoadingTemplate) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} onDragMove={handleDragMove} onDragEnd={handleDragEnd}>
      <div className="min-h-screen bg-gray-100">
        {/* Header */}
        <div className="bg-white border-b shadow-sm sticky top-0 z-50">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 md:gap-4 min-w-0 flex-1">
                <Button variant="ghost" size="sm" onClick={() => setLocation("/esign/templates")} className="flex-shrink-0">
                  <ArrowLeft className="h-4 w-4 md:mr-2" />
                  <span className="hidden md:inline">Back</span>
                </Button>

                {/* Inline Editable Title */}
                <div className="min-w-0 flex-1">
                  {isEditingTitle ? (
                    <div className="flex items-center gap-2">
                      <Input
                        ref={titleInputRef}
                        value={editingTitleValue}
                        onChange={(e) => setEditingTitleValue(e.target.value)}
                        onKeyDown={handleTitleKeyDown}
                        onBlur={saveTitle}
                        className="font-semibold text-lg h-9 max-w-xs md:max-w-md"
                        placeholder="Template Name"
                      />
                      <Button size="icon" variant="ghost" className="h-8 w-8 flex-shrink-0" onClick={saveTitle}>
                        <Check className="h-4 w-4 text-green-600" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 flex-shrink-0" onClick={cancelEditingTitle}>
                        <X className="h-4 w-4 text-gray-500" />
                      </Button>
                    </div>
                  ) : (
                    <div
                      className="group flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded-md px-2 py-1 -mx-2 transition-colors"
                      onClick={startEditingTitle}
                    >
                      <h1 className="font-semibold text-lg truncate">{name}</h1>
                      <Pencil className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Mobile sidebar toggle */}
                <Button
                  variant="outline"
                  size="icon"
                  className="lg:hidden"
                  onClick={() => setShowMobileSidebar(!showMobileSidebar)}
                >
                  <Menu className="h-4 w-4" />
                </Button>

                <Button
                  onClick={() => saveMutation.mutate()}
                  disabled={!canSave || saveMutation.isPending}
                  size="sm"
                  className="md:size-default"
                >
                  <Save className="h-4 w-4 md:mr-2" />
                  <span className="hidden md:inline">{saveMutation.isPending ? "Saving..." : "Save Template"}</span>
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-4 lg:py-6">
          <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
            {/* Mobile Sidebar Overlay */}
            {showMobileSidebar && (
              <div
                className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                onClick={() => setShowMobileSidebar(false)}
              />
            )}

            {/* Left Sidebar - Recipients & Fields */}
            <div className={`
              ${showMobileSidebar ? 'fixed inset-y-0 left-0 z-50 w-80 bg-gray-100 overflow-y-auto p-4 pt-20' : 'hidden'}
              lg:block lg:static lg:w-72 xl:w-80 lg:flex-shrink-0 space-y-4
            `}>
              {/* Close button for mobile */}
              {showMobileSidebar && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-4 right-4 lg:hidden"
                  onClick={() => setShowMobileSidebar(false)}
                >
                  <X className="h-5 w-5" />
                </Button>
              )}

              {/* Recipients */}
              <Card className="overflow-hidden">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">
                    Recipients
                  </CardTitle>
                  <p className="text-xs text-gray-500 mt-1">
                    Add placeholder roles or specific people
                  </p>
                </CardHeader>
                <CardContent className="space-y-3 max-h-[50vh] overflow-y-auto">
                  {/* Add recipient buttons */}
                  <div className="flex flex-col gap-2">
                    <Button size="sm" variant="outline" onClick={() => addRecipient('signer')} className="text-xs justify-start">
                      <Plus className="h-3 w-3 mr-2 flex-shrink-0" />
                      <span className="truncate">Add Signer</span>
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => addRecipient('cc')} className="text-xs justify-start">
                      <Plus className="h-3 w-3 mr-2 flex-shrink-0" />
                      <span className="truncate">Add CC</span>
                    </Button>
                  </div>

                  {/* Recipient list */}
                  {recipients.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">
                      Add recipients to assign fields
                    </p>
                  ) : (
                    <div className="space-y-2 mt-3">
                      {recipients.map((recipient) => (
                        <div
                          key={recipient.id}
                          className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                            activeRecipientId === recipient.id
                              ? 'border-blue-500 bg-blue-50'
                              : 'hover:bg-gray-50 border-gray-200'
                          }`}
                          onClick={() => setActiveRecipientId(recipient.id)}
                        >
                          {/* Header row */}
                          <div className="flex items-center justify-between mb-2 gap-2">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <div
                                className="w-4 h-4 rounded-full flex-shrink-0"
                                style={{ backgroundColor: recipient.color }}
                              />
                              <Badge variant={recipient.role === 'signer' ? 'default' : 'secondary'} className="text-xs flex-shrink-0 capitalize">
                                {recipient.role}
                              </Badge>
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 flex-shrink-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeRecipient(recipient.id);
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>

                          {/* Role Label */}
                          <div className="mb-2">
                            <Label className="text-xs text-gray-500">Role Label</Label>
                            <Input
                              value={recipient.label}
                              onChange={(e) => updateRecipient(recipient.id, { label: e.target.value })}
                              className="h-7 text-sm mt-1"
                              placeholder="e.g., Buyer, Seller, CEO"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>

                          {/* Optional Name & Email - always shown */}
                          <div className="space-y-2 pt-2 border-t">
                            <div>
                              <Label className="text-xs text-gray-500">Name <span className="text-gray-400">(optional)</span></Label>
                              <Input
                                value={recipient.name || ''}
                                onChange={(e) => updateRecipient(recipient.id, { name: e.target.value })}
                                className="h-7 text-sm mt-1"
                                placeholder="Leave blank to fill when using template"
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-gray-500">Email <span className="text-gray-400">(optional)</span></Label>
                              <Input
                                type="email"
                                value={recipient.email || ''}
                                onChange={(e) => updateRecipient(recipient.id, { email: e.target.value })}
                                className="h-7 text-sm mt-1"
                                placeholder="Leave blank to fill when using template"
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
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
            <div className="flex-1 min-w-0">
              <Card className="h-[calc(100vh-140px)] lg:h-[calc(100vh-180px)] flex flex-col">
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
                            registerCanvasRef={registerCanvasRef}
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
