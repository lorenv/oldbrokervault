import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EnhancedCimDisplay } from "@/components/enhanced-cim-display";
import { DocumentExport } from "@/components/document-export";
import { EmailShareDialog } from "@/components/email-share-dialog";
import { ArrowLeft, Share2, Download, ExternalLink, Copy, Mail, FileDown, Settings } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

export default function EnhancedCimPage() {
  const { id } = useParams<{ id: string }>();
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [emailShareDialog, setEmailShareDialog] = useState({ open: false, documentTitle: "", shareToken: "" });
  const { toast } = useToast();

  const { data: cimDocument, isLoading } = useQuery({
    queryKey: ['/api/cim', parseInt(id!)],
    queryFn: async () => {
      const response = await fetch(`/api/cim/${id}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch CIM document');
      return response.json();
    },
    enabled: !!id
  });

  // Helper functions for sharing
  const copyShareUrl = async () => {
    if (cimDocument?.shareEnabled && cimDocument?.shareSlug) {
      const shareUrl = `${window.location.origin}/share/${cimDocument.shareSlug}`;
      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: "Share Link Copied",
        description: "The share link has been copied to your clipboard"
      });
    } else {
      // Auto-enable sharing and copy the link
      try {
        const randomId = Math.random().toString(36).substring(2, 8);
        const newSlug = `cim-${randomId}`;
        const newShareUrl = `${window.location.origin}/share/${newSlug}`;
        
        const response = await fetch(`/api/cim/${id}/share`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            shareEnabled: true,
            shareSlug: newSlug,
            sharePassword: null,
            shareExpiresAt: null,
            ndaProtected: false,
            ndaTemplateId: null
          }),
        });
        
        if (response.ok) {
          await navigator.clipboard.writeText(newShareUrl);
          toast({
            title: "Sharing enabled and link copied",
            description: "Your document is now shareable and the link has been copied to your clipboard"
          });
        } else {
          toast({
            title: "Failed to enable sharing",
            description: "Please try again or enable sharing manually",
            variant: "destructive"
          });
        }
      } catch (error) {
        toast({
          title: "Failed to enable sharing",
          description: "Please try again or enable sharing manually",
          variant: "destructive"
        });
      }
    }
  };

  const openSharePage = async () => {
    if (cimDocument?.shareEnabled && cimDocument?.shareSlug) {
      const shareUrl = `${window.location.origin}/share/${cimDocument.shareSlug}`;
      window.open(shareUrl, '_blank');
    } else {
      // Auto-enable sharing and open the link
      try {
        const randomId = Math.random().toString(36).substring(2, 8);
        const newSlug = `cim-${randomId}`;
        const newShareUrl = `${window.location.origin}/share/${newSlug}`;
        
        const response = await fetch(`/api/cim/${id}/share`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            shareEnabled: true,
            shareSlug: newSlug,
            sharePassword: null,
            shareExpiresAt: null,
            ndaProtected: false,
            ndaTemplateId: null
          }),
        });
        
        if (response.ok) {
          // Open the share link
          window.open(newShareUrl, '_blank');
          
          toast({
            title: "Sharing enabled and link opened",
            description: "Your document is now shareable and the link has been opened in a new tab"
          });
        } else {
          toast({
            title: "Failed to enable sharing",
            description: "Please try again or enable sharing manually",
            variant: "destructive"
          });
        }
      } catch (error) {
        toast({
          title: "Failed to enable sharing",
          description: "Please try again or enable sharing manually",
          variant: "destructive"
        });
      }
    }
  };

  const handleEmailShare = async () => {
    if (cimDocument?.shareEnabled && cimDocument?.shareSlug) {
      setEmailShareDialog({
        open: true,
        documentTitle: cimDocument?.title || `CIM Document #${id}`,
        shareToken: cimDocument.shareSlug
      });
    } else {
      // Auto-enable sharing and open email dialog
      try {
        const randomId = Math.random().toString(36).substring(2, 8);
        const newSlug = `cim-${randomId}`;
        
        const response = await fetch(`/api/cim/${id}/share`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            shareEnabled: true,
            shareSlug: newSlug,
            sharePassword: null,
            shareExpiresAt: null,
            ndaProtected: false,
            ndaTemplateId: null
          }),
        });
        
        if (response.ok) {
          setEmailShareDialog({
            open: true,
            documentTitle: cimDocument?.title || `CIM Document #${id}`,
            shareToken: newSlug
          });
          
          toast({
            title: "Sharing enabled",
            description: "Your document is now shareable. You can now send the email invitation."
          });
        } else {
          toast({
            title: "Failed to enable sharing",
            description: "Please try again or enable sharing manually",
            variant: "destructive"
          });
        }
      } catch (error) {
        toast({
          title: "Failed to enable sharing",
          description: "Please try again or enable sharing manually",
          variant: "destructive"
        });
      }
    }
  };

  const downloadPdf = async () => {
    try {
      const response = await fetch(`/api/cim/export/pdf/${id}`, {
        method: 'POST',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${cimDocument?.title || 'document'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "PDF Downloaded",
        description: "Your CIM has been exported as a PDF"
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export to PDF",
        variant: "destructive"
      });
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!cimDocument) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6 text-center">
            <h2 className="text-xl font-semibold mb-2">Document Not Found</h2>
            <p className="text-gray-600 mb-4">The CIM document you're looking for doesn't exist.</p>
            <Link href="/cims">
              <Button>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to CIMs
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Link href="/documents">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to CIMs
          </Button>
        </Link>
        
        <h1 className="text-2xl font-bold text-center flex-1">{cimDocument.title}</h1>
        
        <div className="flex gap-2">
          {/* Share Button with Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setShowShareDialog(true)}>
                <Settings className="h-4 w-4 mr-2" />
                Share Link Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={copyShareUrl}>
                <Copy className="h-4 w-4 mr-2" />
                Copy Share Link
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleEmailShare}>
                <Mail className="h-4 w-4 mr-2" />
                Share via Email
              </DropdownMenuItem>
              <DropdownMenuItem onClick={downloadPdf}>
                <FileDown className="h-4 w-4 mr-2" />
                Export to PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* View Share Link Button */}
          <Button variant="default" onClick={openSharePage}>
            <ExternalLink className="h-4 w-4 mr-2" />
            View Share Link
          </Button>
        </div>
      </div>

      {/* Enhanced CIM Display */}
      <EnhancedCimDisplay
        analysis={cimDocument.analysis}
        docId={parseInt(id!)}
        logoUrl={cimDocument.logoUrl}
        selectedImages={cimDocument.selectedImages}
        websiteUrl={cimDocument.websiteUrl}
        isSharedView={false}
        cimDocument={cimDocument}
      />

      {/* Comprehensive Share Dialog */}
      <DocumentExport
        analysis={cimDocument.analysis}
        docId={parseInt(id!)}
        autoTriggerShare={showShareDialog}
        onShareTriggered={() => setShowShareDialog(false)}
        isSharedView={false}
        websiteUrl={cimDocument.websiteUrl}
        logoUrl={cimDocument.logoUrl}
        selectedImages={cimDocument.selectedImages}
      />

      {/* Email Share Dialog */}
      <EmailShareDialog
        open={emailShareDialog.open}
        onOpenChange={(open) => setEmailShareDialog(prev => ({ ...prev, open }))}
        documentTitle={emailShareDialog.documentTitle}
        shareUrl={emailShareDialog.shareToken ? `${window.location.origin}/share/${emailShareDialog.shareToken}` : ''}
      />
    </div>
  );
}