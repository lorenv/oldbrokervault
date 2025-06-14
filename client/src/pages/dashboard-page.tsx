import { useAuth } from "@/hooks/use-auth";
import { CimGenerator } from "@/components/cim-generator";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubscriptionCard } from "@/components/ui/subscription-card";
import { FileText, Clock, ArrowRight } from "lucide-react";

export default function DashboardPage() {
  const { user } = useAuth();
  const { data: documentsResponse, isLoading: documentsLoading } = useQuery({
    queryKey: ["/api/cim"],
    staleTime: 1000 * 60 * 5, // 5 minutes before considering stale
    gcTime: 1000 * 60 * 15, // 15 minutes cache retention
  });

  // Extract documents array from the response
  const documents = documentsResponse?.documents || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      {/* Welcome Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200/50">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                Welcome back!
              </h1>
              <p className="text-gray-600 mt-1">Create professional CIM documents with AI-powered analysis</p>
            </div>
            <div className="hidden md:flex items-center space-x-4 text-sm text-gray-500">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4" />
                <span>{documents.length} documents</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content Area */}
          <div className="lg:col-span-2">
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-white/50 overflow-hidden">
              <div className="p-6">
                <CimGenerator />
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Recent Documents Card */}
            <Card className="bg-white/90 backdrop-blur-sm shadow-lg border-white/50 hover:shadow-xl transition-all duration-200">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center space-x-2 text-gray-900">
                  <Clock className="w-5 h-5 text-blue-600" />
                  <span>Recent Documents</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {documentsLoading ? (
                    <div className="flex items-center justify-center py-6">
                      <div className="animate-pulse flex space-x-4">
                        <div className="flex-1 space-y-3">
                          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                        </div>
                      </div>
                    </div>
                  ) : documents.length > 0 ? (
                    documents
                      .slice()
                      .sort((a: any, b: any) => {
                        // Handle both createdAt and created_at field names from database
                        const dateA = new Date(a.createdAt || a.created_at).getTime();
                        const dateB = new Date(b.createdAt || b.created_at).getTime();
                        return dateB - dateA;
                      })
                      .slice(0, 3)
                      .map((doc: any) => (
                        <a 
                          href={`/documents/${doc.id}`} 
                          key={doc.id} 
                          className="group block p-4 bg-gradient-to-r from-gray-50 to-blue-50/30 rounded-xl hover:from-blue-50 hover:to-indigo-50 transition-all duration-200 border border-gray-100 hover:border-blue-200 hover:shadow-md"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <h3 className="font-medium text-gray-900 group-hover:text-blue-700 transition-colors">
                                {doc.title}
                              </h3>
                              <p className="text-sm text-gray-500 mt-1 flex items-center space-x-1">
                                <Clock className="w-3 h-3" />
                                <span>{new Date(doc.createdAt || doc.created_at).toLocaleDateString()}</span>
                              </p>
                            </div>
                            <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                          </div>
                        </a>
                      ))
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <FileText className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                      <p className="text-sm">No documents yet</p>
                      <p className="text-xs text-gray-400 mt-1">Create your first CIM document above</p>
                    </div>
                  )}
                  {documents.length > 3 && (
                    <a 
                      href="/documents" 
                      className="block text-sm text-blue-600 hover:text-blue-700 font-medium text-center mt-4 p-2 rounded-lg hover:bg-blue-50 transition-colors"
                    >
                      View all documents ({documents.length})
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Subscription Card */}
            <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border border-white/50">
              <SubscriptionCard 
                status={user?.subscriptionStatus} 
                endsAt={user?.subscriptionEndsAt ? new Date(user.subscriptionEndsAt).toISOString() : null} 
                monthlyUsage={user?.monthlyUsage}
                monthlyDocumentsCreated={user?.monthlyDocumentsCreated}
                monthlyRegenerationsUsed={user?.monthlyRegenerationsUsed}
                subtle={true}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}