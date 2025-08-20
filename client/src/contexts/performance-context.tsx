/**
 * Performance Context Provider
 * Provides performance optimizations and monitoring across the app
 */

import React, { createContext, useContext, useEffect, useRef, ReactNode } from 'react';

interface PerformanceMetrics {
  renderCount: Map<string, number>;
  slowComponents: Set<string>;
  memoryUsage?: number;
  fps?: number;
}

interface PerformanceContextType {
  trackRender: (componentName: string) => void;
  reportSlowRender: (componentName: string, duration: number) => void;
  getMetrics: () => PerformanceMetrics;
  enableOptimizations: () => void;
  disableOptimizations: () => void;
}

const PerformanceContext = createContext<PerformanceContextType | null>(null);

export function usePerformance() {
  const context = useContext(PerformanceContext);
  if (!context) {
    throw new Error('usePerformance must be used within PerformanceProvider');
  }
  return context;
}

interface PerformanceProviderProps {
  children: ReactNode;
  enableMonitoring?: boolean;
  slowRenderThreshold?: number; // milliseconds
}

export function PerformanceProvider({
  children,
  enableMonitoring = process.env.NODE_ENV === 'development',
  slowRenderThreshold = 16 // One frame at 60fps
}: PerformanceProviderProps) {
  const metrics = useRef<PerformanceMetrics>({
    renderCount: new Map(),
    slowComponents: new Set()
  });

  const optimizationsEnabled = useRef(true);
  const frameCountRef = useRef(0);
  const lastFrameTime = useRef(performance.now());

  // FPS monitoring
  useEffect(() => {
    if (!enableMonitoring) return;

    let animationFrameId: number;

    const measureFPS = () => {
      frameCountRef.current++;
      const currentTime = performance.now();
      const delta = currentTime - lastFrameTime.current;

      if (delta >= 1000) {
        metrics.current.fps = Math.round((frameCountRef.current * 1000) / delta);
        frameCountRef.current = 0;
        lastFrameTime.current = currentTime;
      }

      animationFrameId = requestAnimationFrame(measureFPS);
    };

    animationFrameId = requestAnimationFrame(measureFPS);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [enableMonitoring]);

  // Memory monitoring (if available)
  useEffect(() => {
    if (!enableMonitoring) return;

    const measureMemory = async () => {
      // @ts-ignore - performance.memory is not standard but available in Chrome
      if (performance.memory) {
        // @ts-ignore
        metrics.current.memoryUsage = performance.memory.usedJSHeapSize / 1048576; // Convert to MB
      }
    };

    const interval = setInterval(measureMemory, 5000); // Check every 5 seconds

    return () => {
      clearInterval(interval);
    };
  }, [enableMonitoring]);

  const trackRender = (componentName: string) => {
    if (!enableMonitoring) return;

    const count = metrics.current.renderCount.get(componentName) || 0;
    metrics.current.renderCount.set(componentName, count + 1);

    // Warn about excessive renders
    if (count > 50 && count % 10 === 0) {
      console.warn(
        `[Performance Warning] ${componentName} has rendered ${count} times`
      );
    }
  };

  const reportSlowRender = (componentName: string, duration: number) => {
    if (!enableMonitoring) return;

    if (duration > slowRenderThreshold) {
      metrics.current.slowComponents.add(componentName);
      console.warn(
        `[Performance Warning] ${componentName} rendered slowly (${duration.toFixed(
          2
        )}ms)`
      );
    }
  };

  const getMetrics = () => metrics.current;

  const enableOptimizations = () => {
    optimizationsEnabled.current = true;
    
    // Apply global optimizations
    if (typeof window !== 'undefined') {
      // Disable React DevTools in production
      if (process.env.NODE_ENV === 'production') {
        // @ts-ignore
        if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
          // @ts-ignore
          window.__REACT_DEVTOOLS_GLOBAL_HOOK__.inject = () => {};
        }
      }

      // Enable passive event listeners for better scroll performance
      const originalAddEventListener = EventTarget.prototype.addEventListener;
      EventTarget.prototype.addEventListener = function(
        type: string,
        listener: any,
        options: any
      ) {
        if (type === 'touchstart' || type === 'wheel' || type === 'scroll') {
          if (typeof options === 'object') {
            options.passive = true;
          } else {
            options = { passive: true, capture: options };
          }
        }
        return originalAddEventListener.call(this, type, listener, options);
      };
    }
  };

  const disableOptimizations = () => {
    optimizationsEnabled.current = false;
  };

  // Apply optimizations on mount
  useEffect(() => {
    if (optimizationsEnabled.current) {
      enableOptimizations();
    }
  }, []);

  // Log metrics periodically in development
  useEffect(() => {
    if (!enableMonitoring) return;

    const logMetrics = () => {
      const currentMetrics = getMetrics();
      
      if (currentMetrics.renderCount.size > 0) {
        console.group('[Performance Metrics]');
        console.log('FPS:', currentMetrics.fps || 'N/A');
        console.log('Memory:', currentMetrics.memoryUsage?.toFixed(2) + ' MB' || 'N/A');
        console.log('Render Counts:', Object.fromEntries(currentMetrics.renderCount));
        
        if (currentMetrics.slowComponents.size > 0) {
          console.log('Slow Components:', Array.from(currentMetrics.slowComponents));
        }
        console.groupEnd();
      }
    };

    const interval = setInterval(logMetrics, 30000); // Log every 30 seconds

    return () => {
      clearInterval(interval);
    };
  }, [enableMonitoring]);

  const value: PerformanceContextType = {
    trackRender,
    reportSlowRender,
    getMetrics,
    enableOptimizations,
    disableOptimizations
  };

  return (
    <PerformanceContext.Provider value={value}>
      {children}
    </PerformanceContext.Provider>
  );
}

/**
 * HOC to wrap components with performance tracking
 */
export function withPerformanceTracking<P extends object>(
  Component: React.ComponentType<P>,
  componentName: string
) {
  return React.memo((props: P) => {
    const performance = usePerformance();
    const renderStart = useRef(0);

    useEffect(() => {
      performance.trackRender(componentName);
      const renderDuration = performance.now() - renderStart.current;
      performance.reportSlowRender(componentName, renderDuration);
    });

    renderStart.current = performance.now();

    return <Component {...props} />;
  });
}