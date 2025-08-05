import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Edit, Save, X, Trash2, Type } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { RichTextEditor, htmlToPlainText, plainTextWithFormattingToHtml } from "./rich-text-editor";

interface EnhancedInlineEditorProps {
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
  enableRichText?: boolean; // New prop to enable rich text editing
}

export function EnhancedInlineEditor({
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
  readOnly = false,
  enableRichText = false
}: EnhancedInlineEditorProps) {
  const [editValue, setEditValue] = useState<string>("");
  const [useRichText, setUseRichText] = useState(enableRichText);

  useEffect(() => {
    if (isEditing) {
      if (isArray && Array.isArray(value)) {
        setEditValue(value.join('\n'));
      } else {
        const textValue = typeof value === 'string' ? value : String(value);
        // If it contains HTML tags, keep it as HTML for rich text editor
        if (enableRichText && textValue.includes('<') && textValue.includes('>')) {
          setEditValue(textValue);
          setUseRichText(true);
        } else {
          setEditValue(textValue);
        }
      }
    }
  }, [isEditing, value, isArray, enableRichText]);

  const handleSave = () => {
    if (isArray) {
      const arrayValue = editValue.split('\n').filter(item => item.trim() !== '');
      onSave(fieldPath, arrayValue);
    } else {
      onSave(fieldPath, editValue);
    }
  };

  const handleRichTextChange = (html: string) => {
    setEditValue(html);
  };

  const toggleRichText = () => {
    if (useRichText) {
      // Convert HTML to plain text
      setEditValue(htmlToPlainText(editValue));
    } else {
      // Convert plain text to HTML
      setEditValue(plainTextWithFormattingToHtml(editValue));
    }
    setUseRichText(!useRichText);
  };

  const displayValue = isArray && Array.isArray(value) 
    ? value.map(item => {
        if (typeof item === 'object' && item !== null) {
          // Handle objects in arrays (like Key Personnel)
          const parts = [];
          if ((item as any).role) parts.push(`Role: ${(item as any).role}`);
          if ((item as any).name) parts.push(`Name: ${(item as any).name}`);
          if ((item as any).tenure) parts.push(`Tenure: ${(item as any).tenure}`);
          if ((item as any).background) parts.push(`Background: ${(item as any).background}`);
          
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
         Object.entries(value)
           .map(([key, val]) => {
             // Make field names more readable
             const readableKey = key
               .replace(/([A-Z])/g, ' $1')
               .replace(/^./, str => str.toUpperCase())
               .replace(/Time/g, '-Time');
             return `${readableKey}: ${String(val)}`;
           })
           .join(', '))
    : String(value || '');

  if (isEditing) {
    return (
      <>
        {enableRichText && multiline && !isArray && (
          <div className="mb-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={toggleRichText}
              className="h-8"
            >
              <Type className="h-4 w-4 mr-1" />
              {useRichText ? 'Plain Text' : 'Rich Text'}
            </Button>
          </div>
        )}
        
        {useRichText && enableRichText && multiline && !isArray ? (
          <RichTextEditor
            value={editValue}
            onChange={handleRichTextChange}
            placeholder={placeholder || "Enter text..."}
            onSave={handleSave}
            onCancel={onCancel}
          />
        ) : (
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
                  <Button size="sm" onClick={handleSave}>
                    <Save className="h-4 w-4 mr-1" />
                    Save
                  </Button>
                  <Button size="sm" variant="outline" onClick={onCancel}>
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </>
    );
  }

  return (
    <div className="group relative">
      <div className="min-h-[2rem] py-1">
        {enableRichText && displayValue.includes('<') && displayValue.includes('>') ? (
          <div 
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: displayValue }}
          />
        ) : (
          <span className={displayValue ? "" : "text-muted-foreground"}>
            {displayValue || placeholder || "Click to edit"}
          </span>
        )}
      </div>
      
      {!readOnly && (
        <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onEdit(fieldPath)}
            className="h-6 w-6 p-0"
          >
            <Edit className="h-3 w-3" />
          </Button>
          {onDelete && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onDelete(fieldPath)}
              className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}