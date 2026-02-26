import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, CheckCircle2, Clock, XCircle, AlertCircle, Loader2, ClipboardList } from "lucide-react";

interface NdaStatus {
  signerName: string;
  signedAt: string;
  status: "pending" | "approved" | "rejected";
  approvedAt: string | null;
  documentTitle: string;
}

const statusConfig = {
  pending: {
    icon: Clock,
    color: "text-yellow-600",
    bg: "bg-yellow-50",
    badge: "bg-yellow-100 text-yellow-700 border-yellow-200",
    label: "Pending Review",
    description: "Your NDA signature has been received and is currently being reviewed. You will receive an email once a decision has been made.",
  },
  approved: {
    icon: CheckCircle2,
    color: "text-green-600",
    bg: "bg-green-50",
    badge: "bg-green-100 text-green-700 border-green-200",
    label: "Approved",
    description: "Your NDA has been approved. Check your email for the document access link.",
  },
  rejected: {
    icon: XCircle,
    color: "text-red-600",
    bg: "bg-red-50",
    badge: "bg-red-100 text-red-700 border-red-200",
    label: "Not Approved",
    description: "Your NDA request was not approved at this time. You may contact the document owner for more information.",
  },
};

export function NdaStatusPage() {
  const [, params] = useRoute("/nda/status/:token");
  const token = params?.token;

  const { data, isLoading, error } = useQuery<NdaStatus>({
    queryKey: [`/api/nda/status/${token}`],
    enabled: !!token,
    refetchInterval: (query) => {
      // Auto-refresh every 30 seconds while pending
      if (query.state.data?.status === "pending") return 30000;
      return false;
    },
  });

  // Check if a buyer survey exists for this token
  const { data: formData } = useQuery<{ survey: any; response: any } | null>({
    queryKey: [`/api/buyer-form/${token}`],
    enabled: !!token && !!data,
  });

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="flex justify-center items-center min-h-[50vh]">
          <Card className="max-w-md">
            <CardContent className="pt-6 text-center">
              <AlertCircle className="h-8 w-8 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">Invalid status link. Please check the URL and try again.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="flex justify-center items-center min-h-[50vh]">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600 mb-3" />
              <p className="text-gray-600">Checking NDA status...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="flex justify-center items-center min-h-[50vh]">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6 text-center">
              <AlertCircle className="h-8 w-8 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-700 font-medium mb-1">NDA Not Found</p>
              <p className="text-gray-500 text-sm">This status link may have expired or is invalid.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const config = statusConfig[data.status];
  const StatusIcon = config.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="flex justify-center items-center min-h-[50vh]">
        <Card className="max-w-lg w-full">
          <CardHeader className="text-center pb-4">
            <div className={`mx-auto mb-4 p-3 rounded-full ${config.bg}`}>
              <StatusIcon className={`h-6 w-6 ${config.color}`} />
            </div>
            <CardTitle className="text-xl">NDA Status</CardTitle>
            <CardDescription>{data.documentTitle}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <Badge variant="outline" className={`text-sm px-3 py-1 ${config.badge}`}>
                {config.label}
              </Badge>
            </div>

            <p className="text-sm text-gray-600 text-center">{config.description}</p>

            <div className="border-t pt-4 mt-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Signer</span>
                <span className="text-gray-900 font-medium">{data.signerName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Signed</span>
                <span className="text-gray-900">{new Date(data.signedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
              </div>
              {data.approvedAt && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Approved</span>
                  <span className="text-gray-900">{new Date(data.approvedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
              )}
            </div>

            {data.status === "pending" && (
              <p className="text-xs text-gray-400 text-center pt-2">
                This page auto-refreshes. You can bookmark it to check back later.
              </p>
            )}

            {/* Buyer Profile CTA */}
            {formData?.survey && (
              <div className="border-t pt-4 mt-4">
                {formData.response ? (
                  <div className="flex items-center justify-center gap-2 text-sm text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Buyer Profile Submitted</span>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-sm text-gray-600 mb-3">
                      Complete your buyer profile to help expedite the review process.
                    </p>
                    <Button asChild variant="outline" className="gap-2">
                      <a href={`/buyer-form/${token}`}>
                        <ClipboardList className="h-4 w-4" />
                        Complete Buyer Profile
                      </a>
                    </Button>
                  </div>
                )}
              </div>
            )}

            <div className="text-center pt-2">
              <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400">
                <Shield className="h-3 w-3" />
                <span>Secured by BrokerVault</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
