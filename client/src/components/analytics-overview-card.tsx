import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye, FileSignature, UserCheck, ArrowRight, TrendingUp, TrendingDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";

export function AnalyticsOverviewCard() {
  const { data: analytics, isLoading } = useQuery({
    queryKey: ["/api/analytics/overview"],
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  if (isLoading) {
    return (
      <Card className="bg-white shadow-md border border-gray-200 rounded-lg">
        <CardHeader className="pb-3 pt-5 px-5">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-gray-900">
            <TrendingUp className="w-4 h-4 text-purple-600" />
            <span>Analytics Overview</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="space-y-3 animate-pulse">
            <div className="h-12 bg-gray-200 rounded"></div>
            <div className="h-12 bg-gray-200 rounded"></div>
            <div className="h-12 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalViews = analytics?.totalViews || 0;
  const totalSignatures = analytics?.totalSignatures || 0;
  const pendingApprovals = analytics?.pendingApprovals || 0;
  const viewsTrend = analytics?.viewsTrend || 0;
  const signaturesTrend = analytics?.signaturesTrend || 0;

  return (
    <Card className="bg-white shadow-md border border-gray-200 hover:shadow-lg transition-shadow duration-200 rounded-lg">
      <CardHeader className="pb-3 pt-5 px-5">
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-gray-900">
          <TrendingUp className="w-4 h-4 text-purple-600" />
          <span>Analytics Overview</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <div className="space-y-3">
          {/* Total Views */}
          <div className="flex items-center justify-between p-3 bg-blue-50 rounded-md">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <Eye className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600">Total Views</p>
                <p className="text-lg font-bold text-gray-900">{totalViews}</p>
              </div>
            </div>
            {viewsTrend !== 0 && (
              <div className={`flex items-center gap-1 text-xs ${viewsTrend > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {viewsTrend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                <span>{Math.abs(viewsTrend)}%</span>
              </div>
            )}
          </div>

          {/* Total Signatures */}
          <div className="flex items-center justify-between p-3 bg-green-50 rounded-md">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <FileSignature className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600">NDA Signatures</p>
                <p className="text-lg font-bold text-gray-900">{totalSignatures}</p>
              </div>
            </div>
            {signaturesTrend !== 0 && (
              <div className={`flex items-center gap-1 text-xs ${signaturesTrend > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {signaturesTrend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                <span>{Math.abs(signaturesTrend)}%</span>
              </div>
            )}
          </div>

          {/* Pending Approvals */}
          <div className="flex items-center justify-between p-3 bg-orange-50 rounded-md">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                <UserCheck className="w-4 h-4 text-orange-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600">Pending Approvals</p>
                <p className="text-lg font-bold text-gray-900">{pendingApprovals}</p>
              </div>
            </div>
            {pendingApprovals > 0 && (
              <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
            )}
          </div>

          {/* View Full Analytics Button */}
          <Link href="/analytics">
            <Button
              variant="outline"
              className="w-full mt-2 text-purple-600 border-purple-200 hover:bg-purple-50 hover:border-purple-300"
            >
              View Full Analytics
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
