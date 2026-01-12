import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Pencil, Check, X, Loader2 } from "lucide-react";

export type InlineEditType = 'text' | 'email' | 'phone' | 'number' | 'currency' | 'date' | 'select';

interface SelectOption {
  value: string;
  label: string;
}

interface InlineEditProps {
  value: string | number | null | undefined;
  onSave: (value: string) => Promise<void> | void;
  type?: InlineEditType;
  placeholder?: string;
  options?: SelectOption[];
  className?: string;
  inputClassName?: string;
  displayClassName?: string;
  emptyText?: string;
  prefix?: string;
  formatDisplay?: (value: any) => string;
  disabled?: boolean;
}

export function InlineEdit({
  value,
  onSave,
  type = 'text',
  placeholder = 'Click to edit',
  options = [],
  className,
  inputClassName,
  displayClassName,
  emptyText = 'Add...',
  prefix,
  formatDisplay,
  disabled = false,
}: InlineEditProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value ?? ''));
  const [isLoading, setIsLoading] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Update edit value when prop changes
  useEffect(() => {
    if (!isEditing) {
      setEditValue(String(value ?? ''));
    }
  }, [value, isEditing]);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = useCallback(async () => {
    const trimmedValue = editValue.trim();
    const originalValue = String(value ?? '');

    // Don't save if unchanged
    if (trimmedValue === originalValue) {
      setIsEditing(false);
      return;
    }

    setIsLoading(true);
    try {
      await onSave(trimmedValue);
      setIsEditing(false);
    } catch (error) {
      // Revert on error
      setEditValue(originalValue);
      console.error('Failed to save:', error);
    } finally {
      setIsLoading(false);
    }
  }, [editValue, value, onSave]);

  const handleCancel = useCallback(() => {
    setEditValue(String(value ?? ''));
    setIsEditing(false);
  }, [value]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  }, [handleSave, handleCancel]);

  const handleBlur = useCallback(() => {
    // Small delay to allow click on save/cancel buttons
    setTimeout(() => {
      if (isEditing && !isLoading) {
        handleSave();
      }
    }, 150);
  }, [isEditing, isLoading, handleSave]);

  // Get display value
  const getDisplayValue = () => {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    if (formatDisplay) {
      return formatDisplay(value);
    }
    if (type === 'select' && options.length > 0) {
      const option = options.find(o => o.value === String(value));
      return option?.label || value;
    }
    if (prefix) {
      return `${prefix}${value}`;
    }
    return String(value);
  };

  const displayValue = getDisplayValue();

  if (disabled) {
    return (
      <span className={cn("text-sm", displayClassName)}>
        {displayValue || <span className="text-muted-foreground">{emptyText}</span>}
      </span>
    );
  }

  if (isEditing) {
    if (type === 'select') {
      return (
        <div className={cn("inline-flex items-center gap-1", className)}>
          <Select
            value={editValue}
            onValueChange={async (val) => {
              setEditValue(val);
              // Auto-save on select
              setIsLoading(true);
              try {
                await onSave(val);
                setIsEditing(false);
              } catch {
                setEditValue(String(value ?? ''));
              } finally {
                setIsLoading(false);
              }
            }}
          >
            <SelectTrigger className={cn("h-7 text-sm min-w-[120px]", inputClassName)}>
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>
      );
    }

    return (
      <div className={cn("inline-flex items-center gap-1", className)}>
        <Input
          ref={inputRef}
          type={type === 'currency' ? 'number' : type === 'phone' ? 'tel' : type}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={placeholder}
          className={cn("h-7 text-sm px-2 min-w-[100px]", inputClassName)}
          disabled={isLoading}
        />
        {isLoading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        ) : (
          <>
            <button
              type="button"
              onClick={handleSave}
              className="p-0.5 text-green-600 hover:text-green-700"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="p-0.5 text-gray-400 hover:text-gray-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setIsEditing(true)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "inline-flex items-center gap-1.5 text-left rounded px-1 -mx-1 py-0.5 transition-colors",
        "hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
        className
      )}
    >
      <span className={cn("text-sm", !displayValue && "text-muted-foreground italic", displayClassName)}>
        {displayValue || emptyText}
      </span>
      {isHovered && (
        <Pencil className="h-3 w-3 text-muted-foreground flex-shrink-0" />
      )}
    </button>
  );
}

// Specialized variants for common use cases
export function InlineEditEmail(props: Omit<InlineEditProps, 'type'>) {
  return <InlineEdit {...props} type="email" placeholder="email@example.com" emptyText="Add email" />;
}

export function InlineEditPhone(props: Omit<InlineEditProps, 'type'>) {
  return <InlineEdit {...props} type="phone" placeholder="(555) 123-4567" emptyText="Add phone" />;
}

export function InlineEditCurrency(props: Omit<InlineEditProps, 'type' | 'formatDisplay'> & { currency?: string }) {
  const { currency = 'USD', ...rest } = props;
  return (
    <InlineEdit
      {...rest}
      type="currency"
      placeholder="0"
      emptyText="Add value"
      formatDisplay={(val) =>
        new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency,
          minimumFractionDigits: 0,
        }).format(parseFloat(val) || 0)
      }
    />
  );
}

export function InlineEditDate(props: Omit<InlineEditProps, 'type' | 'formatDisplay'>) {
  return (
    <InlineEdit
      {...props}
      type="date"
      emptyText="Add date"
      formatDisplay={(val) => val ? new Date(val).toLocaleDateString() : ''}
    />
  );
}
