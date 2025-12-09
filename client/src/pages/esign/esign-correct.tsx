import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  FileSignature,
  Save,
  ArrowLeft,
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
  AlertTriangle,
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

interface Recipient {
  id?: number;
  tempId: string;
  name: string;
  email: string;
  role: 'signer' | 'cc';
  order: number;
  color?: string;
  status?: string;
}

interface EnvelopeData {
  envelope: {
    id: number;
    envelopeId: string;
    title: string;
    message: string | null;
    status: string;
    signingOrder: 'sequential' | 'parallel';
    documentUrl: string | null;
    pageImages: string[];
    totalPages: number;
  };
  recipients: Array<{
    id: number;
    name: string;
    email: string;
    role: 'signer' | 'cc';
    color: string;
    signingOrder: number;
    status: string;
  }>;
  fields: Array<{
    id: number;
    recipientId: number;
    type: string;
    x: number;
    y: number;
    width: number;
    height: number;
    page: number;
    required: boolean;
  }>;
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

// Draggable Field on Document
function DraggableField({
  field,
  isSelected,
  color,
  onSelect,
  onDelete,
  onUpdatePosition,
  percentToPixel,
  displayWidth,
  displayHeight,
}: {
  field: SignatureField;
  isSelected: boolean;
  color: string;
  onSelect: () => void;
  onDelete: () => void;
  onUpdatePosition: (fieldId: string, newX: number, newY: number) => void;
  percentToPixel: (x: number, y: number) => { x: number; y: number };
  displayWidth: number;
  displayHeight: number;
}) {
  const fieldRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const startPosRef = useRef({ x: field.x, y: field.y });

  // Keep startPosRef in sync with field position when not dragging
  useEffect(() => {
    if (!isDragging) {
      startPosRef.current = { x: field.x, y: field.y };
    }
  }, [field.x, field.y, isDragging]);

  const pos = percentToPixel(field.x, field.y);
  const size = percentToPixel(field.width, field.height);
  const FieldIcon = FIELD_TYPES.find(f => f.type === field.type)?.icon || Pen;

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    e.preventDefault();
    e.stopPropagation();

    setIsDragging(true);
    setDragOffset({ x: 0, y: 0 });
    startPosRef.current = { x: field.x, y: field.y };
    onSelect();

    const startX = e.clientX;
    const startY = e.clientY;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      // Convert pixel delta to percent
      const percentDeltaX = (deltaX / displayWidth) * 100;
      const percentDeltaY = (deltaY / displayHeight) * 100;

      // Calculate new position
      const newX = Math.max(0, Math.min(startPosRef.current.x + percentDeltaX, 100 - field.width));
      const newY = Math.max(0, Math.min(startPosRef.current.y + percentDeltaY, 100 - field.height));

      // Update the field position
      onUpdatePosition(field.id, newX, newY);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div
      ref={fieldRef}
      className={`absolute cursor-move border-2 rounded transition-shadow ${
        isSelected ? 'ring-2 ring-offset-1 shadow-lg' : ''
      } ${isDragging ? 'opacity-80 shadow-xl z-50' : ''}`}
      style={{
        left: pos.x,
        top: pos.y,
        width: size.x,
        height: size.y,
        borderColor: color,
        backgroundColor: `${color}20`,
        ringColor: color,
      }}
      onMouseDown={handleMouseDown}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <FieldIcon className="h-3 w-3" style={{ color }} />
      </div>

      {/* Delete button */}
      {isSelected && (
        <button
          className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 z-10"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

// Document Page with drop zone and field placement
function DocumentPageCanvas({
  pageImage,
  pageNumber,
  fields,
  selectedFieldId,
  onFieldsChange,
  onSelectField,
  zoom,
  getRecipientColor,
}: {
  pageImage: string;
  pageNumber: number;
  fields: SignatureField[];
  selectedFieldId: string | null;
  onFieldsChange: (fields: SignatureField[]) => void;
  onSelectField: (id: string | null) => void;
  zoom: number;
  getRecipientColor: (index: number) => string;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);

  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
  }, []);

  const baseDisplayWidth = 612;
  const actualWidth = imageDimensions?.width || 1;
  const actualHeight = imageDimensions?.height || 1;
  const aspectRatio = actualHeight / actualWidth;
  const displayWidth = baseDisplayWidth * zoom;
  const displayHeight = imageDimensions ? displayWidth * aspectRatio : 0;

  const pixelToPercent = useCallback((pixelX: number, pixelY: number) => {
    return {
      x: (pixelX / displayWidth) * 100,
      y: (pixelY / displayHeight) * 100
    };
  }, [displayWidth, displayHeight]);

  const percentToPixel = useCallback((percentX: number, percentY: number) => {
    return {
      x: (percentX / 100) * displayWidth,
      y: (percentY / 100) * displayHeight
    };
  }, [displayWidth, displayHeight]);

  // Handle updating a field's position directly
  const handleUpdatePosition = useCallback((fieldId: string, newX: number, newY: number) => {
    onFieldsChange(fields.map(f =>
      f.id === fieldId ? { ...f, x: newX, y: newY } : f
    ));
  }, [fields, onFieldsChange]);

  const [{ isOver }, drop] = useDrop({
    accept: 'SIGNATURE_FIELD',
    drop: (item: { type: string; recipientIndex: number }, monitor) => {
      if (!canvasRef.current) return;

      const offset = monitor.getClientOffset();
      if (!offset) return;

      const canvasRect = canvasRef.current.getBoundingClientRect();
      const x = (offset.x - canvasRect.left) / zoom;
      const y = (offset.y - canvasRect.top) / zoom;

      const percentCoords = pixelToPercent(x, y);
      const fieldConfig = FIELD_TYPES.find(f => f.type === item.type);
      const dimensions = fieldConfig?.defaultSize || { width: 20, height: 4 };

      const newField: SignatureField = {
        id: uuidv4(),
        type: item.type,
        x: Math.max(0, Math.min(percentCoords.x, 100 - dimensions.width)),
        y: Math.max(0, Math.min(percentCoords.y, 100 - dimensions.height)),
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

  const pageFields = fields.filter(f => f.page === pageNumber);

  return (
    <div className="flex flex-col items-center mb-6">
      <div className="mb-2 px-3 py-1 bg-gray-100 rounded-full text-sm text-gray-600">
        Page {pageNumber}
      </div>
      <div
        ref={(node) => { canvasRef.current = node; drop(node); }}
        className={`relative border shadow-lg bg-white ${isOver ? 'ring-2 ring-blue-400' : ''}`}
        style={{ width: displayWidth, maxWidth: '100%' }}
        onClick={() => onSelectField(null)}
      >
        <img
          src={pageImage}
          alt={`Page ${pageNumber}`}
          className="w-full h-auto block"
          onLoad={handleImageLoad}
          draggable={false}
        />

        {/* Fields overlay */}
        <div className="absolute inset-0">
          {pageFields.map((field) => (
            <DraggableField
              key={field.id}
              field={field}
              isSelected={selectedFieldId === field.id}
              color={getRecipientColor(field.recipientIndex)}
              onSelect={() => onSelectField(field.id)}
              onDelete={() => {
                onFieldsChange(fields.filter(f => f.id !== field.id));
                onSelectField(null);
              }}
              onUpdatePosition={handleUpdatePosition}
              percentToPixel={percentToPixel}
              displayWidth={displayWidth}
              displayHeight={displayHeight}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function EsignCorrect() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/esign/correct/:id");
  const envelopeId = params?.id;

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form state
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [signingOrder, setSigningOrder] = useState<'sequential' | 'parallel'>('parallel');
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [signatureFields, setSignatureFields] = useState<SignatureField[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [activeRecipientIndex, setActiveRecipientIndex] = useState<number>(0);
  const [zoom, setZoom] = useState(1);
  const [pageImages, setPageImages] = useState<string[]>([]);
  const [resendEmails, setResendEmails] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Fetch envelope data for correction
  const { data: envelopeData, isLoading, error } = useQuery<EnvelopeData>({
    queryKey: ["/api/esign/envelopes", envelopeId, "correct"],
    queryFn: async () => {
      if (!envelopeId) throw new Error('No envelope ID');
      const res = await fetch(`/api/esign/envelopes/${envelopeId}/correct`, {
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to fetch envelope');
      }
      return res.json();
    },
    enabled: !!envelopeId,
  });

  // Initialize form from envelope data
  useEffect(() => {
    if (envelopeData && !isInitialized) {
      setTitle(envelopeData.envelope.title);
      setMessage(envelopeData.envelope.message || "");
      setSigningOrder(envelopeData.envelope.signingOrder);
      setPageImages(envelopeData.envelope.pageImages || []);

      // Convert recipients
      const convertedRecipients: Recipient[] = envelopeData.recipients.map((r, idx) => ({
        id: r.id,
        tempId: uuidv4(),
        name: r.name,
        email: r.email,
        role: r.role,
        order: r.signingOrder,
        color: r.color,
        status: r.status,
      }));
      setRecipients(convertedRecipients);

      // Convert fields - map recipientId to recipientIndex
      const recipientIdToIndex = new Map(
        envelopeData.recipients.map((r, idx) => [r.id, idx])
      );

      const convertedFields: SignatureField[] = envelopeData.fields.map(f => ({
        id: uuidv4(),
        type: f.type,
        x: f.x,
        y: f.y,
        width: f.width,
        height: f.height,
        page: f.page,
        recipientIndex: recipientIdToIndex.get(f.recipientId) ?? 0,
        required: f.required,
      }));
      setSignatureFields(convertedFields);

      setIsInitialized(true);
    }
  }, [envelopeData, isInitialized]);

  // Get recipient color
  const getRecipientColor = (index: number) => {
    const signers = recipients.filter(r => r.role === 'signer');
    const signerIndex = signers.findIndex((_, i) => {
      const allSignerIndices = recipients
        .map((r, idx) => r.role === 'signer' ? idx : -1)
        .filter(idx => idx !== -1);
      return allSignerIndices[i] === index;
    });

    if (recipients[index]?.role === 'cc') {
      return ESIGN_CC_COLOR;
    }
    return ESIGN_RECIPIENT_COLORS[signerIndex >= 0 ? signerIndex % ESIGN_RECIPIENT_COLORS.length : 0];
  };

  // Add recipient
  const addRecipient = (role: 'signer' | 'cc' = 'signer') => {
    const maxOrder = Math.max(0, ...recipients.map(r => r.order));
    setRecipients([...recipients, {
      tempId: uuidv4(),
      name: "",
      email: "",
      role,
      order: maxOrder + 1,
    }]);
  };

  // Remove recipient
  const removeRecipient = (tempId: string) => {
    const recipientIndex = recipients.findIndex(r => r.tempId === tempId);
    // Remove fields assigned to this recipient
    setSignatureFields(fields => fields.filter(f => f.recipientIndex !== recipientIndex));
    // Update field recipientIndex for recipients after the removed one
    setSignatureFields(fields => fields.map(f => ({
      ...f,
      recipientIndex: f.recipientIndex > recipientIndex ? f.recipientIndex - 1 : f.recipientIndex,
    })));
    setRecipients(recipients.filter(r => r.tempId !== tempId));
  };

  // Update recipient
  const updateRecipient = (tempId: string, updates: Partial<Recipient>) => {
    setRecipients(recipients.map(r =>
      r.tempId === tempId ? { ...r, ...updates } : r
    ));
  };

  // Save correction mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title,
        message: message || null,
        signingOrder,
        recipients: recipients.map((r, idx) => ({
          id: r.id, // Include existing ID if present
          name: r.name,
          email: r.email,
          role: r.role,
          signingOrder: idx + 1,
        })),
        fields: signatureFields.map(field => ({
          recipientIndex: field.recipientIndex,
          type: field.type,
          x: field.x,
          y: field.y,
          width: field.width,
          height: field.height,
          page: field.page,
          required: field.required,
        })),
        resendToRecipients: resendEmails,
      };

      const res = await fetch(`/api/esign/envelopes/${envelopeId}/correct`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save corrections');
      }

      return res.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/esign/envelopes"] });
      toast({
        title: "Corrections saved",
        description: resendEmails
          ? "Recipients have been notified of the changes."
          : "Changes have been saved successfully.",
      });
      setLocation(`/esign/envelope/${envelopeId}`);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save corrections.",
        variant: "destructive",
      });
    },
  });

  // Validation
  const signers = recipients.filter(r => r.role === 'signer');
  const isValid =
    title.trim().length > 0 &&
    signers.length > 0 &&
    signers.every(r => r.name && r.email) &&
    signatureFields.some(f => f.type === 'signature');

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error || !envelopeData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
              <h2 className="text-lg font-medium mb-2">Cannot Correct Envelope</h2>
              <p className="text-gray-500 mb-4">
                {(error as any)?.message || "This envelope cannot be corrected."}
              </p>
              <Button onClick={() => setLocation("/esign")}>
                Back to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const wasSent = envelopeData.envelope.status === 'sent';

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-800 via-slate-700 to-slate-600 border-b border-slate-200 shadow-lg">
          <div className="container mx-auto px-4 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white/80 hover:text-white hover:bg-white/10"
                  onClick={() => setLocation(`/esign/envelope/${envelopeId}`)}
                >
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                  <FileSignature className="h-6 w-6" />
                  Correct Envelope
                </h1>
              </div>
              <Button
                onClick={() => setShowConfirmDialog(true)}
                disabled={!isValid || saveMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {saveMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Corrections
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Warning banner for sent envelopes */}
        {wasSent && (
          <div className="bg-amber-50 border-b border-amber-200">
            <div className="container mx-auto px-4 py-3">
              <div className="flex items-center gap-2 text-amber-800">
                <AlertTriangle className="h-5 w-5" />
                <span className="text-sm font-medium">
                  This envelope has already been sent. Corrections will update the document for recipients who haven't signed yet.
                </span>
              </div>
            </div>
          </div>
        )}

        <main className="container mx-auto px-4 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left sidebar - Recipients & Fields */}
            <div className="space-y-6">
              {/* Title & Message */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Document Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Title</Label>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Document title"
                    />
                  </div>
                  <div>
                    <Label>Message to Recipients</Label>
                    <Textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Optional message..."
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label>Signing Order</Label>
                    <RadioGroup
                      value={signingOrder}
                      onValueChange={(v) => setSigningOrder(v as 'sequential' | 'parallel')}
                      className="mt-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="parallel" id="parallel" />
                        <Label htmlFor="parallel" className="font-normal">
                          All at once
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="sequential" id="sequential" />
                        <Label htmlFor="sequential" className="font-normal">
                          In order
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                </CardContent>
              </Card>

              {/* Recipients */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Recipients
                    </span>
                    <Button size="sm" variant="outline" onClick={() => addRecipient('signer')}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {recipients.map((recipient, index) => {
                    const color = getRecipientColor(index);
                    const isSigner = recipient.role === 'signer';

                    return (
                      <div
                        key={recipient.tempId}
                        className={`p-3 rounded-lg border-2 ${
                          activeRecipientIndex === index && isSigner ? 'ring-2' : ''
                        }`}
                        style={{
                          borderColor: color,
                          backgroundColor: `${color}10`,
                        }}
                        onClick={() => isSigner && setActiveRecipientIndex(index)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <Badge style={{ backgroundColor: color }} className="text-white text-xs">
                            {isSigner ? `Signer ${signers.indexOf(recipient) + 1}` : 'CC'}
                          </Badge>
                          <div className="flex items-center gap-2">
                            <Select
                              value={recipient.role}
                              onValueChange={(v) => updateRecipient(recipient.tempId, { role: v as 'signer' | 'cc' })}
                            >
                              <SelectTrigger className="h-7 w-20 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="signer">Signer</SelectItem>
                                <SelectItem value="cc">CC</SelectItem>
                              </SelectContent>
                            </Select>
                            {recipients.length > 1 && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-gray-400 hover:text-red-600"
                                onClick={() => removeRecipient(recipient.tempId)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Input
                            placeholder="Name"
                            value={recipient.name}
                            onChange={(e) => updateRecipient(recipient.tempId, { name: e.target.value })}
                            className="h-8 text-sm"
                          />
                          <Input
                            type="email"
                            placeholder="Email"
                            value={recipient.email}
                            onChange={(e) => updateRecipient(recipient.tempId, { email: e.target.value })}
                            className="h-8 text-sm"
                          />
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {/* Field Palette */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">
                    Drag Fields to Document
                  </CardTitle>
                  <CardDescription>
                    Select a recipient above, then drag fields onto the document
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2">
                    {FIELD_TYPES.map((fieldType) => (
                      <DraggableFieldType
                        key={fieldType.type}
                        type={fieldType.type}
                        label={fieldType.label}
                        icon={fieldType.icon}
                        color={getRecipientColor(activeRecipientIndex)}
                        recipientIndex={activeRecipientIndex}
                        disabled={recipients.filter(r => r.role === 'signer').length === 0}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Document Preview */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Document</CardTitle>
                    <div className="flex items-center gap-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
                      >
                        <ZoomOut className="h-4 w-4" />
                      </Button>
                      <span className="text-sm w-12 text-center">{Math.round(zoom * 100)}%</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => setZoom(Math.min(2, zoom + 0.1))}
                      >
                        <ZoomIn className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="max-h-[calc(100vh-300px)] overflow-auto">
                  <div className="space-y-6">
                    {pageImages.map((pageImage, index) => (
                      <DocumentPageCanvas
                        key={index}
                        pageImage={pageImage}
                        pageNumber={index + 1}
                        fields={signatureFields}
                        selectedFieldId={selectedFieldId}
                        onFieldsChange={setSignatureFields}
                        onSelectField={setSelectedFieldId}
                        zoom={zoom}
                        getRecipientColor={getRecipientColor}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>

        {/* Confirmation Dialog */}
        <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Save Corrections?</AlertDialogTitle>
              <AlertDialogDescription>
                {wasSent ? (
                  <>
                    This envelope has already been sent to recipients.
                    Your changes will update the document for anyone who hasn't signed yet.
                  </>
                ) : (
                  <>
                    Your corrections will be saved to this envelope.
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>

            {wasSent && (
              <div className="py-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="resend"
                    checked={resendEmails}
                    onCheckedChange={(checked) => setResendEmails(!!checked)}
                  />
                  <Label htmlFor="resend" className="text-sm font-normal">
                    Send updated signing links to recipients
                  </Label>
                </div>
              </div>
            )}

            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setShowConfirmDialog(false);
                  saveMutation.mutate();
                }}
              >
                Save Corrections
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DndProvider>
  );
}
