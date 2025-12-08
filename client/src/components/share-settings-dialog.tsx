import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCimDocument } from "@/hooks/use-cim-document";
import { useAuth } from "@/hooks/use-auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Copy, RefreshCw, Check } from "lucide-react";
import { getBaseUrlWithSubdomain } from "@/lib/url-utils";

interface ShareSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  docId: number;
}

export function ShareSettingsDialog({ open, onOpenChange, docId }: ShareSettingsDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Local state for custom slug input (for live preview)
  const [customSlugInput, setCustomSlugInput] = useState('');
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Use centralized CIM document data instead of separate share settings query
  const { data: cimDocument } = useCimDocument(docId, open);

  // Extract share settings from CIM document to avoid duplicate API calls
  const shareSettings = cimDocument ? {
    isPublic: cimDocument.is_public || cimDocument.isPublic || false,
    shareSlug: cimDocument.share_slug || cimDocument.shareSlug || '',
    customSlug: cimDocument.custom_slug || cimDocument.customSlug || '',
    requireNDA: cimDocument.require_nda || cimDocument.requireNDA || false,
    passwordProtected: cimDocument.password_protected || cimDocument.passwordProtected || false,
    sharePassword: cimDocument.share_password || cimDocument.sharePassword || ''
  } : null;

  // Sync local state with server data when dialog opens or data changes
  useEffect(() => {
    if (shareSettings?.customSlug !== undefined) {
      setCustomSlugInput(shareSettings.customSlug || '');
    }
  }, [shareSettings?.customSlug]);

  const isLoading = !cimDocument && open;

  const updateShareMutation = useMutation({
    mutationFn: async (settings: any) => {
      return apiRequest("PATCH", `/api/cim/${docId}/share-settings`, { body: settings });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/cim/${docId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/cim'] });
      toast({
        title: "Share Settings Updated",
        description: "Your share settings have been saved successfully"
      });
    }
  });

  const regenerateSlugMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/cim/${docId}/regenerate-share-slug`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/cim/${docId}/share-settings`] });
      queryClient.invalidateQueries({ queryKey: ['/api/cim', docId] });
      toast({
        title: "Share Link Regenerated",
        description: "A new share link has been generated"
      });
    }
  });

  const copyShareUrl = async (url: string) => {
    await navigator.clipboard.writeText(url);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
    toast({
      title: "Share Link Copied",
      description: "The share link has been copied to your clipboard"
    });
  };

  const handleSaveSettings = (field: string, value: any) => {
    updateShareMutation.mutate({ [field]: value });
  };

  if (isLoading || !shareSettings) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Link Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-10 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const baseUrl = getBaseUrlWithSubdomain(user?.customSubdomain);

  // Use local input for live preview, fall back to saved customSlug or default shareSlug
  const effectiveSlug = customSlugInput || shareSettings.customSlug || shareSettings.shareSlug;
  const livePreviewUrl = `${baseUrl}/share/${effectiveSlug}`;

  // For displaying the domain prefix in the custom slug input
  const displayDomain = user?.customSubdomain
    ? `${user.customSubdomain}.cimshare.com/share/`
    : 'cimshare.com/share/';

  // Check if the input differs from saved value (needs saving)
  const hasUnsavedChanges = customSlugInput !== (shareSettings.customSlug || '');

  // Sanitize and save custom slug
  const handleCustomSlugChange = (value: string) => {
    // Sanitize: lowercase, alphanumeric and hyphens only
    const sanitized = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setCustomSlugInput(sanitized);
  };

  const saveCustomSlug = () => {
    if (customSlugInput !== shareSettings.customSlug) {
      handleSaveSettings('customSlug', customSlugInput || null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Share Link Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Custom URL Input */}
          <div className="space-y-3">
            <Label htmlFor="custom-slug">Customize Your Share Link</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground whitespace-nowrap">{displayDomain}</span>
              <Input
                id="custom-slug"
                placeholder="my-business-name"
                value={customSlugInput}
                onChange={(e) => handleCustomSlugChange(e.target.value)}
                onBlur={saveCustomSlug}
                onKeyDown={(e) => e.key === 'Enter' && saveCustomSlug()}
                className="flex-1"
              />
              {hasUnsavedChanges && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={saveCustomSlug}
                  disabled={updateShareMutation.isPending}
                >
                  {updateShareMutation.isPending ? 'Saving...' : 'Save'}
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Type a custom URL slug above. Only lowercase letters, numbers, and hyphens allowed.
            </p>
          </div>

          {/* Live Preview Share URL */}
          <div className="space-y-2 p-4 bg-slate-50 rounded-lg border">
            <Label className="text-sm font-medium">Your Share Link</Label>
            <div className="flex gap-2 items-center">
              <code className="flex-1 text-sm bg-white px-3 py-2 rounded border truncate">
                {livePreviewUrl}
              </code>
              <Button
                variant={copiedUrl ? "default" : "outline"}
                size="sm"
                onClick={() => copyShareUrl(livePreviewUrl)}
                className="shrink-0"
              >
                {copiedUrl ? (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-1" />
                    Copy
                  </>
                )}
              </Button>
            </div>
            {hasUnsavedChanges && (
              <p className="text-xs text-amber-600">
                Preview shown above. Click "Save" to confirm your custom URL.
              </p>
            )}
          </div>

          {/* Generate New Link */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => regenerateSlugMutation.mutate()}
            disabled={regenerateSlugMutation.isPending}
            className="w-full"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${regenerateSlugMutation.isPending ? 'animate-spin' : ''}`} />
            Generate Random Link Instead
          </Button>

          {/* Share Settings */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Public Sharing</Label>
                <p className="text-sm text-gray-500">Allow anyone with the link to view this document</p>
              </div>
              <Switch
                checked={shareSettings.isPublic}
                onCheckedChange={(checked) => handleSaveSettings('isPublic', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Require NDA Agreement</Label>
                <p className="text-sm text-gray-500">Viewers must agree to NDA before accessing</p>
              </div>
              <Switch
                checked={shareSettings.requireNDA}
                onCheckedChange={(checked) => handleSaveSettings('requireNda', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Password Protection</Label>
                <p className="text-sm text-gray-500">Require password to access document</p>
              </div>
              <Switch
                checked={!!shareSettings.sharePassword}
                onCheckedChange={(checked) => {
                  if (!checked) {
                    handleSaveSettings('password', null);
                  }
                }}
              />
            </div>

            {shareSettings.passwordProtected && (
              <div className="space-y-2">
                <Label>Password</Label>
                <Input
                  type="password"
                  value={shareSettings.sharePassword || ''}
                  onChange={(e) => handleSaveSettings('password', e.target.value)}
                  placeholder="Enter password"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}