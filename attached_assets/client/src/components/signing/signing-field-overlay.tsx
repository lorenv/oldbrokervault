import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

import { CheckCircle, Edit3, Calendar, User, Mail, Type, PenTool, CheckSquare, X } from "lucide-react";
import type { SignatureField, Recipient } from "@shared/schema";

interface SigningFieldOverlayProps {
  fields: SignatureField[];
  recipient: Recipient;
  onFieldComplete: (fieldId: number, value: string) => void;
  getFieldValue: (fieldId: number) => string;
  currentFieldId?: number;
  onFieldClick: (field: SignatureField) => void;
}

interface FieldEditorProps {
  field: SignatureField;
  recipient: Recipient;
  value: string;
  onComplete: (value: string) => void;
  onCancel: () => void;
}

function FieldEditor({ field, recipient, value, onComplete, onCancel }: FieldEditorProps) {
  const [localValue, setLocalValue] = useState(value);

  const handleSave = () => {
    onComplete(localValue);
  };

  const handleAutoFill = () => {
    let autoValue = "";
    switch (field.type) {
      case "name":
        autoValue = recipient.fullName;
        break;
      case "email":
        autoValue = recipient.email;
        break;
      case "date":
        autoValue = new Date().toISOString().split('T')[0];
        break;
      case "signature":
      case "initials":
        autoValue = recipient.fullName; // Default to typing name for signature
        break;
    }
    setLocalValue(autoValue);
  };

  return (
    <Card className="absolute min-w-80 shadow-lg border-2 pointer-events-auto" style={{
      top: `${field.y + field.height + 10}px`,
      left: `${Math.max(10, field.x)}px`,
      zIndex: 9999,
    }}
    onClick={(e) => e.stopPropagation()}
    onMouseDown={(e) => e.stopPropagation()}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-sm">{field.label}</h3>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {field.type === "signature" && (
          <div className="space-y-3">
            <p className="text-xs text-slate-600">
              Type your full name to sign:
            </p>
            <Input
              value={localValue}
              onChange={(e) => setLocalValue(e.target.value)}
              placeholder="Type your full name"
              className="text-sm"
              autoFocus
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleAutoFill}
              className="text-xs w-full"
            >
              Use my name: {recipient.fullName}
            </Button>
          </div>
        )}

        {field.type === "initials" && (
          <div className="space-y-3">
            <p className="text-xs text-slate-600">
              Type your initials:
            </p>
            <Input
              value={localValue}
              onChange={(e) => setLocalValue(e.target.value)}
              placeholder="Type your initials (e.g., JD)"
              className="text-sm"
              maxLength={4}
              autoFocus
            />
          </div>
        )}

        {field.type === "date" && (
          <div className="space-y-3">
            <Input
              type="date"
              value={localValue}
              onChange={(e) => setLocalValue(e.target.value)}
              className="text-sm"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleAutoFill}
              className="text-xs w-full"
            >
              Use today's date
            </Button>
          </div>
        )}

        {field.type === "text" && (
          <div className="space-y-3">
            <Input
              value={localValue}
              onChange={(e) => setLocalValue(e.target.value)}
              placeholder={`Enter ${field.label.toLowerCase()}`}
              className="text-sm"
            />
          </div>
        )}

        {field.type === "name" && (
          <div className="space-y-3">
            <Input
              value={localValue}
              onChange={(e) => setLocalValue(e.target.value)}
              placeholder="Enter your full name"
              className="text-sm"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleAutoFill}
              className="text-xs w-full"
            >
              Use my name: {recipient.fullName}
            </Button>
          </div>
        )}

        {field.type === "email" && (
          <div className="space-y-3">
            <Input
              type="email"
              value={localValue}
              onChange={(e) => setLocalValue(e.target.value)}
              placeholder="Enter your email"
              className="text-sm"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleAutoFill}
              className="text-xs w-full"
            >
              Use my email: {recipient.email}
            </Button>
          </div>
        )}

        {field.type === "checkbox" && (
          <div className="space-y-3">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={localValue === "true"}
                onChange={(e) => setLocalValue(e.target.checked.toString())}
                className="rounded border-slate-300"
              />
              <span className="text-sm">{field.label}</span>
            </label>
          </div>
        )}

        <div className="flex justify-end space-x-2 mt-4">
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button 
            size="sm" 
            onClick={handleSave}
            disabled={field.required && !localValue}
          >
            Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function SigningFieldOverlay({
  fields,
  recipient,
  onFieldComplete,
  getFieldValue,
  currentFieldId,
  onFieldClick
}: SigningFieldOverlayProps) {
  const [editingFieldId, setEditingFieldId] = useState<number | null>(null);

  const getFieldColor = (recipientId: number) => {
    const colors = [
      { bg: "bg-blue-100", border: "border-blue-500", text: "text-blue-700" },
      { bg: "bg-green-100", border: "border-green-500", text: "text-green-700" },
      { bg: "bg-purple-100", border: "border-purple-500", text: "text-purple-700" },
      { bg: "bg-orange-100", border: "border-orange-500", text: "text-orange-700" },
    ];
    return colors[(recipientId - 1) % colors.length];
  };

  const getFieldIcon = (type: string) => {
    switch (type) {
      case "signature": return <PenTool className="h-3 w-3" />;
      case "initials": return <Type className="h-3 w-3" />;
      case "date": return <Calendar className="h-3 w-3" />;
      case "text": return <Edit3 className="h-3 w-3" />;
      case "checkbox": return <CheckSquare className="h-3 w-3" />;
      case "name": return <User className="h-3 w-3" />;
      case "email": return <Mail className="h-3 w-3" />;
      default: return <Edit3 className="h-3 w-3" />;
    }
  };

  const handleFieldClick = (field: SignatureField) => {
    setEditingFieldId(field.id);
    onFieldClick(field);
  };

  const handleFieldComplete = (fieldId: number, value: string) => {
    onFieldComplete(fieldId, value);
    setEditingFieldId(null);
  };

  const handleCancel = () => {
    setEditingFieldId(null);
  };

  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 30 }}>
      {fields.map((field) => {
        const colors = getFieldColor(field.recipientId);
        const isCompleted = !!getFieldValue(field.id);
        const isCurrent = currentFieldId === field.id;
        const isEditing = editingFieldId === field.id;
        
        return (
          <div key={field.id}>
            {/* Field Button */}
            <button
              className={`absolute border-2 rounded transition-all duration-200 pointer-events-auto cursor-pointer hover:shadow-md z-20 ${
                isCompleted 
                  ? `bg-green-100 border-green-500 text-green-700` 
                  : isCurrent
                  ? `${colors.bg} ${colors.border} ${colors.text} ring-2 ring-blue-400`
                  : `${colors.bg} ${colors.border} ${colors.text}`
              }`}
              style={{
                top: `${field.y}px`,
                left: `${field.x}px`,
                width: `${field.width}px`,
                height: `${field.height}px`,
                zIndex: isEditing ? 25 : 20,
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleFieldClick(field);
              }}
            >
              <div className="flex items-center justify-center h-full px-2">
                {isCompleted ? (
                  <div className="flex items-center justify-center w-full h-full">
                    {field.type === "signature" || field.type === "initials" ? (
                      <span 
                        className="font-medium truncate italic"
                        style={{ 
                          fontFamily: 'Brush Script MT, cursive', 
                          fontSize: `${Math.max(12, Math.min(32, field.height * 0.4))}px` 
                        }}
                      >
                        {getFieldValue(field.id)}
                      </span>
                    ) : field.type === "date" ? (
                      <span 
                        className="font-medium"
                        style={{ fontSize: `${Math.max(12, Math.min(24, field.height * 0.35))}px` }}
                      >
                        {new Date(getFieldValue(field.id)).toLocaleDateString()}
                      </span>
                    ) : field.type === "checkbox" ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <span 
                        className="font-medium truncate"
                        style={{ fontSize: `${Math.max(12, Math.min(24, field.height * 0.35))}px` }}
                      >
                        {getFieldValue(field.id)}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center space-x-1">
                    {getFieldIcon(field.type)}
                    <span className="text-xs font-medium truncate">
                      {field.type}
                    </span>
                  </div>
                )}
              </div>
            </button>

            {/* Field Editor */}
            {isEditing && (
              <FieldEditor
                field={field}
                recipient={recipient}
                value={getFieldValue(field.id)}
                onComplete={(value) => handleFieldComplete(field.id, value)}
                onCancel={handleCancel}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}