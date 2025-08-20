import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/app-layout";
import { useAuth } from "@/hooks/useAuth";
import { lazy, Suspense } from "react";
import { PerformanceProvider } from "@/contexts/performance-context";

// Lazy load all pages to reduce initial bundle size
const Dashboard = lazy(() => import("@/pages/dashboard"));
const Documents = lazy(() => import("@/pages/documents"));
const Templates = lazy(() => import("@/pages/templates"));
const TemplateEditor = lazy(() => import("@/pages/template-editor"));
const Settings = lazy(() => import("@/pages/settings"));
const DocumentEditor = lazy(() => import("@/pages/document-editor"));
const DocumentSigner = lazy(() => import("@/pages/document-signer"));
const MigrationPage = lazy(() => import("@/pages/migration"));
const Landing = lazy(() => import("@/pages/landing"));
const Login = lazy(() => import("@/pages/login"));
const NotFound = lazy(() => import("@/pages/not-found"));

// Loading component for lazy-loaded pages
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <p className="text-slate-600">Loading...</p>
    </div>
  </div>
);

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      {/* Public routes - no authentication required */}
      <Route path="/sign/:token">
        <Suspense fallback={<PageLoader />}>
          <DocumentSigner />
        </Suspense>
      </Route>
      <Route path="/login">
        <Suspense fallback={<PageLoader />}>
          <Login />
        </Suspense>
      </Route>
      
      {/* Root route - shows landing page for unauthenticated, dashboard for authenticated */}
      <Route path="/">
        {isLoading ? (
          <PageLoader />
        ) : isAuthenticated ? (
          <AppLayout>
            <Suspense fallback={<PageLoader />}>
              <Dashboard />
            </Suspense>
          </AppLayout>
        ) : (
          <Suspense fallback={<PageLoader />}>
            <Landing />
          </Suspense>
        )}
      </Route>
      
      {/* Protected routes - require authentication */}
      {isAuthenticated && (
        <>
          <Route path="/dashboard">
            <AppLayout>
              <Suspense fallback={<PageLoader />}>
                <Dashboard />
              </Suspense>
            </AppLayout>
          </Route>
          <Route path="/documents">
            <AppLayout>
              <Suspense fallback={<PageLoader />}>
                <Documents />
              </Suspense>
            </AppLayout>
          </Route>
          <Route path="/templates">
            <AppLayout>
              <Suspense fallback={<PageLoader />}>
                <Templates />
              </Suspense>
            </AppLayout>
          </Route>
          <Route path="/templates/:id/edit">
            <AppLayout>
              <Suspense fallback={<PageLoader />}>
                <TemplateEditor />
              </Suspense>
            </AppLayout>
          </Route>
          <Route path="/settings">
            <AppLayout>
              <Suspense fallback={<PageLoader />}>
                <Settings />
              </Suspense>
            </AppLayout>
          </Route>
          <Route path="/migration">
            <AppLayout>
              <Suspense fallback={<PageLoader />}>
                <MigrationPage />
              </Suspense>
            </AppLayout>
          </Route>
          <Route path="/document/:id">
            <AppLayout>
              <Suspense fallback={<PageLoader />}>
                <DocumentEditor />
              </Suspense>
            </AppLayout>
          </Route>
        </>
      )}
      
      <Route>
        {isAuthenticated ? (
          <AppLayout>
            <Suspense fallback={<PageLoader />}>
              <NotFound />
            </Suspense>
          </AppLayout>
        ) : (
          <Suspense fallback={<PageLoader />}>
            <Login />
          </Suspense>
        )}
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <PerformanceProvider enableMonitoring={process.env.NODE_ENV === 'development'}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </PerformanceProvider>
    </QueryClientProvider>
  );
}

export default App;
