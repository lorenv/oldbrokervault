import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Mail, Send, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface EmailShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shareUrl: string;
  documentTitle: string;
  senderName?: string;
}

export function EmailShareDialog({ 
  open, 
  onOpenChange, 
  shareUrl, 
  documentTitle,
  senderName 
}: EmailShareDialogProps) {
  const [recipientEmail, setRecipientEmail] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSend = async () => {
    if (!recipientEmail.trim()) {
      toast({
        title: "Email Required",
        description: "Please enter a recipient email address",
        variant: "destructive"
      });
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail.trim())) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiRequest("POST", "/api/share/email", {
        recipientEmail: recipientEmail.trim(),
        shareUrl,
        documentTitle,
        customMessage: customMessage.trim(),
        senderName
      });

      if (response.ok) {
        toast({
          title: "Email Sent",
          description: `Share link sent successfully to ${recipientEmail}`
        });
        
        // Reset form and close dialog
        setRecipientEmail("");
        setCustomMessage("");
        onOpenChange(false);
      } else {
        const error = await response.json();
        throw new Error(error.message || "Failed to send email");
      }
    } catch (error) {
      console.error("Email sharing error:", error);
      toast({
        title: "Send Failed",
        description: error instanceof Error ? error.message : "Failed to send email. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setRecipientEmail("");
      setCustomMessage("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-blue-600" />
            Share via Email
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="email">Recipient Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter email address"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              disabled={isLoading}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="message">Custom Message (Optional)</Label>
            <Textarea
              id="message"
              placeholder="Add a personal message..."
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              disabled={isLoading}
              rows={3}
            />
          </div>
          
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-sm text-gray-600">
              <strong>Document:</strong> {documentTitle}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              The recipient will receive an email with a secure link to view this document.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button 
            variant="outline" 
            onClick={handleClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSend}
            disabled={isLoading}
            className="min-w-[100px]"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send Email
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}