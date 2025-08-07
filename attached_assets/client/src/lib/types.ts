import type { Document, Recipient, SignatureField, AuditTrail } from "@shared/schema";

// Extended types for frontend use
export interface DocumentWithDetails extends Document {
  recipients: Recipient[];
  fields: SignatureField[];
  auditTrail?: AuditTrail[];
}

export interface RecipientWithStatus extends Recipient {
  fieldsCount: number;
  completedFields: number;
}

export interface FieldWithPosition extends SignatureField {
  isSelected?: boolean;
  isHighlighted?: boolean;
}

// Canvas and positioning types
export interface Position {
  x: number;
  y: number;
}

export interface Dimensions {
  width: number;
  height: number;
}

export interface FieldBounds extends Position, Dimensions {}

export interface CanvasState {
  zoom: number;
  currentPage: number;
  selectedFieldId: number | null;
  draggedFieldType: string | null;
  isDragging: boolean;
  dropZoneActive: boolean;
}

// Field type definitions
export type FieldType = 
  | "signature" 
  | "initials" 
  | "date" 
  | "text" 
  | "checkbox" 
  | "name" 
  | "email";

// Helper function to get recipient color by index
export function getRecipientColor(index: number): RecipientColors {
  const colorIndex = (index % 8) + 1; // Cycle through colors 1-8
  return RECIPIENT_COLORS[colorIndex] || RECIPIENT_COLORS[1];
}

// New function to get recipient color by ID (consistent mapping)
export function getRecipientColorById(recipientId: number): RecipientColors {
  // Use modulo to cycle through available colors based on ID
  const colorIndex = ((recipientId - 1) % 8) + 1; // Colors 1-8, offset by -1 to start at 0
  return RECIPIENT_COLORS[colorIndex] || RECIPIENT_COLORS[1];
}

export interface FieldTypeConfig {
  type: FieldType;
  label: string;
  description: string;
  icon: string;
  defaultDimensions: Dimensions;
  acceptsInput: boolean;
  requiresDrawing: boolean;
}

// Drag and drop types
export interface DraggedField {
  type: FieldType;
  startPosition: Position;
  currentPosition: Position;
}

export interface DropTargetInfo {
  pageNumber: number;
  bounds: FieldBounds;
  isValid: boolean;
}

// Signing process types
export interface SigningSession {
  document: Document;
  recipient: Recipient;
  fields: SignatureField[];
  currentFieldIndex: number;
  completedFields: Set<number>;
  signatures: Map<number, string>;
}

export interface FieldValidation {
  fieldId: number;
  isRequired: boolean;
  isValid: boolean;
  errorMessage?: string;
}

// Document processing types
export interface DocumentProcessingResult {
  pageCount: number;
  imageUrls: string[];
  processingTime: number;
  fileSize: number;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
  stage: "uploading" | "processing" | "completed" | "error";
}

// UI state types
export interface ViewportState {
  containerWidth: number;
  containerHeight: number;
  documentWidth: number;
  documentHeight: number;
  scrollTop: number;
  scrollLeft: number;
}

export interface SelectionState {
  selectedFieldIds: Set<number>;
  selectionBounds?: FieldBounds;
  isMultiSelect: boolean;
}

// Color coding for recipients
export interface RecipientColors {
  primary: string;
  background: string;
  border: string;
  text: string;
}

export const RECIPIENT_COLORS: Record<number, RecipientColors> = {
  1: {
    primary: "hsl(207, 90%, 54%)", // Blue
    background: "hsl(207, 90%, 97%)",
    border: "hsl(207, 90%, 54%)",
    text: "hsl(207, 90%, 35%)"
  },
  2: {
    primary: "hsl(142, 76%, 36%)", // Green
    background: "hsl(142, 76%, 96%)",
    border: "hsl(142, 76%, 36%)",
    text: "hsl(142, 76%, 25%)"
  },
  3: {
    primary: "hsl(262, 83%, 58%)", // Purple
    background: "hsl(262, 83%, 96%)",
    border: "hsl(262, 83%, 58%)",
    text: "hsl(262, 83%, 40%)"
  },
  4: {
    primary: "hsl(25, 95%, 53%)", // Orange
    background: "hsl(25, 95%, 96%)",
    border: "hsl(25, 95%, 53%)",
    text: "hsl(25, 95%, 35%)"
  },
  5: {
    primary: "hsl(340, 82%, 52%)", // Pink
    background: "hsl(340, 82%, 96%)",
    border: "hsl(340, 82%, 52%)",
    text: "hsl(340, 82%, 35%)"
  },
  6: {
    primary: "hsl(45, 93%, 47%)", // Yellow
    background: "hsl(45, 93%, 96%)",
    border: "hsl(45, 93%, 47%)",
    text: "hsl(45, 93%, 30%)"
  },
  7: {
    primary: "hsl(184, 91%, 44%)", // Cyan
    background: "hsl(184, 91%, 96%)",
    border: "hsl(184, 91%, 44%)",
    text: "hsl(184, 91%, 30%)"
  },
  8: {
    primary: "hsl(238, 83%, 58%)", // Indigo
    background: "hsl(238, 83%, 96%)",
    border: "hsl(238, 83%, 58%)",
    text: "hsl(238, 83%, 40%)"
  }
};

// Field type configurations
export const FIELD_TYPE_CONFIGS: Record<FieldType, FieldTypeConfig> = {
  signature: {
    type: "signature",
    label: "Signature",
    description: "Electronic signature field",
    icon: "✍️",
    defaultDimensions: { width: 200, height: 50 },
    acceptsInput: false,
    requiresDrawing: true
  },
  initials: {
    type: "initials",
    label: "Initials",
    description: "Initials field",
    icon: "📝",
    defaultDimensions: { width: 80, height: 40 },
    acceptsInput: false,
    requiresDrawing: true
  },
  date: {
    type: "date",
    label: "Date",
    description: "Date stamp field",
    icon: "📅",
    defaultDimensions: { width: 120, height: 30 },
    acceptsInput: true,
    requiresDrawing: false
  },
  text: {
    type: "text",
    label: "Text",
    description: "Text input field",
    icon: "✏️",
    defaultDimensions: { width: 150, height: 30 },
    acceptsInput: true,
    requiresDrawing: false
  },
  checkbox: {
    type: "checkbox",
    label: "Checkbox",
    description: "Checkbox field",
    icon: "☐",
    defaultDimensions: { width: 20, height: 20 },
    acceptsInput: true,
    requiresDrawing: false
  },
  name: {
    type: "name",
    label: "Full Name",
    description: "Full name field",
    icon: "👤",
    defaultDimensions: { width: 150, height: 30 },
    acceptsInput: true,
    requiresDrawing: false
  },
  email: {
    type: "email",
    label: "Email",
    description: "Email address field",
    icon: "📧",
    defaultDimensions: { width: 200, height: 30 },
    acceptsInput: true,
    requiresDrawing: false
  }
};

// API response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// Error types
export interface AppError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: Date;
}

// Audit trail types
export interface AuditEntry extends AuditTrail {
  actionLabel: string;
  performerName?: string;
  relativeTime: string;
}

// Document status types
export type DocumentStatus = "draft" | "sent" | "completed" | "cancelled";
export type RecipientStatus = "pending" | "signed" | "declined";
export type FieldStatus = "empty" | "filled" | "invalid";

// Validation types
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Export utility type helpers
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;
