import React from 'react';
import { z } from 'zod';

// Enhanced signature field schema with recipient assignments
export const enhancedSignatureFieldSchema = z.object({
  id: z.string(),
  type: z.enum(['signature', 'name', 'date', 'email', 'text', 'checkbox', 'initials']),
  label: z.string(),
  x: z.number(), // X coordinate as percentage of page width
  y: z.number(), // Y coordinate as percentage of page height
  width: z.number(), // Width as percentage of page width
  height: z.number(), // Height as percentage of page height
  pageNumber: z.number(),
  required: z.boolean().default(true),
  fontSize: z.number().default(12),
  placeholder: z.string().optional(),
  assignedTo: z.string().optional(), // Recipient ID or role
  validation: z.string().optional(), // Regex pattern for validation
  tooltip: z.string().optional(),
  prefilled: z.boolean().default(false),
  prefilledValue: z.string().optional(),
  recipientRole: z.enum(['signer', 'cc', 'approver']).optional(),
});

export type EnhancedSignatureField = z.infer<typeof enhancedSignatureFieldSchema>;

// Field types with enhanced capabilities
export const ENHANCED_FIELD_TYPES = [
  {
    type: 'signature',
    label: 'Signature',
    icon: 'PenTool',
    color: {
      bg: 'bg-blue-50',
      border: 'border-blue-300',
      text: 'text-blue-700',
      hover: 'hover:bg-blue-100'
    }
  },
  {
    type: 'initials',
    label: 'Initials',
    icon: 'Type',
    color: {
      bg: 'bg-green-50',
      border: 'border-green-300',
      text: 'text-green-700',
      hover: 'hover:bg-green-100'
    }
  },
  {
    type: 'name',
    label: 'Full Name',
    icon: 'User',
    color: {
      bg: 'bg-purple-50',
      border: 'border-purple-300',
      text: 'text-purple-700',
      hover: 'hover:bg-purple-100'
    }
  },
  {
    type: 'email',
    label: 'Email',
    icon: 'Mail',
    color: {
      bg: 'bg-orange-50',
      border: 'border-orange-300',
      text: 'text-orange-700',
      hover: 'hover:bg-orange-100'
    }
  },
  {
    type: 'date',
    label: 'Date',
    icon: 'Calendar',
    color: {
      bg: 'bg-indigo-50',
      border: 'border-indigo-300',
      text: 'text-indigo-700',
      hover: 'hover:bg-indigo-100'
    }
  },
  {
    type: 'text',
    label: 'Text Field',
    icon: 'FileText',
    color: {
      bg: 'bg-gray-50',
      border: 'border-gray-300',
      text: 'text-gray-700',
      hover: 'hover:bg-gray-100'
    }
  },
  {
    type: 'checkbox',
    label: 'Checkbox',
    icon: 'Square',
    color: {
      bg: 'bg-teal-50',
      border: 'border-teal-300',
      text: 'text-teal-700',
      hover: 'hover:bg-teal-100'
    }
  }
] as const;

// Field colors for different recipient assignments
export const RECIPIENT_COLORS = {
  unassigned: 'border-gray-400 bg-gray-50',
  recipient1: 'border-blue-500 bg-blue-50',
  recipient2: 'border-green-500 bg-green-50',
  recipient3: 'border-purple-500 bg-purple-50',
  recipient4: 'border-orange-500 bg-orange-50',
  recipient5: 'border-pink-500 bg-pink-50',
} as const;

// Default field dimensions (as percentages)
export const DEFAULT_FIELD_DIMENSIONS = {
  signature: { width: 18, height: 6 },
  initials: { width: 8, height: 4 },
  name: { width: 15, height: 3 },
  date: { width: 12, height: 3 },
  email: { width: 18, height: 3 },
  text: { width: 15, height: 3 },
  checkbox: { width: 2, height: 2 }
} as const;

// Validation patterns for different field types
export const FIELD_VALIDATION_PATTERNS = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  date: /^\d{4}-\d{2}-\d{2}$/,
  phone: /^[\+]?[1-9][\d]{0,15}$/,
  ssn: /^\d{3}-\d{2}-\d{4}$/,
} as const;

// Field renderer component for display in templates and signing
interface FieldRendererProps {
  field: EnhancedSignatureField;
  value?: string;
  onChange?: (value: string) => void;
  onFieldClick?: () => void;
  isEditing?: boolean;
  isHighlighted?: boolean;
  scale?: number;
}

export const FieldRenderer: React.FC<FieldRendererProps> = ({
  field,
  value,
  onChange,
  onFieldClick,
  isEditing = false,
  isHighlighted = false,
  scale = 1
}) => {
  const baseStyle = {
    position: 'absolute' as const,
    left: `${field.x}%`,
    top: `${field.y}%`,
    width: `${field.width}%`,
    height: `${field.height}%`,
    fontSize: `${field.fontSize * scale}px`,
    transform: `scale(${scale})`,
    transformOrigin: 'top left',
    zIndex: isHighlighted ? 10 : 5,
  };

  const getFieldColor = () => {
    if (field.assignedTo) {
      return RECIPIENT_COLORS[field.assignedTo as keyof typeof RECIPIENT_COLORS] || RECIPIENT_COLORS.unassigned;
    }
    return ENHANCED_FIELD_TYPES.find(type => type.type === field.type)?.color || 'border-gray-400 bg-gray-50';
  };

  const fieldClasses = `
    absolute border-2 rounded-md cursor-pointer transition-all duration-200
    ${getFieldColor()}
    ${isHighlighted ? 'ring-2 ring-blue-400 shadow-lg' : ''}
    ${isEditing ? 'border-dashed' : 'border-solid'}
  `;

  if (field.type === 'signature' || field.type === 'initials') {
    return (
      <div
        style={baseStyle}
        className={fieldClasses}
        onClick={onFieldClick}
        title={field.tooltip || field.label}
      >
        <div className="w-full h-full flex items-center justify-center text-xs text-gray-600">
          {value ? (
            <div className="font-signature text-blue-600">
              {field.type === 'signature' ? 'Signed' : 'Initialed'}
            </div>
          ) : (
            <div className="text-center">
              {/* Emojis removed */}
              <div className="text-[10px]">{field.label}</div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (field.type === 'checkbox') {
    return (
      <div
        style={baseStyle}
        className={fieldClasses}
        onClick={onFieldClick}
        title={field.tooltip || field.label}
      >
        <div className="w-full h-full flex items-center justify-center">
          <input
            type="checkbox"
            checked={value === 'true'}
            onChange={(e) => onChange?.(e.target.checked.toString())}
            className="w-4 h-4"
            disabled={isEditing}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      style={baseStyle}
      className={fieldClasses}
      onClick={onFieldClick}
      title={field.tooltip || field.label}
    >
      {isEditing ? (
        <div className="w-full h-full flex items-center justify-center text-xs text-gray-600 text-center p-1">
          <div>
            <div>{ENHANCED_FIELD_TYPES.find(t => t.type === field.type)?.icon}</div>
            <div className="text-[10px]">{field.label}</div>
          </div>
        </div>
      ) : (
        <input
          type={field.type === 'email' ? 'email' : field.type === 'date' ? 'date' : 'text'}
          value={value || ''}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={field.placeholder || field.label}
          required={field.required}
          className="w-full h-full border-none outline-none bg-transparent px-1 text-sm"
          style={{ fontSize: `${field.fontSize * scale}px` }}
        />
      )}
    </div>
  );
};