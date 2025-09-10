import { CimDisplay } from "@/components/cim-display";
import { UploadedCimFileManager } from "@/components/uploaded-cim-file-manager";
import { Button } from "@/components/ui/button";
import { Eye, Link, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface DocumentEditTabProps {
  cimDocument: any;
  financialFiles: any[];
  customSections: any[];
}

export function DocumentEditTab({ cimDocument, financialFiles, customSections }: DocumentEditTabProps) {
  // Check if this is an uploaded file CIM or AI-generated CIM
  const isUploadedFile = cimDocument.isUploadedFile;
  const { toast } = useToast();

  const generateShareUrl = () => {
    const baseUrl = window.location.hostname === 'localhost' ? window.location.origin : 'https://cimshare.com';
    return `${baseUrl}/share/${cimDocument.shareSlug || 'not-shared'}`;
  };

  const handleCopyShareLink = async () => {
    if (!cimDocument.shareSlug) {
      toast({
        title: "Sharing Not Enabled",
        description: "Please enable sharing for this document first in the Share tab.",
        variant: "destructive"
      });
      return;
    }

    try {
      const shareUrl = generateShareUrl();
      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: "Share Link Copied!",
        description: "The share link has been copied to your clipboard.",
      });
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy link to clipboard.",
        variant: "destructive"
      });
    }
  };

  const handlePreviewShareLink = () => {
    if (!cimDocument.shareSlug) {
      toast({
        title: "Sharing Not Enabled",
        description: "Please enable sharing for this document first in the Share tab.",
        variant: "destructive"
      });
      return;
    }

    const shareUrl = generateShareUrl();
    window.open(shareUrl, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Edit Document</h2>
            <p className="text-gray-600 mt-1">
              {isUploadedFile 
                ? "Manage your uploaded document and attachments" 
                : "Customize your CIM content, images, and sections"
              }
            </p>
          </div>
          
          {/* Share Link Action Buttons */}
          <div className="flex-shrink-0">
            <TooltipProvider>
              <div className="flex items-center gap-2">
                {/* Copy Share Link Button */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleCopyShareLink}
                      disabled={!cimDocument.shareSlug}
                      className={`
                        ${cimDocument.shareSlug 
                          ? 'hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600' 
                          : 'opacity-50 cursor-not-allowed'
                        }
                      `}
                    >
                      <Link className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Copy Share Link</p>
                  </TooltipContent>
                </Tooltip>

                {/* Preview Share Link Button */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handlePreviewShareLink}
                      disabled={!cimDocument.shareSlug}
                      className={`
                        ${cimDocument.shareSlug 
                          ? 'hover:bg-green-50 hover:border-green-300 hover:text-green-600' 
                          : 'opacity-50 cursor-not-allowed'
                        }
                      `}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Preview Share Link</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          </div>

        </div>
      </div>

      {/* Content */}
      {isUploadedFile ? (
        // For uploaded files, show the file manager
        <UploadedCimFileManager 
          docId={cimDocument.id}
          cimTitle={cimDocument.title}
        />
      ) : (
        // For AI-generated CIMs, show the CIM display editor
        <CimDisplay
          analysis={cimDocument.analysis}
          docId={cimDocument.id}
          logoUrl={cimDocument.logoUrl}
          selectedImages={cimDocument.selectedImages}
          cimDocument={cimDocument}
          isSharedView={false}
          autoTriggerShare={false}
        />
      )}
    </div>
  );
}