import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "./hooks/use-auth";
import { Navbar } from "@/components/ui/navbar";
import { Footer } from "@/components/ui/footer";
import { ErrorBoundary } from "@/components/error-boundary";
import { lazy, Suspense, useEffect } from "react";
import { initializeTracking, useTracking } from "./hooks/use-tracking";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/layout/app-layout";

// Page imports
import HomePage from "@/pages/home-page";
import DashboardPage from "@/pages/dashboard-page";
import LoginPage from "@/pages/login-page";
import AdminPage from "@/pages/admin-page";
import DocumentsPage from "@/pages/documents-page";
import AnalyticsPage from "@/pages/analytics-page";
import PricingPage from "@/pages/pricing-page";
import CheckoutSuccess from "@/pages/checkout-success";
import ContactPage from "@/pages/contact-page";
import EulaPage from "@/pages/eula-page";
import PrivacyPolicyPage from "@/pages/privacy-policy-page";
import TermsOfServicePage from "@/pages/terms-of-service-page";
import CookiePolicyPage from "@/pages/cookie-policy-page";
import DataSecurityPage from "@/pages/data-security-page";
import { SharePage } from "@/pages/share-page";
import { TeaserPage } from "@/pages/teaser-page";
import { TeaserEmbedPage } from "@/pages/teaser-embed-page";
import { ListingsPage } from "@/pages/listings-page";
import { NdaRedirectPage } from "@/pages/nda-redirect-page";
import { UnsubscribePage } from "@/pages/unsubscribe-page";
import { AcceptCollaborationPage } from "@/pages/accept-collaboration-page";
import { InvitationLandingPage } from "@/pages/invitation-landing-page";
import NotFound from "@/pages/not-found";
import { ProtectedRoute } from "./lib/protected-route";
import PremiumDashboard from "@/pages/premium-dashboard";
import InvestorDatabasePage from "@/pages/investor-database-page";
import { DocumentDetailPage } from "@/pages/document-detail-page";
import NdaTemplatesPage from "@/pages/nda-templates-page";
import EnhancedNdaSigningPage from "@/pages/enhanced-nda-signing-page";
import SignDocumentPage from "@/pages/sign-document";
import Messages from "@/pages/messages";
import EnhancedTemplateEditorPage from "@/pages/enhanced-template-editor-page";
import { GetStartedChecklist } from "@/components/get-started-checklist";
import VirtualDataRoomPage from "@/pages/virtual-data-room-page";
import SDEAnalyzerPage from "@/pages/sde-analyzer-page";
import IntegrationsPage from "@/pages/integrations-page";
import WebhooksPage from "@/pages/webhooks-page";
import DataRoomPage from "@/pages/data-room-page";

// New settings pages
import ListingsSettingsPage from "@/pages/listings-settings-page";
import AccountSettingsPage from "@/pages/settings/account-settings-page";
import ProfilePage from "@/pages/settings/profile-page";
import BillingPage from "@/pages/settings/billing-page";
import EmailSettingsPage from "@/pages/settings/email-settings-page";
import NotificationsPage from "@/pages/settings/notifications-page";
import PermissionsPage from "@/pages/settings/permissions-page";
import CustomFieldsPage from "@/pages/settings/custom-fields-page";
import DataManagementPage from "@/pages/settings/data-management-page";
import BrandingPage from "@/pages/settings/branding-page";
import SettingsIndexPage from "@/pages/settings/settings-index-page";

// CRM Pages
import DealsPage from "@/pages/crm/deals-page";
import DealDetailPage from "@/pages/crm/deal-detail-page";
import CompaniesPage from "@/pages/crm/companies-page";
import CompanyDetailPage from "@/pages/crm/company-detail-page";
import ContactsPage from "@/pages/crm/contacts-page";
import ContactDetailPage from "@/pages/crm/contact-detail-page";
import TasksPage from "@/pages/crm/tasks-page";
import TeamSettingsPage from "@/pages/settings/team-settings-page";
import PipelineSettingsPage from "@/pages/settings/pipeline-settings-page";
import TeamsSettingsPage from "@/pages/settings/teams-settings-page";
import CrmVisibilitySettingsPage from "@/pages/settings/crm-visibility-settings-page";

// E-Signature Pages
import EsignDashboard from "@/pages/esign/esign-dashboard";
import EsignTemplates from "@/pages/esign/esign-templates";
import EsignTemplateEditor from "@/pages/esign/esign-template-editor";
import EsignSend from "@/pages/esign/esign-send";
import EsignEnvelopeDetail from "@/pages/esign/esign-envelope-detail";
import EsignCorrect from "@/pages/esign/esign-correct";
import EsignSign from "@/pages/esign/esign-sign";
import EsignVerify from "@/pages/esign/esign-verify";
import EsignSettings from "@/pages/esign/esign-settings";
import EsignPowerForm from "@/pages/esign/esign-powerform";

// Lazy load SEO pages for better performance
const NdaProtectionPage = lazy(() => import("@/pages/features/nda-protection"));
const AiPoweredCimPage = lazy(() => import("@/pages/features/ai-powered-cim"));
const ESignaturesFeaturePage = lazy(() => import("@/pages/features/esignatures"));
const InvestorDatabaseFeaturePage = lazy(() => import("@/pages/features/investor-database"));
const SdeAnalyzerFeaturePage = lazy(() => import("@/pages/features/sde-analyzer"));
const MessagesFeaturePage = lazy(() => import("@/pages/features/messages"));
const AnalyticsFeaturePage = lazy(() => import("@/pages/features/analytics"));
const IntegrationsFeaturePage = lazy(() => import("@/pages/features/integrations"));
const BusinessBrokersPage = lazy(() => import("@/pages/solutions/business-brokers"));
const InvestmentBankingPage = lazy(() => import("@/pages/solutions/investment-banking"));
const ResourcesPage = lazy(() => import("@/pages/resources-page"));

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
      <Switch>
        <ProtectedRoute path="/dashboard" component={DashboardPage} />
        <ProtectedRoute path="/documents" component={DocumentsPage} />
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
        <ProtectedRoute path="/settings/billing" component={BillingPage} />
        <ProtectedRoute path="/settings/notifications" component={NotificationsPage} />
        <ProtectedRoute path="/settings/team" component={TeamSettingsPage} />
        <ProtectedRoute path="/settings/teams" component={TeamsSettingsPage} />
        <ProtectedRoute path="/settings/crm-visibility" component={CrmVisibilitySettingsPage} />
        <ProtectedRoute path="/settings/permissions" component={PermissionsPage} />
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
      {user && <GetStartedChecklist />}
    </AppLayout>
  );
}

// Public routes with navbar/footer
function PublicRouter() {
  const [location] = useLocation();
  const isSharePage = location.startsWith('/share/') || location.startsWith('/cims/') || location.startsWith('/teaser/') || location.startsWith('/listings/');

  return (
    <>
      {!isSharePage && <Navbar />}
      <div className={isSharePage ? "" : "min-h-screen flex flex-col"}>
        <div className={isSharePage ? "" : "flex-1"}>
          <Switch>
            <Route path="/" component={HomePage} />
            <Route path="/pricing" component={PricingPage} />
            <Route path="/virtual-data-room" component={VirtualDataRoomPage} />
            <Route path="/checkout-success" component={CheckoutSuccess} />
            <Route path="/contact" component={ContactPage} />
            <Route path="/eula" component={EulaPage} />
            <Route path="/privacy-policy" component={PrivacyPolicyPage} />
            <Route path="/terms-of-service" component={TermsOfServicePage} />
            <Route path="/cookie-policy" component={CookiePolicyPage} />
            <Route path="/data-security" component={DataSecurityPage} />
            <Route path="/login" component={LoginPage} />
            <Route path="/auth" component={LoginPage} />
            <Route path="/reset-password" component={LoginPage} />
            <Route path="/unsubscribe" component={UnsubscribePage} />
            <Route path="/invitation/:token" component={InvitationLandingPage} />
            <Route path="/accept-collaboration/:token" component={AcceptCollaborationPage} />

            {/* Share/Public pages (no navbar) */}
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

            {/* SEO Feature Pages */}
            <Route path="/features/nda-protection">
              <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
                <NdaProtectionPage />
              </Suspense>
            </Route>
            <Route path="/features/ai-powered-cim">
              <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
                <AiPoweredCimPage />
              </Suspense>
            </Route>
            <Route path="/features/esignatures">
              <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
                <ESignaturesFeaturePage />
              </Suspense>
            </Route>
            <Route path="/features/investor-database">
              <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
                <InvestorDatabaseFeaturePage />
              </Suspense>
            </Route>
            <Route path="/features/sde-analyzer">
              <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
                <SdeAnalyzerFeaturePage />
              </Suspense>
            </Route>
            <Route path="/features/messages">
              <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
                <MessagesFeaturePage />
              </Suspense>
            </Route>
            <Route path="/features/analytics">
              <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
                <AnalyticsFeaturePage />
              </Suspense>
            </Route>
            <Route path="/features/integrations">
              <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
                <IntegrationsFeaturePage />
              </Suspense>
            </Route>

            {/* SEO Solution Pages */}
            <Route path="/solutions/business-brokers">
              <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
                <BusinessBrokersPage />
              </Suspense>
            </Route>
            <Route path="/solutions/investment-banking">
              <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
                <InvestmentBankingPage />
              </Suspense>
            </Route>

            {/* Resources Page */}
            <Route path="/resources">
              <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
                <ResourcesPage />
              </Suspense>
            </Route>

            <Route component={NotFound} />
          </Switch>
        </div>
        {!isSharePage && <Footer />}
      </div>
    </>
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
          <Router />
          <Toaster />
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
