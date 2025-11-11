import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, FileSignature, UserCheck, FileText, TrendingUp, TrendingDown, Download, RefreshCw, Check, X, CheckCheck, MapPin, Copy } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { format, subDays, eachDayOfInterval } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { InvestorHeatMap } from "@/components/investor-heat-map";
import { ContactDetailModal } from "@/components/contact-detail-modal";

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [selectedDocument, setSelectedDocument] = useState<string>('all');
  const [pendingDocFilter, setPendingDocFilter] = useState<string>('all');
  const [mapDocFilter, setMapDocFilter] = useState<string>('all');
  const [showAllDocuments, setShowAllDocuments] = useState(false);
  const [showAllPendingApprovals, setShowAllPendingApprovals] = useState(false);
  const [docStatusFilter, setDocStatusFilter] = useState<string>('all');
  const [docTimeFilter, setDocTimeFilter] = useState<string>('all');
  const [viewingContact, setViewingContact] = useState<any | null>(null);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [selectedSignatures, setSelectedSignatures] = useState<number[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch analytics data with date range
  const { data: analytics, isLoading, refetch } = useQuery({
    queryKey: ["/api/analytics/overview", dateRange],
    queryFn: async () => {
      const response = await fetch(`/api/analytics/overview?range=${dateRange}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch analytics overview');
      return response.json();
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const { data: timelineData } = useQuery({
    queryKey: ["/api/analytics/timeline", dateRange],
    queryFn: async () => {
      const response = await fetch(`/api/analytics/timeline?range=${dateRange}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch timeline data');
      return response.json();
    },
    staleTime: 1000 * 60 * 5,
  });

  const { data: documentsData } = useQuery({
    queryKey: ["/api/analytics/documents"],
    staleTime: 1000 * 60 * 5,
  });

  const { data: pendingApprovalsData } = useQuery({
    queryKey: ["/api/analytics/pending-approvals"],
    staleTime: 1000 * 60 * 1, // 1 minute - keep fresh
  });

  const { data: allSignaturesData } = useQuery({
    queryKey: ["/api/analytics/all-signatures"],
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const totalViews = analytics?.totalViews || 0;
  const totalSignatures = analytics?.totalSignatures || 0;
  const pendingApprovals = analytics?.pendingApprovals || 0;
  const activeDocuments = analytics?.activeDocuments || 0;
  const viewsTrend = analytics?.viewsTrend || 0;
  const signaturesTrend = analytics?.signaturesTrend || 0;

  // Filter pending approvals by document
  const filteredPendingApprovals = pendingApprovalsData?.filter((approval: any) =>
    pendingDocFilter === 'all' || approval.documentId.toString() === pendingDocFilter
  ) || [];

  // Filter documents by status and time period
  const filteredDocuments = (documentsData || []).filter((doc: any) => {
    // Status filter
    if (docStatusFilter === 'active' && !doc.shareEnabled) return false;
    if (docStatusFilter === 'inactive' && doc.shareEnabled) return false;

    // Time period filter would need backend support - for now just status
    // TODO: Backend needs to support time filtering on documents endpoint

    return true;
  });

  // Approve single NDA mutation
  const approveMutation = useMutation({
    mutationFn: async ({ docId, signatureId }: { docId: number; signatureId: number }) => {
      const response = await apiRequest("POST", `/api/cim/${docId}/nda-signatures/${signatureId}/approve`, {});
      return response.json();
    },
    onMutate: async ({ signatureId }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/analytics/pending-approvals"] });

      // Snapshot the previous value
      const previousApprovals = queryClient.getQueryData(["/api/analytics/pending-approvals"]);

      // Optimistically update by removing the approved item
      queryClient.setQueryData(["/api/analytics/pending-approvals"], (old: any) => {
        if (!old) return old;
        return old.filter((approval: any) => approval.id !== signatureId);
      });

      return { previousApprovals };
    },
    onSuccess: () => {
      toast({
        title: "Approved",
        description: "NDA signature has been approved successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/pending-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/overview"] });
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousApprovals) {
        queryClient.setQueryData(["/api/analytics/pending-approvals"], context.previousApprovals);
      }
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to approve NDA",
        variant: "destructive",
      });
    },
  });

  // Reject single NDA mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ docId, signatureId }: { docId: number; signatureId: number }) => {
      const response = await apiRequest("POST", `/api/cim/${docId}/nda-signatures/${signatureId}/reject`, {});
      return response.json();
    },
    onMutate: async ({ signatureId }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/analytics/pending-approvals"] });

      // Snapshot the previous value
      const previousApprovals = queryClient.getQueryData(["/api/analytics/pending-approvals"]);

      // Optimistically update by removing the rejected item
      queryClient.setQueryData(["/api/analytics/pending-approvals"], (old: any) => {
        if (!old) return old;
        return old.filter((approval: any) => approval.id !== signatureId);
      });

      return { previousApprovals };
    },
    onSuccess: () => {
      toast({
        title: "Rejected",
        description: "NDA signature has been rejected",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/pending-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/overview"] });
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousApprovals) {
        queryClient.setQueryData(["/api/analytics/pending-approvals"], context.previousApprovals);
      }
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to reject NDA",
        variant: "destructive",
      });
    },
  });

  // Bulk approve all mutation
  const bulkApproveMutation = useMutation({
    mutationFn: async () => {
      const approvals = filteredPendingApprovals.map((approval: any) => ({
        docId: approval.documentId,
        signatureId: approval.id
      }));

      await Promise.all(
        approvals.map(({ docId, signatureId }) =>
          apiRequest("POST", `/api/cim/${docId}/nda-signatures/${signatureId}/approve`, {})
        )
      );
    },
    onMutate: async () => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/analytics/pending-approvals"] });

      // Snapshot the previous value
      const previousApprovals = queryClient.getQueryData(["/api/analytics/pending-approvals"]);

      // Get the IDs of all items being approved
      const approvingIds = filteredPendingApprovals.map((approval: any) => approval.id);

      // Optimistically update by removing all approved items
      queryClient.setQueryData(["/api/analytics/pending-approvals"], (old: any) => {
        if (!old) return old;
        return old.filter((approval: any) => !approvingIds.includes(approval.id));
      });

      return { previousApprovals, count: filteredPendingApprovals.length };
    },
    onSuccess: (data, variables, context) => {
      toast({
        title: "Bulk Approved",
        description: `${context?.count || 0} NDA signatures have been approved`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/pending-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/overview"] });
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousApprovals) {
        queryClient.setQueryData(["/api/analytics/pending-approvals"], context.previousApprovals);
      }
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to approve NDAs",
        variant: "destructive",
      });
    },
  });

  // Batch approve selected signatures mutation
  const batchApproveSelectedMutation = useMutation({
    mutationFn: async (signatureIds: number[]) => {
      const approvals = filteredPendingApprovals
        .filter((approval: any) => signatureIds.includes(approval.id))
        .map((approval: any) => ({
          docId: approval.documentId,
          signatureId: approval.id
        }));

      await Promise.all(
        approvals.map(({ docId, signatureId }) =>
          apiRequest("POST", `/api/cim/${docId}/nda-signatures/${signatureId}/approve`, {})
        )
      );
    },
    onMutate: async (signatureIds) => {
      await queryClient.cancelQueries({ queryKey: ["/api/analytics/pending-approvals"] });
      const previousApprovals = queryClient.getQueryData(["/api/analytics/pending-approvals"]);

      queryClient.setQueryData(["/api/analytics/pending-approvals"], (old: any) => {
        if (!old) return old;
        return old.filter((approval: any) => !signatureIds.includes(approval.id));
      });

      return { previousApprovals, count: signatureIds.length };
    },
    onSuccess: (data, variables, context) => {
      toast({
        title: "Signers Approved",
        description: `${context?.count || 0} NDA signatures have been approved`,
      });
      setSelectedSignatures([]);
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/pending-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/overview"] });
    },
    onError: (error, variables, context) => {
      if (context?.previousApprovals) {
        queryClient.setQueryData(["/api/analytics/pending-approvals"], context.previousApprovals);
      }
      toast({
        title: "Batch Approval Failed",
        description: error instanceof Error ? error.message : "Failed to approve signers",
        variant: "destructive",
      });
    }
  });

  // Batch reject selected signatures mutation
  const batchRejectSelectedMutation = useMutation({
    mutationFn: async (signatureIds: number[]) => {
      const rejections = filteredPendingApprovals
        .filter((approval: any) => signatureIds.includes(approval.id))
        .map((approval: any) => ({
          docId: approval.documentId,
          signatureId: approval.id
        }));

      await Promise.all(
        rejections.map(({ docId, signatureId }) =>
          apiRequest("POST", `/api/cim/${docId}/nda-signatures/${signatureId}/reject`, {})
        )
      );
    },
    onMutate: async (signatureIds) => {
      await queryClient.cancelQueries({ queryKey: ["/api/analytics/pending-approvals"] });
      const previousApprovals = queryClient.getQueryData(["/api/analytics/pending-approvals"]);

      queryClient.setQueryData(["/api/analytics/pending-approvals"], (old: any) => {
        if (!old) return old;
        return old.filter((approval: any) => !signatureIds.includes(approval.id));
      });

      return { previousApprovals, count: signatureIds.length };
    },
    onSuccess: (data, variables, context) => {
      toast({
        title: "Signers Rejected",
        description: `${context?.count || 0} NDA signatures have been rejected`,
      });
      setSelectedSignatures([]);
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/pending-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/overview"] });
    },
    onError: (error, variables, context) => {
      if (context?.previousApprovals) {
        queryClient.setQueryData(["/api/analytics/pending-approvals"], context.previousApprovals);
      }
      toast({
        title: "Batch Rejection Failed",
        description: error instanceof Error ? error.message : "Failed to reject signers",
        variant: "destructive",
      });
    }
  });

  // Selection helper functions
  const toggleSignatureSelection = (signatureId: number) => {
    setSelectedSignatures(prev =>
      prev.includes(signatureId)
        ? prev.filter(id => id !== signatureId)
        : [...prev, signatureId]
    );
  };

  const selectAllSignatures = () => {
    setSelectedSignatures(filteredPendingApprovals.map((sig: any) => sig.id));
  };

  const clearSelections = () => {
    setSelectedSignatures([]);
  };

  // Export selected signatures to CSV
  const exportSignaturesToCSV = () => {
    const selectedSigs = selectedSignatures.length > 0
      ? filteredPendingApprovals.filter((sig: any) => selectedSignatures.includes(sig.id))
      : filteredPendingApprovals;

    const csvData = selectedSigs.map((sig: any) => ({
      'Signer Name': sig.signerName,
      'Document': sig.documentTitle,
      'Email': sig.signerEmail,
      'Location': sig.signerLocation || 'Unknown',
      'Signed Date': format(new Date(sig.signedAt), 'yyyy-MM-dd HH:mm:ss')
    }));

    const headers = Object.keys(csvData[0] || {});
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => headers.map(header => `"${row[header as keyof typeof row]}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pending-nda-approvals-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    toast({
      title: "Export Complete",
      description: `Exported ${csvData.length} signatures to CSV`
    });
  };

  // Scroll to pending approvals section
  const scrollToPendingApprovals = () => {
    const element = document.getElementById('pending-approvals');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Export analytics data as CSV
  const handleExport = () => {
    if (!documentsData || documentsData.length === 0) {
      toast({
        title: "No Data",
        description: "No analytics data available to export",
        variant: "destructive",
      });
      return;
    }

    // Create CSV content
    const headers = ['Document Name', 'Views', 'Signatures', 'Status'];
    const rows = documentsData.map((doc: any) => [
      doc.title,
      doc.views,
      doc.signatures,
      doc.shareEnabled ? 'Active' : 'Inactive'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `analytics-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Exported",
      description: "Analytics data has been downloaded as CSV",
    });
  };

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
              <p className="text-xs text-gray-500 mt-1">
                {dateRange === '7d' ? 'Last 7 days' : dateRange === '30d' ? 'Last 30 days' : dateRange === '90d' ? 'Last 90 days' : 'All time'}
              </p>
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
              <p className="text-xs text-gray-500 mt-1">
                {dateRange === '7d' ? 'Last 7 days' : dateRange === '30d' ? 'Last 30 days' : dateRange === '90d' ? 'Last 90 days' : 'All time'}
              </p>
              {signaturesTrend !== 0 && (
                <div className={`flex items-center gap-1 text-sm mt-2 ${signaturesTrend > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {signaturesTrend > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  <span>{Math.abs(signaturesTrend)}% from last period</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pending Approvals */}
          <Card
            className="bg-white shadow-md border border-gray-200 hover:shadow-lg transition-shadow cursor-pointer"
            onClick={scrollToPendingApprovals}
          >
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
              <p className="text-sm text-gray-500 mt-2">
                {pendingApprovals > 0 ? 'Click to view & approve' : 'All caught up!'}
              </p>
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

        {/* Pending NDA Approvals Section */}
        <Card className="bg-white shadow-md border border-gray-200" id="pending-approvals">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-orange-600" />
                Pending NDA Approvals
              </CardTitle>
              <div className="flex items-center gap-3">
                {/* See All / Show Less Toggle */}
                {filteredPendingApprovals.length > 10 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAllPendingApprovals(!showAllPendingApprovals)}
                  >
                    {showAllPendingApprovals
                      ? 'Show Less'
                      : `See All (${filteredPendingApprovals.length})`}
                  </Button>
                )}

                {/* Document Filter */}
                <Select value={pendingDocFilter} onValueChange={setPendingDocFilter}>
                  <SelectTrigger className="w-56">
                    <SelectValue placeholder="Filter by document" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Documents</SelectItem>
                    {documentsData?.map((doc: any) => (
                      <SelectItem key={doc.id} value={doc.id.toString()}>
                        {doc.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Bulk Approve Button */}
                {filteredPendingApprovals.length > 0 && (
                  <Button
                    onClick={() => bulkApproveMutation.mutate()}
                    disabled={bulkApproveMutation.isPending}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCheck className="h-4 w-4 mr-2" />
                    Approve All ({filteredPendingApprovals.length})
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Bulk Actions Bar */}
            {selectedSignatures.length > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-4 mb-4 bg-blue-50 border border-blue-200 rounded-lg">
                <span className="text-sm text-gray-700 font-medium">
                  {selectedSignatures.length} selected
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => batchApproveSelectedMutation.mutate(selectedSignatures)}
                    disabled={batchApproveSelectedMutation.isPending}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    {batchApproveSelectedMutation.isPending ? "Approving..." : `Approve ${selectedSignatures.length}`}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => batchRejectSelectedMutation.mutate(selectedSignatures)}
                    disabled={batchRejectSelectedMutation.isPending}
                    className="text-red-600 border-red-300 hover:bg-red-50"
                  >
                    <X className="h-4 w-4 mr-2" />
                    {batchRejectSelectedMutation.isPending ? "Rejecting..." : `Reject ${selectedSignatures.length}`}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const selectedSigs = filteredPendingApprovals.filter((sig: any) => selectedSignatures.includes(sig.id));
                      const emails = selectedSigs.map((sig: any) => sig.signerEmail).join(', ');
                      navigator.clipboard.writeText(emails);
                      toast({
                        title: "Email addresses copied",
                        description: `${selectedSigs.length} email address${selectedSigs.length > 1 ? 'es' : ''} copied to clipboard`
                      });
                    }}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Emails
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportSignaturesToCSV}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearSelections}
                  >
                    Clear
                  </Button>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              {filteredPendingApprovals.length > 0 ? (
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="w-12 py-2 px-4">
                        <input
                          type="checkbox"
                          checked={selectedSignatures.length === filteredPendingApprovals.length && filteredPendingApprovals.length > 0}
                          onChange={() => {
                            if (selectedSignatures.length === filteredPendingApprovals.length) {
                              clearSelections();
                            } else {
                              selectAllSignatures();
                            }
                          }}
                          className="rounded"
                        />
                      </th>
                      <th className="text-left py-2 px-4 font-semibold text-sm text-gray-700">Signer Name</th>
                      <th className="text-left py-2 px-4 font-semibold text-sm text-gray-700">Document</th>
                      <th className="text-left py-2 px-4 font-semibold text-sm text-gray-700">Email</th>
                      <th className="text-left py-2 px-4 font-semibold text-sm text-gray-700">Location</th>
                      <th className="text-center py-2 px-4 font-semibold text-sm text-gray-700">Signed Date</th>
                      <th className="text-center py-2 px-4 font-semibold text-sm text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(showAllPendingApprovals ? filteredPendingApprovals : filteredPendingApprovals.slice(0, 10)).map((approval: any) => (
                      <tr key={approval.id} className={`border-b hover:bg-gray-50 transition-colors ${selectedSignatures.includes(approval.id) ? 'bg-blue-50' : ''}`}>
                        <td className="py-2 px-4">
                          <input
                            type="checkbox"
                            checked={selectedSignatures.includes(approval.id)}
                            onChange={() => toggleSignatureSelection(approval.id)}
                            className="rounded"
                          />
                        </td>
                        <td className="py-2 px-4">
                          <button
                            onClick={() => {
                              setViewingContact({
                                id: approval.id,
                                name: approval.signerName,
                                email: approval.signerEmail,
                                location: approval.signerLocation,
                                status: 'new',
                                totalDocumentViews: 1,
                                firstSeenAt: approval.signedAt,
                                lastSeenAt: approval.signedAt,
                                ipAddress: approval.signerIpAddress || '',
                                tags: []
                              });
                              setIsContactModalOpen(true);
                            }}
                            className="text-blue-600 hover:underline text-sm text-left"
                          >
                            {approval.signerName}
                          </button>
                        </td>
                        <td className="py-2 px-4">
                          <a
                            href={`/documents/${approval.documentId}?tab=nda`}
                            className="text-blue-600 hover:underline text-sm"
                          >
                            {approval.documentTitle}
                          </a>
                        </td>
                        <td className="py-2 px-4 text-sm text-gray-600">{approval.signerEmail}</td>
                        <td className="py-2 px-4 text-sm text-gray-600">
                          {approval.signerLocation || 'Unknown'}
                        </td>
                        <td className="text-center py-2 px-4 text-sm text-gray-600">
                          {format(new Date(approval.signedAt), 'MMM dd, yyyy')}
                        </td>
                        <td className="text-center py-2 px-4">
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => approveMutation.mutate({
                                docId: approval.documentId,
                                signatureId: approval.id
                              })}
                              disabled={approveMutation.isPending}
                              className="text-green-600 border-green-300 hover:bg-green-50"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => rejectMutation.mutate({
                                docId: approval.documentId,
                                signatureId: approval.id
                              })}
                              disabled={rejectMutation.isPending}
                              className="text-red-600 border-red-300 hover:bg-red-50"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check className="h-8 w-8 text-green-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">All Caught Up!</h3>
                  <p className="text-gray-600">
                    {pendingDocFilter === 'all'
                      ? 'No pending NDA approvals across all documents'
                      : 'No pending NDA approvals for this document'}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Signature Location Map */}
        <Card className="bg-white shadow-md border border-gray-200 mt-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <MapPin className="h-5 w-5 text-blue-600" />
                Signature Locations
              </CardTitle>
              <Select value={mapDocFilter} onValueChange={setMapDocFilter}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Filter by document" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Documents</SelectItem>
                  {documentsData?.map((doc: any) => (
                    <SelectItem key={doc.id} value={doc.id.toString()}>
                      {doc.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <InvestorHeatMap
              contacts={
                (allSignaturesData || [])
                  .filter((sig: any) => mapDocFilter === 'all' || sig.documentId.toString() === mapDocFilter)
                  .map((sig: any) => ({
                    location: sig.signerLocation || 'Unknown',
                    email: sig.signerEmail,
                    name: sig.signerName
                  }))
              }
            />
          </CardContent>
        </Card>

        {/* Document Performance Table - Top 5 */}
        <Card className="bg-white shadow-md border border-gray-200 mt-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-bold">Most Active Documents</CardTitle>
              <div className="flex items-center gap-3">
                {/* Status Filter */}
                <Select value={docStatusFilter} onValueChange={setDocStatusFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active Only</SelectItem>
                    <SelectItem value="inactive">Inactive Only</SelectItem>
                  </SelectContent>
                </Select>

                {/* Time Period Filter */}
                <Select value={docTimeFilter} onValueChange={setDocTimeFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="7d">Last 7 days</SelectItem>
                    <SelectItem value="30d">Last 30 days</SelectItem>
                    <SelectItem value="90d">Last 90 days</SelectItem>
                  </SelectContent>
                </Select>

                {/* See All Toggle */}
                {documentsData && documentsData.length > 5 && !showAllDocuments && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAllDocuments(true)}
                  >
                    See All ({documentsData.length})
                  </Button>
                )}
                {showAllDocuments && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAllDocuments(false)}
                  >
                    Show Top 5
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-semibold text-sm text-gray-700">Document Name</th>
                    <th className="text-center py-3 px-4 font-semibold text-sm text-gray-700">Views</th>
                    <th className="text-center py-3 px-4 font-semibold text-sm text-gray-700">Signatures</th>
                    <th className="text-center py-3 px-4 font-semibold text-sm text-gray-700">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocuments && filteredDocuments.length > 0 ? (
                    (showAllDocuments ? filteredDocuments : filteredDocuments.slice(0, 5)).map((doc: any) => (
                      <tr key={doc.id} className="border-b hover:bg-gray-50 cursor-pointer transition-colors">
                        <td className="py-3 px-4">
                          <a href={`/documents/${doc.id}`} className="text-blue-600 hover:underline font-medium">
                            {doc.title}
                          </a>
                        </td>
                        <td className="text-center py-3 px-4">{doc.views}</td>
                        <td className="text-center py-3 px-4">{doc.signatures}</td>
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
                      <td colSpan={4} className="text-center py-8 text-gray-500">
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

      {/* Contact Detail Modal */}
      <ContactDetailModal
        contact={viewingContact}
        isOpen={isContactModalOpen}
        onClose={() => {
          setIsContactModalOpen(false);
          setViewingContact(null);
        }}
        onUpdate={() => {
          // Optionally refresh the data if contact is updated
          queryClient.invalidateQueries({ queryKey: ["/api/analytics/pending-approvals"] });
        }}
      />
    </div>
  );
}
