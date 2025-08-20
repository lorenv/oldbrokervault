/**
 * Optimized List Component
 * Provides virtualization and performance optimizations for large lists
 */

import React, { memo, useCallback, useMemo } from 'react';
import { useVirtualList } from '@/lib/performance-utils';

interface OptimizedListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  itemHeight: number;
  containerHeight?: number;
  className?: string;
  getItemKey: (item: T, index: number) => string | number;
  emptyMessage?: string;
}

function OptimizedListComponent<T>({
  items,
  renderItem,
  itemHeight,
  containerHeight = 600,
  className = '',
  getItemKey,
  emptyMessage = 'No items to display'
}: OptimizedListProps<T>) {
  const {
    visibleItems,
    totalHeight,
    offsetY,
    handleScroll,
    startIndex
  } = useVirtualList(items, itemHeight, containerHeight);

  const containerStyle = useMemo(
    () => ({
      height: containerHeight,
      overflow: 'auto' as const,
      position: 'relative' as const
    }),
    [containerHeight]
  );

  const innerStyle = useMemo(
    () => ({
      height: totalHeight,
      position: 'relative' as const
    }),
    [totalHeight]
  );

  const itemsStyle = useMemo(
    () => ({
      transform: `translateY(${offsetY}px)`,
      position: 'absolute' as const,
      top: 0,
      left: 0,
      right: 0
    }),
    [offsetY]
  );

  if (items.length === 0) {
    return (
      <div className={`flex items-center justify-center h-${containerHeight} ${className}`}>
        <p className="text-gray-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div
      className={className}
      style={containerStyle}
      onScroll={handleScroll}
    >
      <div style={innerStyle}>
        <div style={itemsStyle}>
          {visibleItems.map((item, index) => {
            const actualIndex = startIndex + index;
            return (
              <div
                key={getItemKey(item, actualIndex)}
                style={{ height: itemHeight }}
              >
                {renderItem(item, actualIndex)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Memoize the component to prevent unnecessary re-renders
export const OptimizedList = memo(OptimizedListComponent) as typeof OptimizedListComponent;