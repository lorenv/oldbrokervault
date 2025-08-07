import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { X, GripVertical } from "lucide-react";
import { getRecipientColor, getRecipientColorById } from "@/lib/types";
import type { SignatureField, Recipient } from "@shared/schema";

interface FieldCanvasProps {
  fields: SignatureField[];
  recipients: Recipient[];
  onFieldDrop: (fieldType: string, x: number, y: number) => void;
  onFieldSelect: (field: SignatureField) => void;
  onFieldMove?: (fieldId: number, x: number, y: number) => void;
  onFieldResize?: (fieldId: number, width: number, height: number) => void;
  onFieldDelete?: (fieldId: number) => void;
  selectedField: SignatureField | null;
  containerRef: React.RefObject<HTMLDivElement> | null;
  pageNumber?: number; // Optional page number for template editor compatibility
}

interface DragState {
  type: 'move' | 'resize';
  fieldId: number;
  startX: number;
  startY: number;
  startWidth?: number;
  startHeight?: number;
  offsetX: number;
  offsetY: number;
}

export function FieldCanvas({
  fields,
  recipients,
  onFieldDrop,
  onFieldSelect,
  onFieldMove,
  onFieldResize,
  onFieldDelete,
  selectedField,
  pageNumber,
}: FieldCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [tempPosition, setTempPosition] = useState<{ x: number; y: number; width?: number; height?: number } | null>(null);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragState || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    if (dragState.type === 'move') {
      const newX = Math.max(0, currentX - dragState.offsetX);
      const newY = Math.max(0, currentY - dragState.offsetY);
      setTempPosition({ x: newX, y: newY });
    } else if (dragState.type === 'resize') {
      // Calculate resize based on distance from the bottom-right corner of the field
      const fieldRight = dragState.startX + (dragState.startWidth || 100);
      const fieldBottom = dragState.startY + (dragState.startHeight || 40);
      
      const newWidth = Math.max(50, currentX - dragState.startX);
      const newHeight = Math.max(30, currentY - dragState.startY);
      
      setTempPosition({ 
        x: dragState.startX, 
        y: dragState.startY, 
        width: newWidth, 
        height: newHeight 
      });
    }
  }, [dragState]);

  const handleMouseUp = useCallback(() => {
    if (dragState && tempPosition) {
      // Immediately update the UI, then persist to backend
      if (dragState.type === 'move' && onFieldMove) {
        onFieldMove(dragState.fieldId, tempPosition.x, tempPosition.y);
      } else if (dragState.type === 'resize' && onFieldResize && tempPosition.width && tempPosition.height) {
        onFieldResize(dragState.fieldId, tempPosition.width, tempPosition.height);
      }
    }
    setDragState(null);
    setTempPosition(null);
  }, [dragState, tempPosition, onFieldMove, onFieldResize]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.dataTransfer!.dropEffect = "copy";
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      
      const fieldType = e.dataTransfer!.getData("text/plain");
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      onFieldDrop(fieldType, x, y);
    };

    canvas.addEventListener("dragover", handleDragOver);
    canvas.addEventListener("drop", handleDrop);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      canvas.removeEventListener("dragover", handleDragOver);
      canvas.removeEventListener("drop", handleDrop);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp, onFieldDrop]);

  const getFieldColor = (recipientId: number) => {
    // Use direct ID-based color mapping for consistency
    const color = getRecipientColorById(recipientId);
    
    // Convert HSL colors to CSS classes for compatibility
    return {
      bg: "border-2",
      border: "border-current",
      text: "text-current",
      style: {
        backgroundColor: color.background,
        borderColor: color.border,
        color: color.text
      }
    };
  };

  const getFieldIcon = (type: string) => {
    switch (type) {
      case "signature": return "✍️";
      case "initials": return "📝";
      case "date": return "📅";
      case "text": return "✏️";
      case "checkbox": return "☐";
      case "name": return "👤";
      case "email": return "📧";
      default: return "📄";
    }
  };

  const startDrag = (field: SignatureField, type: 'move' | 'resize', e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    setDragState({
      type,
      fieldId: field.id,
      startX: field.x,
      startY: field.y,
      startWidth: field.width,
      startHeight: field.height,
      offsetX: type === 'move' ? mouseX - field.x : mouseX,
      offsetY: type === 'move' ? mouseY - field.y : mouseY,
    });
    
    onFieldSelect(field);
  };

  return (
    <div 
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-auto"
      style={{ zIndex: 10 }}
    >
      {fields.map((field) => {
        const colors = getFieldColor(field.recipientId);
        const isSelected = selectedField?.id === field.id;
        const isDragging = dragState?.fieldId === field.id;
        
        // Show temp position during dragging for real-time feedback, otherwise use field position
        const displayX = isDragging && tempPosition ? tempPosition.x : field.x;
        const displayY = isDragging && tempPosition ? tempPosition.y : field.y;
        const displayWidth = isDragging && tempPosition?.width ? tempPosition.width : field.width;
        const displayHeight = isDragging && tempPosition?.height ? tempPosition.height : field.height;
        
        // Calculate dynamic font size based on field dimensions - bigger default sizes
        const dynamicFontSize = Math.max(12, Math.min(24, Math.floor(displayHeight * 0.5)));
        
        return (
          <div
            key={field.id}
            className={`absolute border-2 rounded transition-all duration-100 ${
              isSelected 
                ? 'shadow-lg' 
                : 'hover:shadow-md'
            } ${isDragging ? 'cursor-grabbing z-20' : 'cursor-grab'}`}
            style={{
              top: `${displayY}px`,
              left: `${displayX}px`,
              width: `${displayWidth}px`,
              height: `${displayHeight}px`,
              backgroundColor: colors.style.backgroundColor,
              borderColor: colors.style.borderColor,
              color: colors.style.color,
            }}
            onMouseDown={(e) => startDrag(field, 'move', e)}
          >
            {/* Field Content */}
            <div className="flex items-center justify-between p-1 h-full">
              <span 
                className="font-medium truncate flex-1"
                style={{ fontSize: `${dynamicFontSize}px` }}
              >
                {getFieldIcon(field.type)} {field.type}
              </span>
              
              {/* Action Buttons */}
              <div className="flex items-center space-x-1">
                {isSelected && onFieldDelete && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 hover:bg-red-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      onFieldDelete(field.id);
                    }}
                  >
                    <X className="h-3 w-3 text-red-600" />
                  </Button>
                )}
              </div>
            </div>

            {/* Resize Handle - Bottom Right Corner */}
            {isSelected && onFieldResize && (
              <div
                className="absolute bottom-0 right-0 w-3 h-3 bg-blue-500 cursor-se-resize rounded-tl opacity-75 hover:opacity-100"
                onMouseDown={(e) => startDrag(field, 'resize', e)}
                style={{ transform: 'translate(50%, 50%)' }}
              >
                <GripVertical className="h-2 w-2 text-white" style={{ transform: 'rotate(45deg)' }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}