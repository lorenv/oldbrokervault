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
import NotFound from "@/pages/not-found";
import { ProtectedRoute } from "./lib/protected-route";
import PremiumDashboard from "@/pages/premium-dashboard";

function Router() {
  const [location] = useLocation();
  const isSharePage = location.startsWith('/share/');

  return (
    <>
      {!isSharePage && <Navbar />}
      <div className={isSharePage ? "" : "min-h-screen flex flex-col"}>
        <div className={isSharePage ? "" : "flex-1"}>
          <Switch>
            <Route path="/" component={HomePage} />
            <ProtectedRoute path="/dashboard" component={DashboardPage} />
            <ProtectedRoute path="/documents" component={DocumentsPage} />
            <ProtectedRoute path="/documents/:id" component={DocumentsPage} />
            <ProtectedRoute path="/premium" component={PremiumDashboard} />
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
            <Route path="/share/:shareSlug" component={SharePage} />
            <Route component={NotFound} />
          </Switch>
        </div>
        {!isSharePage && <Footer />}
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