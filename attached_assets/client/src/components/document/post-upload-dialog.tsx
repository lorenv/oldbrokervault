import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X, Users } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { RECIPIENT_COLORS } from "@/lib/types";
import type { Document } from "@shared/schema";

interface PostUploadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: number;
  documentTitle: string;
}

interface Recipient {
  fullName: string;
  email: string;
  role: string;
  signingOrder: number;
}

export function PostUploadDialog({ isOpen, onClose, documentId, documentTitle }: PostUploadDialogProps) {
  const [recipients, setRecipients] = useState<Recipient[]>([
    { fullName: "", email: "", role: "signer", signingOrder: 1 }
  ]);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const addRecipientMutation = useMutation({
    mutationFn: async (recipient: Omit<Recipient, 'signingOrder'> & { documentId: number; signingOrder: number }) => {
      const response = await fetch(`/api/documents/${documentId}/recipients`, {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(recipient),
      });
      if (!response.ok) {
        throw new Error('Failed to add recipient');
      }
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/documents/${documentId}`] });
    },
  });

  const addRecipient = () => {
    setRecipients(prev => [...prev, {
      fullName: "",
      email: "",
      role: "signer",
      signingOrder: prev.length + 1
    }]);
  };

  const removeRecipient = (index: number) => {
    if (recipients.length > 1) {
      setRecipients(prev => prev.filter((_, i) => i !== index).map((r, i) => ({ ...r, signingOrder: i + 1 })));
    }
  };

  const updateRecipient = (index: number, field: keyof Recipient, value: string | number) => {
    setRecipients(prev => prev.map((r, i) => 
      i === index ? { ...r, [field]: value } : r
    ));
  };

  const handleContinue = async () => {
    // Validate recipients
    const validRecipients = recipients.filter(r => r.fullName.trim() && r.email.trim());
    
    if (validRecipients.length === 0) {
      toast({
        title: "Recipients required",
        description: "Please add at least one recipient with name and email",
        variant: "destructive",
      });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = validRecipients.filter(r => !emailRegex.test(r.email));
    
    if (invalidEmails.length > 0) {
      toast({
        title: "Invalid email addresses",
        description: "Please check the email addresses and try again",
        variant: "destructive",
      });
      return;
    }

    try {
      // Add all recipients
      for (const recipient of validRecipients) {
        await addRecipientMutation.mutateAsync({
          ...recipient,
          documentId,
        });
      }

      toast({
        title: "Recipients added!",
        description: `Added ${validRecipients.length} recipient${validRecipients.length > 1 ? 's' : ''}`,
      });

      onClose();
      setLocation(`/document/${documentId}`);
    } catch (error) {
      toast({
        title: "Error adding recipients",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  const handleSkip = () => {
    onClose();
    setLocation(`/document/${documentId}`);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Add Recipients to "{documentTitle}"
          </DialogTitle>
          <DialogDescription>
            Add people who need to sign this document. You can add more recipients later or drag fields for each signer.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-4">
            {recipients.map((recipient, index) => {
              const recipientColor = RECIPIENT_COLORS[index + 1] || RECIPIENT_COLORS[1];
              return (
                <div key={index} className="flex items-start gap-3 p-4 border rounded-lg" 
                     style={{ 
                       borderColor: recipientColor.border,
                       backgroundColor: recipientColor.background 
                     }}>
                  <div className="flex flex-col gap-2 min-w-0">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: recipientColor.primary }}
                      ></div>
                      <span className="text-sm font-medium" style={{ color: recipientColor.text }}>
                        Recipient {index + 1}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor={`name-${index}`}>Full Name</Label>
                        <Input
                          id={`name-${index}`}
                          placeholder="Enter full name"
                          value={recipient.fullName}
                          onChange={(e) => updateRecipient(index, 'fullName', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`email-${index}`}>Email Address</Label>
                        <Input
                          id={`email-${index}`}
                          type="email"
                          placeholder="Enter email address"
                          value={recipient.email}
                          onChange={(e) => updateRecipient(index, 'email', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`role-${index}`}>Role</Label>
                        <Select value={recipient.role} onValueChange={(value) => updateRecipient(index, 'role', value)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="signer">Signer</SelectItem>
                            <SelectItem value="viewer">Viewer</SelectItem>
                            <SelectItem value="approver">Approver</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`order-${index}`}>Signing Order</Label>
                        <Input
                          id={`order-${index}`}
                          type="number"
                          min="1"
                          value={recipient.signingOrder.toString()}
                          onChange={(e) => updateRecipient(index, 'signingOrder', parseInt(e.target.value) || 1)}
                        />
                      </div>
                    </div>
                  </div>
                  
                  {recipients.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeRecipient(index)}
                      className="text-red-500 hover:text-red-700 flex-shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>

          <Button
            variant="outline"
            onClick={addRecipient}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Another Recipient
          </Button>

          <div className="flex gap-3 justify-end">
            <Button variant="ghost" onClick={handleSkip}>
              Skip for Now
            </Button>
            <Button onClick={handleContinue} disabled={addRecipientMutation.isPending}>
              {addRecipientMutation.isPending ? "Adding..." : "Continue to Document"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}