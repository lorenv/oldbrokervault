import { useEffect } from "react";
import { useLocation, useSearch } from "wouter";

// Legacy contacts page — redirects to /buyers
export default function ContactsPage() {
  const [, navigate] = useLocation();
  const searchString = useSearch();

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const contactType = params.get('contactType');
    if (contactType === 'seller') {
      navigate('/sellers', { replace: true });
    } else {
      navigate('/buyers', { replace: true });
    }
  }, [navigate, searchString]);

  return (
    <div className="p-6 text-center py-12">
      <p className="text-gray-500">Redirecting...</p>
    </div>
  );
}
