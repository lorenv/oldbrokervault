import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "./hooks/use-auth";
import { ErrorBoundary } from "@/components/error-boundary";
import { useEffect, lazy, Suspense } from "react";
import { initializeTracking, useTracking } from "./hooks/use-tracking";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/layout/app-layout";
import { CimGenerationProvider } from "@/contexts/cim-generation-context";

// Core pages (loaded immediately for fast initial render)
import LoginPage from "@/pages/login-page";
import RegisterPage from "@/pages/register-page";
import NotFound from "@/pages/not-found";
import { ProtectedRoute } from "./lib/protected-route";
import { GetStartedChecklist } from "@/components/get-started-checklist";

// Lazy-loaded pages (code splitting for better performance)
const DashboardPage = lazy(() => import("@/pages/dashboard-page"));
const AdminPage = lazy(() => import("@/pages/admin-page"));
const DocumentsPage = lazy(() => import("@/pages/documents-page"));
const AnalyticsPage = lazy(() => import("@/pages/analytics-page"));
const CheckoutSuccess = lazy(() => import("@/pages/checkout-success"));
const SharePage = lazy(() => import("@/pages/share-page").then(m => ({ default: m.SharePage })));
const TeaserPage = lazy(() => import("@/pages/teaser-page").then(m => ({ default: m.TeaserPage })));
const TeaserEmbedPage = lazy(() => import("@/pages/teaser-embed-page").then(m => ({ default: m.TeaserEmbedPage })));
const ListingsPage = lazy(() => import("@/pages/listings-page").then(m => ({ default: m.ListingsPage })));
const NdaRedirectPage = lazy(() => import("@/pages/nda-redirect-page").then(m => ({ default: m.NdaRedirectPage })));
const UnsubscribePage = lazy(() => import("@/pages/unsubscribe-page").then(m => ({ default: m.UnsubscribePage })));
const AcceptCollaborationPage = lazy(() => import("@/pages/accept-collaboration-page").then(m => ({ default: m.AcceptCollaborationPage })));
const InvitationLandingPage = lazy(() => import("@/pages/invitation-landing-page").then(m => ({ default: m.InvitationLandingPage })));
const PremiumDashboard = lazy(() => import("@/pages/premium-dashboard"));
const InvestorDatabasePage = lazy(() => import("@/pages/investor-database-page"));
const DocumentDetailPage = lazy(() => import("@/pages/document-detail-page").then(m => ({ default: m.DocumentDetailPage })));
const NdaTemplatesPage = lazy(() => import("@/pages/nda-templates-page"));
const EnhancedNdaSigningPage = lazy(() => import("@/pages/enhanced-nda-signing-page"));
const SignDocumentPage = lazy(() => import("@/pages/sign-document"));
const Messages = lazy(() => import("@/pages/messages"));
const EnhancedTemplateEditorPage = lazy(() => import("@/pages/enhanced-template-editor-page"));
const SDEAnalyzerPage = lazy(() => import("@/pages/sde-analyzer-page"));
const IntegrationsPage = lazy(() => import("@/pages/integrations-page"));
const WebhooksPage = lazy(() => import("@/pages/webhooks-page"));
const DataRoomPage = lazy(() => import("@/pages/data-room-page"));
const CimGeneratingPage = lazy(() => import("@/pages/cim-generating-page").then(m => ({ default: m.CimGeneratingPage })));

// Lazy-loaded settings pages
const ListingsSettingsPage = lazy(() => import("@/pages/listings-settings-page"));
const ProfilePage = lazy(() => import("@/pages/settings/profile-page"));
const NotificationsPage = lazy(() => import("@/pages/settings/notifications-page"));
const ManageUsersPage = lazy(() => import("@/pages/settings/manage-users-page"));
const CustomFieldsPage = lazy(() => import("@/pages/settings/custom-fields-page"));
const DataManagementPage = lazy(() => import("@/pages/settings/data-management-page"));
const BrandingPage = lazy(() => import("@/pages/settings/branding-page"));
const SettingsIndexPage = lazy(() => import("@/pages/settings/settings-index-page"));
const EmailSettingsPage = lazy(() => import("@/pages/settings/email-settings-page"));
const PipelineSettingsPage = lazy(() => import("@/pages/settings/pipeline-settings-page"));

// Lazy-loaded CRM Pages
const DealsPage = lazy(() => import("@/pages/crm/deals-page"));
const DealDetailPage = lazy(() => import("@/pages/crm/deal-detail-page"));
const CompaniesPage = lazy(() => import("@/pages/crm/companies-page"));
const CompanyDetailPage = lazy(() => import("@/pages/crm/company-detail-page"));
const ContactsPage = lazy(() => import("@/pages/crm/contacts-page"));
const ContactDetailPage = lazy(() => import("@/pages/crm/contact-detail-page"));
const TasksPage = lazy(() => import("@/pages/crm/tasks-page"));

// Lazy-loaded E-Signature Pages
const EsignDashboard = lazy(() => import("@/pages/esign/esign-dashboard"));
const EsignTemplates = lazy(() => import("@/pages/esign/esign-templates"));
const EsignTemplateEditor = lazy(() => import("@/pages/esign/esign-template-editor"));
const EsignSend = lazy(() => import("@/pages/esign/esign-send"));
const EsignEnvelopeDetail = lazy(() => import("@/pages/esign/esign-envelope-detail"));
const EsignCorrect = lazy(() => import("@/pages/esign/esign-correct"));
const EsignSign = lazy(() => import("@/pages/esign/esign-sign"));
const EsignVerify = lazy(() => import("@/pages/esign/esign-verify"));
const EsignSettings = lazy(() => import("@/pages/esign/esign-settings"));
const EsignPowerForm = lazy(() => import("@/pages/esign/esign-powerform"));

// Loading spinner for lazy-loaded components
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
    </div>
  );
}

// Routes that should use the sidebar layout (authenticated app routes)
const authenticatedRoutes = [
  '/dashboard',
  '/documents',
  '/analytics',
  '/premium',
  '/investor-database',
  '/sde-analyzer',
  '/data-room',
  '/messages',
  '/esign',
  '/account',
  '/profile',
  '/integrations',
  '/nda-templates',
  '/template-editor',
  '/admin',
  '/listings-settings',
  '/settings',
  // CRM routes
  '/deals',
  '/tasks',
  '/companies',
  '/contacts',
];

// Public esign routes that should NOT use sidebar even when logged in
const publicEsignRoutes = ['/esign/form/', '/esign/sign/', '/esign/verify/'];

// Check if current route should use sidebar layout
function shouldUseSidebarLayout(location: string, user: any): boolean {
  if (!user) return false;

  // Public esign routes should never use sidebar layout
  if (publicEsignRoutes.some(route => location.startsWith(route))) {
    return false;
  }

  return authenticatedRoutes.some(route =>
    location === route || location.startsWith(route + '/')
  );
}

// Authenticated routes with sidebar layout
function AuthenticatedRouter() {
  const { user } = useAuth();

  return (
    <AppLayout>
      <Suspense fallback={<PageLoader />}>
      <Switch>
        <ProtectedRoute path="/dashboard" component={DashboardPage} />
        <ProtectedRoute path="/documents" component={DocumentsPage} />
        <ProtectedRoute path="/documents/:id/generating" component={CimGeneratingPage} />
        <ProtectedRoute path="/documents/:id" component={DocumentDetailPage} />
        <ProtectedRoute path="/analytics" component={AnalyticsPage} />
        <ProtectedRoute path="/premium" component={PremiumDashboard} />
        <ProtectedRoute path="/investor-database" component={InvestorDatabasePage} />
        <ProtectedRoute path="/sde-analyzer" component={SDEAnalyzerPage} />
        <ProtectedRoute path="/data-room" component={DataRoomPage} />
        <ProtectedRoute path="/messages" component={Messages} />

        {/* CRM Routes */}
        <ProtectedRoute path="/deals" component={DealsPage} />
        <ProtectedRoute path="/deals/:id" component={DealDetailPage} />
        <ProtectedRoute path="/tasks" component={TasksPage} />
        <ProtectedRoute path="/companies" component={CompaniesPage} />
        <ProtectedRoute path="/companies/:id" component={CompanyDetailPage} />
        <ProtectedRoute path="/contacts" component={ContactsPage} />
        <ProtectedRoute path="/contacts/:id" component={ContactDetailPage} />

        {/* E-Signature Routes */}
        <ProtectedRoute path="/esign" component={EsignDashboard} />
        <ProtectedRoute path="/esign/templates" component={EsignTemplates} />
        <ProtectedRoute path="/esign/templates/new" component={EsignTemplateEditor} />
        <ProtectedRoute path="/esign/templates/:id/edit" component={EsignTemplateEditor} />
        <ProtectedRoute path="/esign/send" component={EsignSend} />
        <ProtectedRoute path="/esign/envelope/:id" component={EsignEnvelopeDetail} />
        <ProtectedRoute path="/esign/correct/:id" component={EsignCorrect} />
        <ProtectedRoute path="/esign/settings" component={EsignSettings} />

        {/* Listings Settings (main nav) */}
        <ProtectedRoute path="/listings-settings" component={ListingsSettingsPage} />

        {/* Settings Index Page */}
        <ProtectedRoute path="/settings" component={SettingsIndexPage} />

        {/* Settings Routes (sidebar settings section) */}
        <ProtectedRoute path="/settings/profile" component={ProfilePage} />
        <ProtectedRoute path="/settings/notifications" component={NotificationsPage} />
        <ProtectedRoute path="/settings/manage-users" component={ManageUsersPage} />

        {/* Legacy routes - redirect to consolidated Manage Users page */}
        <ProtectedRoute path="/settings/billing" component={ManageUsersPage} />
        <ProtectedRoute path="/settings/team" component={ManageUsersPage} />
        <ProtectedRoute path="/settings/teams" component={ManageUsersPage} />
        <ProtectedRoute path="/settings/crm-visibility" component={ManageUsersPage} />
        <ProtectedRoute path="/settings/permissions" component={ManageUsersPage} />
        <ProtectedRoute path="/settings/pipelines" component={PipelineSettingsPage} />
        <ProtectedRoute path="/settings/custom-fields" component={CustomFieldsPage} />
        <ProtectedRoute path="/settings/data-management" component={DataManagementPage} />
        <ProtectedRoute path="/settings/email" component={EmailSettingsPage} />
        <ProtectedRoute path="/settings/integrations" component={IntegrationsPage} />
        <ProtectedRoute path="/settings/webhooks" component={WebhooksPage} />
        <ProtectedRoute path="/settings/branding" component={BrandingPage} />
        <ProtectedRoute path="/settings/nda-templates" component={NdaTemplatesPage} />

        {/* Legacy settings routes - redirect to new pages */}
        <ProtectedRoute path="/settings/account" component={ProfilePage} />
        <ProtectedRoute path="/settings/customization" component={PipelineSettingsPage} />
        <ProtectedRoute path="/settings/pdf-branding" component={BrandingPage} />
        <ProtectedRoute path="/settings/online-branding" component={BrandingPage} />
        <ProtectedRoute path="/account" component={ProfilePage} />
        <ProtectedRoute path="/profile" component={ProfilePage} />

        <ProtectedRoute path="/integrations" component={IntegrationsPage} />
        <ProtectedRoute path="/nda-templates" component={NdaTemplatesPage} />

        {/* Template editor routes */}
        <ProtectedRoute path="/template-editor" component={EnhancedTemplateEditorPage} />
        <ProtectedRoute path="/template-editor/:id" component={EnhancedTemplateEditorPage} />

        {/* Legacy NDA template routes */}
        <ProtectedRoute path="/nda-templates/create" component={EnhancedTemplateEditorPage} />
        <ProtectedRoute path="/nda-templates/:id/edit" component={EnhancedTemplateEditorPage} />
        <ProtectedRoute path="/nda-templates/edit/:id" component={EnhancedTemplateEditorPage} />

        <ProtectedRoute path="/admin" component={AdminPage} requireAdmin={true} />

        <Route component={NotFound} />
      </Switch>
      </Suspense>
      {user && <GetStartedChecklist />}
    </AppLayout>
  );
}

// Public routes (no navbar/footer - these are standalone pages)
function PublicRouter() {
  return (
    <Suspense fallback={<PageLoader />}>
    <Switch>
      {/* Auth routes - Login is at root */}
      <Route path="/" component={LoginPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/auth" component={LoginPage} />
      <Route path="/reset-password" component={LoginPage} />

      {/* Functional public routes */}
      <Route path="/checkout-success" component={CheckoutSuccess} />
      <Route path="/unsubscribe" component={UnsubscribePage} />
      <Route path="/invitation/:token" component={InvitationLandingPage} />
      <Route path="/accept-collaboration/:token" component={AcceptCollaborationPage} />

      {/* Share/Public pages */}
      <Route path="/share/:shareSlug" component={SharePage} />
      <Route path="/cims/:shareSlug" component={SharePage} />
      <Route path="/teaser/:slug" component={TeaserPage} />
      <Route path="/teaser/:slug/embed" component={TeaserEmbedPage} />
      <Route path="/listings/:slug" component={ListingsPage} />
      <Route path="/nda/redirect/:redirectId" component={NdaRedirectPage} />
      <Route path="/share/:shareSlug/sign-nda" component={EnhancedNdaSigningPage} />
      <Route path="/sign/:accessToken" component={SignDocumentPage} />

      {/* E-Signature Guest Signing and Verification */}
      <Route path="/esign/sign/:token" component={EsignSign} />
      <Route path="/esign/verify/:envelopeId" component={EsignVerify} />
      <Route path="/esign/form/:slug" component={EsignPowerForm} />

      <Route component={NotFound} />
    </Switch>
    </Suspense>
  );
}

function Router() {
  const [location] = useLocation();
  const { user, isLoading } = useAuth();

  // Track page views and user identification
  useTracking();

  // Check if this is a route that requires authentication
  const isAuthenticatedRoute = authenticatedRoutes.some(route =>
    location === route || location.startsWith(route + '/')
  );

  // Show loading state for authenticated routes while auth is loading
  // This prevents the 404 flash before auth state is determined
  if (isLoading && isAuthenticatedRoute) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // Determine which router to use based on auth state and route
  const useSidebar = shouldUseSidebarLayout(location, user);

  if (useSidebar) {
    return <AuthenticatedRouter />;
  }

  return <PublicRouter />;
}

function App() {
  // Initialize PostHog and capture UTM attribution
  useEffect(() => {
    initializeTracking();
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <CimGenerationProvider>
            <Router />
            <Toaster />
          </CimGenerationProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
