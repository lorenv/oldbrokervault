import { useEffect, useCallback } from "react";

interface PerformanceMetrics {
  loadTime: number;
  renderTime: number;
  memoryUsage?: number;
}

export function usePerformanceMonitoring(componentName: string) {
  const startTime = performance.now();

  useEffect(() => {
    const endTime = performance.now();
    const renderTime = endTime - startTime;

    // Only log in development
    if (process.env.NODE_ENV === 'development') {
      
      // Memory usage if available
      if ('memory' in performance) {
        const memory = (performance as any).memory;
      }
    }
  }, [componentName, startTime]);

  const measureFunction = useCallback(<T extends (...args: any[]) => any>(
    fn: T,
    functionName: string
  ): T => {
    return ((...args: any[]) => {
      const start = performance.now();
      const result = fn(...args);
      const end = performance.now();
      
      if (process.env.NODE_ENV === 'development') {
      }
      
      return result;
    }) as T;
  }, []);

  return { measureFunction };
}

// Image optimization utilities
export function optimizeImageLoading() {
  const lazyLoadImages = useCallback(() => {
    const images = document.querySelectorAll('img[data-src]');
    const imageObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement;
          img.src = img.dataset.src!;
          img.removeAttribute('data-src');
          imageObserver.unobserve(img);
        }
      });
    });

    images.forEach(img => imageObserver.observe(img));
    return () => imageObserver.disconnect();
  }, []);

  return { lazyLoadImages };
}