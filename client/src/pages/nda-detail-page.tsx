import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  ArrowLeft,
  Check,
  X,
  Download,
  Mail,
  MapPin,
  Calendar,
  Clock,
  Shield,
  FileText,
  Briefcase,
  Globe,
  Link2,
  Loader2,
  User,
  ExternalLink,
} from "lucide-react";

interface NdaDetail {
  id: number;
  signerName: string;
  signerEmail: string;
  signerIpAddress: string;
  signerLocation: string;
  signedAt: string;
  approved: boolean;
  approvedAt: string | null;
  rejected: boolean;
  rejectedAt: string | null;
  stage: string | null;
  fieldValues: Record<string, any>;
  statusCheckToken: string | null;
  cimDocumentId: number;
  documentTitle: string;
  dealId: number | null;
  dealName: string | null;
  templateName: string | null;
  ndaApprovalRequired: boolean;
  accessToken: {
    token: string;
    isActive: boolean;
    lastAccessedAt: string | null;
  } | null;
}

function getStatusBadge(detail: NdaDetail) {
  if (detail.rejected) {
    return <Badge className="bg-red-100 text-red-700">Rejected</Badge>;
  }
  if (detail.approved) {
    return <Badge className="bg-green-100 text-green-700">Approved</Badge>;
  }
  return <Badge className="bg-yellow-100 text-yellow-700">Pending Approval</Badge>;
}

function formatDateTime(dateStr: string | null) {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

export default function NdaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: detail, isLoading, error } = useQuery<NdaDetail>({
    queryKey: [`/api/ndas/${id}`],
    enabled: !!id,
  });

  const approveMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/ndas/${id}/approve`).then((res) => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/ndas/${id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/ndas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/pending-approvals"] });
      toast({ title: "NDA approved" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to approve NDA", variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/ndas/${id}/reject`).then((res) => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/ndas/${id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/ndas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/pending-approvals"] });
      toast({ title: "NDA rejected" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to reject NDA", variant: "destructive" });
    },
  });

  const handleDownload = async () => {
    if (!detail) return;
    try {
      const response = await fetch(
        `/api/cim/${detail.cimDocumentId}/nda-signatures/${detail.id}/download`,
        { credentials: "include" }
      );
      if (!response.ok) throw new Error("Download failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nda-${detail.signerName.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Error", description: "Failed to download PDF", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Link href="/ndas" className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-4">
          <ArrowLeft className="h-4 w-4" /> Back to NDAs
        </Link>
        <div className="text-center py-12">
          <Shield className="h-8 w-8 mx-auto text-gray-300 mb-2" />
          <p className="text-gray-600 font-medium">NDA signature not found</p>
        </div>
      </div>
    );
  }

  const isPending = !detail.approved && !detail.rejected;
  const fieldEntries = detail.fieldValues && typeof detail.fieldValues === "object"
    ? Object.entries(detail.fieldValues)
    : [];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Back link */}
      <Link href="/ndas" className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to NDAs
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{detail.signerName}</h1>
            {getStatusBadge(detail)}
          </div>
          <p className="text-gray-600 mt-1">{detail.signerEmail}</p>
        </div>
        <div className="flex items-center gap-2">
          {isPending && (
            <>
              <Button
                variant="outline"
                className="text-green-700 border-green-300 hover:bg-green-50"
                onClick={() => approveMutation.mutate()}
                disabled={approveMutation.isPending}
              >
                {approveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-1.5" />
                )}
                Approve
              </Button>
              <Button
                variant="outline"
                className="text-red-700 border-red-300 hover:bg-red-50"
                onClick={() => rejectMutation.mutate()}
                disabled={rejectMutation.isPending}
              >
                {rejectMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <X className="h-4 w-4 mr-1.5" />
                )}
                Reject
              </Button>
            </>
          )}
          <Button variant="outline" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-1.5" />
            Download PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content — left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Document & Deal Context */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-gray-900">Document & Deal</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3">
                <FileText className="h-4 w-4 text-gray-500 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500 uppercase font-medium">CIM Document</p>
                  <Link
                    href={`/documents/${detail.cimDocumentId}`}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    {detail.documentTitle}
                  </Link>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Briefcase className="h-4 w-4 text-gray-500 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500 uppercase font-medium">Deal</p>
                  {detail.dealId ? (
                    <Link
                      href={`/deals/${detail.dealId}`}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      {detail.dealName}
                    </Link>
                  ) : (
                    <p className="text-sm text-gray-600">Not linked to a deal</p>
                  )}
                </div>
              </div>
              {detail.templateName && (
                <div className="flex items-start gap-3">
                  <Shield className="h-4 w-4 text-gray-500 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-medium">NDA Template</p>
                    <Link
                      href="/settings/nda-templates"
                      className="text-sm text-blue-600 hover:underline"
                    >
                      {detail.templateName}
                    </Link>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Signer Details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-gray-900">Signer Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <User className="h-4 w-4 text-gray-500 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-medium">Name</p>
                    <p className="text-sm text-gray-900">{detail.signerName}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Mail className="h-4 w-4 text-gray-500 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-medium">Email</p>
                    <p className="text-sm text-gray-900">{detail.signerEmail}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Globe className="h-4 w-4 text-gray-500 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-medium">IP Address</p>
                    <p className="text-sm text-gray-700 font-mono text-xs">{detail.signerIpAddress}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="h-4 w-4 text-gray-500 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-medium">Location</p>
                    <p className="text-sm text-gray-900">{detail.signerLocation || "Unknown"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Calendar className="h-4 w-4 text-gray-500 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-medium">Signed At</p>
                    <p className="text-sm text-gray-900">{formatDateTime(detail.signedAt)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock className="h-4 w-4 text-gray-500 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-medium">
                      {detail.rejected ? "Rejected At" : "Approved At"}
                    </p>
                    <p className="text-sm text-gray-900">
                      {detail.rejected
                        ? formatDateTime(detail.rejectedAt)
                        : formatDateTime(detail.approvedAt)}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Field Values */}
          {fieldEntries.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold text-gray-900">Custom Field Values</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {fieldEntries.map(([key, value]) => (
                    <div key={key} className="flex items-start justify-between py-2 border-b last:border-0">
                      <span className="text-sm text-gray-600 font-medium">{key}</span>
                      <span className="text-sm text-gray-900 text-right max-w-[60%]">
                        {typeof value === "object" ? JSON.stringify(value) : String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar — right column */}
        <div className="space-y-6">
          {/* Quick Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-gray-900">Quick Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs text-gray-500 uppercase font-medium mb-1">Status</p>
                {getStatusBadge(detail)}
              </div>
              {detail.stage && (
                <div>
                  <p className="text-xs text-gray-500 uppercase font-medium mb-1">Stage</p>
                  <Badge variant="outline" className="text-xs">{detail.stage}</Badge>
                </div>
              )}
              {detail.ndaApprovalRequired && (
                <div>
                  <p className="text-xs text-gray-500 uppercase font-medium mb-1">Approval Required</p>
                  <p className="text-sm text-gray-700">Yes</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Access Token Info */}
          {detail.accessToken && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold text-gray-900">Document Access</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500 uppercase font-medium mb-1">Access Status</p>
                  <Badge
                    className={
                      detail.accessToken.isActive
                        ? "bg-green-100 text-green-700 text-xs"
                        : "bg-gray-100 text-gray-600 text-xs"
                    }
                  >
                    {detail.accessToken.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                {detail.accessToken.lastAccessedAt && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-medium mb-1">Last Accessed</p>
                    <p className="text-sm text-gray-700">{formatDateTime(detail.accessToken.lastAccessedAt)}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Status Check Link */}
          {detail.statusCheckToken && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold text-gray-900">Status Check</CardTitle>
              </CardHeader>
              <CardContent>
                <a
                  href={`/nda/status/${detail.statusCheckToken}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
                >
                  <Link2 className="h-3.5 w-3.5" />
                  View status check page
                  <ExternalLink className="h-3 w-3" />
                </a>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
