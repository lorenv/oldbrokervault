import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { TablePagination } from "@/components/ui/pagination";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  Shield,
  Check,
  X,
  Clock,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  FileText,
  Settings,
  ExternalLink,
  Loader2,
  Users,
  CheckCircle,
  XCircle,
} from "lucide-react";

interface NdaSignature {
  id: number;
  signerName: string;
  signerEmail: string;
  signerLocation: string;
  signedAt: string;
  approved: boolean;
  approvedAt: string | null;
  rejected: boolean;
  rejectedAt: string | null;
  stage: string | null;
  cimDocumentId: number;
  documentTitle: string;
  dealId: number | null;
  dealName: string | null;
}

interface NdaSummary {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

function getStatusBadge(sig: NdaSignature) {
  if (sig.rejected) {
    return <Badge className="bg-red-100 text-red-700 text-xs">Rejected</Badge>;
  }
  if (sig.approved) {
    return <Badge className="bg-green-100 text-green-700 text-xs">Approved</Badge>;
  }
  return <Badge className="bg-yellow-100 text-yellow-700 text-xs">Pending</Badge>;
}

function getStatusLabel(sig: NdaSignature): string {
  if (sig.rejected) return "rejected";
  if (sig.approved) return "approved";
  return "pending";
}

export default function NdasPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [docFilter, setDocFilter] = useState("all");
  const [dealFilter, setDealFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [sortField, setSortField] = useState("signedAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, docFilter, dealFilter]);

  // Fetch NDA signatures
  const { data: ndaData, isLoading } = useQuery({
    queryKey: ["/api/ndas", statusFilter, searchQuery, docFilter, dealFilter, currentPage, pageSize, sortField, sortDirection],
    queryFn: () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (searchQuery) params.set("search", searchQuery);
      if (docFilter !== "all") params.set("cimDocumentId", docFilter);
      if (dealFilter !== "all") params.set("dealId", dealFilter);
      params.set("page", currentPage.toString());
      params.set("pageSize", pageSize.toString());
      params.set("sortField", sortField);
      params.set("sortOrder", sortDirection);
      return apiRequest("GET", `/api/ndas?${params.toString()}`).then((res) => res.json());
    },
  });

  // Fetch summary stats
  const { data: summary } = useQuery<NdaSummary>({
    queryKey: ["/api/ndas/summary"],
  });

  // Fetch user's documents for filter dropdown
  const { data: docsData } = useQuery({
    queryKey: ["/api/cim-documents"],
    queryFn: () => apiRequest("GET", "/api/cim-documents").then((res) => res.json()),
  });

  // Fetch user's deals for filter dropdown
  const { data: dealsData } = useQuery({
    queryKey: ["/api/crm/deals"],
    queryFn: () => apiRequest("GET", "/api/crm/deals").then((res) => res.json()),
  });

  const signatures: NdaSignature[] = ndaData?.signatures || [];
  const total = ndaData?.total || 0;
  const totalPages = Math.ceil(total / pageSize);
  const documents = Array.isArray(docsData) ? docsData : [];
  const allDeals = Array.isArray(dealsData) ? dealsData : (dealsData as any)?.deals || [];

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest("POST", `/api/ndas/${id}/approve`).then((res) => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ndas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/pending-approvals"] });
      toast({ title: "NDA approved" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to approve NDA", variant: "destructive" });
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest("POST", `/api/ndas/${id}/reject`).then((res) => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ndas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/pending-approvals"] });
      toast({ title: "NDA rejected" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to reject NDA", variant: "destructive" });
    },
  });

  // Batch approve
  const batchApproveMutation = useMutation({
    mutationFn: (signatureIds: number[]) =>
      apiRequest("POST", "/api/ndas/approve-batch", { body: { signatureIds } }).then((res) => res.json()),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ndas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/pending-approvals"] });
      setSelectedIds(new Set());
      toast({ title: `${data.count} NDA(s) approved` });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to batch approve", variant: "destructive" });
    },
  });

  // Batch reject
  const batchRejectMutation = useMutation({
    mutationFn: (signatureIds: number[]) =>
      apiRequest("POST", "/api/ndas/reject-batch", { body: { signatureIds } }).then((res) => res.json()),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ndas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/pending-approvals"] });
      setSelectedIds(new Set());
      toast({ title: `${data.count} NDA(s) rejected` });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to batch reject", variant: "destructive" });
    },
  });

  // Sort
  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (field: string) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 text-gray-400" />;
    return sortDirection === "asc" ? (
      <ArrowUp className="h-3 w-3 text-blue-600" />
    ) : (
      <ArrowDown className="h-3 w-3 text-blue-600" />
    );
  };

  // Selection
  const toggleSelectId = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === signatures.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(signatures.map((s) => s.id)));
    }
  };

  // Get selected pending signatures for batch actions
  const selectedPendingIds = useMemo(() => {
    return signatures
      .filter((s) => selectedIds.has(s.id) && !s.approved && !s.rejected)
      .map((s) => s.id);
  }, [signatures, selectedIds]);

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">NDAs</h1>
          <p className="text-gray-600 text-sm mt-1">Manage NDA signatures across all deals</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/settings/nda-templates">
              <FileText className="h-4 w-4 mr-1.5" />
              Templates
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/settings/nda-whitelist">
              <Settings className="h-4 w-4 mr-1.5" />
              Whitelist Rules
            </Link>
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <Users className="h-4 w-4 text-gray-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total</p>
                <p className="text-2xl font-bold text-gray-900">{summary?.total ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-50 rounded-lg">
                <Clock className="h-4 w-4 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-gray-900">{summary?.pending ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-50 rounded-lg">
                <CheckCircle className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Approved</p>
                <p className="text-2xl font-bold text-gray-900">{summary?.approved ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-50 rounded-lg">
                <XCircle className="h-4 w-4 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Rejected</p>
                <p className="text-2xl font-bold text-gray-900">{summary?.rejected ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Select value={docFilter} onValueChange={setDocFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Document" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Documents</SelectItem>
            {documents.map((doc: any) => (
              <SelectItem key={doc.id} value={doc.id.toString()}>
                {doc.title?.slice(0, 40) || `Document #${doc.id}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={dealFilter} onValueChange={setDealFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Deal" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Deals</SelectItem>
            {allDeals.map((deal: any) => (
              <SelectItem key={deal.id} value={deal.id.toString()}>
                {deal.name?.slice(0, 35) || `Deal #${deal.id}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 mb-3 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
          <span className="text-sm text-blue-700 font-medium">
            {selectedIds.size} selected
          </span>
          {selectedPendingIds.length > 0 && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="text-green-700 border-green-300 hover:bg-green-50"
                onClick={() => batchApproveMutation.mutate(selectedPendingIds)}
                disabled={batchApproveMutation.isPending}
              >
                {batchApproveMutation.isPending ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <Check className="h-3 w-3 mr-1" />
                )}
                Approve ({selectedPendingIds.length})
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-red-700 border-red-300 hover:bg-red-50"
                onClick={() => batchRejectMutation.mutate(selectedPendingIds)}
                disabled={batchRejectMutation.isPending}
              >
                {batchRejectMutation.isPending ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <X className="h-3 w-3 mr-1" />
                )}
                Reject ({selectedPendingIds.length})
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="text-gray-600"
            onClick={() => setSelectedIds(new Set())}
          >
            Clear
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="w-10 px-3 py-3">
                  <Checkbox
                    checked={signatures.length > 0 && selectedIds.size === signatures.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </th>
                <th
                  className="text-left px-3 py-3 text-xs font-medium text-gray-600 uppercase cursor-pointer hover:text-gray-900"
                  style={{ width: "20%" }}
                  onClick={() => toggleSort("signerName")}
                >
                  <div className="flex items-center gap-1">Signer {getSortIcon("signerName")}</div>
                </th>
                <th className="text-left px-3 py-3 text-xs font-medium text-gray-600 uppercase" style={{ width: "18%" }}>
                  Email
                </th>
                <th className="text-left px-3 py-3 text-xs font-medium text-gray-600 uppercase" style={{ width: "18%" }}>
                  Document / Deal
                </th>
                <th
                  className="text-left px-3 py-3 text-xs font-medium text-gray-600 uppercase cursor-pointer hover:text-gray-900"
                  style={{ width: "12%" }}
                  onClick={() => toggleSort("approved")}
                >
                  <div className="flex items-center gap-1">Status {getSortIcon("approved")}</div>
                </th>
                <th
                  className="text-left px-3 py-3 text-xs font-medium text-gray-600 uppercase cursor-pointer hover:text-gray-900"
                  style={{ width: "12%" }}
                  onClick={() => toggleSort("signedAt")}
                >
                  <div className="flex items-center gap-1">Signed {getSortIcon("signedAt")}</div>
                </th>
                <th className="text-left px-3 py-3 text-xs font-medium text-gray-600 uppercase" style={{ width: "20%" }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                    <p className="mt-2 text-sm text-gray-500">Loading NDAs...</p>
                  </td>
                </tr>
              ) : signatures.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12">
                    <Shield className="h-8 w-8 mx-auto text-gray-300 mb-2" />
                    <p className="text-gray-600 font-medium">No NDA signatures found</p>
                    <p className="text-sm text-gray-500 mt-1">
                      {searchQuery || statusFilter !== "all"
                        ? "Try adjusting your filters"
                        : "NDA signatures will appear here when buyers sign your documents"}
                    </p>
                  </td>
                </tr>
              ) : (
                signatures.map((sig) => {
                  const isPending = !sig.approved && !sig.rejected;
                  return (
                    <tr
                      key={sig.id}
                      className="border-b hover:bg-gray-50 cursor-pointer"
                      onClick={(e) => {
                        // Don't navigate if clicking checkbox or buttons
                        if ((e.target as HTMLElement).closest("button, [role=checkbox], a")) return;
                        setLocation(`/ndas/${sig.id}`);
                      }}
                    >
                      <td className="w-10 px-3 py-3">
                        <Checkbox
                          checked={selectedIds.has(sig.id)}
                          onCheckedChange={() => toggleSelectId(sig.id)}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-medium text-gray-900 truncate">{sig.signerName}</div>
                        {sig.signerLocation && (
                          <div className="text-xs text-gray-500 truncate">{sig.signerLocation}</div>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-sm text-gray-700 truncate block">{sig.signerEmail}</span>
                      </td>
                      <td className="px-3 py-3">
                        <Link
                          href={`/documents/${sig.cimDocumentId}`}
                          className="text-sm text-blue-600 hover:underline truncate block"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {sig.documentTitle}
                        </Link>
                        {sig.dealName && (
                          <Link
                            href={`/deals/${sig.dealId}`}
                            className="text-xs text-gray-500 hover:underline truncate block"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {sig.dealName}
                          </Link>
                        )}
                      </td>
                      <td className="px-3 py-3">{getStatusBadge(sig)}</td>
                      <td className="px-3 py-3">
                        <span className="text-sm text-gray-700">{formatDate(sig.signedAt)}</span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1">
                          {isPending && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs text-green-700 border-green-300 hover:bg-green-50"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  approveMutation.mutate(sig.id);
                                }}
                                disabled={approveMutation.isPending}
                              >
                                <Check className="h-3 w-3 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs text-red-700 border-red-300 hover:bg-red-50"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  rejectMutation.mutate(sig.id);
                                }}
                                disabled={rejectMutation.isPending}
                              >
                                <X className="h-3 w-3 mr-1" />
                                Reject
                              </Button>
                            </>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-gray-600"
                            onClick={(e) => {
                              e.stopPropagation();
                              setLocation(`/ndas/${sig.id}`);
                            }}
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={total}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      </div>
    </div>
  );
}
