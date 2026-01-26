import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  FileSignature,
  Send,
  ArrowLeft,
  Upload,
  FileText,
  Users,
  Mail,
  User,
  Plus,
  Trash2,
  GripVertical,
  Clock,
  CheckCircle,
  AlertCircle,
  Pen,
  Edit3,
  Calendar,
  Type,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  File,
  Pointer,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ESIGN_RECIPIENT_COLORS, ESIGN_CC_COLOR } from "@shared/schema";
import { v4 as uuidv4 } from "uuid";

// Field types for signature fields
const FIELD_TYPES = [
  { type: 'signature', label: 'Signature', icon: Pen, defaultSize: { width: 20, height: 5 } },
  { type: 'initials', label: 'Initials', icon: Edit3, defaultSize: { width: 10, height: 4 } },
  { type: 'name', label: 'Name', icon: User, defaultSize: { width: 20, height: 3 } },
  { type: 'email', label: 'Email', icon: Mail, defaultSize: { width: 25, height: 3 } },
  { type: 'date', label: 'Date', icon: Calendar, defaultSize: { width: 15, height: 3 } },
  { type: 'text', label: 'Text', icon: Type, defaultSize: { width: 20, height: 3 } },
] as const;

interface SignatureField {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  recipientIndex: number;
  required: boolean;
}

// Interface for uploaded documents (multiple file support)
interface UploadedDocument {
  id: string;
  name: string;
  documentUrl: string;
  pageImages: string[];
  pageCount: number;
  pageDimensions: Array<{ width: number; height: number }>;
}

// Draggable document item for reordering
const DOCUMENT_ITEM_TYPE = 'DOCUMENT_ITEM';

function DraggableDocumentItem({
  doc,
  index,
  moveDocument,
  onRemove,
}: {
  doc: UploadedDocument;
  index: number;
  moveDocument: (dragIndex: number, hoverIndex: number) => void;
  onRemove: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag, preview] = useDrag({
    type: DOCUMENT_ITEM_TYPE,
    item: { index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [, drop] = useDrop({
    accept: DOCUMENT_ITEM_TYPE,
    hover: (item: { index: number }, monitor) => {
      if (!ref.current) return;

      const dragIndex = item.index;
      const hoverIndex = index;

      if (dragIndex === hoverIndex) return;

      const hoverBoundingRect = ref.current.getBoundingClientRect();
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) return;

      const hoverClientY = clientOffset.y - hoverBoundingRect.top;

      // Only move when cursor crosses half of the item height
      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) return;
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) return;

      moveDocument(dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
  });

  // Connect drag and drop refs
  drag(drop(ref));

  return (
    <div
      ref={ref}
      className={`p-3 bg-gray-50 border border-gray-200 rounded-lg flex items-center gap-3 group cursor-move transition-all ${
        isDragging ? 'opacity-50 shadow-lg scale-[1.02]' : 'opacity-100'
      }`}
    >
      {/* Drag handle */}
      <div className="text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing">
        <GripVertical className="h-5 w-5" />
      </div>

      <File className="h-8 w-8 text-blue-500 flex-shrink-0" />

      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-800 truncate">{doc.name}</p>
        <p className="text-xs text-gray-500">
          {doc.pageCount} page{doc.pageCount !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Delete button */}
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8 text-gray-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => {
          e.stopPropagation();
          onRemove(doc.id);
        }}
        title="Remove document"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

// Draggable Field Palette Item using react-dnd
function DraggableFieldType({ type, label, icon: Icon, disabled, color, recipientIndex }: {
  type: string;
  label: string;
  icon: any;
  disabled?: boolean;
  color?: string;
  recipientIndex: number;
}) {
  const [{ isDragging }, drag] = useDrag({
    type: 'SIGNATURE_FIELD',
    item: { type, recipientIndex },
    canDrag: !disabled,
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  return (
    <div
      ref={drag}
      className={`flex items-center gap-2 p-2.5 rounded-lg border-2 cursor-grab active:cursor-grabbing transition-all ${
        isDragging ? 'opacity-50 scale-95' : 'hover:bg-gray-50 hover:shadow-sm'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      style={color ? { borderColor: color, backgroundColor: `${color}15` } : {}}
    >
      <Icon className="h-4 w-4" style={color ? { color } : { color: '#666' }} />
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}

// Document Page with drop zone and proper field placement
interface DocumentPageCanvasProps {
  pageImage: string;
  pageNumber: number;
  pageWidth: number;
  pageHeight: number;
  fields: SignatureField[];
  selectedFieldId: string | null;
  onFieldsChange: (fields: SignatureField[]) => void;
  onSelectField: (id: string | null) => void;
  zoom: number;
  getRecipientColor: (index: number) => string;
  // Mobile tap-to-place support
  isTapToPlaceMode?: boolean;
  onTapToPlace?: (pageNumber: number, x: number, y: number, pageWidth: number, pageHeight: number) => void;
}

function DocumentPageCanvas({
  pageImage,
  pageNumber,
  pageWidth,
  pageHeight,
  fields,
  selectedFieldId,
  onFieldsChange,
  onSelectField,
  zoom,
  getRecipientColor,
  isTapToPlaceMode,
  onTapToPlace,
}: DocumentPageCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);

  // Handle image load to get actual dimensions
  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
    setImageLoaded(true);
  }, []);

  // Calculate display dimensions maintaining aspect ratio based on actual image dimensions
  const baseDisplayWidth = 612; // Base display width in pixels (consistent with esign-sign.tsx)

  // Use actual image dimensions once loaded
  const actualWidth = imageDimensions?.width || 1;
  const actualHeight = imageDimensions?.height || 1;
  const aspectRatio = actualHeight / actualWidth;

  // Use consistent base width for all orientations to match esign-sign.tsx coordinate system
  // The image will naturally display at this width with height auto-calculated
  const displayWidth = baseDisplayWidth * zoom;
  const displayHeight = imageDimensions ? displayWidth * aspectRatio : 0;

  // For landscape images, the container will be shorter/wider due to aspect ratio
  const isLandscape = imageDimensions ? actualWidth > actualHeight : false;

  // Convert pixel coordinates to percentage (based on display dimensions)
  const pixelToPercent = useCallback((pixelX: number, pixelY: number) => {
    return {
      x: (pixelX / displayWidth) * 100,
      y: (pixelY / displayHeight) * 100
    };
  }, [displayWidth, displayHeight]);

  // Convert percentage coordinates to pixels
  const percentToPixel = useCallback((percentX: number, percentY: number) => {
    return {
      x: (percentX / 100) * displayWidth,
      y: (percentY / 100) * displayHeight
    };
  }, [displayWidth, displayHeight]);

  // Drop handler for new fields
  const [{ isOver }, drop] = useDrop({
    accept: 'SIGNATURE_FIELD',
    drop: (item: { type: string; recipientIndex: number }, monitor) => {
      if (!canvasRef.current) return;

      const offset = monitor.getClientOffset();
      if (!offset) return;

      const canvasRect = canvasRef.current.getBoundingClientRect();
      // Account for zoom when calculating position
      const x = (offset.x - canvasRect.left) / zoom;
      const y = (offset.y - canvasRect.top) / zoom;

      // Convert to percentage coordinates
      const percentCoords = pixelToPercent(x, y);

      // Get default dimensions for field type
      const fieldConfig = FIELD_TYPES.find(f => f.type === item.type);
      const dimensions = fieldConfig?.defaultSize || { width: 20, height: 4 };

      // Clamp coordinates to keep field within bounds
      const clampedX = Math.max(0, Math.min(100 - dimensions.width, percentCoords.x));
      const clampedY = Math.max(0, Math.min(100 - dimensions.height, percentCoords.y));

      // Create new field
      const newField: SignatureField = {
        id: uuidv4(),
        type: item.type,
        x: clampedX,
        y: clampedY,
        width: dimensions.width,
        height: dimensions.height,
        page: pageNumber,
        recipientIndex: item.recipientIndex,
        required: true,
      };

      onFieldsChange([...fields, newField]);
      onSelectField(newField.id);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  // Handle field drag for moving existing fields
  const handleFieldMouseDown = useCallback((e: React.MouseEvent, field: SignatureField) => {
    e.preventDefault();
    e.stopPropagation();

    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const fieldPixelCoords = percentToPixel(field.x, field.y);
    const offsetX = (e.clientX - rect.left) / zoom - fieldPixelCoords.x;
    const offsetY = (e.clientY - rect.top) / zoom - fieldPixelCoords.y;

    onSelectField(field.id);

    const handleMouseMove = (e: MouseEvent) => {
      if (!canvasRef.current) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / zoom - offsetX;
      const y = (e.clientY - rect.top) / zoom - offsetY;

      // Convert to percentage
      const percentCoords = pixelToPercent(x, y);

      // Clamp to bounds
      const clampedX = Math.max(0, Math.min(100 - field.width, percentCoords.x));
      const clampedY = Math.max(0, Math.min(100 - field.height, percentCoords.y));

      // Update field position
      const updatedFields = fields.map(f =>
        f.id === field.id ? { ...f, x: clampedX, y: clampedY } : f
      );
      onFieldsChange(updatedFields);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [fields, onFieldsChange, onSelectField, zoom, pixelToPercent, percentToPixel]);

  // Handle field deletion
  const handleDeleteField = useCallback((fieldId: string) => {
    const updatedFields = fields.filter(f => f.id !== fieldId);
    onFieldsChange(updatedFields);
    if (selectedFieldId === fieldId) {
      onSelectField(null);
    }
  }, [fields, onFieldsChange, selectedFieldId, onSelectField]);

  // Handle field resize
  const handleFieldResize = useCallback((e: React.MouseEvent, field: SignatureField, corner: 'se' | 'sw' | 'ne' | 'nw') => {
    e.preventDefault();
    e.stopPropagation();

    if (!canvasRef.current) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = field.width;
    const startHeight = field.height;
    const startFieldX = field.x;
    const startFieldY = field.y;

    const handleMouseMove = (e: MouseEvent) => {
      if (!canvasRef.current) return;

      const deltaX = ((e.clientX - startX) / displayWidth) * 100;
      const deltaY = ((e.clientY - startY) / displayHeight) * 100;

      let newWidth = startWidth;
      let newHeight = startHeight;
      let newX = startFieldX;
      let newY = startFieldY;

      // Calculate new dimensions based on which corner is being dragged
      if (corner === 'se') {
        newWidth = Math.max(5, startWidth + deltaX);
        newHeight = Math.max(2, startHeight + deltaY);
      } else if (corner === 'sw') {
        newWidth = Math.max(5, startWidth - deltaX);
        newHeight = Math.max(2, startHeight + deltaY);
        newX = startFieldX + (startWidth - newWidth);
      } else if (corner === 'ne') {
        newWidth = Math.max(5, startWidth + deltaX);
        newHeight = Math.max(2, startHeight - deltaY);
        newY = startFieldY + (startHeight - newHeight);
      } else if (corner === 'nw') {
        newWidth = Math.max(5, startWidth - deltaX);
        newHeight = Math.max(2, startHeight - deltaY);
        newX = startFieldX + (startWidth - newWidth);
        newY = startFieldY + (startHeight - newHeight);
      }

      // Clamp to bounds
      newX = Math.max(0, Math.min(100 - newWidth, newX));
      newY = Math.max(0, Math.min(100 - newHeight, newY));
      newWidth = Math.min(100 - newX, newWidth);
      newHeight = Math.min(100 - newY, newHeight);

      const updatedFields = fields.map(f =>
        f.id === field.id ? { ...f, x: newX, y: newY, width: newWidth, height: newHeight } : f
      );
      onFieldsChange(updatedFields);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [fields, onFieldsChange, displayWidth, displayHeight]);

  // Combine refs
  const combinedRef = useCallback((node: HTMLDivElement | null) => {
    (canvasRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    drop(node);
  }, [drop]);

  const pageFields = fields.filter(f => f.page === pageNumber);

  // Handle canvas click - either tap-to-place or deselect
  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if (isTapToPlaceMode && onTapToPlace && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / zoom;
      const y = (e.clientY - rect.top) / zoom;
      onTapToPlace(pageNumber, x, y, displayWidth / zoom, displayHeight / zoom);
    } else {
      onSelectField(null);
    }
  }, [isTapToPlaceMode, onTapToPlace, pageNumber, displayWidth, displayHeight, zoom, onSelectField]);

  return (
    <div
      ref={combinedRef}
      className={`relative bg-white rounded-lg shadow-lg overflow-hidden border-2 transition-colors flex-shrink-0 ${
        isOver ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'
      } ${isTapToPlaceMode ? 'cursor-crosshair' : ''}`}
      style={{
        width: imageLoaded ? displayWidth : baseDisplayWidth * zoom,
        minHeight: imageLoaded ? undefined : 400,
      }}
      onClick={handleCanvasClick}
    >
      {/* Loading placeholder while image dimensions are being determined */}
      {!imageLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 animate-pulse">
          <div className="text-gray-400">Loading page...</div>
        </div>
      )}
      
      {/* Document Image - natural height based on width, maintains aspect ratio */}
      <img
        src={pageImage}
        alt={`Page ${pageNumber}`}
        className={`w-full h-auto block ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={handleImageLoad}
        draggable={false}
        style={{
          transition: 'opacity 0.2s ease-in-out'
        }}
      />

      {/* Fields overlay - positioned absolutely over image */}
      <div className="absolute inset-0">
        {pageFields.map((field) => {
          const fieldConfig = FIELD_TYPES.find(f => f.type === field.type);
          const Icon = fieldConfig?.icon || Type;
          const color = getRecipientColor(field.recipientIndex);
          const isSelected = selectedFieldId === field.id;

          // Calculate dynamic font size based on field height (in pixels)
          const fieldHeightPx = (field.height / 100) * displayHeight;
          const dynamicFontSize = Math.max(8, Math.min(24, fieldHeightPx * 0.5));
          const iconSize = Math.max(10, Math.min(20, fieldHeightPx * 0.4));

          return (
            <div
              key={field.id}
              className={`absolute cursor-move transition-shadow ${
                isSelected ? 'ring-2 ring-blue-500 ring-offset-1 z-20' : 'z-10'
              }`}
              style={{
                left: `${field.x}%`,
                top: `${field.y}%`,
                width: `${field.width}%`,
                height: `${field.height}%`,
              }}
              onMouseDown={(e) => handleFieldMouseDown(e, field)}
              onClick={(e) => {
                e.stopPropagation();
                onSelectField(field.id);
              }}
            >
              <div
                className="w-full h-full rounded border-2 flex items-center justify-center gap-1 text-white font-medium overflow-hidden"
                style={{
                  backgroundColor: `${color}dd`,
                  borderColor: color,
                  fontSize: `${dynamicFontSize}px`,
                }}
              >
                <Icon className="flex-shrink-0" style={{ width: iconSize, height: iconSize }} />
                <span className="truncate">{fieldConfig?.label}</span>
              </div>

              {/* Delete button when selected */}
              {isSelected && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteField(field.id);
                  }}
                  className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-md z-30"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}

              {/* Resize handle - only bottom-right corner */}
              {isSelected && (
                <div
                  onMouseDown={(e) => handleFieldResize(e, field, 'se')}
                  className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-blue-500 border border-white rounded-sm cursor-se-resize z-30"
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Drop indicator */}
      {isOver && (
        <div className="absolute inset-0 bg-blue-100/50 pointer-events-none flex items-center justify-center">
          <div className="bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg font-medium">
            Drop field here
          </div>
        </div>
      )}
    </div>
  );
}

interface EsignTemplate {
  id: number;
  name: string;
  description: string | null;
  documentUrl: string;
  pageImages: string[];
  totalPages: number;
  placeholderRecipients: PlaceholderRecipient[];
  fields: TemplateField[];
}

interface PlaceholderRecipient {
  id: string;
  label: string;
  role: 'signer' | 'cc';
  color: string;
  order: number;
}

interface TemplateField {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  assignedTo: string;
  required: boolean;
}

interface Recipient {
  id: string;
  name: string;
  email: string;
  role: 'signer' | 'cc';
  order: number;
  placeholderRecipientId?: string; // Maps to template placeholder
}

interface RecentRecipient {
  id: number;
  email: string;
  name: string;
  useCount: number;
  lastUsedAt: string;
}

// Autocomplete input component for recipient fields
function RecipientAutocompleteInput({
  value,
  onChange,
  onSelectRecipient,
  placeholder,
  type = 'text',
  className,
  recentRecipients,
}: {
  value: string;
  onChange: (value: string) => void;
  onSelectRecipient: (recipient: RecentRecipient) => void;
  placeholder?: string;
  type?: 'text' | 'email';
  className?: string;
  recentRecipients: RecentRecipient[];
}) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<RecentRecipient[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter suggestions based on input
  useEffect(() => {
    if (!value.trim()) {
      setFilteredSuggestions(recentRecipients.slice(0, 5));
    } else {
      const query = value.toLowerCase();
      const filtered = recentRecipients.filter(
        r => r.name.toLowerCase().includes(query) || r.email.toLowerCase().includes(query)
      ).slice(0, 5);
      setFilteredSuggestions(filtered);
    }
  }, [value, recentRecipients]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setShowSuggestions(true)}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      {showSuggestions && filteredSuggestions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto"
        >
          {filteredSuggestions.map((recipient) => (
            <button
              key={recipient.id}
              type="button"
              className="w-full px-3 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none border-b border-gray-100 last:border-b-0"
              onClick={() => {
                onSelectRecipient(recipient);
                setShowSuggestions(false);
              }}
            >
              <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-900">{recipient.name}</span>
                <span className="text-xs text-gray-500">{recipient.email}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function EsignSend() {
  const [, setLocation] = useLocation();
  const searchParams = useSearch();
  const templateIdFromUrl = new URLSearchParams(searchParams).get('template');

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Step state
  const [currentStep, setCurrentStep] = useState(1);

  // Form state
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(
    templateIdFromUrl ? parseInt(templateIdFromUrl) : null
  );
  const [signingOrder, setSigningOrder] = useState<'sequential' | 'parallel'>('parallel');
  const [recipients, setRecipients] = useState<Recipient[]>([]);

  // Multiple document support
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDocument[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Template-specific document data (templates have pre-defined documents)
  const [templateDocumentUrl, setTemplateDocumentUrl] = useState<string | null>(null);
  const [templatePageImages, setTemplatePageImages] = useState<string[]>([]);

  // Computed: Combined document URL, page images, and dimensions from all uploaded documents
  // For templates, use template data; for direct uploads, use uploaded documents
  const documentUrl = selectedTemplateId ? templateDocumentUrl : (uploadedDocuments.length > 0 ? uploadedDocuments[0].documentUrl : null);
  const pageImages = selectedTemplateId ? templatePageImages : uploadedDocuments.flatMap(doc => doc.pageImages);
  const pageDimensions = uploadedDocuments.flatMap(doc => doc.pageDimensions);

  // Field placement state (for direct uploads only, templates have pre-defined fields)
  const [signatureFields, setSignatureFields] = useState<SignatureField[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [activeRecipientIndex, setActiveRecipientIndex] = useState<number>(0);
  const [zoom, setZoom] = useState(1);

  // Mobile-specific state for tap-to-place mode
  const [isTapToPlaceMode, setIsTapToPlaceMode] = useState(false);
  const [mobileFieldType, setMobileFieldType] = useState<string | null>('signature'); // Default to signature

  // Fetch templates
  const { data: templates = [], isLoading: isLoadingTemplates } = useQuery<EsignTemplate[]>({
    queryKey: ["/api/esign/templates"],
  });

  // Fetch recent recipients for autocomplete
  const { data: recentRecipients = [] } = useQuery<RecentRecipient[]>({
    queryKey: ["/api/esign/recent-recipients"],
    queryFn: async () => {
      const res = await fetch('/api/esign/recent-recipients?limit=20', {
        credentials: 'include',
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Fetch selected template details
  const { data: selectedTemplate } = useQuery<EsignTemplate>({
    queryKey: ["/api/esign/templates", selectedTemplateId],
    queryFn: async () => {
      if (!selectedTemplateId) return null;
      const res = await fetch(`/api/esign/templates/${selectedTemplateId}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch template');
      return res.json();
    },
    enabled: !!selectedTemplateId,
  });

  // Track which template we've initialized to prevent re-initialization
  const [initializedTemplateId, setInitializedTemplateId] = useState<number | null>(null);

  // Initialize recipients when template is selected (only once per template)
  useEffect(() => {
    if (selectedTemplate && selectedTemplate.id !== initializedTemplateId) {
      setTitle(selectedTemplate.name);
      setTemplateDocumentUrl(selectedTemplate.documentUrl);
      setTemplatePageImages(selectedTemplate.pageImages);

      // Create recipients from placeholder recipients
      const newRecipients: Recipient[] = selectedTemplate.placeholderRecipients.map((placeholder, idx) => ({
        id: uuidv4(),
        name: "",
        email: "",
        role: placeholder.role,
        order: placeholder.order,
        placeholderRecipientId: placeholder.id,
      }));
      setRecipients(newRecipients);
      setInitializedTemplateId(selectedTemplate.id);
    }
  }, [selectedTemplate, initializedTemplateId]);

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

        // Create uploaded document entry
        const uploadedDoc: UploadedDocument = {
          id: uuidv4(),
          name: file.name,
          documentUrl: data.documentUrl,
          pageImages: data.pageImages,
          pageCount: data.pageCount,
          pageDimensions: data.pages?.map((p: { width: number; height: number }) => ({
            width: p.width,
            height: p.height
          })) || data.pageImages.map(() => ({ width: 612, height: 792 })),
        };

        newDocuments.push(uploadedDoc);
      }

      // Add new documents to existing ones
      setUploadedDocuments(prev => [...prev, ...newDocuments]);

      // Set title from first document if not already set
      if (!title && newDocuments.length > 0) {
        setTitle(newDocuments[0].name.replace(/\.[^/.]+$/, "")); // Remove extension
      }

      setSelectedTemplateId(null);

      // Initialize with one signer if none exist
      if (recipients.length === 0) {
        setRecipients([{
          id: uuidv4(),
          name: "",
          email: "",
          role: 'signer',
          order: 1,
        }]);
      }

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

  // Handle direct document upload (supports multiple files)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await processFiles(files);
    // Reset file input
    e.target.value = '';
  };

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isUploading) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set dragging to false if we're leaving the drop zone entirely
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (isUploading) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await processFiles(files);
    }
  };

  // Remove a document from the list
  const handleRemoveDocument = (docId: string) => {
    setUploadedDocuments(prev => prev.filter(doc => doc.id !== docId));
    // Clear fields that were on removed document pages
    // Note: This is a simplification - in a real app you'd need to track which fields belong to which document
    toast({
      title: "Document removed",
      description: "The document has been removed from the list.",
    });
  };

  // Move document via drag and drop
  const moveDocument = useCallback((dragIndex: number, hoverIndex: number) => {
    setUploadedDocuments(prev => {
      const newDocs = [...prev];
      const [draggedDoc] = newDocs.splice(dragIndex, 1);
      newDocs.splice(hoverIndex, 0, draggedDoc);
      return newDocs;
    });
  }, []);

  // Add recipient
  const addRecipient = (role: 'signer' | 'cc') => {
    const maxOrder = Math.max(...recipients.map(r => r.order), 0);
    const newRecipient: Recipient = {
      id: uuidv4(),
      name: "",
      email: "",
      role,
      order: maxOrder + 1,
    };
    setRecipients([...recipients, newRecipient]);
  };

  // Remove recipient
  const removeRecipient = (id: string) => {
    setRecipients(recipients.filter(r => r.id !== id));
  };

  // Update recipient
  const updateRecipient = useCallback((id: string, updates: Partial<Recipient>) => {
    setRecipients(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
  }, []);

  // Move recipient order
  const moveRecipient = (id: string, direction: 'up' | 'down') => {
    const idx = recipients.findIndex(r => r.id === id);
    if (idx === -1) return;

    const newRecipients = [...recipients];
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;

    if (swapIdx < 0 || swapIdx >= newRecipients.length) return;

    // Swap orders
    const tempOrder = newRecipients[idx].order;
    newRecipients[idx].order = newRecipients[swapIdx].order;
    newRecipients[swapIdx].order = tempOrder;

    // Re-sort
    newRecipients.sort((a, b) => a.order - b.order);
    setRecipients(newRecipients);
  };

  // Get placeholder label for a recipient
  const getPlaceholderLabel = (recipient: Recipient): string | null => {
    if (!selectedTemplate || !recipient.placeholderRecipientId) return null;
    const placeholder = selectedTemplate.placeholderRecipients.find(
      p => p.id === recipient.placeholderRecipientId
    );
    return placeholder?.label || null;
  };

  // Get color for a recipient
  const getRecipientColor = (recipient: Recipient, index: number): string => {
    if (recipient.role === 'cc') return ESIGN_CC_COLOR;
    if (selectedTemplate && recipient.placeholderRecipientId) {
      const placeholder = selectedTemplate.placeholderRecipients.find(
        p => p.id === recipient.placeholderRecipientId
      );
      if (placeholder) return placeholder.color;
    }
    return ESIGN_RECIPIENT_COLORS[index % ESIGN_RECIPIENT_COLORS.length];
  };

  // Get color for recipient by index (for field placement UI)
  const getRecipientColorByIndex = useCallback((index: number): string => {
    const recipient = recipients[index];
    if (!recipient) return ESIGN_RECIPIENT_COLORS[0];
    return getRecipientColor(recipient, index);
  }, [recipients, selectedTemplate]);

  // Mobile tap-to-place handler - places a field at the tapped location
  const handleMobileTapToPlace = useCallback((pageNumber: number, x: number, y: number, pageWidth: number, pageHeight: number) => {
    if (!isTapToPlaceMode || !mobileFieldType) return;

    const fieldConfig = FIELD_TYPES.find(f => f.type === mobileFieldType);
    if (!fieldConfig) return;

    // Convert tap coordinates to percentage-based positioning
    const xPercent = (x / pageWidth) * 100;
    const yPercent = (y / pageHeight) * 100;

    const newField: SignatureField = {
      id: uuidv4(),
      type: mobileFieldType,
      x: xPercent,
      y: yPercent,
      width: fieldConfig.defaultSize.width,
      height: fieldConfig.defaultSize.height,
      page: pageNumber,
      recipientIndex: activeRecipientIndex,
      required: true,
    };

    setSignatureFields(prev => [...prev, newField]);
    // Keep tap-to-place mode active for placing multiple fields
  }, [isTapToPlaceMode, mobileFieldType, activeRecipientIndex]);

  // Send envelope mutation
  const sendMutation = useMutation({
    mutationFn: async () => {
      // Build the fields array based on template or direct upload fields
      let fields: any[] = [];
      if (selectedTemplate) {
        // For templates, use the pre-defined fields and map placeholder IDs to recipient indices
        fields = selectedTemplate.fields.map(field => {
          // Find the recipient index that maps to this field's placeholder
          const recipientIndex = recipients.findIndex(
            r => r.placeholderRecipientId === field.assignedTo
          );
          return {
            recipientIndex: recipientIndex >= 0 ? recipientIndex : 0,
            type: field.type,
            x: field.x,
            y: field.y,
            width: field.width,
            height: field.height,
            page: field.page,
            required: field.required ?? true,
          };
        });
      } else {
        // For direct uploads, use the placed signature fields
        fields = signatureFields.map(field => ({
          recipientIndex: field.recipientIndex,
          type: field.type,
          x: field.x,
          y: field.y,
          width: field.width,
          height: field.height,
          page: field.page,
          required: field.required,
        }));
      }

      const payload = {
        title,
        message: message || null,
        documentUrl,
        pageImages,
        totalPages: pageImages.length,
        signingOrder,
        templateId: selectedTemplateId,
        recipients: recipients.map((r, idx) => ({
          name: r.name,
          email: r.email,
          role: r.role,
          signingOrder: r.order,
          color: getRecipientColor(r, idx),
        })),
        fields,
      };

      // Step 1: Create the envelope (as draft)
      const createResponse = await apiRequest("POST", "/api/esign/envelopes", { body: payload });
      const envelope = await createResponse.json();

      // Step 2: Send the envelope (this actually sends emails to recipients)
      await apiRequest("POST", `/api/esign/envelopes/${envelope.id}/send`);

      return envelope;
    },
    onSuccess: async (envelope) => {
      queryClient.invalidateQueries({ queryKey: ["/api/esign/envelopes"] });
      toast({
        title: "Document sent!",
        description: "Recipients will receive an email with signing instructions.",
      });
      setLocation(`/esign/envelope/${envelope.envelopeId}`);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to send document. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Validation
  const signers = recipients.filter(r => r.role === 'signer');
  const isStep1Valid = (uploadedDocuments.length > 0 && pageImages.length > 0) || (selectedTemplateId !== null);
  const isStep2Valid = signers.length > 0 && signers.every(r => r.name && r.email);
  // For templates, fields are pre-defined. For direct uploads, at least one signature field is required
  const isStep3Valid = selectedTemplate ? true : signatureFields.some(f => f.type === 'signature');
  const isStep4Valid = title.trim().length > 0;
  const canSend = isStep1Valid && isStep2Valid && isStep3Valid && isStep4Valid;

  // Steps configuration - varies based on whether using a template
  const steps = selectedTemplate
    ? [
        { step: 1, label: "Document" },
        { step: 2, label: "Recipients" },
        { step: 4, label: "Review & Send" }, // Skip step 3 (fields) for templates
      ]
    : [
        { step: 1, label: "Document" },
        { step: 2, label: "Recipients" },
        { step: 3, label: "Place Fields" },
        { step: 4, label: "Review & Send" },
      ];

  // Get total steps count for progress display
  const totalSteps = steps.length;
  const currentStepIndex = steps.findIndex(s => s.step === currentStep);

  // Helper to check if a step can be navigated to
  const canNavigateToStep = (step: number) => {
    if (step < currentStep) return true;
    if (step === 2 && isStep1Valid) return true;
    if (step === 3 && isStep1Valid && isStep2Valid && !selectedTemplate) return true;
    if (step === 4 && isStep1Valid && isStep2Valid && isStep3Valid) return true;
    return false;
  };

  // Get next step number
  const getNextStep = () => {
    if (currentStep === 2 && selectedTemplate) return 4; // Skip field placement for templates
    return currentStep + 1;
  };

  // Get previous step number
  const getPrevStep = () => {
    if (currentStep === 4 && selectedTemplate) return 2; // Skip field placement for templates
    return currentStep - 1;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 via-slate-700 to-slate-600 border-b border-slate-200 shadow-lg">
        <div className="px-4 md:px-6 py-4 md:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-1 md:mb-2 flex items-center gap-2 md:gap-3">
                <Send className="h-6 w-6 md:h-8 md:w-8" />
                <span className="hidden sm:inline">Send Document for Signature</span>
                <span className="sm:hidden">Send for Signature</span>
              </h1>
              <p className="text-slate-200 text-sm md:text-base">
                Upload a document or use a template and send it for signing
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="bg-white/10 border-white/20 text-white hover:bg-white/20 self-start sm:self-auto"
              onClick={() => setLocation("/esign")}
            >
              <ArrowLeft className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Back to Dashboard</span>
              <span className="sm:hidden">Back</span>
            </Button>
          </div>
        </div>
      </div>

      <main className="px-4 md:px-6 py-4 md:py-6">
        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-6 md:mb-8 overflow-x-auto pb-2">
          <div className="flex items-center gap-2 md:gap-4">
            {steps.map(({ step, label }, index) => (
              <div key={step} className="flex items-center">
                <button
                  onClick={() => {
                    if (canNavigateToStep(step)) {
                      setCurrentStep(step);
                    }
                  }}
                  className={`flex items-center gap-1.5 md:gap-2 px-2.5 md:px-4 py-1.5 md:py-2 rounded-full transition-colors text-sm md:text-base whitespace-nowrap ${
                    currentStep === step
                      ? 'bg-blue-600 text-white'
                      : currentStepIndex > index
                        ? 'bg-green-100 text-green-700 cursor-pointer hover:bg-green-200'
                        : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {currentStepIndex > index ? (
                    <CheckCircle className="h-4 w-4 md:h-5 md:w-5" />
                  ) : (
                    <span className="w-4 h-4 md:w-5 md:h-5 flex items-center justify-center rounded-full bg-current/10 text-xs md:text-sm font-medium">
                      {index + 1}
                    </span>
                  )}
                  <span className="font-medium hidden sm:inline">{label}</span>
                </button>
                {index < steps.length - 1 && (
                  <div className={`w-4 md:w-16 h-0.5 mx-1 md:mx-2 ${currentStepIndex > index ? 'bg-green-300' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step 1: Document Selection */}
        {currentStep === 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Upload Document */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Upload Documents
                </CardTitle>
                <CardDescription>
                  Upload documents to send for signature. Supports PDF, Word, Excel, and PowerPoint files.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div
                  className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
                    isDragging
                      ? 'border-blue-500 bg-blue-50'
                      : isUploading
                      ? 'bg-gray-50 cursor-wait'
                      : 'hover:border-blue-400 hover:bg-blue-50'
                  }`}
                  onDragEnter={handleDragEnter}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => !isUploading && document.getElementById('esign-file-upload')?.click()}
                >
                  <input
                    type="file"
                    id="esign-file-upload"
                    accept=".pdf,.doc,.docx,.odt,.rtf,.xlsx,.xls,.ods,.csv,.pptx,.ppt,.odp"
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={isUploading}
                    multiple
                  />
                  {isUploading ? (
                    <>
                      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3" />
                      <p className="text-gray-600">Processing document(s)...</p>
                    </>
                  ) : isDragging ? (
                    <>
                      <Upload className="h-10 w-10 mx-auto text-blue-500 mb-3" />
                      <p className="text-blue-600 font-medium mb-1">
                        Drop files here
                      </p>
                      <p className="text-sm text-blue-400">
                        Release to upload
                      </p>
                    </>
                  ) : (
                    <>
                      <Upload className="h-10 w-10 mx-auto text-gray-400 mb-3" />
                      <p className="text-gray-600 mb-1">
                        {uploadedDocuments.length > 0 ? 'Add more documents' : 'Drag and drop or click to upload'}
                      </p>
                      <p className="text-sm text-gray-400">
                        PDF, Word, Excel, or PowerPoint (multiple files allowed)
                      </p>
                    </>
                  )}
                </div>

                {/* Uploaded documents list */}
                {uploadedDocuments.length > 0 && !selectedTemplateId && (
                  <DndProvider backend={HTML5Backend}>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-700">
                          Uploaded Documents ({uploadedDocuments.length})
                        </p>
                        <p className="text-xs text-gray-500">
                          {pageImages.length} total page(s)
                        </p>
                      </div>
                      <div className="space-y-2 max-h-[280px] overflow-y-auto">
                        {uploadedDocuments.map((doc, index) => (
                          <DraggableDocumentItem
                            key={doc.id}
                            doc={doc}
                            index={index}
                            moveDocument={moveDocument}
                            onRemove={handleRemoveDocument}
                          />
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 italic">
                        Drag to reorder documents
                      </p>
                    </div>
                  </DndProvider>
                )}
              </CardContent>
            </Card>

            {/* Use Template */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Use a Template
                </CardTitle>
                <CardDescription>
                  Select a saved template with pre-configured fields
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingTemplates ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                  </div>
                ) : templates.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="h-12 w-12 mx-auto opacity-30 mb-4" />
                    <p>No templates yet</p>
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => setLocation("/esign/templates/new")}
                    >
                      Create Template
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {templates.map((template) => (
                      <button
                        key={template.id}
                        onClick={() => setSelectedTemplateId(template.id)}
                        className={`w-full p-3 rounded-lg border text-left transition-colors ${
                          selectedTemplateId === template.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{template.name}</p>
                            <p className="text-sm text-gray-500">
                              {template.totalPages} page(s) • {template.placeholderRecipients.length} recipient(s)
                            </p>
                          </div>
                          {selectedTemplateId === template.id && (
                            <CheckCircle className="h-5 w-5 text-blue-600" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 2: Recipients */}
        {currentStep === 2 && (
          <div className="max-w-2xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Recipients
                </CardTitle>
                <CardDescription>
                  Add the people who need to sign or receive a copy
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Signing Order Checkbox - at top */}
                <div className="flex items-center space-x-3 pb-2">
                  <Checkbox
                    id="signing-order"
                    checked={signingOrder === 'sequential'}
                    onCheckedChange={(checked) => setSigningOrder(checked ? 'sequential' : 'parallel')}
                  />
                  <Label htmlFor="signing-order" className="cursor-pointer text-sm font-medium">
                    Set signing order
                  </Label>
                </div>

                {/* Recipients List */}
                <div className="space-y-3">
                  {recipients.map((recipient, index) => {
                    const placeholderLabel = getPlaceholderLabel(recipient);
                    const color = getRecipientColor(recipient, index);

                    return (
                      <div
                        key={recipient.id}
                        className="p-4 rounded-lg border bg-gray-50"
                      >
                        <div className="flex items-start gap-3 mb-3">
                          {/* Move controls - prominent on the left when signing order is enabled */}
                          {signingOrder === 'sequential' && (
                            <div className="flex flex-col gap-0.5 -ml-1">
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-6 w-6 border-gray-300 bg-white hover:bg-gray-100"
                                onClick={() => moveRecipient(recipient.id, 'up')}
                                disabled={index === 0}
                              >
                                <ChevronUp className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-6 w-6 border-gray-300 bg-white hover:bg-gray-100"
                                onClick={() => moveRecipient(recipient.id, 'down')}
                                disabled={index === recipients.length - 1}
                              >
                                <ChevronDown className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                          <div className="flex items-center gap-2 flex-wrap flex-1">
                            {/* Order number - only show when signing order is enabled */}
                            {signingOrder === 'sequential' && (
                              <div
                                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0"
                                style={{ backgroundColor: color }}
                              >
                                {recipient.order}
                              </div>
                            )}
                            {/* Color dot - only show when signing order is disabled */}
                            {signingOrder !== 'sequential' && (
                              <div
                                className="w-4 h-4 rounded-full"
                                style={{ backgroundColor: color }}
                              />
                            )}
                            {placeholderLabel && (
                              <Badge variant="secondary" className="text-xs">
                                {placeholderLabel}
                              </Badge>
                            )}
                            <Badge
                              variant={recipient.role === 'signer' ? 'default' : 'outline'}
                              className="text-xs"
                            >
                              {recipient.role === 'signer' ? 'Signer' : 'CC'}
                            </Badge>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs">Full Name</Label>
                            <RecipientAutocompleteInput
                              value={recipient.name}
                              onChange={(value) => updateRecipient(recipient.id, { name: value })}
                              onSelectRecipient={(selected) => {
                                updateRecipient(recipient.id, {
                                  name: selected.name,
                                  email: selected.email,
                                });
                              }}
                              placeholder="John Smith"
                              className="mt-1"
                              recentRecipients={recentRecipients}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Email Address</Label>
                            <RecipientAutocompleteInput
                              type="email"
                              value={recipient.email}
                              onChange={(value) => updateRecipient(recipient.id, { email: value })}
                              onSelectRecipient={(selected) => {
                                updateRecipient(recipient.id, {
                                  name: selected.name,
                                  email: selected.email,
                                });
                              }}
                              placeholder="john@example.com"
                              className="mt-1"
                              recentRecipients={recentRecipients}
                            />
                          </div>
                        </div>

                        {/* Delete button - now on its own row */}
                        {!recipient.placeholderRecipientId && (
                          <div className="flex justify-end mt-3">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => removeRecipient(recipient.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Remove
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Add Recipient Buttons */}
                {!selectedTemplate && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => addRecipient('signer')}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Signer
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => addRecipient('cc')}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add CC
                    </Button>
                  </div>
                )}

                {signers.length === 0 && (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-600" />
                    <p className="text-sm text-amber-800">
                      At least one signer is required
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 3: Place Fields (only for direct uploads, not templates) */}
        {currentStep === 3 && !selectedTemplate && (
          <DndProvider backend={HTML5Backend}>
            {/* Add top padding on mobile for fixed header, bottom padding for fixed field bar */}
            <div className="flex flex-col lg:grid lg:grid-cols-12 gap-4 lg:gap-6 pt-14 pb-20 lg:pt-0 lg:pb-0" style={{ minHeight: 'calc(100vh - 320px)' }}>
              {/* Left Sidebar - Field Palette & Recipients - Hidden on mobile, shown on lg+ */}
              <div className="hidden lg:block lg:col-span-3 space-y-4 overflow-y-auto lg:max-h-[calc(100vh-280px)]">
                {/* Select Recipient for Field Assignment */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Assign Fields To</CardTitle>
                    <p className="text-xs text-gray-500">Select a recipient, then drag fields onto the document</p>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {signers.map((recipient, index) => {
                      const signerIndex = recipients.findIndex(r => r.id === recipient.id);
                      const color = getRecipientColor(recipient, signerIndex);
                      return (
                        <button
                          key={recipient.id}
                          onClick={() => setActiveRecipientIndex(signerIndex)}
                          className={`w-full p-2.5 rounded-lg border-2 text-left transition-all ${
                            activeRecipientIndex === signerIndex
                              ? 'border-blue-500 bg-blue-50 shadow-sm'
                              : 'border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className="w-4 h-4 rounded-full flex-shrink-0"
                              style={{ backgroundColor: color }}
                            />
                            <span className="text-sm font-medium truncate">
                              {recipient.name || recipient.email || `Signer ${index + 1}`}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </CardContent>
                </Card>

                {/* Field Palette */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Field Types</CardTitle>
                    <p className="text-xs text-gray-500">Drag fields onto the document</p>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {FIELD_TYPES.map((fieldType) => {
                      const color = signers.length > 0 ? getRecipientColor(recipients[activeRecipientIndex], activeRecipientIndex) : undefined;
                      return (
                        <DraggableFieldType
                          key={fieldType.type}
                          type={fieldType.type}
                          label={fieldType.label}
                          icon={fieldType.icon}
                          disabled={signers.length === 0}
                          color={color}
                          recipientIndex={activeRecipientIndex}
                        />
                      );
                    })}
                  </CardContent>
                </Card>

                {/* Placed Fields Summary */}
                {signatureFields.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Placed Fields ({signatureFields.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-1 text-xs">
                        {signatureFields.map((field) => {
                          const recipient = recipients[field.recipientIndex];
                          const color = getRecipientColor(recipient, field.recipientIndex);
                          const fieldConfig = FIELD_TYPES.find(f => f.type === field.type);
                          return (
                            <div
                              key={field.id}
                              className={`flex items-center gap-2 p-1.5 rounded cursor-pointer transition-colors ${
                                selectedFieldId === field.id ? 'bg-blue-50' : 'hover:bg-gray-50'
                              }`}
                              onClick={() => setSelectedFieldId(field.id)}
                            >
                              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                              <span className="truncate">{fieldConfig?.label} - Page {field.page}</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSignatureFields(signatureFields.filter(f => f.id !== field.id));
                                  if (selectedFieldId === field.id) setSelectedFieldId(null);
                                }}
                                className="ml-auto text-red-500 hover:text-red-700 flex-shrink-0"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Document Canvas - Vertical Scrollable */}
              <div className="lg:col-span-9 flex flex-col lg:max-h-[calc(100vh-280px)] overflow-hidden order-first lg:order-last">
                {/* Desktop Toolbar - hidden on mobile */}
                <div className="hidden lg:flex items-center justify-between bg-white border rounded-t-lg px-4 py-2 flex-shrink-0">
                  {/* Back Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentStep(getPrevStep())}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>

                  {/* Zoom Controls */}
                  <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
                      disabled={zoom <= 0.5}
                      className="h-8 w-8 p-0"
                    >
                      <ZoomOut className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-medium min-w-[50px] text-center">
                      {Math.round(zoom * 100)}%
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setZoom(Math.min(2.5, zoom + 0.25))}
                      disabled={zoom >= 2.5}
                      className="h-8 w-8 p-0"
                    >
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                    <div className="w-px h-5 bg-gray-300 mx-1" />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setZoom(1)}
                      className="h-8 w-8 p-0"
                      title="Reset zoom to 100%"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Continue Button */}
                  <Button
                    size="sm"
                    onClick={() => setCurrentStep(getNextStep())}
                    disabled={!isStep3Valid}
                  >
                    Continue
                  </Button>
                </div>

                {/* Scrollable Document Area - supports both vertical and horizontal scroll for landscape */}
                <div className="flex-1 overflow-auto bg-gray-100 border lg:border-t-0 rounded-lg lg:rounded-t-none min-h-0">
                  <div className="p-4 lg:p-6 flex flex-col items-center gap-6 min-w-fit">
                    {pageImages.map((pageImage, index) => (
                      <div key={index} className="flex flex-col items-center flex-shrink-0">
                        {/* Page Number Badge */}
                        <Badge variant="secondary" className="mb-3">
                          Page {index + 1} of {pageImages.length}
                        </Badge>

                        {/* Document Page */}
                        <DocumentPageCanvas
                          pageImage={pageImage}
                          pageNumber={index + 1}
                          pageWidth={pageDimensions[index]?.width || 612}
                          pageHeight={pageDimensions[index]?.height || 792}
                          fields={signatureFields}
                          selectedFieldId={selectedFieldId}
                          onFieldsChange={setSignatureFields}
                          onSelectField={setSelectedFieldId}
                          zoom={zoom}
                          getRecipientColor={getRecipientColorByIndex}
                          isTapToPlaceMode={isTapToPlaceMode}
                          onTapToPlace={handleMobileTapToPlace}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile Top Navigation Bar - sticky at top on mobile */}
            <div className="fixed top-0 left-0 right-0 bg-white border-b shadow-md z-50 lg:hidden">
              <div className="flex items-center justify-between px-3 py-2">
                {/* Back button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentStep(getPrevStep())}
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
                    onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <span className="text-xs w-10 text-center font-medium">{Math.round(zoom * 100)}%</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => setZoom(Math.min(2.5, zoom + 0.25))}
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                </div>

                {/* Continue button */}
                <Button
                  onClick={() => setCurrentStep(getNextStep())}
                  disabled={!isStep3Valid}
                  size="sm"
                  className="h-10"
                >
                  Continue
                </Button>
              </div>
            </div>

            {/* Mobile Field Placement Bar - bottom sticky with translucent blur effect */}
            <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t shadow-lg z-40 lg:hidden">
              <div className="flex items-center gap-2 px-3 py-3">
                {/* Recipient selector */}
                <Select
                  value={activeRecipientIndex.toString()}
                  onValueChange={(value) => setActiveRecipientIndex(parseInt(value))}
                >
                  <SelectTrigger className="w-[130px] h-9 text-xs bg-white/90">
                    <SelectValue placeholder="Recipient" />
                  </SelectTrigger>
                  <SelectContent>
                    {signers.map((recipient, index) => {
                      const signerIndex = recipients.findIndex(r => r.id === recipient.id);
                      const color = getRecipientColor(recipient, signerIndex);
                      return (
                        <SelectItem key={recipient.id} value={signerIndex.toString()}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: color }}
                            />
                            <span className="truncate">{recipient.name || recipient.email || `Signer ${index + 1}`}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>

                {/* Field type selector */}
                <Select
                  value={mobileFieldType || "signature"}
                  onValueChange={(value) => {
                    setMobileFieldType(value);
                    setIsTapToPlaceMode(true);
                  }}
                  disabled={signers.length === 0}
                >
                  <SelectTrigger className="w-[120px] h-9 text-xs bg-white/90">
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
                    <div className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-100/80 px-2 py-1.5 rounded-md">
                      <Pointer className="h-3 w-3" />
                      <span>Tap to place</span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs ml-auto"
                      onClick={() => {
                        setIsTapToPlaceMode(false);
                      }}
                    >
                      Done
                    </Button>
                  </div>
                ) : (
                  <div className="text-xs text-gray-500 flex-1">
                    {signers.length === 0 ? (
                      "Add signers first"
                    ) : (
                      "Tap document to place"
                    )}
                  </div>
                )}
              </div>
            </div>
          </DndProvider>
        )}

        {/* Step 3 Validation Warning */}
        {currentStep === 3 && !selectedTemplate && !isStep3Valid && (
          <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            <p className="text-sm text-amber-800">
              Place at least one signature field on the document before continuing
            </p>
          </div>
        )}

        {/* Step 4: Review & Send */}
        {currentStep === 4 && (
          <div className="max-w-2xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5" />
                  Review & Send
                </CardTitle>
                <CardDescription>
                  Review the details before sending
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Document Title */}
                <div>
                  <Label>Document Title</Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter a title for this document"
                    className="mt-1"
                  />
                </div>

                {/* Email Message */}
                <div>
                  <Label>Email Message (Optional)</Label>
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Add a message for the recipients..."
                    className="mt-1"
                    rows={3}
                  />
                </div>

                <Separator />

                {/* Summary */}
                <div className="space-y-4">
                  <h3 className="font-medium">Summary</h3>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-gray-500">Document</p>
                      <p className="font-medium">{title || "Untitled"}</p>
                      <p className="text-xs text-gray-400">{pageImages.length} page(s)</p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-gray-500">Signing Order</p>
                      <p className="font-medium capitalize">{signingOrder}</p>
                    </div>
                  </div>

                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-gray-500 mb-2">Recipients</p>
                    <div className="space-y-2">
                      {recipients.map((recipient, index) => (
                        <div key={recipient.id} className="flex items-center gap-2 text-sm">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: getRecipientColor(recipient, index) }}
                          />
                          <span className="font-medium">{recipient.name || "No name"}</span>
                          <span className="text-gray-500">{recipient.email || "No email"}</span>
                          <Badge variant="outline" className="text-xs ml-auto">
                            {recipient.role}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Fields summary for direct uploads */}
                  {!selectedTemplate && signatureFields.length > 0 && (
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-gray-500 mb-2">Signature Fields ({signatureFields.length})</p>
                      <div className="space-y-1 text-sm">
                        {signatureFields.map((field) => {
                          const recipient = recipients[field.recipientIndex];
                          const fieldConfig = FIELD_TYPES.find(f => f.type === field.type);
                          return (
                            <div key={field.id} className="flex items-center gap-2">
                              <div
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: getRecipientColor(recipient, field.recipientIndex) }}
                              />
                              <span>{fieldConfig?.label}</span>
                              <span className="text-gray-400">→</span>
                              <span className="text-gray-600">{recipient?.name || 'Unknown'}</span>
                              <span className="text-gray-400 text-xs">(Page {field.page})</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Validation Warnings */}
                {!canSend && (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="font-medium text-amber-800 mb-2">Please fix the following:</p>
                    <ul className="list-disc list-inside text-sm text-amber-700 space-y-1">
                      {!isStep1Valid && <li>Upload a document or select a template</li>}
                      {!isStep2Valid && <li>Add at least one signer with name and email</li>}
                      {!isStep3Valid && <li>Place at least one signature field on the document</li>}
                      {!isStep4Valid && <li>Enter a document title</li>}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Navigation Buttons - hide on step 3 since they're in the toolbar */}
        {currentStep !== 3 && (
          <div className="flex justify-between mt-8 max-w-2xl mx-auto">
            <Button
              variant="outline"
              onClick={() => setCurrentStep(getPrevStep())}
              disabled={currentStep === 1}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>

            {currentStep < 4 ? (
              <Button
                onClick={() => setCurrentStep(getNextStep())}
                disabled={
                  (currentStep === 1 && !isStep1Valid) ||
                  (currentStep === 2 && !isStep2Valid)
                }
              >
                Continue
              </Button>
            ) : (
              <Button
                onClick={() => sendMutation.mutate()}
                disabled={!canSend || sendMutation.isPending}
                className="bg-slate-700 hover:bg-slate-800"
              >
                {sendMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send for Signature
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
