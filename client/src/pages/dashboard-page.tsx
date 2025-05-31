import { useAuth } from "@/hooks/use-auth";
import { CimGenerator } from "@/components/cim-generator";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubscriptionCard } from "@/components/ui/subscription-card";

export default function DashboardPage() {
  const { user } = useAuth();
  const { data: documents } = useQuery({
    queryKey: ["/api/cim"],
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <main className="container mx-auto px-6 py-10">
        {/* Welcome Header */}
        <div className="mb-10">
          <div className="bg-white/60 backdrop-blur-sm border border-white/40 rounded-2xl p-8 shadow-xl">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
              Welcome back, {user?.email?.split('@')[0]}
            </h1>
            <p className="text-gray-600 text-lg">
              Create professional CIMs with AI-powered analysis and secure sharing
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <CimGenerator />
          </div>

          <div className="space-y-6">
            {/* Recent Documents Card */}
            <div className="bg-white/60 backdrop-blur-sm border border-white/40 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Recent Documents</h2>
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-400 to-blue-500 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                  </svg>
                </div>
              </div>
              
              <div className="space-y-3">
                {documents?.slice()
                  .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .slice(0, 3)
                  .map((doc: any) => (
                  <a 
                    href={`/documents/${doc.id}`} 
                    key={doc.id} 
                    className="block p-4 bg-white/50 rounded-xl hover:bg-white/70 transition-all duration-200 border border-gray-100/50 hover:shadow-md group"
                  >
                    <h3 className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors">{doc.title}</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {new Date(doc.createdAt).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric', 
                        year: 'numeric' 
                      })}
                    </p>
                  </a>
                ))}
                {(!documents || documents.length === 0) && (
                  <div className="text-center py-8 text-gray-500">
                    <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                    <p>No documents yet</p>
                    <p className="text-sm">Create your first CIM to get started</p>
                  </div>
                )}
                {documents && documents.length > 3 && (
                  <a 
                    href="/documents" 
                    className="block text-sm text-blue-600 hover:text-blue-700 text-center mt-4 font-medium hover:underline"
                  >
                    View all documents ({documents.length})
                  </a>
                )}
              </div>
            </div>

            {/* Enhanced Subscription Card */}
            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-100 rounded-2xl p-6 shadow-xl">
              <SubscriptionCard 
                status={user?.subscriptionStatus} 
                endsAt={user?.subscriptionEndsAt} 
                monthlyUsage={user?.monthlyUsage}
                subtle={false}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}