import { lazy, Suspense } from "react";
import { DocumentSkeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";

// Lazy load heavy components
export const LazyDocumentExport = lazy(() => 
  import("@/components/document-export").then(module => ({ 
    default: module.DocumentExport 
  }))
);

export const LazyCimDisplay = lazy(() => 
  import("@/components/cim-display").then(module => ({ 
    default: module.CimDisplay 
  }))
);

export const LazyCimGenerator = lazy(() => 
  import("@/components/cim-generator").then(module => ({ 
    default: module.CimGenerator 
  }))
);

export const LazyFinancialsSection = lazy(() => 
  import("@/components/financials-section").then(module => ({ 
    default: module.FinancialsSection 
  }))
);

// Wrapper components with loading states
export function DocumentExportWithSuspense(props: any) {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2">Loading export options...</span>
      </div>
    }>
      <LazyDocumentExport {...props} />
    </Suspense>
  );
}

export function CimDisplayWithSuspense(props: any) {
  return (
    <Suspense fallback={<DocumentSkeleton lines={12} />}>
      <LazyCimDisplay {...props} />
    </Suspense>
  );
}

export function CimGeneratorWithSuspense(props: any) {
  return (
    <Suspense fallback={
      <div className="space-y-4">
        <div className="h-10 bg-muted animate-pulse rounded" />
        <div className="h-32 bg-muted animate-pulse rounded" />
        <div className="h-10 bg-muted animate-pulse rounded" />
      </div>
    }>
      <LazyCimGenerator {...props} />
    </Suspense>
  );
}

export function FinancialsSectionWithSuspense(props: any) {
  return (
    <Suspense fallback={
      <div className="space-y-4">
        <div className="h-6 bg-muted animate-pulse rounded w-1/3" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 bg-muted animate-pulse rounded" />
          ))}
        </div>
      </div>
    }>
      <LazyFinancialsSection {...props} />
    </Suspense>
  );
}