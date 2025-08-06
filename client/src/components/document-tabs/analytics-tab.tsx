import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eye, Users, Calendar, TrendingUp, Globe, FileSignature, Shield } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { format, subDays, eachDayOfInterval } from "date-fns";

interface DocumentAnalyticsTabProps {
  cimDocument: any;
  ndaSignatures: any[];
}

export function DocumentAnalyticsTab({ cimDocument, ndaSignatures }: DocumentAnalyticsTabProps) {
  // Fetch view analytics
  const { data: viewStats } = useQuery({
    queryKey: [`/api/cim/${cimDocument.id}/analytics`],
    queryFn: async () => {
      const response = await fetch(`/api/cim/${cimDocument.id}/analytics`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch analytics');
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Generate chart data for the last 30 days
  const generateChartData = () => {
    const days = eachDayOfInterval({
      start: subDays(new Date(), 30),
      end: new Date()
    });

    // DEBUG: Log the data being used for chart
    console.log("🔍 CHART DATA DEBUG:", {
      viewStats,
      dailyViews: viewStats?.dailyViews,
      totalViews: viewStats?.totalViews
    });

    return days.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const daySignatures = ndaSignatures.filter(sig => 
        format(new Date(sig.signedAt), 'yyyy-MM-dd') === dayStr
      ).length;
      
      const dayViews = viewStats?.dailyViews?.[dayStr] || 0;
      
      // DEBUG: Log individual day calculation
      if (dayViews > 0 || daySignatures > 0) {
        console.log("🔍 DAY DATA:", { dayStr, dayViews, daySignatures });
      }
      
      return {
        date: format(day, 'MMM dd'),
        signatures: daySignatures,
        views: dayViews
      };
    });
  };

  const chartData = generateChartData();
  const totalViews = viewStats?.totalViews || 0;
  const totalSignatures = ndaSignatures.length;
  const uniqueViewers = viewStats?.uniqueViewers || 0;

  // Calculate conversion rate (signatures / views)
  const conversionRate = totalViews > 0 ? ((totalSignatures / totalViews) * 100).toFixed(1) : '0';

  // Get recent activity
  const recentSignatures = ndaSignatures
    .sort((a, b) => new Date(b.signedAt).getTime() - new Date(a.signedAt).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-slate-50 ring-1 ring-blue-100/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-700">Total Views</CardTitle>
            <div className="p-1.5 bg-blue-100 rounded-lg">
              <Eye className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-800">{totalViews}</div>
            <p className="text-xs text-slate-500">
              Document page views
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-emerald-50 to-slate-50 ring-1 ring-emerald-100/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-700">NDA Signatures</CardTitle>
            <div className="p-1.5 bg-emerald-100 rounded-lg">
              <FileSignature className="h-4 w-4 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-800">{totalSignatures}</div>
            <p className="text-xs text-slate-500">
              Signed agreements
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Activity Chart */}
      <Card className="border-0 shadow-lg bg-gradient-to-br from-slate-50 to-gray-50 ring-1 ring-slate-200/50">
        <CardHeader className="bg-gradient-to-r from-slate-600 to-slate-700 text-white rounded-t-lg">
          <CardTitle className="text-white">Activity Over Time (Last 30 Days)</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="views" 
                  stroke="#3b82f6" 
                  name="Views"
                  strokeWidth={2}
                />
                <Line 
                  type="monotone" 
                  dataKey="signatures" 
                  stroke="#10b981" 
                  name="NDA Signatures"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Document Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-lg bg-gradient-to-br from-amber-50 to-slate-50 ring-1 ring-amber-100/50">
          <CardHeader className="bg-gradient-to-r from-amber-600 to-slate-700 text-white rounded-t-lg">
            <CardTitle className="text-white flex items-center gap-2">
              <div className="p-1.5 bg-white/20 rounded-lg">
                <Shield className="h-4 w-4" />
              </div>
              Document Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-700">Sharing Status</span>
              <Badge variant={cimDocument.shareEnabled ? "default" : "secondary"}>
                {cimDocument.shareEnabled ? "Public" : "Private"}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-700">NDA Protection</span>
              <Badge variant={cimDocument.ndaProtected ? "default" : "secondary"}>
                {cimDocument.ndaProtected ? "Enabled" : "Disabled"}
              </Badge>
            </div>
            
            {cimDocument.shareEnabled && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-700">Share URL</span>
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-emerald-600" />
                  <span className="text-xs text-emerald-600 font-medium">Active</span>
                </div>
              </div>
            )}
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-700">Created</span>
              <span className="text-xs text-slate-500">
                {new Date(cimDocument.createdAt).toLocaleDateString()}
              </span>
            </div>
            
            {cimDocument.updatedAt && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-700">Last Modified</span>
                <span className="text-xs text-slate-500">
                  {new Date(cimDocument.updatedAt).toLocaleDateString()}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-violet-50 to-slate-50 ring-1 ring-violet-100/50">
          <CardHeader className="bg-gradient-to-r from-violet-600 to-slate-700 text-white rounded-t-lg">
            <CardTitle className="text-white flex items-center gap-2">
              <div className="p-1.5 bg-white/20 rounded-lg">
                <Users className="h-4 w-4" />
              </div>
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {recentSignatures.length > 0 ? (
              <div className="space-y-3">
                {recentSignatures.map((signature, index) => (
                  <div key={signature.id} className="flex items-center justify-between py-2 border-b border-violet-100 last:border-b-0">
                    <div>
                      <p className="text-sm font-medium text-slate-700">{signature.signerName}</p>
                      <p className="text-xs text-slate-500">{signature.signerEmail}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500">
                        {format(new Date(signature.signedAt), 'MMM dd, yyyy')}
                      </p>
                      <p className="text-xs text-slate-500">
                        {signature.signerLocation || 'Unknown location'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <FileSignature className="h-8 w-8 text-violet-400 mx-auto mb-2" />
                <p className="text-sm text-slate-600">No signatures yet</p>
                <p className="text-xs text-slate-500">Enable NDA protection to start collecting signatures</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}