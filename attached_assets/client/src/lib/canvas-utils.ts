import type { 
  Position, 
  Dimensions, 
  FieldBounds, 
  FieldType, 
  ViewportState,
  DropTargetInfo,
  FIELD_TYPE_CONFIGS
} from "./types";
import { FIELD_TYPE_CONFIGS } from "./types";

/**
 * Canvas utility functions for document field positioning and interaction
 */

// Coordinate conversion functions
export function getRelativePosition(
  event: MouseEvent | TouchEvent,
  container: HTMLElement
): Position {
  const rect = container.getBoundingClientRect();
  
  if ('touches' in event) {
    const touch = event.touches[0] || event.changedTouches[0];
    return {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top
    };
  }
  
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
}

export function getScaledPosition(
  position: Position,
  zoom: number
): Position {
  return {
    x: position.x / (zoom / 100),
    y: position.y / (zoom / 100)
  };
}

export function getAbsolutePosition(
  relativePosition: Position,
  container: HTMLElement,
  viewport: ViewportState
): Position {
  return {
    x: relativePosition.x + viewport.scrollLeft,
    y: relativePosition.y + viewport.scrollTop
  };
}

// Field positioning functions
export function getFieldBounds(
  position: Position,
  fieldType: FieldType
): FieldBounds {
  const config = FIELD_TYPE_CONFIGS[fieldType];
  return {
    ...position,
    ...config.defaultDimensions
  };
}

export function snapToGrid(
  position: Position,
  gridSize: number = 10
): Position {
  return {
    x: Math.round(position.x / gridSize) * gridSize,
    y: Math.round(position.y / gridSize) * gridSize
  };
}

export function constrainToContainer(
  bounds: FieldBounds,
  containerDimensions: Dimensions
): FieldBounds {
  const constrainedX = Math.max(0, Math.min(bounds.x, containerDimensions.width - bounds.width));
  const constrainedY = Math.max(0, Math.min(bounds.y, containerDimensions.height - bounds.height));
  
  return {
    ...bounds,
    x: constrainedX,
    y: constrainedY
  };
}

// Collision detection
export function isPointInBounds(point: Position, bounds: FieldBounds): boolean {
  return (
    point.x >= bounds.x &&
    point.x <= bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y <= bounds.y + bounds.height
  );
}

export function boundsIntersect(bounds1: FieldBounds, bounds2: FieldBounds): boolean {
  return !(
    bounds1.x + bounds1.width < bounds2.x ||
    bounds2.x + bounds2.width < bounds1.x ||
    bounds1.y + bounds1.height < bounds2.y ||
    bounds2.y + bounds2.height < bounds1.y
  );
}

export function findFieldsAtPosition(
  position: Position,
  fields: Array<{ id: number; bounds: FieldBounds }>
): number[] {
  return fields
    .filter(field => isPointInBounds(position, field.bounds))
    .map(field => field.id);
}

// Page calculations
export function getPageFromPosition(
  position: Position,
  pageHeight: number,
  pageSpacing: number = 20
): number {
  const totalPageHeight = pageHeight + pageSpacing;
  return Math.floor(position.y / totalPageHeight) + 1;
}

export function getPositionOnPage(
  position: Position,
  pageNumber: number,
  pageHeight: number,
  pageSpacing: number = 20
): Position {
  const totalPageHeight = pageHeight + pageSpacing;
  const pageStartY = (pageNumber - 1) * totalPageHeight;
  
  return {
    x: position.x,
    y: position.y - pageStartY
  };
}

// Validation functions
export function isValidDropTarget(
  position: Position,
  fieldType: FieldType,
  existingFields: Array<{ bounds: FieldBounds }>,
  containerDimensions: Dimensions
): DropTargetInfo {
  const bounds = getFieldBounds(position, fieldType);
  const constrainedBounds = constrainToContainer(bounds, containerDimensions);
  
  // Check if position was modified by constraints
  const isWithinContainer = 
    bounds.x === constrainedBounds.x && 
    bounds.y === constrainedBounds.y;
  
  // Check for overlaps with existing fields
  const hasOverlap = existingFields.some(field => 
    boundsIntersect(constrainedBounds, field.bounds)
  );
  
  const pageNumber = getPageFromPosition(position, containerDimensions.height);
  
  return {
    pageNumber,
    bounds: constrainedBounds,
    isValid: isWithinContainer && !hasOverlap
  };
}

// Canvas drawing utilities
export function clearCanvas(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

export function drawFieldOutline(
  canvas: HTMLCanvasElement,
  bounds: FieldBounds,
  color: string = "#3b82f6",
  dashPattern: number[] = []
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash(dashPattern);
  
  ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
  
  ctx.restore();
}

export function drawDropZone(
  canvas: HTMLCanvasElement,
  bounds: FieldBounds,
  isValid: boolean = true
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  
  const color = isValid ? "#10b981" : "#ef4444";
  const alpha = 0.2;
  
  ctx.save();
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
  
  ctx.globalAlpha = 1;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
  
  ctx.restore();
}

// Document zoom utilities
export function calculateZoomToFit(
  documentDimensions: Dimensions,
  containerDimensions: Dimensions,
  padding: number = 40
): number {
  const availableWidth = containerDimensions.width - padding * 2;
  const availableHeight = containerDimensions.height - padding * 2;
  
  const scaleX = availableWidth / documentDimensions.width;
  const scaleY = availableHeight / documentDimensions.height;
  
  return Math.min(scaleX, scaleY) * 100; // Convert to percentage
}

export function calculateZoomToFitWidth(
  documentWidth: number,
  containerWidth: number,
  padding: number = 40
): number {
  const availableWidth = containerWidth - padding * 2;
  return (availableWidth / documentWidth) * 100;
}

// Selection utilities
export function getSelectionBounds(fieldBounds: FieldBounds[]): FieldBounds | null {
  if (fieldBounds.length === 0) return null;
  
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  
  fieldBounds.forEach(bounds => {
    minX = Math.min(minX, bounds.x);
    minY = Math.min(minY, bounds.y);
    maxX = Math.max(maxX, bounds.x + bounds.width);
    maxY = Math.max(maxY, bounds.y + bounds.height);
  });
  
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}

// Field ordering utilities
export function orderFieldsByPosition(
  fields: Array<{ id: number; bounds: FieldBounds }>
): number[] {
  return fields
    .sort((a, b) => {
      // Sort by Y position first (top to bottom)
      if (Math.abs(a.bounds.y - b.bounds.y) > 10) {
        return a.bounds.y - b.bounds.y;
      }
      // Then by X position (left to right)
      return a.bounds.x - b.bounds.x;
    })
    .map(field => field.id);
}

// Touch and mouse event utilities
export function getTouchPosition(event: TouchEvent): Position | null {
  if (event.touches.length === 0 && event.changedTouches.length === 0) {
    return null;
  }
  
  const touch = event.touches[0] || event.changedTouches[0];
  return {
    x: touch.clientX,
    y: touch.clientY
  };
}

export function preventDefaultForTouchEvents(element: HTMLElement): void {
  element.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
  element.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  element.addEventListener('touchend', (e) => e.preventDefault(), { passive: false });
}

// Performance utilities
export function debounce<T extends (...args: any[]) => void>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(null, args), delay);
  };
}

export function throttle<T extends (...args: any[]) => void>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func.apply(null, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// Export commonly used constants
export const CANVAS_CONSTANTS = {
  DEFAULT_GRID_SIZE: 10,
  MIN_FIELD_SIZE: { width: 20, height: 20 },
  MAX_FIELD_SIZE: { width: 500, height: 200 },
  PAGE_SPACING: 20,
  ZOOM_STEP: 25,
  MIN_ZOOM: 25,
  MAX_ZOOM: 300
} as const;
