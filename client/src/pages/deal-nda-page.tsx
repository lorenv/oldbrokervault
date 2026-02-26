import React, { useState } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import FillableNdaDocument from "@/components/fillable-nda-document";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, CheckCircle, Shield, Loader2 } from "lucide-react";

interface DealNdaInfo {
  id: number;
  name: string | null;
  dealName: string;
  businessLogo: string | null;
  businessName: string | null;
  templateName: string | null;
  approvalRequired: boolean;
  hasTemplate: boolean;
}

interface NdaTemplateData {
  id: number;
  name: string;
  fileContent: string;
  signatureFields: any[];
  pageImages: any[];
  totalPages: number;
}

interface SignResponse {
  success: boolean;
  requiresApproval: boolean;
  statusCheckToken?: string;
  accessToken?: string;
  message: string;
}

export function DealNdaPage() {
  const [match, params] = useRoute("/nda/:shareSlug");
  const shareSlug = params?.shareSlug;

  const [isComplete, setIsComplete] = useState(false);
  const [signResponse, setSignResponse] = useState<SignResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Get URL parameters for pre-filling
  const urlParams = new URLSearchParams(window.location.search);
  const prefilledName = urlParams.get("name") || "";
  const prefilledEmail = urlParams.get("email") || "";

  // Fetch NDA info (public)
  const { data: ndaInfo, isLoading: isLoadingInfo, error: infoError } = useQuery<DealNdaInfo>({
    queryKey: ["/api/nda", shareSlug, "info"],
    queryFn: async () => {
      const res = await fetch(`/api/nda/${shareSlug}`);
      if (!res.ok) throw new Error("NDA not found");
      return res.json();
    },
    enabled: !!shareSlug,
  });

  // Fetch NDA template (public)
  const { data: templateData, isLoading: isLoadingTemplate, error: templateError } = useQuery<NdaTemplateData>({
    queryKey: ["/api/nda", shareSlug, "template"],
    queryFn: async () => {
      const res = await fetch(`/api/nda/${shareSlug}/template`);
      if (!res.ok) throw new Error("Template not found");
      return res.json();
    },
    enabled: !!shareSlug && !!ndaInfo?.hasTemplate,
  });

  // Sign mutation
  const signMutation = useMutation({
    mutationFn: async (fieldValues: Record<string, string>) => {
      const nameField = templateData?.signatureFields.find((f: any) => f.type === "name");
      const emailField = templateData?.signatureFields.find((f: any) => f.type === "email");

      const signerName = prefilledName || (nameField ? fieldValues[nameField.id] : "") || "Unknown";
      const signerEmail = prefilledEmail || (emailField ? fieldValues[emailField.id] : "") || "";

      if (!signerEmail?.trim()) {
        throw new Error("Email address is required");
      }

      const res = await fetch(`/api/nda/${shareSlug}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signerName: signerName.trim(),
          signerEmail: signerEmail.trim(),
          fieldValues,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || "Failed to sign NDA");
      }

      return res.json();
    },
    onSuccess: (data: SignResponse) => {
      setSignResponse(data);
      setIsComplete(true);
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const handleSign = async (fieldValues: Record<string, string>) => {
    setError(null);
    signMutation.mutate(fieldValues);
  };

  // Loading state
  if (isLoadingInfo) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-600 mb-3" />
          <p className="text-gray-600">Loading NDA...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (infoError || !ndaInfo) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-gray-900 mb-1">NDA Not Found</h2>
            <p className="text-sm text-gray-600">
              This NDA link may be invalid or has been deactivated.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Completion state
  if (isComplete && signResponse) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">NDA Signed Successfully</h2>
            <p className="text-gray-600 text-sm">
              {signResponse.requiresApproval
                ? "Thank you for signing. Your NDA is pending approval — you'll receive an email once it's reviewed."
                : "Thank you for signing. Check your email for access to the document."}
            </p>
            {signResponse.statusCheckToken && (
              <p className="text-xs text-gray-500 mt-4">
                You can check your approval status at any time.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main signing view
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          {ndaInfo.businessLogo && (
            <img
              src={ndaInfo.businessLogo}
              alt=""
              className="h-8 w-auto rounded"
            />
          )}
          <div>
            <h1 className="text-lg font-semibold text-gray-900">
              {ndaInfo.name || ndaInfo.dealName}
            </h1>
            {ndaInfo.businessName && (
              <p className="text-sm text-gray-500">{ndaInfo.businessName}</p>
            )}
          </div>
          <div className="ml-auto">
            <div className="flex items-center gap-1.5 text-indigo-600">
              <Shield className="h-4 w-4" />
              <span className="text-sm font-medium">Non-Disclosure Agreement</span>
            </div>
          </div>
        </div>
      </div>

      {/* Template / Signing Form */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {isLoadingTemplate ? (
          <div className="text-center py-16">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-600 mb-3" />
            <p className="text-gray-600">Loading NDA document...</p>
          </div>
        ) : templateError || !templateData ? (
          <Card>
            <CardContent className="p-6 text-center">
              <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
              <p className="text-gray-700 font-medium">Unable to load NDA template</p>
              <p className="text-sm text-gray-500 mt-1">Please contact the sender.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
            <FillableNdaDocument
              documentTitle={templateData.name}
              ndaContent={templateData.fileContent}
              signatureFields={templateData.signatureFields}
              onSubmit={handleSign}
              isLoading={signMutation.isPending}
              prefilledName={prefilledName}
              prefilledEmail={prefilledEmail}
            />
          </>
        )}
      </div>
    </div>
  );
}

export default DealNdaPage;
