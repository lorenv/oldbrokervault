import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "./hooks/use-auth";
import { Navbar } from "@/components/ui/navbar";
import { Footer } from "@/components/ui/footer";
import { ErrorBoundary } from "@/components/error-boundary";
import HomePage from "@/pages/home-page";
import DashboardPage from "@/pages/dashboard-page";
import LoginPage from "@/pages/login-page";
import AdminPage from "@/pages/admin-page";
import DocumentsPage from "@/pages/documents-page";
import AccountPage from "@/pages/account-page";
import ProfilePage from "@/pages/profile-page";
import PricingPage from "@/pages/pricing-page";

import ContactPage from "@/pages/contact-page";
import EulaPage from "@/pages/eula-page";
import PrivacyPolicyPage from "@/pages/privacy-policy-page";
import TermsOfServicePage from "@/pages/terms-of-service-page";
import CookiePolicyPage from "@/pages/cookie-policy-page";
import { SharePage } from "@/pages/share-page";
import { NdaRedirectPage } from "@/pages/nda-redirect-page";
import NotFound from "@/pages/not-found";
import { ProtectedRoute } from "./lib/protected-route";
import PremiumDashboard from "@/pages/premium-dashboard";
import InvestorDatabasePage from "@/pages/investor-database-page";
import EnhancedCimPage from "@/pages/enhanced-cim-page";
import { DocumentDetailPage } from "@/pages/document-detail-page";
import NdaTemplatesPage from "@/pages/nda-templates-page";
import NdaTemplateEditorPage from "@/pages/nda-template-editor-page";
import EnhancedNdaSigningPage from "@/pages/enhanced-nda-signing-page";
import SignDocumentPage from "@/pages/sign-document";
import Messages from "@/pages/messages";
import EnhancedTemplateEditorPage from "@/pages/enhanced-template-editor-page";
import { GetStartedChecklist } from "@/components/get-started-checklist";
import { useAuth } from "@/hooks/use-auth";

function Router() {
  const [location] = useLocation();
  const { user } = useAuth();
  const isSharePage = location.startsWith('/share/') || location.startsWith('/cims/');

  return (
    <>
      {!isSharePage && <Navbar />}
      <div className={isSharePage ? "" : "min-h-screen flex flex-col"}>
        <div className={isSharePage ? "" : "flex-1"}>
          <Switch>
            <Route path="/" component={HomePage} />
            <ProtectedRoute path="/dashboard" component={DashboardPage} />
            <ProtectedRoute path="/documents" component={DocumentsPage} />
            <ProtectedRoute path="/documents/:id" component={DocumentDetailPage} />
            <ProtectedRoute path="/cim/:id" component={EnhancedCimPage} />
            <ProtectedRoute path="/enhanced-cim/:id" component={EnhancedCimPage} />
            <ProtectedRoute path="/premium" component={PremiumDashboard} />
            <ProtectedRoute path="/investor-database" component={InvestorDatabasePage} />
            <ProtectedRoute path="/messages" component={Messages} />
            <ProtectedRoute path="/account" component={AccountPage} />
            <ProtectedRoute path="/profile" component={AccountPage} />
            <Route path="/pricing" component={PricingPage} />
            <Route path="/contact" component={ContactPage} />
            <Route path="/eula" component={EulaPage} />
            <Route path="/privacy-policy" component={PrivacyPolicyPage} />
            <Route path="/terms-of-service" component={TermsOfServicePage} />
            <Route path="/cookie-policy" component={CookiePolicyPage} />
            <ProtectedRoute path="/admin" component={AdminPage} requireAdmin={true} />
            <Route path="/login" component={LoginPage} />
            <Route path="/auth" component={LoginPage} />
            <Route path="/reset-password" component={LoginPage} />
            <Route path="/share/:shareSlug" component={SharePage} />
            <Route path="/cims/:shareSlug" component={SharePage} />
            <Route path="/nda/redirect/:redirectId" component={NdaRedirectPage} />
            <ProtectedRoute path="/nda-templates" component={NdaTemplatesPage} />
            <ProtectedRoute path="/nda-templates/create" component={NdaTemplateEditorPage} />
            <ProtectedRoute path="/nda-templates/:id/edit" component={NdaTemplateEditorPage} />
            <ProtectedRoute path="/nda-templates/edit/:id" component={NdaTemplateEditorPage} />
            <ProtectedRoute path="/template-editor" component={EnhancedTemplateEditorPage} />
            <ProtectedRoute path="/template-editor/:id" component={EnhancedTemplateEditorPage} />
            <Route path="/share/:shareSlug/sign-nda" component={EnhancedNdaSigningPage} />
            <Route path="/sign/:accessToken" component={SignDocumentPage} />
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