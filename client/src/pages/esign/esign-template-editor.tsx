import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, useSensor, useSensors, PointerSensor, TouchSensor, useDroppable, useDraggable, DragMoveEvent, closestCenter } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
  File,
  ChevronDown,
  Pointer,
  Link2,
  Copy,
  Loader2,
  ExternalLink,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  fontSize?: number; // Optional custom font size (auto-calculated if not set)
}

// Interface for uploaded documents (multiple file support)
interface UploadedDocument {
  id: string;
  name: string;
  documentUrl: string;
  pageImages: string[];
  pageCount: number;
}

// Sortable document item for drag-and-drop reordering
function SortableDocumentItem({
  doc,
  onRemove,
}: {
  doc: UploadedDocument;
  onRemove: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: doc.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`p-2 bg-gray-50 border border-gray-200 rounded-lg flex items-center gap-2 group ${
        isDragging ? 'opacity-50 shadow-lg z-50' : ''
      }`}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing touch-none"
      >
        <GripVertical className="h-4 w-4" />
      </div>

      <File className="h-6 w-6 text-blue-500 flex-shrink-0" />

      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-800 truncate">{doc.name}</p>
        <p className="text-xs text-gray-500">
          {doc.pageCount} page{doc.pageCount !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Delete button */}
      <Button
        size="icon"
        variant="ghost"
        className="h-6 w-6 text-gray-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => onRemove(doc.id)}
        title="Remove document"
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
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

// Helper to calculate font size based on field height (in percentage of canvas)
function calculateFontSize(heightPercent: number, canvasHeight: number): number {
  const heightPixels = (heightPercent / 100) * canvasHeight;
  // Font size is roughly 60% of the field height, with min/max bounds
  return Math.max(8, Math.min(48, heightPixels * 0.6));
}

// Resize handle positions
type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

// Draggable Field on Canvas
function DraggableField({
  field,
  recipient,
  isSelected,
  onSelect,
  onDelete,
  onResize,
  onResizeStateChange,
  zoom,
  canvasHeight,
  canvasRef,
}: {
  field: TemplateField;
  recipient: PlaceholderRecipient | undefined;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onResize: (updates: { width?: number; height?: number; x?: number; y?: number }) => void;
  onResizeStateChange: (isResizing: boolean) => void;
  zoom: number;
  canvasHeight: number;
  canvasRef: React.RefObject<HTMLDivElement>;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: field.id,
    data: { field },
  });

  const [isResizing, setIsResizing] = useState(false);
  const resizeStartRef = useRef<{
    handle: ResizeHandle;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    startFieldX: number;
    startFieldY: number;
    canvasRect: DOMRect;
  } | null>(null);
  const fieldRef = useRef<HTMLDivElement>(null);

  // Handle resize - uses displayed canvas dimensions for accurate scaling
  const handleResizeStart = (e: React.MouseEvent, handle: ResizeHandle) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    onResizeStateChange(true);

    // Get the canvas element (parent of the field)
    const canvasElement = fieldRef.current?.parentElement;
    const canvasRect = canvasElement?.getBoundingClientRect();

    if (!canvasRect) return;

    resizeStartRef.current = {
      handle,
      startX: e.clientX,
      startY: e.clientY,
      startWidth: field.width,
      startHeight: field.height,
      startFieldX: field.x,
      startFieldY: field.y,
      canvasRect,
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!resizeStartRef.current) return;

      const { handle, startX, startY, startWidth, startHeight, startFieldX, startFieldY } = resizeStartRef.current;

      // Get fresh canvas dimensions directly from the canvas ref
      // Use clientWidth/clientHeight which exclude borders (matches percentage positioning area)
      if (!canvasRef.current) return;
      const canvasWidth = canvasRef.current.clientWidth;
      const canvasHeight = canvasRef.current.clientHeight;
      if (!canvasWidth || !canvasHeight) return;

      // Convert mouse movement to percentage of canvas
      const deltaX = ((moveEvent.clientX - startX) / canvasWidth) * 100;
      const deltaY = ((moveEvent.clientY - startY) / canvasHeight) * 100;

      let newWidth = startWidth;
      let newHeight = startHeight;
      let newX = startFieldX;
      let newY = startFieldY;

      // Handle horizontal resizing
      if (handle.includes('e')) {
        newWidth = Math.max(5, startWidth + deltaX);
      }
      if (handle.includes('w')) {
        const widthChange = Math.min(deltaX, startWidth - 5);
        newWidth = startWidth - widthChange;
        newX = startFieldX + widthChange;
      }

      // Handle vertical resizing
      if (handle.includes('s')) {
        newHeight = Math.max(2, startHeight + deltaY);
      }
      if (handle.includes('n')) {
        const heightChange = Math.min(deltaY, startHeight - 2);
        newHeight = startHeight - heightChange;
        newY = startFieldY + heightChange;
      }

      // Constrain to canvas bounds
      newX = Math.max(0, Math.min(100 - newWidth, newX));
      newY = Math.max(0, Math.min(100 - newHeight, newY));
      newWidth = Math.min(100 - newX, newWidth);
      newHeight = Math.min(100 - newY, newHeight);

      onResize({ width: newWidth, height: newHeight, x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      onResizeStateChange(false);
      resizeStartRef.current = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const style: React.CSSProperties = {
    position: 'absolute',
    left: `${field.x}%`,
    top: `${field.y}%`,
    width: `${field.width}%`,
    height: `${field.height}%`,
    // Divide transform by zoom so the field follows the cursor correctly at any zoom level
    transform: transform ? `translate3d(${transform.x / zoom}px, ${transform.y / zoom}px, 0)` : undefined,
    zIndex: isDragging || isSelected || isResizing ? 100 : 10,
    opacity: isDragging ? 0.7 : 1,
  };

  const fieldConfig = FIELD_TYPES.find(f => f.type === field.type);
  const Icon = fieldConfig?.icon || Type;

  // Calculate dynamic font size
  const fontSize = field.fontSize || calculateFontSize(field.height, canvasHeight);

  // Resize handle styles - bottom-right, bottom, and right handles like canvas-overlay
  const handles: { position: ResizeHandle; className: string; cursor: string; style?: React.CSSProperties }[] = [
    { position: 'se', className: 'absolute -bottom-1 -right-1 w-3 h-3 bg-blue-500 border border-white rounded', cursor: 'nwse-resize' },
    { position: 's', className: 'absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-2 bg-blue-500 border border-white rounded', cursor: 's-resize' },
    { position: 'e', className: 'absolute -right-1 top-1/2 -translate-y-1/2 w-2 h-3 bg-blue-500 border border-white rounded', cursor: 'e-resize' },
  ];

  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        (fieldRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }}
      style={style}
      {...(isResizing ? {} : attributes)}
      {...(isResizing ? {} : listeners)}
      className={`rounded cursor-move flex items-center justify-center gap-1 text-white font-medium transition-shadow ${
        isSelected ? 'ring-2 ring-offset-1 ring-blue-500' : ''
      }`}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <div
        className="w-full h-full flex items-center justify-center gap-1 rounded border-2 overflow-hidden"
        style={{
          backgroundColor: recipient?.color || '#888',
          borderColor: recipient?.color || '#888',
          opacity: 0.9,
          fontSize: `${Math.min(fontSize, 14)}px`, // Cap display font size for template preview
        }}
      >
        <Icon className="h-3 w-3 flex-shrink-0" />
        <span className="truncate">{fieldConfig?.label}</span>
      </div>

      {/* Delete button */}
      {isSelected && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600 z-10"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}

      {/* Resize handles - only show when selected */}
      {isSelected && handles.map(({ position, className, cursor }) => (
        <div
          key={position}
          className={className}
          style={{ cursor }}
          onMouseDown={(e) => handleResizeStart(e, position)}
        />
      ))}
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
  onResizeField,
  onResizeStateChange,
  zoom,
  onDrop,
  registerCanvasRef,
  isTapToPlaceMode,
  onTapToPlace,
}: {
  pageImage: string;
  pageNumber: number;
  fields: TemplateField[];
  recipients: PlaceholderRecipient[];
  selectedFieldId: string | null;
  onSelectField: (id: string | null) => void;
  onDeleteField: (id: string) => void;
  onResizeField: (fieldId: string, updates: { width?: number; height?: number; x?: number; y?: number }) => void;
  onResizeStateChange: (isResizing: boolean) => void;
  zoom: number;
  onDrop: (x: number, y: number, type: string) => void;
  registerCanvasRef: (pageNumber: number, ref: HTMLDivElement | null) => void;
  isTapToPlaceMode?: boolean;
  onTapToPlace?: (pageNumber: number, x: number, y: number) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `canvas-page-${pageNumber}`,
  });
  const [canvasHeight, setCanvasHeight] = useState(792); // Default to letter size height
  const canvasRef = useRef<HTMLDivElement>(null);

  const pageFields = fields.filter(f => f.page === pageNumber);

  // Calculate display width based on zoom
  const baseWidth = 612; // Standard letter width in points
  const displayWidth = baseWidth * zoom;

  // Handle canvas click for tap-to-place mode
  const handleCanvasClick = (e: React.MouseEvent) => {
    if (!isTapToPlaceMode || !onTapToPlace) {
      onSelectField(null);
      return;
    }

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Calculate position relative to canvas, accounting for zoom
    const relativeX = (e.clientX - rect.left) / zoom;
    const relativeY = (e.clientY - rect.top) / zoom;

    // Convert to percentage of canvas dimensions (unzoomed)
    const x = (relativeX / baseWidth) * 100;
    const y = (relativeY / (rect.height / zoom)) * 100;

    onTapToPlace(pageNumber, x, y);
  };

  // Track actual canvas height for font size calculation
  useEffect(() => {
    const updateHeight = () => {
      if (canvasRef.current) {
        setCanvasHeight(canvasRef.current.offsetHeight / zoom);
      }
    };
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, [zoom]);

  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        registerCanvasRef(pageNumber, node);
        (canvasRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }}
      data-page={pageNumber}
      className={`relative border-2 rounded-lg overflow-hidden transition-colors flex-shrink-0 ${
        isOver ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
      } ${isTapToPlaceMode ? 'cursor-crosshair' : ''}`}
      style={{
        width: displayWidth,
      }}
      onClick={handleCanvasClick}
    >
      <img
        src={pageImage}
        alt={`Page ${pageNumber}`}
        className="w-full h-auto block"
        draggable={false}
        onLoad={(e) => {
          const img = e.target as HTMLImageElement;
          setCanvasHeight(img.naturalHeight * (displayWidth / img.naturalWidth) / zoom);
        }}
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
              onResize={(updates) => onResizeField(field.id, updates)}
              onResizeStateChange={onResizeStateChange}
              zoom={zoom}
              canvasHeight={canvasHeight}
              canvasRef={canvasRef}
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
  const [recipients, setRecipients] = useState<PlaceholderRecipient[]>([]);
  const [fields, setFields] = useState<TemplateField[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [isUploading, setIsUploading] = useState(false);
  const [activeRecipientId, setActiveRecipientId] = useState<string | null>(null);

  // Multiple document support
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDocument[]>([]);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  // Computed: Combined document URL and page images from all uploaded documents
  const documentUrl = uploadedDocuments.length > 0 ? uploadedDocuments[0].documentUrl : "";
  const pageImages = uploadedDocuments.flatMap(doc => doc.pageImages);

  // Title editing state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingTitleValue, setEditingTitleValue] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Mobile sidebar state
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  // Mobile tap-to-place mode
  const [mobileFieldType, setMobileFieldType] = useState<string | null>(null);
  const [isTapToPlaceMode, setIsTapToPlaceMode] = useState(false);

  // PowerForm state
  const [showPowerFormDialog, setShowPowerFormDialog] = useState(false);
  const [powerFormEnabled, setPowerFormEnabled] = useState(false);
  const [powerFormSlug, setPowerFormSlug] = useState("");
  const [powerFormUrl, setPowerFormUrl] = useState<string | null>(null);
  const [copiedPowerFormUrl, setCopiedPowerFormUrl] = useState(false);

  // Track active dragging item for DragOverlay visual feedback
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [activeDragData, setActiveDragData] = useState<{ type: string; fromPalette: boolean; field?: TemplateField } | null>(null);

  // Track if any field is being resized (to prevent drag during resize)
  const [isAnyFieldResizing, setIsAnyFieldResizing] = useState(false);

  // Track canvas refs for accurate drop positioning
  const canvasRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const lastPointerPosition = useRef<{ x: number; y: number } | null>(null);

  // Track actual mouse position during drag using native events (more reliable than @dnd-kit delta)
  useEffect(() => {
    if (!activeDragId) return;

    const handleMouseMove = (e: MouseEvent) => {
      lastPointerPosition.current = { x: e.clientX, y: e.clientY };
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, [activeDragId]);

  const registerCanvasRef = useCallback((pageNumber: number, ref: HTMLDivElement | null) => {
    if (ref) {
      canvasRefs.current.set(pageNumber, ref);
    } else {
      canvasRefs.current.delete(pageNumber);
    }
  }, []);

  // DnD sensors - include touch sensor for mobile
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 5,
      },
    })
  );

  // Handle drag start - track the active item for DragOverlay
  const handleDragStart = useCallback((event: DragStartEvent) => {
    // Don't start drag if a field is being resized
    if (isAnyFieldResizing) return;

    const { active } = event;
    setActiveDragId(active.id.toString());

    if (active.data.current?.fromPalette) {
      setActiveDragData({
        type: active.data.current.type,
        fromPalette: true,
      });
    } else if (active.data.current?.field) {
      setActiveDragData({
        type: active.data.current.field.type,
        fromPalette: false,
        field: active.data.current.field,
      });
    }
  }, [isAnyFieldResizing]);

  // Track pointer position during drag (native mouse tracking is used via useEffect above)
  const handleDragMove = useCallback((event: DragMoveEvent) => {
    // Native mouse tracking is now used instead for more accurate position
    // This callback is kept for potential future use but position is tracked via document mousemove
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
      // Convert existing template data to the new multi-document format
      if (template.documentUrl && template.pageImages?.length > 0) {
        setUploadedDocuments([{
          id: uuidv4(),
          name: template.name || 'Document',
          documentUrl: template.documentUrl,
          pageImages: template.pageImages,
          pageCount: template.pageImages.length,
        }]);
      }
      setRecipients(template.placeholderRecipients || []);
      setFields(template.fields || []);

      // Load PowerForm settings
      if (template.powerFormEnabled) {
        setPowerFormEnabled(true);
        setPowerFormSlug(template.powerFormSlug || "");
        if (template.powerFormSlug) {
          setPowerFormUrl(`${window.location.origin}/esign/form/${template.powerFormSlug}`);
        }
      }
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
    const newName = trimmed || generateDefaultTitle();
    setName(newName);
    setIsEditingTitle(false);

    // Auto-save to server if editing an existing template
    if (isEditing && templateId) {
      updateTitleMutation.mutate(newName);
    }
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

  // Allowed file extensions for validation
  const allowedExtensions = ['.pdf', '.doc', '.docx', '.odt', '.rtf', '.xlsx', '.xls', '.ods', '.csv', '.pptx', '.ppt', '.odp'];

  // Process files (shared by file input and drag/drop)
  const processFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    // Validate file types
    const invalidFiles = fileArray.filter(file => {
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      return !allowedExtensions.includes(ext);
    });

    if (invalidFiles.length > 0) {
      toast({
        title: "Invalid file type",
        description: `Only PDF, Word, Excel, and PowerPoint files are allowed. Invalid: ${invalidFiles.map(f => f.name).join(', ')}`,
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      const newDocuments: UploadedDocument[] = [];

      for (const file of fileArray) {
        const formData = new FormData();
        formData.append('document', file);

        const res = await fetch('/api/esign/templates/upload', {
          method: 'POST',
          body: formData,
          credentials: 'include',
        });

        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.error || `Upload failed for ${file.name}`);
        }

        const data = await res.json();

        newDocuments.push({
          id: uuidv4(),
          name: file.name,
          documentUrl: data.documentUrl,
          pageImages: data.pageImages,
          pageCount: data.pageCount,
        });
      }

      // Add new documents to existing ones
      setUploadedDocuments(prev => [...prev, ...newDocuments]);

      const totalPages = newDocuments.reduce((sum, doc) => sum + doc.pageCount, 0);
      toast({
        title: fileArray.length > 1 ? "Documents uploaded" : "Document uploaded",
        description: `Successfully processed ${fileArray.length} file(s) with ${totalPages} page(s).`,
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

  // File upload handler (supports multiple files)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await processFiles(files);
    // Reset file input
    e.target.value = '';
  };

  // Drag and drop handlers for file upload
  const handleFileDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isUploading) {
      setIsDraggingFile(true);
    }
  };

  const handleFileDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target) {
      setIsDraggingFile(false);
    }
  };

  const handleFileDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleFileDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);

    if (isUploading) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await processFiles(files);
    }
  };

  // Remove a document from the list
  const handleRemoveDocument = (docId: string) => {
    // Find which pages belong to this document to clear fields
    const docToRemove = uploadedDocuments.find(d => d.id === docId);
    if (docToRemove) {
      // Calculate page offset for this document
      let pageOffset = 0;
      for (const doc of uploadedDocuments) {
        if (doc.id === docId) break;
        pageOffset += doc.pageCount;
      }
      // Remove fields that were on pages from this document
      const pagesToRemove = Array.from({ length: docToRemove.pageCount }, (_, i) => pageOffset + i + 1);
      setFields(prev => prev.filter(f => !pagesToRemove.includes(f.page)));
    }

    setUploadedDocuments(prev => prev.filter(doc => doc.id !== docId));
    toast({
      title: "Document removed",
      description: "The document has been removed from the template.",
    });
  };

  // Handle document drag end for reordering
  const handleDocumentDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setUploadedDocuments(prev => {
        const oldIndex = prev.findIndex(doc => doc.id === active.id);
        const newIndex = prev.findIndex(doc => doc.id === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
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
    const { active, over } = event;

    // Clear active drag state
    setActiveDragId(null);
    setActiveDragData(null);

    // For new fields from palette, require a recipient to be selected
    // For existing fields, allow moving regardless of recipient selection
    const isExistingField = active.data.current?.field != null;
    if (!over || (!activeRecipientId && !isExistingField)) {
      lastPointerPosition.current = null;
      return;
    }

    // Check if dropped on canvas
    if (over.id.toString().startsWith('canvas-page-')) {
      const pageNumber = parseInt(over.id.toString().split('-').pop() || '1');
      const canvasRef = canvasRefs.current.get(pageNumber);

      if (!canvasRef || !lastPointerPosition.current) {
        lastPointerPosition.current = null;
        return;
      }

      // Get canvas bounding rect for accurate position calculation
      const canvasRect = canvasRef.getBoundingClientRect();

      // Use the native mouse position tracked via document mousemove
      const pointerX = lastPointerPosition.current.x;
      const pointerY = lastPointerPosition.current.y;

      // Calculate position relative to canvas
      // The canvas is displayed at baseWidth * zoom, so we need to convert screen pixels to percentage
      const relativeX = pointerX - canvasRect.left;
      const relativeY = pointerY - canvasRect.top;

      // Convert to percentage of canvas dimensions
      // canvasRect.width and height are already the zoomed dimensions
      const x = (relativeX / canvasRect.width) * 100;
      const y = (relativeY / canvasRect.height) * 100;

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

  // Handle tap-to-place on mobile
  const handleTapToPlace = useCallback((pageNumber: number, x: number, y: number) => {
    if (!mobileFieldType || !activeRecipientId) return;

    const fieldConfig = FIELD_TYPES.find(f => f.type === mobileFieldType);
    const fieldWidth = fieldConfig?.defaultSize.width || 20;
    const fieldHeight = fieldConfig?.defaultSize.height || 4;

    // Center the field on the tap point
    const centeredX = x - fieldWidth / 2;
    const centeredY = y - fieldHeight / 2;

    const newField: TemplateField = {
      id: uuidv4(),
      type: mobileFieldType as TemplateField['type'],
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
    // Keep tap-to-place mode active so user can add multiple fields
  }, [mobileFieldType, activeRecipientId, fields]);

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
      await queryClient.refetchQueries({ queryKey: ["/api/esign/templates"] });
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

  // Title update mutation (for auto-saving title changes)
  const updateTitleMutation = useMutation({
    mutationFn: async (newName: string) => {
      if (!templateId) throw new Error("Template must be saved first");
      return apiRequest("PUT", `/api/esign/templates/${templateId}`, {
        body: { name: newName },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/esign/templates", templateId] });
      queryClient.invalidateQueries({ queryKey: ["/api/esign/templates"] });
    },
  });

  // PowerForm mutation
  const powerFormMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      if (!templateId) throw new Error("Template must be saved first");
      return apiRequest("POST", `/api/esign/templates/${templateId}/powerform`, {
        body: { enabled },
      });
    },
    onSuccess: async (data: any) => {
      await queryClient.refetchQueries({ queryKey: ["/api/esign/templates", templateId] });
      if (data.powerFormUrl) {
        setPowerFormEnabled(true);
        setPowerFormSlug(data.slug);
        setPowerFormUrl(data.powerFormUrl);
        toast({
          title: "PowerForm enabled",
          description: "Your template now has a shareable PowerForm link.",
        });
      } else {
        setPowerFormEnabled(false);
        setPowerFormSlug("");
        setPowerFormUrl(null);
        toast({
          title: "PowerForm disabled",
          description: "The PowerForm link has been deactivated.",
        });
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update PowerForm settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Copy PowerForm URL to clipboard
  const copyPowerFormUrl = () => {
    if (powerFormUrl) {
      navigator.clipboard.writeText(powerFormUrl);
      setCopiedPowerFormUrl(true);
      setTimeout(() => setCopiedPowerFormUrl(false), 2000);
      toast({
        title: "Copied!",
        description: "PowerForm link copied to clipboard.",
      });
    }
  };

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
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragMove={handleDragMove} onDragEnd={handleDragEnd}>
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
                      <h1 className="font-semibold text-lg truncate text-gray-900">{name}</h1>
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

                {/* PowerForm Button - only show for saved templates */}
                {isEditing && (
                  <>
                    {/* Desktop button with text */}
                    <Button
                      variant={powerFormEnabled ? "default" : "outline"}
                      size="sm"
                      onClick={() => setShowPowerFormDialog(true)}
                      className="hidden md:flex"
                    >
                      <Link2 className="h-4 w-4 mr-2" />
                      {powerFormEnabled ? "PowerForm Active" : "Enable PowerForm"}
                    </Button>
                    {/* Mobile icon-only button */}
                    <Button
                      variant={powerFormEnabled ? "default" : "outline"}
                      size="icon"
                      onClick={() => setShowPowerFormDialog(true)}
                      className="md:hidden"
                      title={powerFormEnabled ? "PowerForm Active" : "Enable PowerForm"}
                    >
                      <Link2 className="h-4 w-4" />
                    </Button>
                  </>
                )}

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
              lg:block lg:static lg:w-72 xl:w-80 lg:flex-shrink-0 lg:h-[calc(100vh-180px)] lg:overflow-y-auto space-y-4
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

              {/* Documents */}
              {uploadedDocuments.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center justify-between">
                      <span>Documents ({uploadedDocuments.length})</span>
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,.odt,.rtf,.xlsx,.xls,.ods,.csv,.pptx,.ppt,.odp"
                          className="hidden"
                          onChange={handleFileUpload}
                          disabled={isUploading}
                          multiple
                        />
                        <Button size="sm" variant="ghost" className="h-7 text-xs" asChild disabled={isUploading}>
                          <span>
                            <Plus className="h-3 w-3 mr-1" />
                            Add
                          </span>
                        </Button>
                      </label>
                    </CardTitle>
                    <p className="text-xs text-gray-500">
                      {pageImages.length} total page(s)
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-2 max-h-[30vh] overflow-y-auto">
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDocumentDragEnd}
                    >
                      <SortableContext
                        items={uploadedDocuments.map(doc => doc.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {uploadedDocuments.map((doc) => (
                          <SortableDocumentItem
                            key={doc.id}
                            doc={doc}
                            onRemove={handleRemoveDocument}
                          />
                        ))}
                      </SortableContext>
                    </DndContext>
                    <p className="text-xs text-gray-500 italic pt-1">
                      Drag to reorder documents
                    </p>
                  </CardContent>
                </Card>
              )}

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

              {/* Field Properties - shown when a field is selected */}
              {selectedFieldId && (() => {
                const selectedField = fields.find(f => f.id === selectedFieldId);
                if (!selectedField) return null;
                const fieldConfig = FIELD_TYPES.find(f => f.type === selectedField.type);
                const recipient = recipients.find(r => r.id === selectedField.assignedTo);
                // Estimate font size (assuming ~792pt canvas height for letter size)
                const estimatedFontSize = Math.round(calculateFontSize(selectedField.height, 792));

                return (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: recipient?.color || '#888' }}
                        />
                        Field Properties
                      </CardTitle>
                      <p className="text-xs text-gray-500">
                        {fieldConfig?.label} field for {recipient?.label || 'Unknown'}
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* Size controls */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs text-gray-500">Width (%)</Label>
                          <Input
                            type="number"
                            min={5}
                            max={100}
                            step={1}
                            value={Math.round(selectedField.width)}
                            onChange={(e) => {
                              const width = Math.max(5, Math.min(100, parseFloat(e.target.value) || 5));
                              setFields(fields.map(f =>
                                f.id === selectedFieldId ? { ...f, width } : f
                              ));
                            }}
                            className="h-8 text-sm mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-gray-500">Height (%)</Label>
                          <Input
                            type="number"
                            min={2}
                            max={50}
                            step={0.5}
                            value={Math.round(selectedField.height * 10) / 10}
                            onChange={(e) => {
                              const height = Math.max(2, Math.min(50, parseFloat(e.target.value) || 2));
                              setFields(fields.map(f =>
                                f.id === selectedFieldId ? { ...f, height } : f
                              ));
                            }}
                            className="h-8 text-sm mt-1"
                          />
                        </div>
                      </div>

                      {/* Font size display */}
                      <div className="bg-gray-50 rounded-md p-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">Estimated Font Size</span>
                          <span className="text-sm font-medium">{estimatedFontSize}px</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          Font size adjusts automatically based on field height
                        </p>
                      </div>

                      {/* Quick size presets */}
                      <div>
                        <Label className="text-xs text-gray-500 mb-2 block">Quick Size</Label>
                        <div className="flex gap-1">
                          {[
                            { label: 'S', width: 15, height: 3 },
                            { label: 'M', width: 20, height: 4 },
                            { label: 'L', width: 25, height: 5 },
                            { label: 'XL', width: 30, height: 6 },
                          ].map((preset) => (
                            <Button
                              key={preset.label}
                              size="sm"
                              variant={
                                Math.abs(selectedField.width - preset.width) < 2 &&
                                Math.abs(selectedField.height - preset.height) < 0.5
                                  ? 'default'
                                  : 'outline'
                              }
                              className="flex-1 h-7 text-xs"
                              onClick={() => {
                                setFields(fields.map(f =>
                                  f.id === selectedFieldId
                                    ? { ...f, width: preset.width, height: preset.height }
                                    : f
                                ));
                              }}
                            >
                              {preset.label}
                            </Button>
                          ))}
                        </div>
                      </div>

                      {/* Required toggle */}
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-gray-500">Required field</Label>
                        <Button
                          size="sm"
                          variant={selectedField.required ? 'default' : 'outline'}
                          className="h-6 text-xs"
                          onClick={() => {
                            setFields(fields.map(f =>
                              f.id === selectedFieldId ? { ...f, required: !f.required } : f
                            ));
                          }}
                        >
                          {selectedField.required ? 'Required' : 'Optional'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}
            </div>

            {/* Main Canvas */}
            <div className="flex-1 min-w-0 pb-32 lg:pb-0">
              <Card className="h-[calc(100vh-200px)] lg:h-[calc(100vh-180px)] flex flex-col">
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
                    <div className="h-full flex items-center justify-center p-6">
                      <div
                        className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors w-full max-w-md ${
                          isDraggingFile
                            ? 'border-blue-500 bg-blue-50'
                            : isUploading
                            ? 'border-gray-300 bg-gray-50 cursor-wait'
                            : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                        }`}
                        onDragEnter={handleFileDragEnter}
                        onDragOver={handleFileDragOver}
                        onDragLeave={handleFileDragLeave}
                        onDrop={handleFileDrop}
                        onClick={() => !isUploading && document.getElementById('template-file-upload')?.click()}
                      >
                        <input
                          type="file"
                          id="template-file-upload"
                          accept=".pdf,.doc,.docx,.odt,.rtf,.xlsx,.xls,.ods,.csv,.pptx,.ppt,.odp"
                          className="hidden"
                          onChange={handleFileUpload}
                          disabled={isUploading}
                          multiple
                        />
                        {isUploading ? (
                          <>
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 mb-2">
                              Processing...
                            </h3>
                            <p className="text-gray-500">
                              Please wait while we process your document(s)
                            </p>
                          </>
                        ) : isDraggingFile ? (
                          <>
                            <Upload className="h-12 w-12 mx-auto text-blue-500 mb-4" />
                            <h3 className="text-lg font-medium text-blue-600 mb-2">
                              Drop files here
                            </h3>
                            <p className="text-blue-400">
                              Release to upload
                            </p>
                          </>
                        ) : (
                          <>
                            <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 mb-2">
                              Drag & Drop or Click to Upload
                            </h3>
                            <p className="text-gray-500 mb-4">
                              Supports PDF, Word, Excel, and PowerPoint (multiple files allowed)
                            </p>
                            <Button
                              disabled={isUploading}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                document.getElementById('template-file-upload')?.click();
                              }}
                            >
                              <Upload className="h-4 w-4 mr-2" />
                              Choose Files
                            </Button>
                          </>
                        )}
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
                            onResizeField={(fieldId, updates) => {
                              setFields(fields.map(f =>
                                f.id === fieldId ? { ...f, ...updates } : f
                              ));
                            }}
                            onResizeStateChange={setIsAnyFieldResizing}
                            zoom={zoom}
                            onDrop={() => {}}
                            registerCanvasRef={registerCanvasRef}
                            isTapToPlaceMode={isTapToPlaceMode}
                            onTapToPlace={handleTapToPlace}
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

        {/* Mobile Bottom Bars - Only show when document is loaded */}
        {pageImages.length > 0 && (
          <>
            {/* Mobile Field Placement Bar - positioned above nav bar */}
            <div className="fixed bottom-16 left-0 right-0 bg-white border-t shadow-lg z-40 lg:hidden">
              <div className="flex items-center gap-2 px-3 py-2">
                {/* Recipient selector */}
                <Select
                  value={activeRecipientId || ""}
                  onValueChange={(value) => setActiveRecipientId(value)}
                >
                  <SelectTrigger className="w-[130px] h-9 text-xs">
                    <SelectValue placeholder="Recipient" />
                  </SelectTrigger>
                  <SelectContent>
                    {recipients.map((recipient) => (
                      <SelectItem key={recipient.id} value={recipient.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: recipient.color }}
                          />
                          <span className="truncate">{recipient.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Field type selector */}
                <Select
                  value={mobileFieldType || ""}
                  onValueChange={(value) => {
                    setMobileFieldType(value);
                    setIsTapToPlaceMode(true);
                  }}
                  disabled={!activeRecipientId}
                >
                  <SelectTrigger className="w-[120px] h-9 text-xs">
                    <SelectValue placeholder="Field type" />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPES.map((fieldType) => {
                      const Icon = fieldType.icon;
                      return (
                        <SelectItem key={fieldType.type} value={fieldType.type}>
                          <div className="flex items-center gap-2">
                            <Icon className="h-3 w-3 flex-shrink-0" />
                            <span>{fieldType.label}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>

                {/* Tap-to-place indicator/toggle */}
                {isTapToPlaceMode ? (
                  <div className="flex items-center gap-2 flex-1">
                    <div className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 px-2 py-1.5 rounded-md">
                      <Pointer className="h-3 w-3" />
                      <span>Tap to place</span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs ml-auto"
                      onClick={() => {
                        setIsTapToPlaceMode(false);
                        setMobileFieldType(null);
                      }}
                    >
                      Done
                    </Button>
                  </div>
                ) : (
                  <div className="text-xs text-gray-500 flex-1">
                    {!activeRecipientId ? (
                      "Select recipient first"
                    ) : (
                      "Select field to place"
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Mobile Navigation Bar - bottom sticky */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-40 lg:hidden">
              <div className="flex items-center justify-between px-3 py-2">
                {/* Back button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLocation("/esign/templates")}
                  className="h-10"
                >
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>

                {/* Zoom controls */}
                <div className="flex items-center gap-1 bg-gray-100 rounded-lg px-2 py-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <span className="text-xs w-10 text-center font-medium">{Math.round(zoom * 100)}%</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => setZoom(Math.min(1.5, zoom + 0.1))}
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                </div>

                {/* Save button */}
                <Button
                  onClick={() => saveMutation.mutate()}
                  disabled={!canSave || saveMutation.isPending}
                  size="sm"
                  className="h-10"
                >
                  <Save className="h-4 w-4 mr-1" />
                  {saveMutation.isPending ? "..." : "Save"}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* PowerForm Dialog */}
      <Dialog open={showPowerFormDialog} onOpenChange={setShowPowerFormDialog}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              PowerForm Settings
            </DialogTitle>
            <DialogDescription>
              Enable PowerForm to create a shareable link that anyone can use to fill out and sign this template.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {powerFormEnabled ? (
              <>
                {/* PowerForm is enabled - show link */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                    <span className="font-medium text-green-800">PowerForm Active</span>
                  </div>
                  <p className="text-sm text-green-700 mb-3">
                    Anyone with this link can fill out and sign the template.
                  </p>

                  {/* Link display */}
                  <div className="bg-white rounded border p-2 mb-3">
                    <code className="text-xs text-gray-700 break-all">
                      {powerFormUrl}
                    </code>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={copyPowerFormUrl}
                      className="flex-1"
                    >
                      {copiedPowerFormUrl ? (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 mr-2" />
                          Copy Link
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(powerFormUrl!, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open
                    </Button>
                  </div>
                </div>

                {/* Disable button */}
                <Button
                  variant="outline"
                  className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => powerFormMutation.mutate(false)}
                  disabled={powerFormMutation.isPending}
                >
                  {powerFormMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Disabling...
                    </>
                  ) : (
                    "Disable PowerForm"
                  )}
                </Button>
              </>
            ) : (
              <>
                {/* PowerForm is disabled - show enable option */}
                <div className="bg-gray-50 border rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-2">What is PowerForm?</h4>
                  <ul className="text-sm text-gray-600 space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="text-blue-500 mt-0.5">•</span>
                      Create a shareable link to this template
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-500 mt-0.5">•</span>
                      Anyone can fill out and sign without you sending an envelope
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-500 mt-0.5">•</span>
                      You'll be notified when someone completes the form
                    </li>
                  </ul>
                </div>

                <Button
                  className="w-full"
                  onClick={() => powerFormMutation.mutate(true)}
                  disabled={powerFormMutation.isPending}
                >
                  {powerFormMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Enabling...
                    </>
                  ) : (
                    <>
                      <Link2 className="h-4 w-4 mr-2" />
                      Enable PowerForm
                    </>
                  )}
                </Button>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPowerFormDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DragOverlay - shows visual feedback of the dragged item following the cursor */}
      <DragOverlay dropAnimation={null}>
        {activeDragId && activeDragData && !isAnyFieldResizing && (
          <div
            className="rounded border-2 flex items-center justify-center gap-1 text-white font-medium shadow-lg pointer-events-none"
            style={{
              backgroundColor: activeRecipientId
                ? recipients.find(r => r.id === activeRecipientId)?.color || '#888'
                : '#888',
              borderColor: activeRecipientId
                ? recipients.find(r => r.id === activeRecipientId)?.color || '#888'
                : '#888',
              opacity: 0.9,
              width: activeDragData.field
                ? `${activeDragData.field.width * 6.12}px`
                : `${(FIELD_TYPES.find(f => f.type === activeDragData.type)?.defaultSize.width || 20) * 6.12}px`,
              height: activeDragData.field
                ? `${activeDragData.field.height * 7.92}px`
                : `${(FIELD_TYPES.find(f => f.type === activeDragData.type)?.defaultSize.height || 4) * 7.92}px`,
              fontSize: '12px',
            }}
          >
            {(() => {
              const fieldConfig = FIELD_TYPES.find(f => f.type === activeDragData.type);
              const Icon = fieldConfig?.icon || Type;
              return (
                <>
                  <Icon className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{fieldConfig?.label}</span>
                </>
              );
            })()}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
