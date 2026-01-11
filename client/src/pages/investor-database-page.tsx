import { useEffect } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";

/**
 * Investor Database Page - Redirects to CRM Contacts
 *
 * The investor database functionality has been consolidated into the
 * CRM Contacts page. This page redirects to contacts with the buyer filter.
 */
export default function InvestorDatabasePage() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Redirect to contacts page with buyer filter
    setLocation("/contacts?contactType=buyer");
  }, [setLocation]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="text-gray-600">Redirecting to Contacts...</p>
      </div>
    </div>
  );
}
