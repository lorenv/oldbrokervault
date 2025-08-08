import React from 'react';
import { useDrag } from 'react-dnd';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ENHANCED_FIELD_TYPES } from './enhanced-signature-field';
import { Palette, GripVertical, PenTool, Type, User, Calendar, Mail, FileText, Square } from 'lucide-react';

interface NdaFieldPaletteProps {
  className?: string;
}

interface DraggableFieldProps {
  type: string;
  label: string;
  icon: string;
  description: string;
}

function DraggableField({ type, label, icon, description }: DraggableFieldProps) {
  const [{ isDragging }, drag] = useDrag({
    type: 'FIELD_TYPE',
    item: { type, recipientId: '999999' }, // Auto-assign to the NDA signer
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

  return (
    <div
      ref={drag}
      className={`
        flex items-center gap-3 p-3 border rounded-lg cursor-grab transition-all duration-200
        bg-white hover:shadow-sm hover:bg-blue-50 hover:border-blue-300
        ${isDragging ? 'opacity-50 scale-95 border-blue-300' : 'opacity-100 border-gray-200'}
      `}
      title={description}
    >
      <GripVertical className="w-4 h-4 text-gray-400" />
      <div className="w-8 h-8 rounded flex items-center justify-center bg-blue-50 border border-blue-200">
        {IconComponent && <IconComponent className="w-4 h-4 text-blue-600" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm text-gray-900 truncate">{label}</div>
        <div className="text-xs text-gray-500 truncate">{description}</div>
      </div>
    </div>
  );
}

export default function NdaFieldPalette({ className = '' }: NdaFieldPaletteProps) {
  return (
    <Card className={className}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-xl">
          <Palette className="w-6 h-6" />
          Signature Fields
        </CardTitle>
        <p className="text-sm text-gray-600 mt-2">
          Drag fields onto the document to place them for the NDA signer
        </p>
      </CardHeader>

      <CardContent className="space-y-2">
        <div className="text-xs text-gray-600 mb-3 px-1">
          All fields will be assigned to the designated NDA signer
        </div>

        {ENHANCED_FIELD_TYPES.map((fieldType) => (
          <DraggableField
            key={fieldType.type}
            type={fieldType.type}
            label={fieldType.label}
            icon={fieldType.icon}
            description={fieldType.description}
          />
        ))}

        
      </CardContent>
    </Card>
  );
}