import { useAuth } from "@/hooks/use-auth";
import { CimGenerator } from "@/components/cim-generator";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubscriptionCard } from "@/components/ui/subscription-card";
import { FileText, Clock, ArrowRight } from "lucide-react";

export default function DashboardPage() {
  const { user } = useAuth();
  const { data: documentsResponse, isLoading: documentsLoading } = useQuery({
    queryKey: ["/api/dashboard/recent"],
    staleTime: 1000 * 60 * 10, // 10 minutes - very aggressive caching
    gcTime: 1000 * 60 * 30, // 30 minutes cache retention
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  // Fetch user profile for personalized welcome message
  const { data: userProfile } = useQuery({
    queryKey: ["/api/profile"],
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Extract documents array from the response
  const documents = documentsResponse?.documents || [];

  // Extract first name from user profile
  const firstName = userProfile?.name ? userProfile.name.split(' ')[0] : '';
  const welcomeMessage = firstName ? `Welcome back, ${firstName}!` : 'Welcome back!';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-blue-500 via-indigo-600 to-purple-600 shadow-xl">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">
                {welcomeMessage}
              </h1>
              <p className="text-blue-100 mt-2 text-lg">Create professional CIM documents with AI-powered analysis</p>
            </div>
            
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content Area */}
          <div className="lg:col-span-2">
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border-0 ring-1 ring-gray-200/50 overflow-hidden">
              <div className="p-8">
                <CimGenerator />
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Recent Documents Card */}
            <Card className="bg-white/95 backdrop-blur-sm shadow-xl border-0 ring-1 ring-gray-200/50 hover:shadow-2xl transition-all duration-300 rounded-2xl overflow-hidden">
              <CardHeader className="bg-gradient-to-br from-violet-500 via-purple-600 to-indigo-600 pb-6 pt-8 px-6 shadow-lg">
                <CardTitle className="flex items-center gap-3 text-lg font-bold text-white">
                  <div className="p-2 bg-white/20 backdrop-blur-sm rounded-xl shadow-sm">
                    <Clock className="w-5 h-5 text-white" />
                  </div>
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
                          className="group block p-5 bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 rounded-xl hover:from-indigo-100 hover:via-purple-100 hover:to-pink-100 transition-all duration-300 border-2 border-indigo-200/30 hover:border-purple-300/50 hover:shadow-lg transform hover:scale-[1.02]"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <h3 className="font-semibold text-gray-900 group-hover:text-purple-700 transition-colors">
                                {doc.title}
                              </h3>
                              <p className="text-sm text-gray-600 mt-2 flex items-center gap-2">
                                <div className="p-1 bg-purple-100 rounded-md">
                                  <Clock className="w-3 h-3 text-purple-600" />
                                </div>
                                <span>{new Date(doc.createdAt || doc.created_at).toLocaleDateString()}</span>
                              </p>
                            </div>
                            <div className="flex items-center justify-center w-8 h-8 bg-purple-100 group-hover:bg-purple-200 rounded-full transition-all duration-300">
                              <ArrowRight className="w-4 h-4 text-purple-600 group-hover:translate-x-0.5 transition-all" />
                            </div>
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
                      className="block text-sm text-purple-600 hover:text-purple-700 font-semibold text-center mt-6 p-3 rounded-xl bg-gradient-to-r from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100 border-2 border-purple-200/30 hover:border-purple-300/50 transition-all duration-300 transform hover:scale-[1.02]"
                    >
                      View all documents ({documents.length}) →
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Subscription Card */}
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl border-0 ring-1 ring-gray-200/50 overflow-hidden">
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