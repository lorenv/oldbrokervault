import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Lock, Edit, UserPlus, Users, Globe } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { DocumentExport } from './document-export';

interface CollaborationBannerProps {
  docId: number;
  isOwner: boolean;
  onEditingStatusChange?: (canEdit: boolean) => void;
  shareToken?: string;
  shareEnabled?: boolean;
  title?: string;
  analysis?: any;
  websiteUrl?: string;
  logoUrl?: string;
  selectedImages?: string[];
  autoTriggerShare?: boolean;
  onShareTriggered?: () => void;
}

interface EditingStatus {
  isBeingEdited: boolean;
  currentEditor: {
    id: number;
    name: string;
    editStartedAt: string;
  } | null;
  canEdit: boolean;
}

interface Collaborator {
  id: number;
  email: string;
  permission: "view" | "edit";
  status: "pending" | "accepted" | "declined";
  invitedAt: string;
}

export function CollaborationBanner({ 
  docId, 
  isOwner, 
  onEditingStatusChange, 
  shareToken, 
  shareEnabled, 
  title, 
  analysis, 
  websiteUrl, 
  logoUrl, 
  selectedImages,
  autoTriggerShare,
  onShareTriggered
}: CollaborationBannerProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: "", permission: "view" });

  // Query editing status every 10 seconds
  const { data: editingStatus } = useQuery({
    queryKey: [`/api/cim/${docId}/editing-status`],
    refetchInterval: 10000,
    enabled: !!user && (user.subscriptionStatus !== 'free' || user.isAdmin)
  });

  // Query collaborators
  const { data: collaborators } = useQuery({
    queryKey: [`/api/cim/${docId}/collaborators`],
    enabled: !!user && (user.subscriptionStatus !== 'free' || user.isAdmin)
  });

  // Start editing mutation
  const startEditingMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/cim/${docId}/start-editing`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/cim/${docId}/editing-status`] });
      onEditingStatusChange?.(true);
      toast({
        title: "Editing Started",
        description: "You can now edit this document. Others will see that you're editing."
      });
    },
    onError: async (error: any) => {
      const errorData = await error.response?.json();
      if (errorData?.upgradeRequired) {
        toast({
          title: "Upgrade Required",
          description: "Collaboration features require a paid subscription.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Cannot Edit",
          description: errorData?.error || "Failed to start editing",
          variant: "destructive"
        });
      }
    }
  });

  // Stop editing mutation
  const stopEditingMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/cim/${docId}/stop-editing`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/cim/${docId}/editing-status`] });
      onEditingStatusChange?.(false);
      toast({
        title: "Editing Stopped",
        description: "You have stopped editing this document."
      });
    }
  });

  // Invite collaborator mutation
  const inviteCollaboratorMutation = useMutation({
    mutationFn: (data: { email: string; permission: string }) => 
      apiRequest("POST", `/api/cim/${docId}/invite`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/cim/${docId}/collaborators`] });
      setIsInviteDialogOpen(false);
      setInviteForm({ email: "", permission: "view" });
      toast({
        title: "Invitation Sent",
        description: "The collaboration invitation has been sent."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Send Invitation",
        description: "Could not send the collaboration invitation.",
        variant: "destructive"
      });
    }
  });

  // Auto-stop editing after 2 hours of inactivity
  useEffect(() => {
    const typedStatus = editingStatus as EditingStatus | undefined;
    if (typedStatus?.currentEditor?.id === user?.id) {
      const timeout = setTimeout(() => {
        stopEditingMutation.mutate();
      }, 2 * 60 * 60 * 1000); // 2 hours

      return () => clearTimeout(timeout);
    }
  }, [editingStatus, user?.id, docId, stopEditingMutation]);

  // Notify parent of editing status changes
  useEffect(() => {
    const typedStatus = editingStatus as EditingStatus | undefined;
    const canEdit = typedStatus?.canEdit || false;
    onEditingStatusChange?.(canEdit);
  }, [editingStatus, onEditingStatusChange]);

  // Don't show collaboration features for free users
  if (!user || (user.subscriptionStatus === 'free' && !user.isAdmin)) {
    return null;
  }

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inviteForm.email) {
      inviteCollaboratorMutation.mutate(inviteForm);
    }
  };

  const typedEditingStatus = editingStatus as EditingStatus | undefined;
  const typedCollaborators = collaborators as Collaborator[] | undefined;

  return (
    <div className="space-y-3 mb-6">
      {/* Editing Status Banner */}
      {typedEditingStatus?.isBeingEdited && typedEditingStatus.currentEditor && (
        <Alert>
          <Lock className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>
                <strong>{typedEditingStatus.currentEditor.name}</strong> is currently editing this document
              </span>
              <span className="text-xs text-muted-foreground">
                Started {format(new Date(typedEditingStatus.currentEditor.editStartedAt), 'h:mm a')}
              </span>
            </div>
            {typedEditingStatus.currentEditor.id === user?.id && (
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => stopEditingMutation.mutate()}
                disabled={stopEditingMutation.isPending}
              >
                Stop Editing
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Collaboration Bar */}
      <div className="flex items-center justify-between bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4">
        {/* Left side - Edit controls */}
        <div className="flex items-center gap-3">
          {typedEditingStatus?.isBeingEdited ? (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-orange-600">
                {typedEditingStatus.currentEditor?.name} is editing
              </span>
              <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-200">
                In Use
              </Badge>
            </div>
          ) : (
            <Button
              onClick={() => startEditingMutation.mutate()}
              disabled={startEditingMutation.isPending || !typedEditingStatus?.canEdit}
              className="flex items-center gap-2"
              size="sm"
            >
              <Edit className="h-4 w-4" />
              {startEditingMutation.isPending ? "Starting..." : "Start Editing"}
            </Button>
          )}
        </div>

        {/* Right side - Actions */}
        <div className="flex items-center gap-2">
          {/* Add Collaborator */}
          {isOwner && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsInviteDialogOpen(true)}
              className="flex items-center gap-2"
            >
              <UserPlus className="h-4 w-4" />
              Invite
            </Button>
          )}

          {/* Document Export */}
          <DocumentExport
            docId={docId}
            analysis={analysis}
            websiteUrl={websiteUrl}
            logoUrl={logoUrl}
            selectedImages={selectedImages}
            user={user}
            autoTriggerShare={autoTriggerShare}
            onShareTriggered={onShareTriggered}
          />
        </div>
      </div>

      {/* Status Indicators */}
      <div className="flex items-center gap-3 text-xs">
        {shareEnabled ? (
          <div className="flex items-center gap-1 px-2 py-1 bg-green-50 text-green-600 rounded-full">
            <Globe className="h-3 w-3" />
            Public Link Active
          </div>
        ) : (
          <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
            <Lock className="h-3 w-3" />
            Private Document
          </div>
        )}
        
        {typedCollaborators && typedCollaborators.length > 0 && (
          <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 rounded-full">
            <Users className="h-3 w-3" />
            {typedCollaborators.length} Team {typedCollaborators.length === 1 ? 'Member' : 'Members'}
          </div>
        )}
      </div>

      {/* Invite Collaborator Dialog */}
      {isOwner && (
        <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Invite Collaborator</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleInviteSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="colleague@company.com"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="permission">Permission Level</Label>
                <Select
                  value={inviteForm.permission}
                  onValueChange={(value) => setInviteForm({ ...inviteForm, permission: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="view">View Only</SelectItem>
                    <SelectItem value="edit">Can Edit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsInviteDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={inviteCollaboratorMutation.isPending}>
                  Send Invitation
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Collaborators List */}
      {typedCollaborators && typedCollaborators.length > 0 && (
        <div className="bg-gray-50 p-3 rounded-lg">
          <h4 className="text-sm font-medium mb-2">Team Members</h4>
          <div className="space-y-2">
            {typedCollaborators.map((collaborator) => (
              <div key={collaborator.id} className="flex items-center justify-between text-sm">
                <span>{collaborator.email}</span>
                <div className="flex items-center gap-2">
                  <Badge variant={collaborator.permission === 'edit' ? 'default' : 'secondary'}>
                    {collaborator.permission}
                  </Badge>
                  <Badge variant={collaborator.status === 'accepted' ? 'default' : 'outline'}>
                    {collaborator.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}