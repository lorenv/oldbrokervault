import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { useToast } from "@/hooks/use-toast";
import { FileText, Shield } from "lucide-react";

interface NdaDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSigned: () => void;
  shareSlug: string;
  ndaUrl?: string;
}

export function NdaDialog({ 
  isOpen, 
  onClose, 
  onSigned, 
  shareSlug, 
  ndaUrl 
}: NdaDialogProps) {
  const { toast } = useToast();
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");

  const [isSigning, setIsSigning] = useState(false);

  const handleSignNda = async () => {
    console.log('=== NDA DIALOG SIGNING DEBUG ===');
    console.log('Signer name from dialog:', signerName);
    console.log('Signer email from dialog:', signerEmail);
    console.log('Share slug:', shareSlug);
    
    if (!signerName.trim() || !signerEmail.trim()) {
      console.log('ERROR: Missing name or email');
      toast({
        title: "Missing Information",
        description: "Please provide your name and email address",
        variant: "destructive"
      });
      return;
    }

    console.log('Validation passed, proceeding with redirect...');

    setIsSigning(true);
    try {
      // For documents with NDA templates, redirect to the signing page with user info
      const params = new URLSearchParams({
        name: signerName.trim(),
        email: signerEmail.trim()
      });
      
      const redirectUrl = `/share/${shareSlug}/sign-nda?${params.toString()}`;
      console.log('Redirecting to:', redirectUrl);
      console.log('URL params created:', params.toString());
      console.log('=== END NDA DIALOG DEBUG ===');
      
      window.location.href = redirectUrl;
    } catch (error) {
      console.error('Redirect error:', error);
      setIsSigning(false);
      toast({
        title: "Error",
        description: "Failed to proceed with NDA signing",
        variant: "destructive"
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => !isSigning && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            NDA Required
          </DialogTitle>
          <DialogDescription>
            This confidential information memorandum requires signing a Non-Disclosure Agreement before access.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-800">
              By proceeding, you agree to keep all information confidential and comply with the terms 
              of the Non-Disclosure Agreement.
            </p>
          </div>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="signer-name">Full Name</Label>
              <Input
                id="signer-name"
                placeholder="Enter your full legal name"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                disabled={isSigning}
              />
              {signerName.trim() && (
                <div className="mt-2 p-3 bg-gray-50 rounded border">
                  <p className="text-xs text-gray-600 mb-1">Signature preview:</p>
                  <div className="signature-handwriting" style={{ color: '#1a365d' }}>
                    {signerName.trim()}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="signer-email">Email Address</Label>
              <Input
                id="signer-email"
                type="email"
                placeholder="Enter your email address"
                value={signerEmail}
                onChange={(e) => setSignerEmail(e.target.value)}
                disabled={isSigning}
              />
            </div>


          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={onClose}
            disabled={isSigning}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSignNda}
            disabled={isSigning || !signerName.trim() || !signerEmail.trim()}
          >
            {isSigning ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Processing...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                Continue
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}