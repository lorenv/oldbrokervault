import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Send, X, AlertCircle, Loader2 } from "lucide-react";

interface EmailMessage {
  id: string;
  threadId?: string;
  from: string;
  fromName?: string;
  to: string;
  subject: string;
  snippet: string;
  body?: string;
  date: string;
  provider: "gmail" | "microsoft";
}

interface EmailComposerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId?: number;
  contactEmail?: string;
  dealId?: number;
  replyTo?: EmailMessage | null;
  onSuccess?: () => void;
}

export function EmailComposer({
  open,
  onOpenChange,
  contactId,
  contactEmail,
  dealId,
  replyTo,
  onSuccess,
}: EmailComposerProps) {
  const { toast } = useToast();
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  // Fetch connection info
  const { data: connectionInfo } = useQuery({
    queryKey: ["/api/crm/emails/connection/info"],
    enabled: open,
  });

  const isConnected = (connectionInfo as any)?.connected;
  const fromEmail = (connectionInfo as any)?.email;

  // Reset form when dialog opens or replyTo changes
  useEffect(() => {
    if (open) {
      if (replyTo) {
        // Reply mode
        setTo(replyTo.from);
        setSubject(
          replyTo.subject.startsWith("Re:") ? replyTo.subject : `Re: ${replyTo.subject}`
        );
        // Build quoted reply
        const quotedDate = new Date(replyTo.date).toLocaleString();
        const quotedFrom = replyTo.fromName || replyTo.from;
        const quotedBody = replyTo.body || replyTo.snippet;
        setBody(`\n\n---\nOn ${quotedDate}, ${quotedFrom} wrote:\n\n${quotedBody}`);
      } else {
        // New email mode
        setTo(contactEmail || "");
        setSubject("");
        setBody("");
      }
    }
  }, [open, replyTo, contactEmail]);

  // Send email mutation
  const sendMutation = useMutation({
    mutationFn: async () => {
      if (replyTo) {
        // Reply
        return apiRequest("POST", "/api/crm/emails/reply", {
          body: {
            emailId: replyTo.id,
            provider: replyTo.provider,
            body,
            isHtml: false,
            contactId,
            dealId,
          },
        }).then((res) => res.json());
      } else {
        // New email
        return apiRequest("POST", "/api/crm/emails/send", {
          body: {
            to,
            subject,
            body,
            isHtml: false,
            contactId,
            dealId,
          },
        }).then((res) => res.json());
      }
    },
    onSuccess: (data) => {
      if (data.error) {
        toast({
          title: "Failed to send email",
          description: data.error,
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Email sent",
        description: replyTo ? "Your reply has been sent." : "Your email has been sent.",
      });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send email",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!to.trim()) {
      toast({
        title: "Missing recipient",
        description: "Please enter a recipient email address.",
        variant: "destructive",
      });
      return;
    }

    if (!subject.trim() && !replyTo) {
      toast({
        title: "Missing subject",
        description: "Please enter a subject line.",
        variant: "destructive",
      });
      return;
    }

    if (!body.trim()) {
      toast({
        title: "Missing message",
        description: "Please enter a message.",
        variant: "destructive",
      });
      return;
    }

    sendMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{replyTo ? "Reply to Email" : "Compose Email"}</DialogTitle>
        </DialogHeader>

        {!isConnected ? (
          <div className="text-center py-8">
            <AlertCircle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
            <h3 className="font-medium text-gray-900 mb-2">Email not connected</h3>
            <p className="text-sm text-gray-500 mb-4">
              Connect your Gmail or Outlook account to send emails.
            </p>
            <Button variant="outline" asChild>
              <a href="/integrations">Connect Email</a>
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
            <div className="space-y-4 flex-1 overflow-y-auto">
              {/* From field (readonly) */}
              <div className="space-y-2">
                <Label htmlFor="from">From</Label>
                <Input
                  id="from"
                  value={fromEmail || "Loading..."}
                  disabled
                  className="bg-gray-50"
                />
              </div>

              {/* To field */}
              <div className="space-y-2">
                <Label htmlFor="to">To</Label>
                <Input
                  id="to"
                  type="email"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="recipient@example.com"
                  disabled={!!replyTo}
                  className={replyTo ? "bg-gray-50" : ""}
                />
              </div>

              {/* Subject field */}
              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Email subject"
                  disabled={!!replyTo}
                  className={replyTo ? "bg-gray-50" : ""}
                />
              </div>

              {/* Body field */}
              <div className="space-y-2 flex-1">
                <Label htmlFor="body">Message</Label>
                <Textarea
                  id="body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Write your message..."
                  className="min-h-[200px] resize-none"
                  rows={10}
                />
              </div>
            </div>

            <DialogFooter className="pt-4 border-t mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={sendMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={sendMutation.isPending}>
                {sendMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    {replyTo ? "Send Reply" : "Send Email"}
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
