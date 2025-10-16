import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { CimGenerator } from "@/components/cim-generator";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubscriptionCard } from "@/components/ui/subscription-card";
import { AnalyticsOverviewCard } from "@/components/analytics-overview-card";
import { FileText, Clock, ArrowRight } from "lucide-react";


export default function DashboardPage() {
  const { user } = useAuth();
  const [cimMode, setCimMode] = useState<'choice' | 'generate' | 'upload'>('choice');

  // Removed guided tour - now using get started checklist instead
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
  const documents = (documentsResponse as any)?.documents || [];

  // Extract first name from user profile
  const firstName = (userProfile as any)?.name ? (userProfile as any).name.split(' ')[0] : '';
  const welcomeMessage = firstName ? `Welcome back, ${firstName}!` : 'Welcome back!';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      {/* Get Started Checklist moved to App.tsx for global visibility */}
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-slate-800 via-slate-700 to-slate-600 border-b border-slate-200 shadow-lg">
        <div className="container mx-auto px-4 py-12">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-white mb-3">
                {welcomeMessage}
              </h1>
              <p className="text-slate-200 text-lg font-medium">Create professional CIM documents with AI-powered analysis</p>
            </div>
            
          </div>
        </div>
      </div>

      <main className="container mx-auto px-2 lg:px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-4">
          {/* Main Content Area */}
          <div className={`transition-all duration-[2000ms] ease-in-out ${
            cimMode === 'choice' ? 'lg:col-span-9' : 'lg:col-span-12'
          }`}>
            <div className="bg-white rounded-xl shadow-xl border-2 border-blue-100 ring-2 ring-blue-50">
              <div className="p-3 lg:p-4">
                <CimGenerator onModeChange={setCimMode} />
              </div>
            </div>
          </div>

          {/* Sidebar - Only show when in 'choice' mode */}
          <div className={`lg:col-span-3 transition-all duration-[2000ms] ease-in-out ${
            cimMode === 'choice'
              ? 'opacity-100 scale-100'
              : 'opacity-0 scale-95 max-h-0 overflow-hidden pointer-events-none'
          }`}>
            <div className="space-y-6 pb-8">
            {/* Recent Documents Card */}
            <Card className="bg-white shadow-md border border-gray-200 hover:shadow-lg transition-shadow duration-200 rounded-lg">
              <CardHeader className="pb-3 pt-5 px-5">
                <CardTitle className="flex items-center gap-2 text-base font-semibold text-gray-900">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <span>Recent Documents</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5">
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
                          className="group block p-3 bg-gray-50 border border-gray-200 rounded-md hover:border-blue-400 hover:bg-blue-50 transition-all duration-150"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h3 className="font-medium text-sm text-gray-900 group-hover:text-blue-700 transition-colors truncate">
                                  {doc.title}
                                </h3>
                                {(doc as any).isSharedWithUser && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200 flex-shrink-0">
                                    Shared
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {new Date(doc.createdAt || doc.created_at).toLocaleDateString()}
                              </p>
                            </div>
                            <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all flex-shrink-0 ml-2" />
                          </div>
                        </a>
                      ))
                  ) : (
                    <div className="text-center py-6 text-gray-500">
                      <FileText className="w-7 h-7 mx-auto mb-2 text-gray-300" />
                      <p className="text-sm">No documents yet</p>
                      <p className="text-xs text-gray-400 mt-1">Create your first CIM above</p>
                    </div>
                  )}
                  {documents.length > 3 && (
                    <a
                      href="/documents"
                      className="block text-sm text-blue-600 hover:text-blue-700 font-medium text-center mt-3 py-2 px-3 rounded-md hover:bg-blue-50 transition-colors"
                    >
                      View all ({documents.length})
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Analytics Overview Card */}
            <AnalyticsOverviewCard />

            {/* Subscription Card */}
            <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
              <SubscriptionCard
                status={user?.subscriptionStatus}
                endsAt={user?.subscriptionEndsAt ? new Date(user.subscriptionEndsAt).toISOString() : null}
                monthlyUsage={user?.monthlyUsage}
                monthlyDocumentsCreated={user?.monthlyDocumentsCreated}
                monthlyRegenerationsUsed={user?.monthlyRegenerationsUsed}
                subtle={true}
                hideProButtons={true}
                hideActiveUntil={true}
                hideRegenerations={true}
              />
            </div>
          </div>
          </div>
        </div>
      </main>
    </div>
  );
}