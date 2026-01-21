import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  FileSignature,
  ArrowLeft,
  Clock,
  CheckCircle2,
  XCircle,
  Ban,
  Mail,
  Download,
  Send,
  AlertCircle,
  User,
  Calendar,
  MapPin,
  ExternalLink,
  Copy,
  Eye,
  Edit,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";

type EnvelopeStatus = 'draft' | 'sent' | 'completed' | 'voided' | 'declined';
type RecipientStatus = 'pending' | 'sent' | 'viewed' | 'signed' | 'declined';

interface Recipient {
  id: number;
  name: string;
  email: string;
  role: 'signer' | 'cc';
  status: RecipientStatus;
  order: number;
  color: string;
  signedAt: string | null;
  viewedAt: string | null;
  declinedAt: string | null;
  declineReason: string | null;
}

interface AuditEntry {
  id: number;
  action: string;
  ipAddress: string | null;
  userAgent: string | null;
  location: string | null;
  details: Record<string, any>;
  timestamp: string;
}

interface Envelope {
  id: number;
  title: string;
  status: EnvelopeStatus;
  signingOrder: 'sequential' | 'parallel';
  message: string | null;
  documentUrl: string | null;
  signedDocumentUrl: string | null;
  createdAt: string;
  updatedAt: string;
  sentAt: string | null;
  completedAt: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  recipients: Recipient[];
  auditLog: AuditEntry[];
}

const statusConfig: Record<EnvelopeStatus, { label: string; icon: any; color: string }> = {
  draft: { label: 'Draft', icon: Clock, color: 'bg-gray-100 text-gray-700' },
  sent: { label: 'Pending Signatures', icon: Clock, color: 'bg-yellow-100 text-yellow-700' },
  completed: { label: 'Completed', icon: CheckCircle2, color: 'bg-green-100 text-green-700' },
  voided: { label: 'Voided', icon: Ban, color: 'bg-red-100 text-red-700' },
  declined: { label: 'Declined', icon: XCircle, color: 'bg-red-100 text-red-700' },
};

const recipientStatusConfig: Record<RecipientStatus, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-gray-100 text-gray-600' },
  sent: { label: 'Email Sent', color: 'bg-blue-100 text-blue-700' },
  viewed: { label: 'Viewed', color: 'bg-yellow-100 text-yellow-700' },
  signed: { label: 'Signed', color: 'bg-green-100 text-green-700' },
  declined: { label: 'Declined', color: 'bg-red-100 text-red-700' },
};

const actionLabels: Record<string, string> = {
  envelope_created: 'Envelope created',
  envelope_sent: 'Envelope sent',
  email_sent: 'Signing request sent',
  envelope_viewed: 'Envelope viewed',
  signature_completed: 'Signature completed',
  envelope_completed: 'Envelope completed',
  envelope_declined: 'Envelope declined',
  envelope_voided: 'Envelope voided',
  envelope_corrected: 'Envelope corrected',
  reminder_sent: 'Reminder sent',
};

export default function EsignEnvelopeDetail() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/esign/envelope/:id");
  const envelopeId = params?.id || null; // Use string ID (supports both UUID and numeric)

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch envelope details
  const { data: envelopeData, isLoading, error } = useQuery<{
    envelope: Omit<Envelope, 'recipients' | 'auditLog'>;
    recipients: Recipient[];
    auditLog: AuditEntry[];
    fields: any[];
  }>({
    queryKey: ["/api/esign/envelopes", envelopeId],
    queryFn: async () => {
      if (!envelopeId) throw new Error('No envelope ID');
      const res = await fetch(`/api/esign/envelopes/${envelopeId}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch envelope');
      return res.json();
    },
    enabled: !!envelopeId,
  });

  // Combine envelope data with recipients and audit log for easier access
  const envelope: Envelope | undefined = envelopeData ? {
    ...envelopeData.envelope,
    recipients: envelopeData.recipients || [],
    auditLog: envelopeData.auditLog || [],
  } : undefined;

  // Check if envelope can be corrected
  const { data: canCorrectData } = useQuery<{ canCorrect: boolean; reason?: string }>({
    queryKey: ["/api/esign/envelopes", envelopeId, "can-correct"],
    queryFn: async () => {
      if (!envelopeId) throw new Error('No envelope ID');
      const res = await fetch(`/api/esign/envelopes/${envelopeId}/can-correct`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to check correction eligibility');
      return res.json();
    },
    enabled: !!envelopeId && !!envelope && envelope.status !== 'completed' && envelope.status !== 'voided',
  });

  // Void envelope mutation
  const voidMutation = useMutation({
    mutationFn: async (reason: string) => {
      return apiRequest("POST", `/api/esign/envelopes/${envelopeId}/void`, {
        body: { reason },
      });
    },
    onSuccess: (_, reason) => {
      // Immediately update the local cache for instant UI feedback
      queryClient.setQueryData(["/api/esign/envelopes", envelopeId], (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          envelope: {
            ...oldData.envelope,
            status: 'voided',
            voidedAt: new Date().toISOString(),
            voidReason: reason,
          },
        };
      });
      // Also refetch to ensure data is in sync with server
      queryClient.refetchQueries({ queryKey: ["/api/esign/envelopes", envelopeId] });
      // Invalidate the dashboard list as well
      queryClient.invalidateQueries({ queryKey: ["/api/esign/envelopes"] });
      toast({
        title: "Envelope voided",
        description: "The envelope has been voided and signers notified.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to void envelope. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Download signed document
  const handleDownload = async () => {
    if (!envelopeId) return;
    try {
      const response = await fetch(`/api/esign/envelopes/${envelopeId}/download`, {
        credentials: "include",
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to get download URL");
      }
      const data = await response.json();
      window.open(data.downloadUrl, "_blank");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to download document.",
        variant: "destructive",
      });
    }
  };

  // Send reminder mutation
  const reminderMutation = useMutation({
    mutationFn: async (recipientId: number) => {
      return apiRequest("POST", `/api/esign/envelopes/${envelopeId}/remind/${recipientId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/esign/envelopes", envelopeId] });
      toast({
        title: "Reminder sent",
        description: "A reminder email has been sent to the recipient.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send reminder. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Copy signing link
  const copySigningLink = async (recipient: Recipient) => {
    // In a real app, we'd have an access token to construct the link
    // For now, we'll show a placeholder
    toast({
      title: "Link copied",
      description: "The signing link has been copied to clipboard.",
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error || !envelope) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
              <h2 className="text-lg font-medium mb-2">Envelope Not Found</h2>
              <p className="text-gray-500 mb-4">
                The envelope you're looking for doesn't exist or you don't have access.
              </p>
              <Button onClick={() => setLocation("/esign")}>
                Back to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const status = statusConfig[envelope.status] || { label: envelope.status || 'Unknown', icon: Clock, color: 'bg-gray-100 text-gray-700' };
  const StatusIcon = status.icon;
  const signers = envelope.recipients.filter(r => r.role === 'signer');
  const ccRecipients = envelope.recipients.filter(r => r.role === 'cc');
  const signedCount = signers.filter(r => r.status === 'signed').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 via-slate-700 to-slate-600 border-b border-slate-200 shadow-lg">
        <div className="px-4 py-6 md:py-8">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                className="text-white/80 hover:text-white hover:bg-white/10 -ml-2"
                onClick={() => setLocation("/esign")}
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-2 flex items-center gap-2 md:gap-3">
                <FileSignature className="h-6 w-6 md:h-8 md:w-8 flex-shrink-0" />
                <span className="truncate">{envelope.title}</span>
              </h1>
              <div className="flex flex-wrap items-center gap-2 md:gap-4">
                <Badge className={`${status.color} px-2 md:px-3 py-1 text-xs md:text-sm`}>
                  <StatusIcon className="h-3 w-3 md:h-4 md:w-4 mr-1" />
                  {status.label}
                </Badge>
                {envelope.status === 'sent' && (
                  <span className="text-slate-200 text-xs md:text-sm">
                    {signedCount}/{signers.length} signed
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="px-4 py-6 md:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-4 md:space-y-6">
            {/* Recipients */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Recipients
                </CardTitle>
                <CardDescription>
                  {envelope.signingOrder === 'sequential' ? 'Signing in order' : 'Signing in parallel'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {signers.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-3">Signers</h4>
                      <div className="space-y-3">
                        {signers.map((recipient, index) => {
                          const recipientStatus = recipientStatusConfig[recipient.status];
                          return (
                            <div
                              key={recipient.id}
                              className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-gray-50 rounded-lg gap-3"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div
                                  className="w-8 h-8 rounded-full flex items-center justify-center text-white font-medium flex-shrink-0"
                                  style={{ backgroundColor: recipient.color }}
                                >
                                  {recipient.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-medium truncate">{recipient.name}</p>
                                  <p className="text-sm text-gray-500 truncate">{recipient.email}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 ml-11 sm:ml-0">
                                <Badge className={`${recipientStatus.color} text-xs`}>
                                  {recipientStatus.label}
                                </Badge>
                                {envelope.status === 'sent' && recipient.status !== 'signed' && recipient.status !== 'declined' && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => reminderMutation.mutate(recipient.id)}
                                    disabled={reminderMutation.isPending}
                                  >
                                    <Mail className="h-4 w-4 sm:mr-1" />
                                    <span className="hidden sm:inline">Remind</span>
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {ccRecipients.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-3">CC Recipients</h4>
                      <div className="space-y-2">
                        {ccRecipients.map((recipient) => (
                          <div
                            key={recipient.id}
                            className="flex items-center gap-3 p-2 text-sm"
                          >
                            <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs">
                              {recipient.name.charAt(0).toUpperCase()}
                            </div>
                            <span>{recipient.name}</span>
                            <span className="text-gray-400">{recipient.email}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Audit Timeline */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Activity Timeline
                </CardTitle>
              </CardHeader>
              <CardContent>
                {envelope.auditLog.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No activity yet</p>
                ) : (
                  <div className="relative">
                    <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
                    <div className="space-y-4">
                      {envelope.auditLog.map((entry, index) => (
                        <div key={entry.id} className="relative flex gap-4 pl-10">
                          <div className="absolute left-2 top-1 w-4 h-4 rounded-full bg-blue-500 border-2 border-white" />
                          <div className="flex-1">
                            <p className="font-medium text-sm">
                              {actionLabels[entry.action] || entry.action}
                            </p>
                            {(entry.details?.recipientEmail || entry.details?.recipientName) && (
                              <p className="text-sm text-gray-500">
                                {entry.details?.recipientName || entry.details?.recipientEmail}
                              </p>
                            )}
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-gray-400">
                              <span>
                                {entry.timestamp ? format(new Date(entry.timestamp), "MMM d, yyyy 'at' h:mm a") : 'Unknown date'}
                              </span>
                              {(entry.ipAddress || entry.location) && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {entry.location && entry.location !== 'Unknown' ? (
                                    <span>
                                      {entry.location}
                                      {entry.ipAddress && (
                                        <span className="text-gray-300 ml-1">({entry.ipAddress})</span>
                                      )}
                                    </span>
                                  ) : (
                                    entry.ipAddress
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4 md:space-y-6">
            {/* Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div>
                  <p className="text-gray-500">Created</p>
                  <p className="font-medium">
                    {envelope.createdAt ? format(new Date(envelope.createdAt), "MMM d, yyyy 'at' h:mm a") : 'Unknown'}
                  </p>
                </div>
                {envelope.sentAt && (
                  <div>
                    <p className="text-gray-500">Sent</p>
                    <p className="font-medium">
                      {format(new Date(envelope.sentAt), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                )}
                {envelope.completedAt && (
                  <div>
                    <p className="text-gray-500">Completed</p>
                    <p className="font-medium">
                      {format(new Date(envelope.completedAt), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                )}
                {envelope.voidedAt && (
                  <div>
                    <p className="text-gray-500">Voided</p>
                    <p className="font-medium">
                      {format(new Date(envelope.voidedAt), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                    {envelope.voidReason && (
                      <p className="text-xs text-gray-400 mt-1">{envelope.voidReason}</p>
                    )}
                  </div>
                )}
                <Separator />
                <div>
                  <p className="text-gray-500">Signing Order</p>
                  <p className="font-medium capitalize">{envelope.signingOrder}</p>
                </div>
              </CardContent>
            </Card>

            {/* Message */}
            {envelope.message && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Message to Recipients</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600">{envelope.message}</p>
                </CardContent>
              </Card>
            )}

            {/* Document & Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Document</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Show signed document if completed, otherwise show original */}
                {envelope.status === 'completed' && envelope.signedDocumentUrl ? (
                  <>
                    <Button
                      variant="default"
                      className="w-full"
                      onClick={() => window.open(envelope.signedDocumentUrl!, '_blank')}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download Signed PDF
                    </Button>
                    {envelope.documentUrl && (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => window.open(envelope.documentUrl!, '_blank')}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View Original
                      </Button>
                    )}
                  </>
                ) : envelope.documentUrl ? (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => window.open(envelope.documentUrl!, '_blank')}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View Document
                  </Button>
                ) : (
                  <p className="text-sm text-gray-500 text-center">No document available</p>
                )}

                {/* Actions for draft or sent envelopes */}
                {(envelope.status === 'draft' || envelope.status === 'sent') && (
                  <>
                    <Separator />
                    {/* Correct envelope - available when no signatures collected */}
                    {canCorrectData?.canCorrect && (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => setLocation(`/esign/correct/${envelopeId}`)}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Correct
                      </Button>
                    )}
                    {/* Remind all pending signers - only for sent envelopes */}
                    {envelope.status === 'sent' && signers.some(r => r.status !== 'signed' && r.status !== 'declined') && (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => {
                          const pendingSigners = signers.filter(r => r.status !== 'signed' && r.status !== 'declined');
                          pendingSigners.forEach(r => reminderMutation.mutate(r.id));
                        }}
                        disabled={reminderMutation.isPending}
                      >
                        <Mail className="h-4 w-4 mr-2" />
                        Remind All
                      </Button>
                    )}
                    {/* Void envelope */}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" className="w-full text-red-600 hover:text-red-700 hover:bg-red-50">
                          <Ban className="h-4 w-4 mr-2" />
                          Void Envelope
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Void this envelope?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will cancel the signing process. All recipients will be notified
                            and any collected signatures will be invalidated.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-red-600 hover:bg-red-700"
                            onClick={() => voidMutation.mutate("Voided by sender")}
                          >
                            Void Envelope
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
