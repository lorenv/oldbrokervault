import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, FileSignature, UserCheck, FileText, TrendingUp, TrendingDown, Download, RefreshCw } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { format, subDays, eachDayOfInterval } from "date-fns";

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [selectedDocument, setSelectedDocument] = useState<string>('all');

  // Fetch analytics data
  const { data: analytics, isLoading, refetch } = useQuery({
    queryKey: ["/api/analytics/overview"],
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const { data: timelineData } = useQuery({
    queryKey: ["/api/analytics/timeline", dateRange],
    staleTime: 1000 * 60 * 5,
  });

  const { data: documentsData } = useQuery({
    queryKey: ["/api/analytics/documents"],
    staleTime: 1000 * 60 * 5,
  });

  const totalViews = analytics?.totalViews || 0;
  const totalSignatures = analytics?.totalSignatures || 0;
  const pendingApprovals = analytics?.pendingApprovals || 0;
  const activeDocuments = analytics?.activeDocuments || 0;
  const viewsTrend = analytics?.viewsTrend || 0;
  const signaturesTrend = analytics?.signaturesTrend || 0;

  // Generate chart data
  const generateChartData = () => {
    if (!timelineData) return [];

    const daysMap: { [key: string]: number } = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
      'all': 365
    };

    const days = eachDayOfInterval({
      start: subDays(new Date(), daysMap[dateRange] - 1),
      end: new Date()
    });

    return days.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const dayData = timelineData.find((d: any) => d.date === dayStr);

      return {
        date: format(day, 'MMM dd'),
        views: dayData?.views || 0,
        signatures: dayData?.signatures || 0
      };
    });
  };

  const chartData = generateChartData();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
        <div className="bg-gradient-to-r from-slate-800 via-slate-700 to-slate-600 border-b border-slate-200 shadow-lg">
          <div className="container mx-auto px-4 py-12">
            <h1 className="text-4xl font-bold text-white mb-3">Analytics Dashboard</h1>
            <p className="text-slate-200 text-lg font-medium">Track performance across all your CIM documents</p>
          </div>
        </div>
        <main className="container mx-auto px-4 py-8">
          <div className="animate-pulse space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
              ))}
            </div>
            <div className="h-96 bg-gray-200 rounded-lg"></div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 via-slate-700 to-slate-600 border-b border-slate-200 shadow-lg">
        <div className="container mx-auto px-4 py-12">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-white mb-3">Analytics Dashboard</h1>
              <p className="text-slate-200 text-lg font-medium">Track performance across all your CIM documents</p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                className="bg-white/10 text-white border-white/20 hover:bg-white/20"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="bg-white/10 text-white border-white/20 hover:bg-white/20"
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 py-8">
        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {/* Total Views */}
          <Card className="bg-white shadow-md border border-gray-200 hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-sm font-medium text-gray-600">
                <span>Total Views</span>
                <Eye className="h-4 w-4 text-blue-600" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{totalViews}</div>
              {viewsTrend !== 0 && (
                <div className={`flex items-center gap-1 text-sm mt-2 ${viewsTrend > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {viewsTrend > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  <span>{Math.abs(viewsTrend)}% from last period</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Total Signatures */}
          <Card className="bg-white shadow-md border border-gray-200 hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-sm font-medium text-gray-600">
                <span>NDA Signatures</span>
                <FileSignature className="h-4 w-4 text-green-600" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{totalSignatures}</div>
              {signaturesTrend !== 0 && (
                <div className={`flex items-center gap-1 text-sm mt-2 ${signaturesTrend > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {signaturesTrend > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  <span>{Math.abs(signaturesTrend)}% from last period</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pending Approvals */}
          <Card className="bg-white shadow-md border border-gray-200 hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-sm font-medium text-gray-600">
                <span>Pending Approvals</span>
                <UserCheck className="h-4 w-4 text-orange-600" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className="text-3xl font-bold text-gray-900">{pendingApprovals}</div>
                {pendingApprovals > 0 && (
                  <div className="w-3 h-3 bg-orange-500 rounded-full animate-pulse"></div>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-2">Requires action</p>
            </CardContent>
          </Card>

          {/* Active Documents */}
          <Card className="bg-white shadow-md border border-gray-200 hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-sm font-medium text-gray-600">
                <span>Active Documents</span>
                <FileText className="h-4 w-4 text-purple-600" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{activeDocuments}</div>
              <p className="text-sm text-gray-500 mt-2">With sharing enabled</p>
            </CardContent>
          </Card>
        </div>

        {/* Chart Section */}
        <Card className="bg-white shadow-md border border-gray-200 mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-bold">Activity Over Time</CardTitle>
              <Select value={dateRange} onValueChange={(value: any) => setDateRange(value)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[400px]">
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
                    name="Signatures"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Document Performance Table */}
        <Card className="bg-white shadow-md border border-gray-200">
          <CardHeader>
            <CardTitle className="text-xl font-bold">Document Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-semibold text-sm text-gray-700">Document Name</th>
                    <th className="text-center py-3 px-4 font-semibold text-sm text-gray-700">Views</th>
                    <th className="text-center py-3 px-4 font-semibold text-sm text-gray-700">Signatures</th>
                    <th className="text-center py-3 px-4 font-semibold text-sm text-gray-700">Conversion</th>
                    <th className="text-center py-3 px-4 font-semibold text-sm text-gray-700">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {documentsData && documentsData.length > 0 ? (
                    documentsData.map((doc: any) => (
                      <tr key={doc.id} className="border-b hover:bg-gray-50 cursor-pointer transition-colors">
                        <td className="py-3 px-4">
                          <a href={`/documents/${doc.id}`} className="text-blue-600 hover:underline font-medium">
                            {doc.title}
                          </a>
                        </td>
                        <td className="text-center py-3 px-4">{doc.views}</td>
                        <td className="text-center py-3 px-4">{doc.signatures}</td>
                        <td className="text-center py-3 px-4">
                          {doc.views > 0 ? `${((doc.signatures / doc.views) * 100).toFixed(1)}%` : '0%'}
                        </td>
                        <td className="text-center py-3 px-4">
                          <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                            doc.shareEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                          }`}>
                            {doc.shareEnabled ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-gray-500">
                        No documents found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
