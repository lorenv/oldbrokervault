import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Edit, Save, X, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface InlineEditorProps {
  value: string | string[];
  fieldPath: string;
  isEditing: boolean;
  onEdit: (fieldPath: string) => void;
  onSave: (fieldPath: string, value: string | string[]) => void;
  onCancel: () => void;
  onDelete?: (fieldPath: string) => void;
  multiline?: boolean;
  isArray?: boolean;
  placeholder?: string;
  readOnly?: boolean;
}

export function InlineEditor({
  value,
  fieldPath,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  onDelete,
  multiline = false,
  isArray = false,
  placeholder = "",
  readOnly = false
}: InlineEditorProps) {
  const [editValue, setEditValue] = useState<string>("");

  useEffect(() => {
    if (isEditing) {
      if (isArray && Array.isArray(value)) {
        setEditValue(value.join('\n'));
      } else {
        setEditValue(typeof value === 'string' ? value : String(value));
      }
    }
  }, [isEditing, value, isArray]);

  const handleSave = () => {
    if (isArray) {
      const arrayValue = editValue.split('\n').filter(item => item.trim() !== '');
      onSave(fieldPath, arrayValue);
    } else {
      onSave(fieldPath, editValue);
    }
  };

  const displayValue = isArray && Array.isArray(value) 
    ? value.map(item => {
        if (typeof item === 'object' && item !== null) {
          // Handle objects in arrays (like Key Personnel)
          const parts = [];
          if (item.role) parts.push(`Role: ${item.role}`);
          if (item.name) parts.push(`Name: ${item.name}`);
          if (item.tenure) parts.push(`Tenure: ${item.tenure}`);
          if (item.background) parts.push(`Background: ${item.background}`);
          
          if (parts.length === 0) {
            // Fallback for objects without expected properties - convert to string
            const entries = Object.entries(item);
            if (entries.length === 0) return '';
            return entries
              .map(([key, val]) => `${key}: ${String(val)}`)
              .join(', ');
          }
          
          return parts.join(', ');
        }
        return String(item);
      }).join(' | ')
    : typeof value === 'string' ? value 
    : typeof value === 'object' && value !== null ? 
        (Object.keys(value).length === 0 ? '' : 
         Object.entries(value).map(([key, val]) => `${key}: ${String(val)}`).join(', '))
    : String(value || '');

  if (isEditing) {
    return (
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <div className="space-y-3">
            {multiline ? (
              <Textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                placeholder={placeholder || "Enter text..."}
                className="min-h-[100px] resize-none"
                autoFocus
              />
            ) : (
              <Input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                placeholder={placeholder || "Enter text..."}
                autoFocus
              />
            )}
            {isArray && (
              <p className="text-sm text-muted-foreground">
                Enter each item on a new line
              </p>
            )}
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} className="flex items-center gap-1">
                <Save className="h-3 w-3" />
                Save
              </Button>
              <Button size="sm" variant="outline" onClick={onCancel} className="flex items-center gap-1">
                <X className="h-3 w-3" />
                Cancel
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Read-only mode for shared views
  if (readOnly) {
    return (
      <div className="min-h-[40px] p-2">
        {displayValue || <span className="text-muted-foreground italic">No content available</span>}
      </div>
    );
  }

  return (
    <div className="group relative">
      <div 
        className="min-h-[40px] p-2 rounded border border-transparent group-hover:border-gray-200 group-hover:bg-gray-50 cursor-pointer"
        onClick={() => onEdit(fieldPath)}
      >
        {displayValue || <span className="text-muted-foreground italic">Click to add content...</span>}
      </div>
      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
        <Button
          size="sm"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(fieldPath);
          }}
          className="h-6 w-6 p-0"
        >
          <Edit className="h-3 w-3" />
        </Button>
        {onDelete && (
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(fieldPath);
            }}
            className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}