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

function Router() {
  const [location] = useLocation();
  const isSharePage = location.startsWith('/share/') || location.startsWith('/cims/');

  if (isSharePage) {
    return (
      <Switch>
        <Route path="/share/:shareSlug" component={SharePage} />
        <Route path="/cims/:shareSlug" component={SharePage} />
        <Route path="/nda/redirect/:redirectId" component={NdaRedirectPage} />
        <Route component={NotFound} />
      </Switch>
    );
  }

  return (
    <div className="relative min-h-screen">
      {/* Fixed parallax footer at the bottom */}
      <div className="fixed bottom-0 left-0 right-0 z-0">
        <Footer />
      </div>
      
      {/* Main content that slides over the footer */}
      <div className="relative z-10 min-h-screen bg-white">
        <Navbar />
        <div className="pb-96"> {/* Add padding to ensure content can scroll over footer */}
          <Switch>
            <Route path="/" component={HomePage} />
            <ProtectedRoute path="/dashboard" component={DashboardPage} />
            <ProtectedRoute path="/documents" component={DocumentsPage} />
            <ProtectedRoute path="/documents/:id" component={DocumentsPage} />
            <ProtectedRoute path="/cim/:id" component={EnhancedCimPage} />
            <ProtectedRoute path="/enhanced-cim/:id" component={EnhancedCimPage} />
            <ProtectedRoute path="/premium" component={PremiumDashboard} />
            <ProtectedRoute path="/investor-database" component={InvestorDatabasePage} />
            <ProtectedRoute path="/account" component={AccountPage} />
            <Route path="/pricing" component={PricingPage} />
            <Route path="/contact" component={ContactPage} />
            <Route path="/eula" component={EulaPage} />
            <Route path="/privacy-policy" component={PrivacyPolicyPage} />
            <Route path="/terms-of-service" component={TermsOfServicePage} />
            <Route path="/cookie-policy" component={CookiePolicyPage} />
            <ProtectedRoute path="/admin" component={AdminPage} requireAdmin={true} />
            <Route path="/login" component={LoginPage} />
            <Route path="/auth" component={LoginPage} />
            <Route component={NotFound} />
          </Switch>
        </div>
      </div>
    </div>
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