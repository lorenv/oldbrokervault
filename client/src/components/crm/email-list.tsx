import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Mail,
  MailOpen,
  Reply,
  ChevronDown,
  ChevronUp,
  Paperclip,
  ExternalLink,
  Send,
  AlertCircle,
  Inbox,
} from "lucide-react";
import { EmailComposer } from "./email-composer";
import DOMPurify from "dompurify";

interface EmailAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
}

interface EmailMessage {
  id: string;
  threadId?: string;
  from: string;
  fromName?: string;
  to: string;
  cc?: string;
  subject: string;
  snippet: string;
  body?: string;
  bodyHtml?: string;
  date: string;
  isRead?: boolean;
  hasAttachments?: boolean;
  attachments?: EmailAttachment[];
  provider: "gmail" | "microsoft";
}

interface EmailListProps {
  contactId?: number;
  contactEmail?: string;
  dealId?: number;
}

export function EmailList({ contactId, contactEmail, dealId }: EmailListProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedEmailId, setExpandedEmailId] = useState<string | null>(null);
  const [expandedEmailContent, setExpandedEmailContent] = useState<EmailMessage | null>(null);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [replyToEmail, setReplyToEmail] = useState<EmailMessage | null>(null);

  // Fetch emails for this contact or deal
  const { data, isLoading, error } = useQuery({
    queryKey: dealId ? ["/api/crm/deals", dealId, "emails"] : ["/api/crm/emails/contact", contactId],
    queryFn: async () => {
      if (dealId) {
        // Fetch emails for deal (from all contacts)
        const res = await apiRequest("GET", `/api/crm/deals/${dealId}/emails`);
        return res.json();
      }
      if (!contactId) return { emails: [], connected: false };
      const res = await apiRequest("GET", `/api/crm/emails/contact/${contactId}`);
      return res.json();
    },
    enabled: !!contactId || !!dealId,
  });

  // Fetch full email content when expanded
  const fetchEmailContent = async (email: EmailMessage) => {
    if (expandedEmailId === email.id) {
      // Collapse if already expanded
      setExpandedEmailId(null);
      setExpandedEmailContent(null);
      return;
    }

    setExpandedEmailId(email.id);

    try {
      const res = await apiRequest(
        "GET",
        `/api/crm/emails/${email.id}?provider=${email.provider}`
      );
      const fullEmail = await res.json();
      setExpandedEmailContent(fullEmail);
    } catch (err) {
      console.error("Failed to fetch email content:", err);
      // Fall back to snippet
      setExpandedEmailContent(email);
    }
  };

  const handleReply = (email: EmailMessage) => {
    setReplyToEmail(email);
    setIsComposerOpen(true);
  };

  const handleCompose = () => {
    setReplyToEmail(null);
    setIsComposerOpen(true);
  };

  const handleEmailSent = () => {
    setIsComposerOpen(false);
    setReplyToEmail(null);
    // Invalidate the correct query based on context
    if (dealId) {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals", dealId, "emails"] });
    } else if (contactId) {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/emails/contact", contactId] });
    }
    toast({
      title: "Email sent",
      description: "Your email has been sent successfully.",
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: "short" });
    } else {
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    }
  };

  const emails = (data as any)?.emails || [];
  const connected = (data as any)?.connected;
  const provider = (data as any)?.provider;

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-4 border rounded-lg">
            <Skeleton className="h-4 w-1/3 mb-2" />
            <Skeleton className="h-3 w-full mb-1" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="text-center py-8 px-4">
        <AlertCircle className="h-10 w-10 text-gray-400 mx-auto mb-3" />
        <h3 className="font-medium text-gray-900 mb-1">Email not connected</h3>
        <p className="text-sm text-gray-500 mb-4">
          Connect your Gmail or Outlook account to view and send emails.
        </p>
        <Button variant="outline" asChild>
          <a href="/integrations">Connect Email</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with compose button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Mail className="h-4 w-4" />
          <span>
            {emails.length} email{emails.length !== 1 ? "s" : ""}
            {provider && (
              <span className="text-xs ml-1">via {provider === "gmail" ? "Gmail" : "Outlook"}</span>
            )}
          </span>
        </div>
        <Button size="sm" onClick={handleCompose}>
          <Send className="h-4 w-4 mr-2" />
          Compose
        </Button>
      </div>

      {/* Email list */}
      {emails.length === 0 ? (
        <div className="text-center py-8 px-4 bg-gray-50 rounded-lg">
          <Inbox className="h-10 w-10 text-gray-400 mx-auto mb-3" />
          <h3 className="font-medium text-gray-900 mb-1">No emails yet</h3>
          <p className="text-sm text-gray-500 mb-4">
            No email history found with this contact.
          </p>
          <Button size="sm" onClick={handleCompose}>
            <Send className="h-4 w-4 mr-2" />
            Send First Email
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {emails.map((email: EmailMessage) => {
            const isExpanded = expandedEmailId === email.id;

            return (
              <div
                key={email.id}
                className={`border rounded-lg transition-all ${
                  isExpanded ? "ring-1 ring-blue-200" : "hover:border-gray-300"
                }`}
              >
                {/* Email header row */}
                <div
                  className="p-3 cursor-pointer"
                  onClick={() => fetchEmailContent(email)}
                >
                  <div className="flex items-start gap-3">
                    {/* Read/unread indicator */}
                    <div className="pt-1">
                      {email.isRead ? (
                        <MailOpen className="h-4 w-4 text-gray-400" />
                      ) : (
                        <Mail className="h-4 w-4 text-blue-500" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className={`font-medium text-sm truncate ${!email.isRead ? "text-gray-900" : "text-gray-700"}`}>
                          {email.fromName || email.from}
                        </span>
                        <span className="text-xs text-gray-500 flex-shrink-0">
                          {formatDate(email.date)}
                        </span>
                      </div>
                      <div className={`text-sm mb-1 truncate ${!email.isRead ? "font-medium text-gray-900" : "text-gray-700"}`}>
                        {email.subject}
                      </div>
                      {!isExpanded && (
                        <p className="text-sm text-gray-500 truncate">{email.snippet}</p>
                      )}
                    </div>

                    {/* Indicators */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {email.hasAttachments && (
                        <Paperclip className="h-4 w-4 text-gray-400" />
                      )}
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t px-4 py-3 bg-gray-50">
                    {/* Email metadata */}
                    <div className="text-xs text-gray-500 mb-3 space-y-1">
                      <div>
                        <strong>From:</strong> {expandedEmailContent?.fromName || email.fromName}{" "}
                        &lt;{expandedEmailContent?.from || email.from}&gt;
                      </div>
                      <div>
                        <strong>To:</strong> {expandedEmailContent?.to || email.to}
                      </div>
                      {(expandedEmailContent?.cc || email.cc) && (
                        <div>
                          <strong>Cc:</strong> {expandedEmailContent?.cc || email.cc}
                        </div>
                      )}
                      <div>
                        <strong>Date:</strong>{" "}
                        {new Date(expandedEmailContent?.date || email.date).toLocaleString()}
                      </div>
                    </div>

                    {/* Email body */}
                    <div className="bg-white rounded-md border p-4 mb-3 text-sm max-h-96 overflow-y-auto">
                      {expandedEmailContent?.bodyHtml ? (
                        <div
                          className="prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{
                            __html: DOMPurify.sanitize(expandedEmailContent.bodyHtml, {
                              ALLOWED_TAGS: [
                                "p", "br", "div", "span", "a", "b", "strong", "i", "em",
                                "u", "ul", "ol", "li", "h1", "h2", "h3", "h4", "h5", "h6",
                                "table", "tr", "td", "th", "tbody", "thead", "img",
                                "blockquote", "pre", "code",
                              ],
                              ALLOWED_ATTR: ["href", "src", "alt", "style", "class"],
                            }),
                          }}
                        />
                      ) : expandedEmailContent?.body ? (
                        <pre className="whitespace-pre-wrap font-sans">
                          {expandedEmailContent.body}
                        </pre>
                      ) : (
                        <p className="text-gray-500">{email.snippet}</p>
                      )}
                    </div>

                    {/* Attachments */}
                    {expandedEmailContent?.attachments && expandedEmailContent.attachments.length > 0 && (
                      <div className="mb-3">
                        <div className="text-xs font-medium text-gray-700 mb-2">Attachments</div>
                        <div className="flex flex-wrap gap-2">
                          {expandedEmailContent.attachments.map((attachment: any) => (
                            <Badge
                              key={attachment.id}
                              variant="secondary"
                              className="flex items-center gap-1"
                            >
                              <Paperclip className="h-3 w-3" />
                              {attachment.filename}
                              <span className="text-xs text-gray-500">
                                ({Math.round(attachment.size / 1024)}KB)
                              </span>
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReply(expandedEmailContent || email);
                        }}
                      >
                        <Reply className="h-4 w-4 mr-2" />
                        Reply
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Email composer dialog */}
      <EmailComposer
        open={isComposerOpen}
        onOpenChange={setIsComposerOpen}
        contactId={contactId}
        contactEmail={contactEmail}
        dealId={dealId}
        replyTo={replyToEmail}
        onSuccess={handleEmailSent}
      />
    </div>
  );
}
