import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Share2, 
  Copy, 
  Mail, 
  Download, 
  Code,
  Globe,
  Link,
  Calendar,
  Lock,
  Eye,
  FileDown,
  Settings // Imported Settings icon, assuming it was intended for Share Settings
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { DocumentExport } from "@/components/document-export";
import { EmailShareDialog } from "@/components/email-share-dialog";

interface DocumentShareTabProps {
  cimDocument: any;
  user: any;
}

export function DocumentShareTab({ cimDocument, user }: DocumentShareTabProps) {
  const { toast } = useToast();

  // Share settings state
  const [shareSettings, setShareSettings] = useState({
    shareEnabled: cimDocument.shareEnabled || false,
    shareSlug: cimDocument.shareSlug || '',
    sharePassword: cimDocument.sharePassword || '',
    shareExpiresAt: cimDocument.shareExpiresAt || '',
    customSlug: cimDocument.shareSlug || '',
    ndaProtected: cimDocument.ndaProtected || false,
    ndaTemplateId: cimDocument.ndaTemplateId || null
  });

  const [shareUrl, setShareUrl] = useState('');
  const [isUpdatingShare, setIsUpdatingShare] = useState(false);

  // Email sharing state
  const [emailShareDialog, setEmailShareDialog] = useState<{
    open: boolean;
    documentTitle?: string;
    shareUrl?: string;
  }>({ open: false });

  // Embed settings state
  const [embedSettings, setEmbedSettings] = useState({
    width: '100%',
    height: '600',
    border: true,
    responsive: true
  });

  // Document export state
  const [isPdfLoading, setIsPdfLoading] = useState(false);

  // Initialize share URL on component mount
  useEffect(() => {
    if (shareSettings.shareEnabled && shareSettings.shareSlug) {
      const baseUrl = window.location.hostname === 'localhost' ? window.location.origin : 'https://cimshare.com';
      const url = `${baseUrl}/share/${shareSettings.shareSlug}`;
      setShareUrl(url);
    } else {
      setShareUrl('');
    }
  }, [shareSettings.shareEnabled, shareSettings.shareSlug]);

  // Generate share slug
  const generateShareSlug = () => {
    if (shareSettings.customSlug) {
      return shareSettings.customSlug.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    }
    const randomId = Math.random().toString(36).substring(2, 8);
    return `cim-${randomId}`;
  };

  // Update share settings
  const updateShareSettings = async () => {
    if (!cimDocument.id) return;

    // Validate NDA template selection when NDA protection is enabled
    if (shareSettings.ndaProtected && !shareSettings.ndaTemplateId) {
      toast({
        title: "NDA Template Required",
        description: "Please select an NDA template when enabling NDA protection.",
        variant: "destructive"
      });
      return;
    }

    setIsUpdatingShare(true);
    try {
      const slug = shareSettings.shareEnabled ? (shareSettings.shareSlug || generateShareSlug()) : null;
      const expiresAt = shareSettings.shareExpiresAt ? new Date(shareSettings.shareExpiresAt) : null;

      const payload = {
        shareEnabled: shareSettings.shareEnabled,
        shareSlug: slug,
        customSlug: shareSettings.customSlug || null,
        sharePassword: shareSettings.sharePassword || null,
        shareExpiresAt: expiresAt,
        ndaProtected: shareSettings.ndaProtected,
        ndaTemplateId: shareSettings.ndaTemplateId
      };

      const response = await apiRequest('POST', `/api/cim/${cimDocument.id}/share`, payload);

      if (response.ok) {
        const result = await response.json();

        if (result.shareSlug) {
          const baseUrl = window.location.hostname === 'localhost' ? window.location.origin : 'https://cimshare.com';
          const url = `${baseUrl}/share/${result.shareSlug}`;
          setShareUrl(url);
          setShareSettings(prev => ({ ...prev, shareSlug: result.shareSlug }));
        }
        toast({
          title: "Share settings updated",
          description: shareSettings.shareEnabled ? "Your CIM is now shareable!" : "Sharing has been disabled",
        });
      } else {
        const errorText = await response.text();
        throw new Error(`Failed to update settings: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      toast({
        title: "Error updating share settings",
        description: `Failed to save settings: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setIsUpdatingShare(false);
    }
  };

  // Copy share URL
  const copyShareUrl = async () => {
    if (shareSettings.shareEnabled && shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      toast({
        title: "Share link copied!",
        description: "The link has been copied to your clipboard",
      });
    } else {
      toast({
        title: "No Share Link Available",
        description: "This document doesn't have sharing enabled",
        variant: "destructive"
      });
    }
  };

  // Generate embed code
  const generateEmbedCode = () => {
    if (!shareUrl) return '';

    const { width, height, border, responsive } = embedSettings;

    let iframe = `<iframe src="${shareUrl}" width="${width}" height="${height}px"`;

    if (!border) {
      iframe += ` style="border: none;"`;
    }

    iframe += ` frameborder="0" allowfullscreen></iframe>`;

    if (responsive && width === '100%') {
      return `<div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%; background: #000;">
  ${iframe.replace(`height="${height}px"`, 'style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"')}
</div>`;
    }

    return iframe;
  };

  // Copy embed code
  const copyEmbedCode = () => {
    const embedCode = generateEmbedCode();
    navigator.clipboard.writeText(embedCode);
    toast({
      title: "Embed code copied!",
      description: "The iframe code has been copied to your clipboard",
    });
  };

  // Handle PDF export
  const handlePdfExport = async () => {
    setIsPdfLoading(true);
    try {
      const response = await fetch(`/api/cim/export/pdf/${cimDocument.id}`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) throw new Error('PDF export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${cimDocument.title || 'CIM'}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "PDF Export Started",
        description: "Your CIM is being downloaded as a PDF"
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export PDF. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsPdfLoading(false);
    }
  };

  const copyToClipboard = async (text: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied!",
        description: successMessage,
      });
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const downloadPdf = async () => {
    setIsPdfLoading(true);
    try {
      const response = await fetch(`/api/cim/${cimDocument.id}/export/pdf`, {
        method: 'GET',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${cimDocument.title || 'document'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Download started",
        description: "Your document is being downloaded as a PDF.",
      });

    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to export PDF: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsPdfLoading(false);
    }
  };


  return (
    <div className="space-y-6">
      {/* Share Link */}
      {shareSettings.shareEnabled && shareUrl && (
        <Card className="bg-white shadow-lg border border-gray-200 rounded-xl">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-teal-600 text-white rounded-t-xl p-4">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Link className="h-4 w-4" />
              Share Link
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={copyShareUrl}
                className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 hover:border-blue-300"
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Input
                value={shareUrl}
                readOnly
                className="flex-1 font-mono text-sm bg-gray-50"
              />
            </div>

            <div className="flex items-center gap-2">
              {shareSettings.sharePassword && (
                <Badge variant="outline">
                  <Lock className="h-3 w-3 mr-1" />
                  Password Protected
                </Badge>
              )}
              {shareSettings.ndaProtected && (
                <Badge variant="outline">
                  <Eye className="h-3 w-3 mr-1" />
                  NDA Required
                </Badge>
              )}
              {shareSettings.shareExpiresAt && (
                <Badge variant="outline">
                  <Calendar className="h-3 w-3 mr-1" />
                  Expires {new Date(shareSettings.shareExpiresAt).toLocaleDateString()}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Export Document */}
      <Card className="bg-white shadow-lg border border-gray-200 rounded-xl">
        <CardHeader className="bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-t-xl p-4">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Download className="h-4 w-4" />
            Export Document
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handlePdfExport}
              disabled={isPdfLoading}
              className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100 hover:border-green-300"
            >
              <FileDown className="h-4 w-4 mr-2" />
              {isPdfLoading ? "Exporting..." : "Export PDF"}
            </Button>
          </div>
          <p className="text-sm text-gray-600">
            Download your CIM as PDF document for offline sharing
          </p>
        </CardContent>
      </Card>

      {/* Send via Email */}
      <Card className="bg-white shadow-lg border border-gray-200 rounded-xl">
        <CardHeader className="bg-gradient-to-r from-purple-600 to-teal-600 text-white rounded-t-xl p-4">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Mail className="h-4 w-4" />
            Send via Email
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-sm text-gray-600 mb-4">
            Share this document directly via email with custom message
          </p>
          <Button
            onClick={() => setEmailShareDialog({
              open: true,
              documentTitle: cimDocument.title,
              shareUrl: shareUrl
            })}
            disabled={!shareSettings.shareEnabled}
            className="bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 hover:border-purple-300"
          >
            <Mail className="h-4 w-4 mr-2" />
            Send Email
          </Button>
        </CardContent>
      </Card>

      {/* Share Settings */}
      <Card className="bg-white shadow-lg border border-gray-200 rounded-xl">
        <CardHeader className="bg-gradient-to-r from-slate-600 to-teal-600 text-white rounded-t-xl p-4">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Settings className="h-4 w-4" />
            Share Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="share-enabled">Enable Public Sharing</Label>
              <p className="text-sm text-muted-foreground">
                Allow others to view this document via a public link
              </p>
            </div>
            <Switch
              id="share-enabled"
              checked={shareSettings.shareEnabled}
              onCheckedChange={(checked) => 
                setShareSettings(prev => ({ ...prev, shareEnabled: checked }))
              }
            />
          </div>

          {shareSettings.shareEnabled && (
            <>
              <div className="space-y-2">
                <Label htmlFor="custom-slug">Customize Share Link</Label>
                <Input
                  id="custom-slug"
                  placeholder="my-company-cim"
                  value={shareSettings.customSlug}
                  onChange={(e) => 
                    setShareSettings(prev => ({ ...prev, customSlug: e.target.value }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Customize the end of your share link. Example: https://cimshare.com/share/customexample
                </p>
              </div>


                <div className="space-y-2">
                  <Label htmlFor="share-password">Password Protection</Label>
                  <Input
                    id="share-password"
                    type="password"
                  placeholder="Enter password"
                  value={shareSettings.sharePassword}
                  onChange={(e) => 
                    setShareSettings(prev => ({ ...prev, sharePassword: e.target.value }))
                  }
                />
              </div>


                <div className="space-y-2">
                  <Label htmlFor="expires-at">Expiration Date</Label>
                  <Input
                    id="expires-at"
                    type="datetime-local"
                  value={shareSettings.shareExpiresAt}
                  onChange={(e) => 
                    setShareSettings(prev => ({ ...prev, shareExpiresAt: e.target.value }))
                  }
                />
              </div>
            </>
          )}

          <Button 
            onClick={updateShareSettings}
            disabled={isUpdatingShare}
            className="bg-slate-600 text-white hover:bg-slate-700 border-slate-600 hover:border-slate-700"
          >
            {isUpdatingShare ? "Updating..." : "Update Share Settings"}
          </Button>
        </CardContent>
      </Card>

      {/* Embed Code */}
      {shareSettings.shareEnabled && shareUrl && (
        <Card className="bg-white shadow-lg border border-gray-200 rounded-xl">
          <CardHeader className="bg-gradient-to-r from-indigo-600 to-teal-600 text-white rounded-t-xl p-4">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Code className="h-4 w-4" />
              Embed Code
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="embed-width">Width</Label>
                <Input
                  id="embed-width"
                  value={embedSettings.width}
                  onChange={(e) => 
                    setEmbedSettings(prev => ({ ...prev, width: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="embed-height">Height (px)</Label>
                <Input
                  id="embed-height"
                  value={embedSettings.height}
                  onChange={(e) => 
                    setEmbedSettings(prev => ({ ...prev, height: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="embed-border"
                  checked={embedSettings.border}
                  onCheckedChange={(checked) => 
                    setEmbedSettings(prev => ({ ...prev, border: checked }))
                  }
                />
                <Label htmlFor="embed-border">Show Border</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="embed-responsive"
                  checked={embedSettings.responsive}
                  onCheckedChange={(checked) => 
                    setEmbedSettings(prev => ({ ...prev, responsive: checked }))
                  }
                />
                <Label htmlFor="embed-responsive">Responsive</Label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="embed-code">Embed Code</Label>
              <Textarea
                id="embed-code"
                value={generateEmbedCode()}
                readOnly
                rows={6}
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                onClick={copyEmbedCode}
                className="w-full"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy Embed Code
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Email Share Dialog */}
      <EmailShareDialog
        open={emailShareDialog.open}
        onOpenChange={(open) => setEmailShareDialog(prev => ({ ...prev, open }))}
        documentTitle={emailShareDialog.documentTitle || ''}
        shareUrl={emailShareDialog.shareUrl || shareUrl}
        senderName={user?.name}
      />
    </div>
  );
}