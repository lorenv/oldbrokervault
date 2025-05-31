import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "./hooks/use-auth";
import { Navbar } from "@/components/ui/navbar";
import { Footer } from "@/components/ui/footer";
import HomePage from "@/pages/home-page";
import AuthPage from "@/pages/auth-page";
import AdminPage from "@/pages/admin-page";
import DocumentsPage from "@/pages/documents-page";
import AccountPage from "@/pages/account-page";
import PricingPage from "@/pages/pricing-page";
import FeaturesPage from "@/pages/features-page";
import ContactPage from "@/pages/contact-page";
import { SharePage } from "@/pages/share-page";
import NotFound from "@/pages/not-found";
import { ProtectedRoute } from "./lib/protected-route";

function Router() {
  return (
    <>
      <Navbar />
      <div className="min-h-screen flex flex-col">
        <div className="flex-1">
          <Switch>
            <ProtectedRoute path="/" component={HomePage} />
            <ProtectedRoute path="/documents" component={DocumentsPage} />
            <ProtectedRoute path="/documents/:id" component={DocumentsPage} />
            <ProtectedRoute path="/account" component={AccountPage} />
            <Route path="/pricing" component={PricingPage} />
            <Route path="/features" component={FeaturesPage} />
            <Route path="/contact" component={ContactPage} />
            <ProtectedRoute path="/admin" component={AdminPage} requireAdmin={true} />
            <Route path="/auth" component={AuthPage} />
            <Route path="/cims/:shareSlug" component={SharePage} />
            <Route component={NotFound} />
          </Switch>
        </div>
        <Footer />
      </div>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;