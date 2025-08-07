import React from 'react';
import { useDrag } from 'react-dnd';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ENHANCED_FIELD_TYPES } from './enhanced-signature-field';
import { NdaRecipient } from '@shared/schema';
import { Palette, GripVertical } from 'lucide-react';

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

  return (
    <div
      ref={drag}
      className={`
        flex items-center gap-4 p-6 border-2 border-dashed rounded-xl cursor-grab transition-all duration-200
        ${color} hover:shadow-lg hover:scale-102 hover:border-solid
        ${isDragging ? 'opacity-50 scale-95' : 'opacity-100'}
      `}
      title={description}
    >
      <GripVertical className="w-5 h-5 text-gray-500" />
      <div className="text-2xl">{icon}</div>
      <div className="flex-1">
        <div className="font-semibold text-base mb-1">{label}</div>
        <div className="text-sm text-gray-600">{description}</div>
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
      
      <CardContent className="space-y-3">
        {recipients.length === 0 ? (
          <div className="text-center py-6 text-gray-500">
            <div className="text-sm">Add recipients first to assign fields</div>
          </div>
        ) : (
          <>
            <div className="text-sm text-gray-600 mb-3">
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
        
        {/* Instructions */}
        <div className="mt-6 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="text-sm text-blue-800">
            <div className="font-medium mb-1">How to use:</div>
            <ul className="space-y-1 text-blue-700 text-xs">
              <li>1. Select a recipient above</li>
              <li>2. Drag field types onto the document</li>
              <li>3. Click fields to select and resize them</li>
              <li>4. Fields are automatically assigned to the selected recipient</li>
            </ul>
          </div>
        </div>
        
        {/* Field legend */}
        {recipients.length > 0 && (
          <div className="mt-4 space-y-2">
            <div className="text-sm font-medium">Field Assignment:</div>
            {recipients.filter(r => r.role === 'signer').map((recipient, index) => (
              <div key={recipient.id} className="flex items-center gap-2 text-xs">
                <div 
                  className={`w-3 h-3 rounded-full bg-${getRecipientColor(index)}-500`} 
                />
                <span className="font-medium">{recipient.name}</span>
                <span className="text-gray-600">({recipient.email})</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}