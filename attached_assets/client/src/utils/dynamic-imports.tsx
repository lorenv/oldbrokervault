import { lazy, ComponentType } from "react";

// Create a higher-order component for dynamic imports with error boundaries
export function createDynamicComponent<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  fallback?: React.ReactNode
) {
  const Component = lazy(importFn);
  
  return function DynamicComponent(props: React.ComponentProps<T>) {
    return (
      <Component {...props} />
    );
  };
}

// Dynamically import heavy libraries only when needed
export const dynamicImports = {
  // PDF processing libraries
  loadPDFKit: () => import("pdfkit"),
  loadJSPDF: () => import("jspdf"),
  
  // Chart libraries (if needed)
  loadRecharts: () => import("recharts"),
  
  // Date processing
  loadDateFns: () => import("date-fns"),
  
  // Form libraries
  loadHookForm: () => import("react-hook-form"),
  
  // Heavy UI components
  loadDataTable: () => import("@/components/ui/data-table"),
  loadCalendar: () => import("@/components/ui/calendar"),
};