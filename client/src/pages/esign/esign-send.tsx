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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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

  // Calculate display dimensions maintaining aspect ratio
  const baseWidth = 612; // Standard letter width in points
  const displayWidth = baseWidth * zoom;
  // Use actual image dimensions if loaded, otherwise use standard letter size
  const actualWidth = imageDimensions?.width || 612;
  const actualHeight = imageDimensions?.height || 792;
  const aspectRatio = actualHeight / actualWidth;
  const displayHeight = displayWidth * aspectRatio;

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

  // Combine refs
  const combinedRef = useCallback((node: HTMLDivElement | null) => {
    (canvasRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    drop(node);
  }, [drop]);

  const pageFields = fields.filter(f => f.page === pageNumber);

  return (
    <div
      ref={combinedRef}
      className={`relative bg-white rounded-lg shadow-lg overflow-hidden border-2 transition-colors flex-shrink-0 ${
        isOver ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'
      }`}
      style={{
        width: displayWidth,
      }}
      onClick={() => onSelectField(null)}
    >
      {/* Document Image - natural height based on width */}
      <img
        src={pageImage}
        alt={`Page ${pageNumber}`}
        className="w-full h-auto block"
        onLoad={handleImageLoad}
        draggable={false}
      />

      {/* Fields overlay - positioned absolutely over image */}
      <div className="absolute inset-0">
        {pageFields.map((field) => {
          const fieldConfig = FIELD_TYPES.find(f => f.type === field.type);
          const Icon = fieldConfig?.icon || Type;
          const color = getRecipientColor(field.recipientIndex);
          const isSelected = selectedFieldId === field.id;

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
                className="w-full h-full rounded border-2 flex items-center justify-center gap-1 text-white text-xs font-medium"
                style={{
                  backgroundColor: `${color}dd`,
                  borderColor: color,
                }}
              >
                <Icon className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{fieldConfig?.label}</span>
              </div>

              {/* Delete button when selected */}
              {isSelected && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteField(field.id);
                  }}
                  className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-md"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
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
  const [signingOrder, setSigningOrder] = useState<'sequential' | 'parallel'>('sequential');
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [pageImages, setPageImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Field placement state (for direct uploads only, templates have pre-defined fields)
  const [signatureFields, setSignatureFields] = useState<SignatureField[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [activeRecipientIndex, setActiveRecipientIndex] = useState<number>(0);
  const [zoom, setZoom] = useState(1);

  // Fetch templates
  const { data: templates = [], isLoading: isLoadingTemplates } = useQuery<EsignTemplate[]>({
    queryKey: ["/api/esign/templates"],
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

  // Initialize recipients when template is selected
  useEffect(() => {
    if (selectedTemplate) {
      setTitle(selectedTemplate.name);
      setDocumentUrl(selectedTemplate.documentUrl);
      setPageImages(selectedTemplate.pageImages);

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
    }
  }, [selectedTemplate]);

  // Handle direct document upload
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
      setTitle(file.name.replace(/\.[^/.]+$/, "")); // Remove extension
      setSelectedTemplateId(null);

      // Initialize with one signer
      if (recipients.length === 0) {
        setRecipients([{
          id: uuidv4(),
          name: "",
          email: "",
          role: 'signer',
          order: 1,
        }]);
      }

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
  const updateRecipient = (id: string, updates: Partial<Recipient>) => {
    setRecipients(recipients.map(r => r.id === id ? { ...r, ...updates } : r));
  };

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

  // Send envelope mutation
  const sendMutation = useMutation({
    mutationFn: async () => {
      // Build the fields array based on template or direct upload fields
      let fields: any[] = [];
      if (selectedTemplate) {
        // For templates, use the pre-defined fields
        fields = selectedTemplate.fields.map(field => {
          // Find the recipient that maps to this field's placeholder
          const recipient = recipients.find(
            r => r.placeholderRecipientId === field.assignedTo
          );
          return {
            ...field,
            recipientId: recipient?.id || null,
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
      setLocation(`/esign/envelope/${envelope.id}`);
    },
    onError: (error: any) => {
      console.error('[ESIGN] Send error:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to send document. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Validation
  const signers = recipients.filter(r => r.role === 'signer');
  const isStep1Valid = documentUrl && pageImages.length > 0;
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
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                <Send className="h-8 w-8" />
                Send Document for Signature
              </h1>
              <p className="text-slate-200">
                Upload a document or use a template and send it for signing
              </p>
            </div>
            <Button
              variant="outline"
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              onClick={() => setLocation("/esign")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 py-8">
        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center gap-4">
            {steps.map(({ step, label }, index) => (
              <div key={step} className="flex items-center">
                <button
                  onClick={() => {
                    if (canNavigateToStep(step)) {
                      setCurrentStep(step);
                    }
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full transition-colors ${
                    currentStep === step
                      ? 'bg-blue-600 text-white'
                      : currentStepIndex > index
                        ? 'bg-green-100 text-green-700 cursor-pointer hover:bg-green-200'
                        : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {currentStepIndex > index ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : (
                    <span className="w-5 h-5 flex items-center justify-center rounded-full bg-current/10 text-sm font-medium">
                      {index + 1}
                    </span>
                  )}
                  <span className="font-medium">{label}</span>
                </button>
                {index < steps.length - 1 && (
                  <div className={`w-16 h-0.5 mx-2 ${currentStepIndex > index ? 'bg-green-300' : 'bg-gray-200'}`} />
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
                  Upload Document
                </CardTitle>
                <CardDescription>
                  Upload a PDF or Word document to send for signature
                </CardDescription>
              </CardHeader>
              <CardContent>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={isUploading}
                  />
                  <div className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    isUploading ? 'bg-gray-50' : 'hover:border-blue-400 hover:bg-blue-50'
                  }`}>
                    {isUploading ? (
                      <>
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
                        <p className="text-gray-600">Processing document...</p>
                      </>
                    ) : (
                      <>
                        <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                        <p className="text-gray-600 mb-2">
                          Drag and drop or click to upload
                        </p>
                        <p className="text-sm text-gray-400">
                          PDF, DOC, or DOCX files
                        </p>
                      </>
                    )}
                  </div>
                </label>

                {documentUrl && !selectedTemplateId && (
                  <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium text-green-800">{title}</p>
                      <p className="text-sm text-green-600">{pageImages.length} page(s)</p>
                    </div>
                  </div>
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
                {/* Signing Order */}
                <div>
                  <Label className="mb-3 block">Signing Order</Label>
                  <RadioGroup
                    value={signingOrder}
                    onValueChange={(v) => setSigningOrder(v as 'sequential' | 'parallel')}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="sequential" id="sequential" />
                      <Label htmlFor="sequential" className="cursor-pointer">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-gray-500" />
                          Sequential
                        </div>
                        <p className="text-xs text-gray-500 font-normal">
                          Recipients sign one at a time in order
                        </p>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="parallel" id="parallel" />
                      <Label htmlFor="parallel" className="cursor-pointer">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-gray-500" />
                          Parallel
                        </div>
                        <p className="text-xs text-gray-500 font-normal">
                          All recipients can sign at the same time
                        </p>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <Separator />

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
                        <div className="flex items-center gap-2 mb-3">
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: color }}
                          />
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
                          <span className="text-xs text-gray-500 ml-auto">
                            #{recipient.order}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs">Full Name</Label>
                            <Input
                              value={recipient.name}
                              onChange={(e) => updateRecipient(recipient.id, { name: e.target.value })}
                              placeholder="John Smith"
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Email Address</Label>
                            <Input
                              type="email"
                              value={recipient.email}
                              onChange={(e) => updateRecipient(recipient.id, { email: e.target.value })}
                              placeholder="john@example.com"
                              className="mt-1"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between mt-3">
                          <div className="flex gap-1">
                            {signingOrder === 'sequential' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => moveRecipient(recipient.id, 'up')}
                                  disabled={index === 0}
                                >
                                  Up
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => moveRecipient(recipient.id, 'down')}
                                  disabled={index === recipients.length - 1}
                                >
                                  Down
                                </Button>
                              </>
                            )}
                          </div>
                          {!recipient.placeholderRecipientId && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => removeRecipient(recipient.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Remove
                            </Button>
                          )}
                        </div>
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
            <div className="grid grid-cols-12 gap-6" style={{ height: 'calc(100vh - 280px)', maxHeight: 'calc(100vh - 280px)' }}>
              {/* Left Sidebar - Field Palette & Recipients */}
              <div className="col-span-3 space-y-4 overflow-y-auto max-h-full">
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
              <div className="col-span-9 flex flex-col max-h-full overflow-hidden">
                {/* Toolbar */}
                <div className="flex items-center justify-between bg-white border rounded-t-lg px-4 py-2 flex-shrink-0">
                  <div>
                    <h3 className="text-sm font-medium">Place Signature Fields</h3>
                    <p className="text-xs text-gray-500">Drag fields onto the document where recipients should sign</p>
                  </div>
                  {/* Zoom Controls */}
                  <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
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
                      onClick={() => setZoom(Math.min(1.5, zoom + 0.1))}
                      disabled={zoom >= 1.5}
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
                      title="Reset zoom"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Scrollable Document Area */}
                <div className="flex-1 overflow-auto bg-gray-100 border border-t-0 rounded-b-lg min-h-0">
                  <div className="p-6 flex flex-col items-center gap-6">
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
                          pageWidth={612}
                          pageHeight={792}
                          fields={signatureFields}
                          selectedFieldId={selectedFieldId}
                          onFieldsChange={setSignatureFields}
                          onSelectField={setSelectedFieldId}
                          zoom={zoom}
                          getRecipientColor={getRecipientColorByIndex}
                        />
                      </div>
                    ))}
                  </div>
                </div>
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

        {/* Navigation Buttons */}
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
                (currentStep === 2 && !isStep2Valid) ||
                (currentStep === 3 && !isStep3Valid)
              }
            >
              Continue
            </Button>
          ) : (
            <Button
              onClick={() => sendMutation.mutate()}
              disabled={!canSend || sendMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
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
      </main>
    </div>
  );
}
