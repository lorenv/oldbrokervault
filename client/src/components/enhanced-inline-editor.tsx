import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Save, X, Type, Bold, Italic, List, ListOrdered } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { RichTextEditor, htmlToPlainText, plainTextToHtml } from "./rich-text-editor";
import { Editor } from "@tiptap/core";

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
  const [saveInProgress, setSaveInProgress] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);

  useEffect(() => {
    if (isEditing) {
      if (isArray && Array.isArray(value)) {
        setEditValue(value.join('\n'));
      } else {
        const textValue = typeof value === 'string' ? value : String(value);
        setEditValue(textValue);
      }
    }
  }, [isEditing, value, isArray, enableRichText]);

  const handleSave = () => {
    setSaveInProgress(true);
    if (isArray) {
      const arrayValue = editValue.split('\n').filter(item => item.trim() !== '');
      onSave(fieldPath, arrayValue);
    } else {
      onSave(fieldPath, editValue);
    }
    setSaveInProgress(false);
  };

  const handleRichTextChange = (newValue: string) => {
    setEditValue(newValue);
  };

  const toggleBold = () => {
    if (editor) {
      editor.chain().focus().toggleBold().run();
    }
  };

  const toggleItalic = () => {
    if (editor) {
      editor.chain().focus().toggleItalic().run();
    }
  };

  const toggleBulletList = () => {
    if (editor) {
      editor.chain().focus().toggleBulletList().run();
    }
  };

  const toggleOrderedList = () => {
    if (editor) {
      editor.chain().focus().toggleOrderedList().run();
    }
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
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleBold}
                  className={`p-2 rounded hover:bg-gray-100 ${
                    editor?.isActive('bold') ? 'bg-gray-200' : ''
                  }`}
                >
                  <Bold className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={toggleItalic}
                  className={`p-2 rounded hover:bg-gray-100 ${
                    editor?.isActive('italic') ? 'bg-gray-200' : ''
                  }`}
                >
                  <Italic className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={toggleBulletList}
                  className={`p-2 rounded hover:bg-gray-100 ${
                    editor?.isActive('bulletList') ? 'bg-gray-200' : ''
                  }`}
                >
                  <List className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={toggleOrderedList}
                  className={`p-2 rounded hover:bg-gray-100 ${
                    editor?.isActive('orderedList') ? 'bg-gray-200' : ''
                  }`}
                >
                  <ListOrdered className="h-4 w-4" />
                </button>
                <Button
                  onClick={handleSave}
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2"
                  disabled={saveInProgress}
                >
                  <Save className="h-4 w-4 mr-1" />
                  Save
                </Button>
              </div>
              <div>
                <Button
                  onClick={onCancel}
                  variant="outline"
                  size="sm"
                  className="px-4 py-2"
                >
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        {enableRichText && multiline && !isArray ? (
          <RichTextEditor
            value={editValue}
            onChange={handleRichTextChange}
            placeholder={placeholder || "Enter text..."}
            onSave={handleSave}
            onCancel={onCancel}
            setEditor={setEditor} // Pass setEditor to RichTextEditor
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
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
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
              </div>
            </CardContent>
          </Card>
        )}
      </>
    );
  }

  return (
    <div
      className={`group relative ${!readOnly ? 'cursor-pointer hover:bg-gray-50 rounded p-1' : ''}`}
      onClick={() => !readOnly && onEdit(fieldPath)}
    >
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
    </div>
  );
}