import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "./hooks/use-auth";
import { Navbar } from "@/components/ui/navbar";
import { Footer } from "@/components/ui/footer";
import { ErrorBoundary } from "@/components/error-boundary";
import { lazy, Suspense, useEffect } from "react";
import { initGA } from "./lib/analytics";
import { useAnalytics } from "./hooks/use-analytics";
import HomePage from "@/pages/home-page";
import HomePageNew from "@/pages/home-page-new";
import DashboardPage from "@/pages/dashboard-page";
import LoginPage from "@/pages/login-page";
import AdminPage from "@/pages/admin-page";
import DocumentsPage from "@/pages/documents-page";
import AnalyticsPage from "@/pages/analytics-page";
import AccountPage from "@/pages/account-page";
import ProfilePage from "@/pages/profile-page";
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
import NdaTemplateEditorPage from "@/pages/nda-template-editor-page";
import EnhancedNdaSigningPage from "@/pages/enhanced-nda-signing-page";
import SignDocumentPage from "@/pages/sign-document";
import Messages from "@/pages/messages";
import EnhancedTemplateEditorPage from "@/pages/enhanced-template-editor-page";
import { GetStartedChecklist } from "@/components/get-started-checklist";
import { useAuth } from "@/hooks/use-auth";
import MarketingHomePage from "@/pages/marketing-home-page";
import VirtualDataRoomPage from "@/pages/virtual-data-room-page";
import SDEAnalyzerPage from "@/pages/sde-analyzer-page";
import WebhooksPage from "@/pages/webhooks-page";
import IntegrationsPage from "@/pages/integrations-page";

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

function Router() {
  const [location] = useLocation();
  const { user } = useAuth();
  const isSharePage = location.startsWith('/share/') || location.startsWith('/cims/') || location.startsWith('/teaser/') || location.startsWith('/listings/');
  
  // Track page views when routes change
  useAnalytics();

  return (
    <>
      {!isSharePage && <Navbar />}
      <div className={isSharePage ? "" : "min-h-screen flex flex-col"}>
        <div className={isSharePage ? "" : "flex-1"}>
          <Switch>
            <Route path="/" component={HomePage} />
            <Route path="/home-new" component={HomePageNew} />
            <Route path="/marketing" component={MarketingHomePage} />
            <ProtectedRoute path="/dashboard" component={DashboardPage} />
            <ProtectedRoute path="/documents" component={DocumentsPage} />
            <ProtectedRoute path="/documents/:id" component={DocumentDetailPage} />
            <ProtectedRoute path="/analytics" component={AnalyticsPage} />
            <ProtectedRoute path="/premium" component={PremiumDashboard} />
            <ProtectedRoute path="/investor-database" component={InvestorDatabasePage} />
            <ProtectedRoute path="/sde-analyzer" component={SDEAnalyzerPage} />
            <ProtectedRoute path="/messages" component={Messages} />
            {/* E-Signature Routes */}
            <ProtectedRoute path="/esign" component={EsignDashboard} />
            <ProtectedRoute path="/esign/templates" component={EsignTemplates} />
            <ProtectedRoute path="/esign/templates/new" component={EsignTemplateEditor} />
            <ProtectedRoute path="/esign/templates/:id/edit" component={EsignTemplateEditor} />
            <ProtectedRoute path="/esign/send" component={EsignSend} />
            <ProtectedRoute path="/esign/envelope/:id" component={EsignEnvelopeDetail} />
            <ProtectedRoute path="/esign/correct/:id" component={EsignCorrect} />
            <ProtectedRoute path="/esign/settings" component={EsignSettings} />
            <ProtectedRoute path="/account" component={AccountPage} />
            <ProtectedRoute path="/profile" component={AccountPage} />
            <ProtectedRoute path="/webhooks" component={WebhooksPage} />
            <ProtectedRoute path="/integrations" component={IntegrationsPage} />
            <Route path="/pricing" component={PricingPage} />
            <Route path="/virtual-data-room" component={VirtualDataRoomPage} />
            <Route path="/checkout-success" component={CheckoutSuccess} />
            <Route path="/contact" component={ContactPage} />
            <Route path="/eula" component={EulaPage} />
            <Route path="/privacy-policy" component={PrivacyPolicyPage} />
            <Route path="/terms-of-service" component={TermsOfServicePage} />
            <Route path="/cookie-policy" component={CookiePolicyPage} />
            <Route path="/data-security" component={DataSecurityPage} />
            <ProtectedRoute path="/admin" component={AdminPage} requireAdmin={true} />
            <Route path="/login" component={LoginPage} />
            <Route path="/auth" component={LoginPage} />
            <Route path="/reset-password" component={LoginPage} />
            <Route path="/unsubscribe" component={UnsubscribePage} />
            <Route path="/invitation/:token" component={InvitationLandingPage} />
            <Route path="/accept-collaboration/:token" component={AcceptCollaborationPage} />
            <Route path="/share/:shareSlug" component={SharePage} />
            <Route path="/cims/:shareSlug" component={SharePage} />
            <Route path="/teaser/:slug" component={TeaserPage} />
            <Route path="/teaser/:slug/embed" component={TeaserEmbedPage} />
            <Route path="/listings/:slug" component={ListingsPage} />
            <Route path="/nda/redirect/:redirectId" component={NdaRedirectPage} />
            <ProtectedRoute path="/nda-templates" component={NdaTemplatesPage} />

            {/* Main template editor routes - using EnhancedTemplateEditorPage */}
            <ProtectedRoute path="/template-editor" component={EnhancedTemplateEditorPage} />
            <ProtectedRoute path="/template-editor/:id" component={EnhancedTemplateEditorPage} />

            {/* Legacy routes - redirect to main template editor */}
            <ProtectedRoute path="/nda-templates/create" component={EnhancedTemplateEditorPage} />
            <ProtectedRoute path="/nda-templates/:id/edit" component={EnhancedTemplateEditorPage} />
            <ProtectedRoute path="/nda-templates/edit/:id" component={EnhancedTemplateEditorPage} />
            <Route path="/share/:shareSlug/sign-nda" component={EnhancedNdaSigningPage} />
            <Route path="/sign/:accessToken" component={SignDocumentPage} />
            {/* E-Signature Guest Signing and Verification */}
            <Route path="/esign/sign/:token" component={EsignSign} />
            <Route path="/esign/verify/:envelopeId" component={EsignVerify} />
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
        {!isSharePage && user && <GetStartedChecklist />}
      </div>
    </>
  );
}

function App() {
  // Initialize Google Analytics
  useEffect(() => {
    initGA();
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