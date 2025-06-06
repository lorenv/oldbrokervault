import { useState, useRef, useCallback } from "react";
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
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [initialPosition, setInitialPosition] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (disabled) return;
    
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setInitialPosition(position);
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [position, disabled]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;

    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    
    // Calculate movement as percentage of container size
    const deltaX = ((e.clientX - dragStart.x) / rect.width) * 100;
    const deltaY = ((e.clientY - dragStart.y) / rect.height) * 100;
    
    // Apply movement to initial position and clamp to 0-100%
    const newX = Math.max(0, Math.min(100, initialPosition.x + deltaX));
    const newY = Math.max(0, Math.min(100, initialPosition.y + deltaY));
    
    onPositionChange({ x: newX, y: newY });
  }, [isDragging, dragStart, initialPosition, onPositionChange]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled) return;
    
    e.preventDefault();
    const touch = e.touches[0];
    setIsDragging(true);
    setDragStart({ x: touch.clientX, y: touch.clientY });
    setInitialPosition(position);
  }, [position, disabled]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging || !containerRef.current) return;

    e.preventDefault();
    const touch = e.touches[0];
    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    
    const deltaX = ((touch.clientX - dragStart.x) / rect.width) * 100;
    const deltaY = ((touch.clientY - dragStart.y) / rect.height) * 100;
    
    const newX = Math.max(0, Math.min(100, initialPosition.x + deltaX));
    const newY = Math.max(0, Math.min(100, initialPosition.y + deltaY));
    
    onPositionChange({ x: newX, y: newY });
  }, [isDragging, dragStart, initialPosition, onPositionChange]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    <div className={`relative group ${className}`}>
      <div 
        ref={containerRef}
        className={`relative w-full h-32 bg-gray-100 rounded-lg overflow-hidden cursor-${disabled ? 'not-allowed' : 'move'} ${isDragging ? 'cursor-grabbing' : ''}`}
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
        
        {/* Overlay gradient for visual appeal */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-white opacity-30 pointer-events-none" />
        
        {/* Drag indicator */}
        {!disabled && (
          <div className={`absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-md transition-opacity ${isDragging || containerRef.current ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
            <Move className="h-3 w-3" />
          </div>
        )}
        
        {/* Position indicator dot */}
        <div 
          className="absolute w-2 h-2 bg-blue-500 border border-white rounded-full shadow-sm pointer-events-none transform -translate-x-1 -translate-y-1"
          style={{
            left: `${position.x}%`,
            top: `${position.y}%`
          }}
        />
      </div>
      
      {!disabled && (
        <div className="mt-2 text-xs text-gray-500 text-center">
          Click and drag to reposition the image
        </div>
      )}
    </div>
  );
}