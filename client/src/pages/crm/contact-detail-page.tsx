import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";

// Legacy contact detail page — redirects to /buyers/:id or /sellers/:id based on contact type
export default function ContactDetailPage() {
  const { id } = useParams();
  const [, navigate] = useLocation();

  const { data: contact, isLoading } = useQuery({
    queryKey: ["/api/crm/contacts", id],
    queryFn: () => apiRequest("GET", `/api/crm/contacts/${id}`).then(res => res.json()),
    enabled: !!id,
  });

  useEffect(() => {
    if (!contact || isLoading) return;
    const contactType = (contact as any).contactType;
    if (contactType === 'seller') {
      navigate(`/sellers/${id}`, { replace: true });
    } else {
      navigate(`/buyers/${id}`, { replace: true });
    }
  }, [contact, isLoading, id, navigate]);

  return (
    <div className="p-6 text-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
      <p className="text-gray-500 mt-4">Redirecting...</p>
    </div>
  );
}
