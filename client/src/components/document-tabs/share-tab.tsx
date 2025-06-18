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
  FileDown
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
  const [isWordLoading, setIsWordLoading] = useState(false);

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
      const response = await fetch(`/api/cim/${cimDocument.id}/export/pdf`, {
        method: 'GET',
        credentials: 'include'
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

  // Handle Word export
  const handleWordExport = async () => {
    setIsWordLoading(true);
    try {
      const response = await fetch(`/api/cim/${cimDocument.id}/export/word`, {
        method: 'GET',
        credentials: 'include'
      });
      
      if (!response.ok) throw new Error('Word export failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${cimDocument.title || 'CIM'}.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Word Export Started",
        description: "Your CIM is being downloaded as a Word document"
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export Word document. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsWordLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Share Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
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
                <Label htmlFor="custom-slug">Custom Link (Optional)</Label>
                <Input
                  id="custom-slug"
                  placeholder="my-company-cim"
                  value={shareSettings.customSlug}
                  onChange={(e) => 
                    setShareSettings(prev => ({ ...prev, customSlug: e.target.value }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty for auto-generated link
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="share-password">Password Protection (Optional)</Label>
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
                <Label htmlFor="expires-at">Expiration Date (Optional)</Label>
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
          >
            {isUpdatingShare ? "Updating..." : "Update Share Settings"}
          </Button>
        </CardContent>
      </Card>

      {/* Share Link */}
      {shareSettings.shareEnabled && shareUrl && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link className="h-5 w-5" />
              Share Link
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Input
                value={shareUrl}
                readOnly
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={copyShareUrl}
              >
                <Copy className="h-4 w-4" />
              </Button>
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

      {/* Email Sharing */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Send via Email
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Share this document directly via email with custom message
          </p>
          <Button
            onClick={() => setEmailShareDialog({
              open: true,
              documentTitle: cimDocument.title,
              shareUrl: shareUrl
            })}
            disabled={!shareSettings.shareEnabled}
          >
            <Mail className="h-4 w-4 mr-2" />
            Send Email
          </Button>
        </CardContent>
      </Card>

      {/* Export Options */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Document
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handlePdfExport}
              disabled={isPdfLoading}
            >
              <FileDown className="h-4 w-4 mr-2" />
              {isPdfLoading ? "Exporting..." : "Export PDF"}
            </Button>
            <Button
              variant="outline"
              onClick={handleWordExport}
              disabled={isWordLoading}
            >
              <FileDown className="h-4 w-4 mr-2" />
              {isWordLoading ? "Exporting..." : "Export Word"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Download your CIM as PDF or Word document for offline sharing
          </p>
        </CardContent>
      </Card>

      {/* Embed Code */}
      {shareSettings.shareEnabled && shareUrl && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code className="h-5 w-5" />
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
        shareUrl={shareUrl}
      />
    </div>
  );
}