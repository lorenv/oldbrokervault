import React, { useRef, useCallback, useState, useEffect } from 'react';
import { useDrop } from 'react-dnd';
import { EnhancedSignatureField, FieldRenderer, DEFAULT_FIELD_DIMENSIONS } from './enhanced-signature-field';
import { NdaRecipient } from '@shared/schema';

interface CanvasOverlayProps {
  pageNumber: number;
  fields: EnhancedSignatureField[];
  recipients: NdaRecipient[];
  onFieldsChange: (fields: EnhancedSignatureField[]) => void;
  onFieldSelect: (field: EnhancedSignatureField | null) => void;
  selectedField: EnhancedSignatureField | null;
  imageWidth: number;
  imageHeight: number;
  scale?: number;
  snapToGrid?: boolean;
  showGrid?: boolean;
  isReadOnly?: boolean;
}

export default function CanvasOverlay({
  pageNumber,
  fields,
  recipients,
  onFieldsChange,
  onFieldSelect,
  selectedField,
  imageWidth,
  imageHeight,
  scale = 1,
  snapToGrid = true,
  showGrid = false,
  isReadOnly = false
}: CanvasOverlayProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Grid configuration
  const gridSize = 20; // pixels
  const snapThreshold = 10; // pixels

  // Snap coordinate to grid
  const snapToGridFunc = useCallback((coord: number, dimension: number) => {
    if (!snapToGrid) return coord;
    const snapped = Math.round(coord / gridSize) * gridSize;
    return Math.max(0, Math.min(snapped, dimension - gridSize));
  }, [snapToGrid, gridSize]);

  // Convert pixel coordinates to percentage
  const pixelToPercent = useCallback((pixelX: number, pixelY: number) => {
    return {
      x: (pixelX / imageWidth) * 100,
      y: (pixelY / imageHeight) * 100
    };
  }, [imageWidth, imageHeight]);

  // Convert percentage coordinates to pixels
  const percentToPixel = useCallback((percentX: number, percentY: number) => {
    return {
      x: (percentX / 100) * imageWidth,
      y: (percentY / 100) * imageHeight
    };
  }, [imageWidth, imageHeight]);

  // Drop handler for new fields from palette
  const [{ isOver, canDrop }, drop] = useDrop({
    accept: 'FIELD_TYPE',
    drop: (item: { type: string; recipientId?: string }, monitor) => {
      if (!canvasRef.current) return;

      const offset = monitor.getClientOffset();
      if (!offset) return;

      const canvasRect = canvasRef.current.getBoundingClientRect();
      const x = offset.x - canvasRect.left;
      const y = offset.y - canvasRect.top;

      // Snap to grid if enabled
      const snappedX = snapToGridFunc(x, imageWidth);
      const snappedY = snapToGridFunc(y, imageHeight);

      // Convert to percentage coordinates
      const percentCoords = pixelToPercent(snappedX, snappedY);

      // Get default dimensions for field type
      const dimensions = DEFAULT_FIELD_DIMENSIONS[item.type as keyof typeof DEFAULT_FIELD_DIMENSIONS] 
        || { width: 15, height: 3 };

      // Create new field
      const newField: EnhancedSignatureField = {
        id: `field_${Date.now()}`,
        type: item.type as any,
        label: `${item.type.charAt(0).toUpperCase() + item.type.slice(1)} Field`,
        x: percentCoords.x,
        y: percentCoords.y,
        width: dimensions.width,
        height: dimensions.height,
        pageNumber,
        required: true,
        fontSize: 12,
        assignedTo: item.recipientId || recipients[0]?.id?.toString(),
        prefilled: false,
      };

      const updatedFields = [...fields, newField];
      onFieldsChange(updatedFields);
      onFieldSelect(newField);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  });

  // Handle field movement
  const handleFieldMouseDown = useCallback((e: React.MouseEvent, field: EnhancedSignatureField) => {
    if (isReadOnly) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const fieldPixelCoords = percentToPixel(field.x, field.y);
    const offsetX = e.clientX - rect.left - fieldPixelCoords.x;
    const offsetY = e.clientY - rect.top - fieldPixelCoords.y;

    setDragOffset({ x: offsetX, y: offsetY });
    setIsDragging(true);
    onFieldSelect(field);

    const handleMouseMove = (e: MouseEvent) => {
      if (!canvasRef.current) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left - offsetX;
      const y = e.clientY - rect.top - offsetY;

      // Snap to grid
      const snappedX = snapToGridFunc(x, imageWidth);
      const snappedY = snapToGridFunc(y, imageHeight);

      // Convert to percentage
      const percentCoords = pixelToPercent(snappedX, snappedY);

      // Update field position
      const updatedFields = fields.map(f =>
        f.id === field.id ? { ...f, x: percentCoords.x, y: percentCoords.y } : f
      );
      onFieldsChange(updatedFields);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [fields, onFieldsChange, onFieldSelect, snapToGridFunc, pixelToPercent, percentToPixel, isReadOnly]);

  // Handle field resizing
  const handleFieldResize = useCallback((field: EnhancedSignatureField, direction: string, e: React.MouseEvent) => {
    if (isReadOnly) return;
    
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = field.width;
    const startHeight = field.height;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = ((e.clientX - startX) / imageWidth) * 100;
      const deltaY = ((e.clientY - startY) / imageHeight) * 100;

      let newWidth = startWidth;
      let newHeight = startHeight;

      if (direction.includes('right')) {
        newWidth = Math.max(5, startWidth + deltaX);
      }
      if (direction.includes('bottom')) {
        newHeight = Math.max(2, startHeight + deltaY);
      }

      const updatedFields = fields.map(f =>
        f.id === field.id ? { ...f, width: newWidth, height: newHeight } : f
      );
      onFieldsChange(updatedFields);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [fields, onFieldsChange, imageWidth, imageHeight, isReadOnly]);

  // Canvas click handler
  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if (e.target === canvasRef.current) {
      onFieldSelect(null);
    }
  }, [onFieldSelect]);

  // Get recipient color for field
  const getRecipientColor = (assignedTo?: string) => {
    if (!assignedTo) return 'border-gray-400 bg-gray-50';
    const recipientIndex = recipients.findIndex(r => r.id?.toString() === assignedTo);
    const colors = ['blue', 'green', 'purple', 'orange', 'pink', 'indigo'];
    const color = colors[recipientIndex % colors.length] || 'gray';
    return `border-${color}-500 bg-${color}-50`;
  };

  // Grid overlay
  const renderGrid = () => {
    if (!showGrid) return null;

    const horizontalLines = [];
    const verticalLines = [];

    for (let i = 0; i <= imageHeight; i += gridSize) {
      horizontalLines.push(
        <line
          key={`h-${i}`}
          x1={0}
          y1={i}
          x2={imageWidth}
          y2={i}
          stroke="#e5e7eb"
          strokeWidth={0.5}
          opacity={0.5}
        />
      );
    }

    for (let i = 0; i <= imageWidth; i += gridSize) {
      verticalLines.push(
        <line
          key={`v-${i}`}
          x1={i}
          y1={0}
          x2={i}
          y2={imageHeight}
          stroke="#e5e7eb"
          strokeWidth={0.5}
          opacity={0.5}
        />
      );
    }

    return (
      <svg
        className="absolute inset-0 pointer-events-none"
        width={imageWidth}
        height={imageHeight}
        style={{ zIndex: 1 }}
      >
        {horizontalLines}
        {verticalLines}
      </svg>
    );
  };

  // Combine drop ref with canvas ref
  const combinedRef = useCallback((node: HTMLDivElement | null) => {
    if (canvasRef.current !== node) {
      (canvasRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    }
    drop(node);
  }, [drop]);

  return (
    <div
      ref={combinedRef}
      className={`absolute inset-0 cursor-crosshair ${isOver && canDrop ? 'bg-blue-50/30' : ''}`}
      style={{ 
        width: '100%', 
        height: '100%',
        minHeight: imageHeight,
        pointerEvents: 'auto'
      }}
      onClick={handleCanvasClick}
    >
      {/* Grid overlay */}
      {renderGrid()}

      {/* Fields for this page */}
      {fields
        .filter(field => field.pageNumber === pageNumber)
        .map(field => (
          <div
            key={field.id}
            className="absolute"
            style={{
              left: `${field.x}%`,
              top: `${field.y}%`,
              width: `${field.width}%`,
              height: `${field.height}%`,
              zIndex: selectedField?.id === field.id ? 10 : 5,
            }}
          >
            {/* Field content */}
            <div
              className={`
                w-full h-full border-2 rounded cursor-move transition-all duration-200
                ${getRecipientColor(field.assignedTo)}
                ${selectedField?.id === field.id ? 'ring-2 ring-blue-400 shadow-lg' : ''}
                ${!isReadOnly ? 'hover:shadow-md' : ''}
              `}
              onMouseDown={(e) => handleFieldMouseDown(e, field)}
              title={field.tooltip || `${field.label} (${recipients.find(r => r.id?.toString() === field.assignedTo)?.name || 'Unassigned'})`}
            >
              <FieldRenderer
                field={field}
                isEditing={true}
                isHighlighted={selectedField?.id === field.id}
                scale={scale}
              />
            </div>

            {/* Resize handles */}
            {selectedField?.id === field.id && !isReadOnly && (
              <>
                {/* Bottom-right resize handle */}
                <div
                  className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-500 border border-white rounded cursor-se-resize"
                  onMouseDown={(e) => handleFieldResize(field, 'bottom-right', e)}
                />
                {/* Bottom resize handle */}
                <div
                  className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-3 h-2 bg-blue-500 border border-white rounded cursor-s-resize"
                  onMouseDown={(e) => handleFieldResize(field, 'bottom', e)}
                />
                {/* Right resize handle */}
                <div
                  className="absolute -right-1 top-1/2 transform -translate-y-1/2 w-2 h-3 bg-blue-500 border border-white rounded cursor-e-resize"
                  onMouseDown={(e) => handleFieldResize(field, 'right', e)}
                />
              </>
            )}

            {/* Field assignment indicator */}
            {field.assignedTo && (
              <div className="absolute -top-6 left-0 text-xs bg-white px-2 py-1 rounded shadow border">
                {recipients.find(r => r.id?.toString() === field.assignedTo)?.name || 'Unknown'}
              </div>
            )}
          </div>
        ))}

      {/* Drop overlay */}
      {isOver && canDrop && (
        <div className="absolute inset-0 bg-blue-100 bg-opacity-50 border-2 border-dashed border-blue-400 flex items-center justify-center pointer-events-none">
          <div className="bg-blue-500 text-white px-4 py-2 rounded shadow">
            Drop field here
          </div>
        </div>
      )}
    </div>
  );
}