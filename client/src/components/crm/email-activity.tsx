import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Mail,
  Send,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Settings,
  User,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";

interface Email {
  id: string;
  from: string;
  fromName?: string;
  to: string;
  subject: string;
  date: string;
  snippet: string;
  isRead?: boolean;
  contactEmail?: string;
  contactName?: string;
}

interface EmailActivityProps {
  contactId?: number;
  dealId?: number;
  contactEmail?: string;
  contactName?: string;
  compact?: boolean;
}

export function EmailActivity({
  contactId,
  dealId,
  contactEmail,
  contactName,
  compact = false,
}: EmailActivityProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [expandedEmails, setExpandedEmails] = useState<Set<string>>(new Set());
  const [composeData, setComposeData] = useState({ subject: "", body: "" });

  // Determine the API endpoint based on whether we're showing contact or deal emails
  const emailsEndpoint = contactId
    ? `/api/crm/contacts/${contactId}/emails`
    : dealId
    ? `/api/crm/deals/${dealId}/emails`
    : null;

  // Check email connection status
  const { data: connectionStatus } = useQuery({
    queryKey: ["/api/crm/email-connection"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/crm/email-connection");
      return res.json();
    },
  });

  // Fetch emails
  const {
    data: emailsData,
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: [emailsEndpoint],
    queryFn: async () => {
      if (!emailsEndpoint) return null;
      const res = await apiRequest("GET", emailsEndpoint);
      return res.json();
    },
    enabled: !!emailsEndpoint && connectionStatus?.connected,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  // Send email mutation
  const sendEmailMutation = useMutation({
    mutationFn: async (data: { subject: string; body: string }) => {
      if (!contactId) throw new Error("Cannot send email without contact");
      const res = await apiRequest("POST", `/api/crm/contacts/${contactId}/emails`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Email sent", description: "Your email has been sent successfully." });
      setIsComposeOpen(false);
      setComposeData({ subject: "", body: "" });
      queryClient.invalidateQueries({ queryKey: [emailsEndpoint] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send email",
        description: error.message || "An error occurred while sending the email.",
        variant: "destructive",
      });
    },
  });

  const toggleEmailExpanded = (emailId: string) => {
    setExpandedEmails((prev) => {
      const next = new Set(prev);
      if (next.has(emailId)) {
        next.delete(emailId);
      } else {
        next.add(emailId);
      }
      return next;
    });
  };

  const emails: Email[] = emailsData?.emails || [];
  const isConnected = connectionStatus?.connected;
  const isExpired = emailsData?.expired;

  // Not connected state
  if (!isConnected) {
    return (
      <Card className={compact ? "border-dashed" : ""}>
        <CardHeader className={compact ? "pb-2" : ""}>
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Email Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
              <Mail className="h-6 w-6 text-slate-400" />
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Connect your email to see conversations with this contact
            </p>
            <Button variant="outline" size="sm" asChild>
              <Link href="/settings/email">
                <Settings className="h-4 w-4 mr-2" />
                Connect Email
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Expired token state
  if (isExpired) {
    return (
      <Card className="border-amber-200 bg-amber-50/50">
        <CardHeader className={compact ? "pb-2" : ""}>
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Email Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800">Email connection expired</p>
              <p className="text-xs text-amber-600">Please reconnect your email account</p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/settings/email">Reconnect</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader className={compact ? "pb-2" : ""}>
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Email Activity
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className={`flex flex-row items-center justify-between ${compact ? "pb-2" : ""}`}>
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Email Activity
            {emails.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">
                {emails.length}
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
            {contactId && contactEmail && (
              <Button size="sm" onClick={() => setIsComposeOpen(true)}>
                <Send className="h-4 w-4 mr-2" />
                Compose
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {emails.length === 0 ? (
            <div className="text-center py-6">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2">
                <Mail className="h-5 w-5 text-slate-400" />
              </div>
              <p className="text-sm text-muted-foreground">
                No email history with {contactName || "this contact"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {emails.slice(0, compact ? 5 : 20).map((email) => (
                <Collapsible
                  key={email.id}
                  open={expandedEmails.has(email.id)}
                  onOpenChange={() => toggleEmailExpanded(email.id)}
                >
                  <div
                    className={`border rounded-lg ${
                      !email.isRead ? "bg-blue-50/50 border-blue-100" : ""
                    }`}
                  >
                    <CollapsibleTrigger asChild>
                      <button className="w-full p-3 text-left hover:bg-slate-50/50 rounded-lg">
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                              email.from?.toLowerCase() === contactEmail?.toLowerCase()
                                ? "bg-green-100"
                                : "bg-blue-100"
                            }`}
                          >
                            {email.from?.toLowerCase() === contactEmail?.toLowerCase() ? (
                              <ArrowDownLeft className="h-4 w-4 text-green-600" />
                            ) : (
                              <ArrowUpRight className="h-4 w-4 text-blue-600" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm truncate">
                                {email.subject || "(No subject)"}
                              </span>
                              {!email.isRead && (
                                <Badge variant="default" className="text-[10px] px-1 py-0">
                                  New
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                              <span>
                                {email.from?.toLowerCase() === contactEmail?.toLowerCase()
                                  ? `From: ${email.fromName || email.from}`
                                  : `To: ${email.to}`}
                              </span>
                              <span>·</span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDistanceToNow(new Date(email.date), { addSuffix: true })}
                              </span>
                            </div>
                            {/* Deal context: show which contact this email is with */}
                            {email.contactName && dealId && (
                              <Badge variant="outline" className="mt-1 text-xs">
                                <User className="h-3 w-3 mr-1" />
                                {email.contactName}
                              </Badge>
                            )}
                          </div>
                          <div className="flex-shrink-0">
                            {expandedEmails.has(email.id) ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-3 pb-3 pt-0">
                        <div className="bg-slate-50 rounded p-3 text-sm text-muted-foreground whitespace-pre-wrap">
                          {email.snippet}
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))}
              {emails.length > (compact ? 5 : 20) && (
                <p className="text-xs text-center text-muted-foreground pt-2">
                  Showing {compact ? 5 : 20} of {emails.length} emails
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Compose Email Dialog */}
      <Dialog open={isComposeOpen} onOpenChange={setIsComposeOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Send Email to {contactName || contactEmail}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">To</label>
              <Input value={contactEmail || ""} disabled className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Subject</label>
              <Input
                value={composeData.subject}
                onChange={(e) => setComposeData((prev) => ({ ...prev, subject: e.target.value }))}
                placeholder="Email subject..."
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Message</label>
              <Textarea
                value={composeData.body}
                onChange={(e) => setComposeData((prev) => ({ ...prev, body: e.target.value }))}
                placeholder="Write your message..."
                className="mt-1 min-h-[150px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsComposeOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => sendEmailMutation.mutate(composeData)}
              disabled={!composeData.subject || !composeData.body || sendEmailMutation.isPending}
            >
              {sendEmailMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Email
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default EmailActivity;
