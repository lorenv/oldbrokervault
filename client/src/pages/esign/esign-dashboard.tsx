import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { BrandedButton } from "@/components/ui/branded-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  FileSignature,
  Plus,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  Ban,
  Search,
  Users,
  MoreHorizontal,
  Send,
  Eye,
  Download,
  Trash2,
  Palette,
  Edit,
  Mail,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/layout/page-header";

type EnvelopeStatus = 'draft' | 'sent' | 'completed' | 'voided' | 'declined';

interface Envelope {
  id: number;
  envelopeId: string; // UUID for URLs
  title: string;
  status: EnvelopeStatus;
  signingOrder: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  recipientCount: number;
  signerCount: number;
  signedCount: number;
  pendingSigners: string[];
}

const statusConfig: Record<EnvelopeStatus, { label: string; icon: any; color: string }> = {
  draft: { label: 'Draft', icon: FileText, color: 'bg-gray-100 text-gray-700' },
  sent: { label: 'Pending', icon: Clock, color: 'bg-yellow-100 text-yellow-700' },
  completed: { label: 'Completed', icon: CheckCircle2, color: 'bg-green-100 text-green-700' },
  voided: { label: 'Voided', icon: Ban, color: 'bg-red-100 text-red-700' },
  declined: { label: 'Declined', icon: XCircle, color: 'bg-red-100 text-red-700' },
};

export default function EsignDashboard() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<string>("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: envelopes = [], isLoading } = useQuery<Envelope[]>({
    queryKey: ["/api/esign/envelopes"],
  });

  // Send envelope mutation
  const sendMutation = useMutation({
    mutationFn: async (envelopeId: number) => {
      return apiRequest("POST", `/api/esign/envelopes/${envelopeId}/send`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/esign/envelopes"] });
      toast({ title: "Envelope sent", description: "Signing invitations have been sent." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to send envelope.", variant: "destructive" });
    },
  });

  // Delete envelope mutation
  const deleteMutation = useMutation({
    mutationFn: async (envelopeId: number) => {
      return apiRequest("DELETE", `/api/esign/envelopes/${envelopeId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/esign/envelopes"] });
      toast({ title: "Deleted", description: "Draft envelope has been deleted." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete envelope.", variant: "destructive" });
    },
  });

  // Void envelope mutation
  const voidMutation = useMutation({
    mutationFn: async (envelopeId: number) => {
      return apiRequest("POST", `/api/esign/envelopes/${envelopeId}/void`, {
        body: { reason: "Voided by sender" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/esign/envelopes"] });
      toast({ title: "Voided", description: "Envelope has been voided and recipients notified." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to void envelope.", variant: "destructive" });
    },
  });

  // Remind all pending signers mutation
  const remindMutation = useMutation({
    mutationFn: async (envelopeId: number) => {
      return apiRequest("POST", `/api/esign/envelopes/${envelopeId}/remind`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/esign/envelopes"] });
      toast({ title: "Reminders sent", description: "Reminder emails sent to pending signers." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to send reminders.", variant: "destructive" });
    },
  });

  // Download signed document
  const handleDownload = async (envelopeId: number) => {
    try {
      const response = await fetch(`/api/esign/envelopes/${envelopeId}/download`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to get download URL");
      const data = await response.json();

      // Open download URL in new tab
      window.open(data.downloadUrl, "_blank");
    } catch (error) {
      toast({ title: "Error", description: "Failed to download document.", variant: "destructive" });
    }
  };

  const filteredEnvelopes = envelopes.filter((envelope) => {
    const matchesSearch = envelope.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = activeTab === "all" || envelope.status === activeTab;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: envelopes.length,
    pending: envelopes.filter(e => e.status === 'sent').length,
    completed: envelopes.filter(e => e.status === 'completed').length,
    draft: envelopes.filter(e => e.status === 'draft').length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 overflow-x-hidden">
      <main className="container mx-auto px-4 md:px-6 py-4 md:py-6">
        <PageHeader
          title="E-Signatures"
          description="Send documents for signature and track their progress"
          icon={<FileSignature className="h-5 w-5" />}
          actions={
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-slate-700 border-slate-300"
                onClick={() => setLocation("/esign/settings")}
              >
                <Palette className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Branding</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-slate-700 border-slate-300"
                onClick={() => setLocation("/esign/templates")}
              >
                <FileText className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Templates</span>
              </Button>
              <BrandedButton
                size="sm"
                onClick={() => setLocation("/esign/send")}
              >
                <Plus className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Send Document</span>
              </BrandedButton>
            </div>
          }
        />
        {/* Stats Cards - Click to filter */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card
            className={`bg-white shadow-sm cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] ${activeTab === 'all' ? 'ring-2 ring-blue-500' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Documents</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <FileSignature className="h-8 w-8 text-blue-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card
            className={`bg-white shadow-sm cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] ${activeTab === 'sent' ? 'ring-2 ring-yellow-500' : ''}`}
            onClick={() => setActiveTab('sent')}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Pending</p>
                  <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card
            className={`bg-white shadow-sm cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] ${activeTab === 'completed' ? 'ring-2 ring-green-500' : ''}`}
            onClick={() => setActiveTab('completed')}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Completed</p>
                  <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-green-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card
            className={`bg-white shadow-sm cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] ${activeTab === 'draft' ? 'ring-2 ring-gray-500' : ''}`}
            onClick={() => setActiveTab('draft')}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Drafts</p>
                  <p className="text-2xl font-bold text-gray-600">{stats.draft}</p>
                </div>
                <FileText className="h-8 w-8 text-gray-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Card className="bg-white shadow-lg overflow-hidden">
          <CardHeader className="border-b">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle>Documents</CardTitle>
              <div className="relative w-full sm:w-auto">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search documents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-full sm:w-64"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <div className="border-b px-3 md:px-6 overflow-x-auto">
                <TabsList className="h-12 bg-transparent w-max min-w-full md:w-auto">
                  <TabsTrigger value="all" className="data-[state=active]:bg-blue-50 text-xs md:text-sm whitespace-nowrap">
                    All ({envelopes.length})
                  </TabsTrigger>
                  <TabsTrigger value="sent" className="data-[state=active]:bg-yellow-50 text-xs md:text-sm whitespace-nowrap">
                    Pending ({stats.pending})
                  </TabsTrigger>
                  <TabsTrigger value="completed" className="data-[state=active]:bg-green-50 text-xs md:text-sm whitespace-nowrap">
                    Completed ({stats.completed})
                  </TabsTrigger>
                  <TabsTrigger value="draft" className="data-[state=active]:bg-gray-50 text-xs md:text-sm whitespace-nowrap">
                    Drafts ({stats.draft})
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value={activeTab} className="m-0">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                  </div>
                ) : filteredEnvelopes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                    <FileSignature className="h-12 w-12 mb-4 opacity-30" />
                    <p className="text-lg font-medium">No documents found</p>
                    <p className="text-sm">
                      {searchQuery
                        ? "Try adjusting your search"
                        : "Send your first document for signature"}
                    </p>
                    {!searchQuery && (
                      <Button
                        className="mt-4"
                        onClick={() => setLocation("/esign/send")}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Send Document
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="divide-y">
                    {filteredEnvelopes.map((envelope) => {
                      const status = statusConfig[envelope.status];
                      const StatusIcon = status.icon;

                      // Debug: log envelope data

                      return (
                        <div
                          key={envelope.id}
                          className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 md:p-4 hover:bg-gray-50 cursor-pointer gap-3"
                          onClick={() => setLocation(`/esign/envelope/${envelope.envelopeId}`)}
                        >
                          <div className="flex items-center gap-3 md:gap-4 min-w-0 flex-1">
                            <div className="p-2 bg-blue-50 rounded-lg flex-shrink-0">
                              <FileSignature className="h-4 w-4 md:h-5 md:w-5 text-blue-600" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h3 className="font-medium text-gray-900 truncate text-sm md:text-base">
                                {envelope.title}
                              </h3>
                              <div className="flex flex-wrap items-center gap-2 md:gap-3 mt-1 text-xs md:text-sm text-gray-500">
                                <span className="flex items-center gap-1">
                                  <Users className="h-3 w-3" />
                                  {envelope.signerCount} signer{envelope.signerCount !== 1 ? 's' : ''}
                                </span>
                                <span className="hidden xs:inline">
                                  {envelope.status === 'sent' && (
                                    <>{envelope.signedCount}/{envelope.signerCount} signed</>
                                  )}
                                  {envelope.status === 'completed' && (
                                    <>Completed {new Date(envelope.completedAt!).toLocaleDateString()}</>
                                  )}
                                  {envelope.status === 'draft' && (
                                    <>Created {new Date(envelope.createdAt).toLocaleDateString()}</>
                                  )}
                                </span>
                              </div>
                              {/* Progress bar and waiting on status for sent (pending) envelopes only */}
                              {envelope.status === 'sent' && envelope.signerCount > 0 && (
                                <div className="mt-2 space-y-1">
                                  {/* Mini progress bar */}
                                  <div className="w-full max-w-[180px] h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-green-500 rounded-full transition-all duration-300"
                                      style={{ width: `${(envelope.signedCount / envelope.signerCount) * 100}%` }}
                                    />
                                  </div>
                                  {/* Waiting on text */}
                                  {envelope.pendingSigners && envelope.pendingSigners.length > 0 && (
                                    <p className="text-xs text-amber-600 font-medium">
                                      {envelope.pendingSigners.length === 1
                                        ? `Waiting on ${envelope.pendingSigners[0]}`
                                        : `Waiting on ${envelope.pendingSigners.length} signatures`}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-2 md:gap-4 ml-11 sm:ml-0">
                            <Badge className={`${status.color} text-xs`}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {status.label}
                            </Badge>

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={(e) => {
                                  e.stopPropagation();
                                  setLocation(`/esign/envelope/${envelope.envelopeId}`);
                                }}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  View Details
                                </DropdownMenuItem>
                                {(envelope.status === 'draft' || envelope.status === 'sent') && (
                                  <DropdownMenuItem onClick={(e) => {
                                    e.stopPropagation();
                                    setLocation(`/esign/correct/${envelope.envelopeId}`);
                                  }}>
                                    <Edit className="h-4 w-4 mr-2" />
                                    Correct
                                  </DropdownMenuItem>
                                )}
                                {envelope.status === 'draft' && (
                                  <DropdownMenuItem onClick={(e) => {
                                    e.stopPropagation();
                                    sendMutation.mutate(envelope.id);
                                  }}>
                                    <Send className="h-4 w-4 mr-2" />
                                    Send
                                  </DropdownMenuItem>
                                )}
                                {envelope.status === 'sent' && (
                                  <DropdownMenuItem onClick={(e) => {
                                    e.stopPropagation();
                                    remindMutation.mutate(envelope.id);
                                  }}>
                                    <Mail className="h-4 w-4 mr-2" />
                                    Send Reminder
                                  </DropdownMenuItem>
                                )}
                                {envelope.status === 'completed' && (
                                  <DropdownMenuItem onClick={(e) => {
                                    e.stopPropagation();
                                    handleDownload(envelope.id);
                                  }}>
                                    <Download className="h-4 w-4 mr-2" />
                                    Download
                                  </DropdownMenuItem>
                                )}
                                {envelope.status === 'sent' && (
                                  <DropdownMenuItem
                                    className="text-red-600"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (confirm("Void this envelope? All recipients will be notified.")) {
                                        voidMutation.mutate(envelope.id);
                                      }
                                    }}
                                  >
                                    <Ban className="h-4 w-4 mr-2" />
                                    Void
                                  </DropdownMenuItem>
                                )}
                                {envelope.status === 'draft' && (
                                  <DropdownMenuItem
                                    className="text-red-600"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (confirm("Delete this draft envelope?")) {
                                        deleteMutation.mutate(envelope.id);
                                      }
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
