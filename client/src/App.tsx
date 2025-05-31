import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "./hooks/use-auth";
import { Navbar } from "@/components/ui/navbar";
import HomePage from "@/pages/home-page";
import AuthPage from "@/pages/auth-page";
import NotFound from "@/pages/not-found";
import DocumentsPage from "@/pages/documents-page";
import SharePage from "@/pages/share-page";
import PricingPage from "@/pages/pricing-page";
import AccountPage from "@/pages/account-page";
import AdminPage from "@/pages/admin-page";
import ProfilePage from "@/pages/profile-page";
import FeaturesPage from "@/pages/features-page";
import HowItWorksPage from "@/pages/how-it-works-page";
import ContactPage from "@/pages/contact-page";

function Router() {
  return (
    <>
      <Navbar />
      <Switch>
        <ProtectedRoute path="/" component={HomePage} />
        <ProtectedRoute path="/documents" component={DocumentsPage} />
        <ProtectedRoute path="/documents/:id" component={DocumentsPage} />
        <ProtectedRoute path="/account" component={AccountPage} />
        <ProtectedRoute path="/pricing" component={PricingPage} />
        <ProtectedRoute path="/features" component={FeaturesPage} />
        <ProtectedRoute path="/how-it-works" component={HowItWorksPage} />
        <ProtectedRoute path="/contact" component={ContactPage} />
        <ProtectedRoute path="/admin" component={AdminPage} requireAdmin={true} />
        <Route path="/auth" component={AuthPage} />
        <Route path="/cims/:shareSlug" component={SharePage} />
        <Route component={NotFound} />
      </Switch>
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