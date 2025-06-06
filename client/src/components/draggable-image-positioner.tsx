import { useState, useRef, useCallback, useEffect } from "react";
import { Move } from "lucide-react";

interface DraggableImagePositionerProps {
  imageUrl: string;
  position: { x: number; y: number };
  onPositionChange: (position: { x: number; y: number }) => void;
  className?: string;
  disabled?: boolean;
}

export function DraggableImagePositioner({
  imageUrl,
  position,
  onPositionChange,
  className = "",
  disabled = false
}: DraggableImagePositionerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragDataRef = useRef({ startX: 0, startY: 0, startPosition: { x: 0, y: 0 } });

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;

    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    
    // Calculate movement as percentage
    const deltaX = ((e.clientX - dragDataRef.current.startX) / rect.width) * 100;
    const deltaY = ((e.clientY - dragDataRef.current.startY) / rect.height) * 100;
    
    // Apply movement and clamp to 0-100%
    const newX = Math.max(0, Math.min(100, dragDataRef.current.startPosition.x + deltaX));
    const newY = Math.max(0, Math.min(100, dragDataRef.current.startPosition.y + deltaY));
    
    onPositionChange({ x: newX, y: newY });
  }, [isDragging, onPositionChange]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (disabled) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    dragDataRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPosition: { ...position }
    };
    
    setIsDragging(true);
  }, [position, disabled]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled) return;
    
    e.preventDefault();
    const touch = e.touches[0];
    
    dragDataRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      startPosition: { ...position }
    };
    
    setIsDragging(true);
  }, [position, disabled]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging || !containerRef.current) return;

    e.preventDefault();
    const touch = e.touches[0];
    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    
    const deltaX = ((touch.clientX - dragDataRef.current.startX) / rect.width) * 100;
    const deltaY = ((touch.clientY - dragDataRef.current.startY) / rect.height) * 100;
    
    const newX = Math.max(0, Math.min(100, dragDataRef.current.startPosition.x + deltaX));
    const newY = Math.max(0, Math.min(100, dragDataRef.current.startPosition.y + deltaY));
    
    onPositionChange({ x: newX, y: newY });
  }, [isDragging, onPositionChange]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    <div className={`relative group ${className}`}>
      <div 
        ref={containerRef}
        className={`relative w-full h-32 bg-gray-100 rounded-lg overflow-hidden select-none ${
          disabled ? 'cursor-not-allowed' : isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <img 
          src={imageUrl}
          alt="Cover image"
          className="w-full h-full object-cover select-none pointer-events-none"
          style={{
            objectPosition: `${position.x}% ${position.y}%`
          }}
          draggable={false}
        />
        
        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-white opacity-30 pointer-events-none" />
        
        {/* Drag indicator */}
        {!disabled && (
          <div className={`absolute top-2 right-2 p-1.5 bg-black/60 text-white rounded-md transition-opacity ${
            isDragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}>
            <Move className="h-3 w-3" />
          </div>
        )}
        

      </div>
      
      {!disabled && (
        <div className="mt-2 text-xs text-gray-500 text-center">
          Click and drag to reposition the image • Position: {Math.round(position.x)}%, {Math.round(position.y)}%
        </div>
      )}
    </div>
  );
}