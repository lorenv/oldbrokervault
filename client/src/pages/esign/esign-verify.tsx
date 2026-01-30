import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2,
  AlertCircle,
  FileSignature,
  User,
  Calendar,
  MapPin,
  Shield,
  Clock,
} from "lucide-react";
import { format } from "date-fns";

interface VerificationData {
  valid: boolean;
  envelope: {
    id: number;
    title: string;
    status: string;
    completedAt: string | null;
    createdAt: string;
  };
  signers: Array<{
    name: string;
    email: string;
    signedAt: string | null;
    ipAddress: string | null;
    location: string | null;
  }>;
  auditLog: Array<{
    action: string;
    actorName: string | null;
    actorEmail: string | null;
    createdAt: string;
    ipAddress: string | null;
    location: string | null;
  }>;
}

const actionLabels: Record<string, string> = {
  envelope_created: 'Document created',
  envelope_sent: 'Document sent for signing',
  email_sent: 'Signing invitation sent',
  recipient_viewed: 'Document viewed',
  field_completed: 'Field completed',
  recipient_signed: 'Signature completed',
  envelope_completed: 'All signatures collected',
  recipient_declined: 'Signer declined',
  envelope_declined: 'Document declined',
  envelope_voided: 'Document voided',
};

export default function EsignVerify() {
  const [, params] = useRoute("/esign/verify/:envelopeId");
  const envelopeId = params?.envelopeId;

  const { data, isLoading, error } = useQuery<VerificationData>({
    queryKey: ["/api/esign/verify", envelopeId],
    queryFn: async () => {
      if (!envelopeId) throw new Error('No envelope ID');
      const res = await fetch(`/api/esign/verify/${envelopeId}`);
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to verify document');
      }
      return res.json();
    },
    enabled: !!envelopeId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
              <h2 className="text-lg font-medium mb-2">Verification Failed</h2>
              <p className="text-gray-500">
                {(error as any)?.message || "Unable to verify this document."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isCompleted = data.envelope.status === 'completed';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 py-12">
      <div className="container mx-auto px-4 max-w-3xl">
        {/* Verification Status */}
        <Card className={`mb-6 ${isCompleted ? 'border-green-200 bg-green-50/50' : 'border-yellow-200 bg-yellow-50/50'}`}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                isCompleted ? 'bg-green-100' : 'bg-yellow-100'
              }`}>
                {isCompleted ? (
                  <CheckCircle2 className="h-10 w-10 text-green-600" />
                ) : (
                  <Clock className="h-10 w-10 text-yellow-600" />
                )}
              </div>
              <div>
                <h1 className="text-2xl font-bold mb-1">
                  {isCompleted ? 'Document Verified' : 'Document In Progress'}
                </h1>
                <p className={isCompleted ? 'text-green-700' : 'text-yellow-700'}>
                  {isCompleted
                    ? 'This document has been electronically signed by all parties.'
                    : 'This document is still awaiting signatures.'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Document Details */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSignature className="h-5 w-5" />
              Document Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Document Title</p>
                <p className="font-medium">{data.envelope.title}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <Badge className={
                  isCompleted ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                }>
                  {data.envelope.status.charAt(0).toUpperCase() + data.envelope.status.slice(1)}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-gray-500">Created</p>
                <p className="font-medium">
                  {format(new Date(data.envelope.createdAt), "MMM d, yyyy 'at' h:mm a")}
                </p>
              </div>
              {data.envelope.completedAt && (
                <div>
                  <p className="text-sm text-gray-500">Completed</p>
                  <p className="font-medium">
                    {format(new Date(data.envelope.completedAt), "MMM d, yyyy 'at' h:mm a")}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Signers */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Signers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.signers.map((signer, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <User className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium">{signer.name}</p>
                      <p className="text-sm text-gray-500">{signer.email}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    {signer.signedAt ? (
                      <>
                        <div className="flex items-center gap-1 text-green-600 text-sm font-medium">
                          <CheckCircle2 className="h-4 w-4" />
                          Signed
                        </div>
                        <p className="text-xs text-gray-500">
                          {format(new Date(signer.signedAt), "MMM d, yyyy")}
                        </p>
                        {signer.location && (
                          <p className="text-xs text-gray-400 flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {signer.location}
                          </p>
                        )}
                      </>
                    ) : (
                      <Badge variant="outline" className="text-gray-500">
                        Pending
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Audit Trail */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Audit Trail
            </CardTitle>
            <CardDescription>
              Complete history of document activity
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
              <div className="space-y-4">
                {data.auditLog.map((entry, index) => (
                  <div key={index} className="relative flex gap-4 pl-10">
                    <div className="absolute left-2 top-1 w-4 h-4 rounded-full bg-blue-500 border-2 border-white" />
                    <div className="flex-1">
                      <p className="font-medium text-sm">
                        {actionLabels[entry.action] || entry.action}
                      </p>
                      {entry.actorEmail && (
                        <p className="text-sm text-gray-500">
                          {entry.actorName || entry.actorEmail}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(entry.createdAt), "MMM d, yyyy 'at' h:mm a")}
                        </span>
                        {entry.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {entry.location}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Document ID: {data.envelope.id}</p>
          <p className="mt-1">
            This verification was generated by Broker Vault's E-Signature system
          </p>
        </div>
      </div>
    </div>
  );
}
