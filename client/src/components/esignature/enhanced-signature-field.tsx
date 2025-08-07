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

// Recipient color scheme
export const RECIPIENT_COLORS = [
  {
    name: 'Blue',
    bg: 'bg-blue-50',
    border: 'border-blue-300',
    text: 'text-blue-700',
    hover: 'hover:bg-blue-100',
    solid: 'bg-blue-500'
  },
  {
    name: 'Green', 
    bg: 'bg-green-50',
    border: 'border-green-300',
    text: 'text-green-700',
    hover: 'hover:bg-green-100',
    solid: 'bg-green-500'
  },
  {
    name: 'Purple',
    bg: 'bg-purple-50',
    border: 'border-purple-300', 
    text: 'text-purple-700',
    hover: 'hover:bg-purple-100',
    solid: 'bg-purple-500'
  },
  {
    name: 'Orange',
    bg: 'bg-orange-50',
    border: 'border-orange-300',
    text: 'text-orange-700',
    hover: 'hover:bg-orange-100',
    solid: 'bg-orange-500'
  },
  {
    name: 'Pink',
    bg: 'bg-pink-50',
    border: 'border-pink-300',
    text: 'text-pink-700',
    hover: 'hover:bg-pink-100',
    solid: 'bg-pink-500'
  },
  {
    name: 'Indigo',
    bg: 'bg-indigo-50',
    border: 'border-indigo-300',
    text: 'text-indigo-700',
    hover: 'hover:bg-indigo-100',
    solid: 'bg-indigo-500'
  },
];

// Get recipient color by index
export const getRecipientColor = (index: number) => {
  return RECIPIENT_COLORS[index % RECIPIENT_COLORS.length];
};

// Field types with enhanced capabilities
export const ENHANCED_FIELD_TYPES = [
  {
    type: 'signature',
    label: 'Signature',
    icon: 'PenTool',
    description: 'Digital signature field'
  },
  {
    type: 'initials',
    label: 'Initials',
    icon: 'Type',
    description: 'Initials field'
  },
  {
    type: 'name',
    label: 'Full Name',
    icon: 'User',
    description: 'Full name text field'
  },
  {
    type: 'email',
    label: 'Email',
    icon: 'Mail',
    description: 'Email address field'
  },
  {
    type: 'date',
    label: 'Date',
    icon: 'Calendar',
    description: 'Date picker field'
  },
  {
    type: 'text',
    label: 'Text Field',
    icon: 'FileText',
    description: 'Custom text input'
  },
  {
    type: 'checkbox',
    label: 'Checkbox',
    icon: 'Square',
    description: 'Checkbox for agreements'
  }
] as const;

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
    fontSize: `${field.fontSize * scale}px`,
    transform: `scale(${scale})`,
    transformOrigin: 'center',
  };

  const getFieldColor = () => {
    if (field.assignedTo) {
      const recipientIndex = parseInt(field.assignedTo) - 1;
      const color = RECIPIENT_COLORS[recipientIndex] || RECIPIENT_COLORS[0];
      return `${color.border} ${color.bg}`;
    }
    return 'border-gray-400 bg-gray-50';
  };

  const fieldClasses = `
    w-full h-full rounded-md cursor-pointer transition-all duration-200 flex items-center justify-center text-center
    ${getFieldColor()}
    ${isEditing ? '' : ''}
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