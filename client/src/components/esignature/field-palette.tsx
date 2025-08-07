import React from 'react';
import { useDrag } from 'react-dnd';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ENHANCED_FIELD_TYPES } from './enhanced-signature-field';
import { NdaRecipient } from '@shared/schema';
import { Palette, GripVertical, PenTool, Type, User, Calendar, Mail, FileText, Square } from 'lucide-react';

interface FieldPaletteProps {
  recipients: NdaRecipient[];
  selectedRecipient?: string;
  onRecipientChange: (recipientId: string) => void;
  className?: string;
}

interface DraggableFieldProps {
  type: string;
  label: string;
  icon: string;
  color: string;
  description: string;
  recipientId?: string;
}

function DraggableField({ type, label, icon, color, description, recipientId }: DraggableFieldProps) {
  const [{ isDragging }, drag] = useDrag({
    type: 'FIELD_TYPE',
    item: { type, recipientId },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const IconComponent = 
    icon === 'PenTool' ? PenTool :
    icon === 'Type' ? Type :
    icon === 'User' ? User :
    icon === 'Calendar' ? Calendar :
    icon === 'Mail' ? Mail :
    icon === 'FileText' ? FileText :
    icon === 'Square' ? Square :
    null;

  // Map the color string to Tailwind CSS classes
  const colorClasses = {
    bg: `bg-${color}-50`,
    border: `border-${color}-200`,
    hover: `hover:bg-${color}-50 hover:border-${color}-300`,
    text: `text-${color}-600`
  };

  return (
    <div
      ref={drag}
      className={`
        flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-grab transition-all duration-200
        bg-white hover:bg-gray-50 hover:border-blue-300 hover:shadow-sm
        ${isDragging ? 'opacity-50 scale-95 border-blue-400' : 'opacity-100'}
      `}
      title={description}
    >
      <GripVertical className="w-4 h-4 text-gray-400" />
      <div className={`w-8 h-8 rounded flex items-center justify-center ${colorClasses.bg} ${colorClasses.border}`}>
        {IconComponent && <IconComponent className={`w-4 h-4 ${colorClasses.text}`} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm text-gray-900 truncate">{label}</div>
        <div className="text-xs text-gray-500 truncate">{description}</div>
      </div>
    </div>
  );
}

export default function FieldPalette({
  recipients,
  selectedRecipient,
  onRecipientChange,
  className = ''
}: FieldPaletteProps) {
  const getRecipientColor = (index: number) => {
    const colors = ['blue', 'green', 'purple', 'orange', 'pink', 'indigo'];
    return colors[index % colors.length] || 'gray';
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-xl">
          <Palette className="w-6 h-6" />
          Field Types
        </CardTitle>

        {/* Recipient selector */}
        {recipients.length > 0 && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Assign fields to:
            </label>
            <Select value={selectedRecipient} onValueChange={onRecipientChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select recipient" />
              </SelectTrigger>
              <SelectContent>
                {recipients.filter(r => r.role === 'signer').map((recipient, index) => (
                  <SelectItem key={recipient.id} value={recipient.id?.toString() || ''}>
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-3 h-3 rounded-full bg-${getRecipientColor(index)}-500`}
                      />
                      {recipient.name}
                      <Badge variant="secondary" className="ml-auto">
                        {recipient.role}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-2">
        {recipients.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <div className="text-sm">Add recipients first to assign fields</div>
          </div>
        ) : (
          <>
            <div className="text-xs text-gray-600 mb-3 px-1">
              Drag fields onto the document to place them
            </div>

            {ENHANCED_FIELD_TYPES.map((fieldType) => (
              <DraggableField
                key={fieldType.type}
                type={fieldType.type}
                label={fieldType.label}
                icon={fieldType.icon}
                color={fieldType.color}
                description={fieldType.description}
                recipientId={selectedRecipient}
              />
            ))}
          </>
        )}

        {/* Field legend */}
        {recipients.length > 0 && (
          <div className="mt-3 space-y-2">
            <div className="text-xs font-medium text-gray-700">Field Assignment:</div>
            {recipients.filter(r => r.role === 'signer').map((recipient, index) => (
              <div key={recipient.id} className="flex items-center gap-2 text-xs">
                <div
                  className={`w-2 h-2 rounded-full bg-${getRecipientColor(index)}-500`}
                />
                <span className="font-medium">{recipient.name}</span>
                <span className="text-gray-500 truncate">({recipient.email})</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}