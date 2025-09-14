import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, Calendar, User, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";

interface AddManualNdaSignerProps {
  isOpen: boolean;
  onClose: () => void;
  cimDocumentId: number;
  onSuccess: () => void;
}

export function AddManualNdaSigner({ isOpen, onClose, cimDocumentId, onSuccess }: AddManualNdaSignerProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [signedDate, setSignedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [ndaFile, setNdaFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.includes('pdf')) {
        toast({
          title: "Invalid File",
          description: "Please upload a PDF file",
          variant: "destructive"
        });
        return;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "File size must be less than 10MB",
          variant: "destructive"
        });
        return;
      }

      setNdaFile(file);
    }
  };

  const handleSubmit = async () => {
    // Validate required fields
    if (!signerName.trim()) {
      toast({
        title: "Missing Information",
        description: "Signer name is required",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    setUploadProgress(0);

    try {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append("signerName", signerName);
      formData.append("signerEmail", signerEmail || "");
      formData.append("signedDate", signedDate);
      if (ndaFile) {
        formData.append("ndaFile", ndaFile);
      }

      // Upload with progress tracking
      const xhr = new XMLHttpRequest();

      // Track upload progress
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(percentComplete);
        }
      });

      // Handle completion
      await new Promise((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(xhr.response);
          } else {
            const errorMsg = xhr.response?.error || `Upload failed with status ${xhr.status}`;
            reject(new Error(errorMsg));
          }
        };

        xhr.onerror = () => {
          reject(new Error("Network error during upload"));
        };

        const url = `/api/cim/${cimDocumentId}/nda-signatures/manual`;
        xhr.open("POST", url);
        xhr.withCredentials = true;
        xhr.setRequestHeader("Accept", "application/json");
        xhr.responseType = "json";
        xhr.send(formData);
      });

      toast({
        title: "Signer Added",
        description: "Manual NDA signer has been added successfully"
      });

      // Reset form
      setSignerName("");
      setSignerEmail("");
      setSignedDate(format(new Date(), 'yyyy-MM-dd'));
      setNdaFile(null);
      setUploadProgress(0);

      // Close modal and refresh list
      onSuccess();
      onClose();

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to add manual signer";
      toast({
        title: "Upload Failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
      setUploadProgress(0);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Add Manual NDA Signer
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Signer Name */}
          <div className="space-y-2">
            <Label htmlFor="signerName" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Full Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="signerName"
              placeholder="Enter signer's full name"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          {/* Email (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="signerEmail" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email Address <span className="text-sm text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="signerEmail"
              type="email"
              placeholder="Enter email address"
              value={signerEmail}
              onChange={(e) => setSignerEmail(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          {/* Date Signed */}
          <div className="space-y-2">
            <Label htmlFor="signedDate" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Date Signed <span className="text-sm text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="signedDate"
              type="date"
              value={signedDate}
              onChange={(e) => setSignedDate(e.target.value)}
              disabled={isSubmitting}
              max={format(new Date(), 'yyyy-MM-dd')}
            />
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label htmlFor="ndaFile" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Signed NDA Document <span className="text-sm text-muted-foreground">(optional)</span>
            </Label>
            <div className="space-y-2">
              <Input
                id="ndaFile"
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                disabled={isSubmitting}
                className="cursor-pointer"
              />
              {ndaFile && (
                <div className="text-sm text-muted-foreground">
                  Selected: {ndaFile.name} ({(ndaFile.size / 1024).toFixed(2)} KB)
                </div>
              )}
              <div className="text-xs text-muted-foreground">
                Upload a PDF file (max 10MB)
              </div>
            </div>
          </div>

          {/* Upload Progress */}
          {isSubmitting && uploadProgress > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !signerName}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : (
              "Add Signer"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}