import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Copy, RefreshCw } from "lucide-react";

interface ShareSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  docId: number;
}

export function ShareSettingsDialog({ open, onOpenChange, docId }: ShareSettingsDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: shareSettings, isLoading } = useQuery({
    queryKey: [`/api/cim/${docId}/share-settings`],
    queryFn: async () => {
      const response = await fetch(`/api/cim/${docId}/share-settings`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch share settings');
      return response.json();
    },
    enabled: open
  });

  const updateShareMutation = useMutation({
    mutationFn: async (settings: any) => {
      return apiRequest("PATCH", `/api/cim/${docId}/share-settings`, settings);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/cim/${docId}/share-settings`] });
      queryClient.invalidateQueries({ queryKey: ['/api/cim', docId] });
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

  const copyShareUrl = async () => {
    if (!shareSettings?.shareSlug) return;
    const shareUrl = `${window.location.origin}/share/${shareSettings.shareSlug}`;
    await navigator.clipboard.writeText(shareUrl);
    toast({
      title: "Share Link Copied",
      description: "The share link has been copied to your clipboard"
    });
  };

  const handleSaveSettings = (field: string, value: any) => {
    updateShareMutation.mutate({ [field]: value });
  };

  const shareUrl = shareSettings?.shareSlug ? `${window.location.origin}/share/${shareSettings.shareSlug}` : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share Link Settings</DialogTitle>
        </DialogHeader>
        
        {isLoading || !shareSettings ? (
          <div className="space-y-4">
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-10 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              <div className="h-10 bg-gray-200 rounded"></div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Share URL */}
            <div className="space-y-2">
              <Label>Share URL</Label>
              <div className="flex gap-2">
                <Input 
                  value={shareUrl} 
                  readOnly 
                  className="flex-1"
                />
                <Button variant="outline" size="sm" onClick={copyShareUrl}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => regenerateSlugMutation.mutate()}
                disabled={regenerateSlugMutation.isPending}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${regenerateSlugMutation.isPending ? 'animate-spin' : ''}`} />
                Generate New Link
              </Button>
            </div>

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
                  checked={shareSettings.requireNda}
                  onCheckedChange={(checked) => handleSaveSettings('requireNda', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Password Protection</Label>
                  <p className="text-sm text-gray-500">Require password to access document</p>
                </div>
                <Switch
                  checked={!!shareSettings.password}
                  onCheckedChange={(checked) => {
                    if (!checked) {
                      handleSaveSettings('password', null);
                    }
                  }}
                />
              </div>

              {shareSettings.password !== null && (
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input
                    type="password"
                    value={shareSettings.password || ''}
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
        )}
      </DialogContent>
    </Dialog>
  );
}