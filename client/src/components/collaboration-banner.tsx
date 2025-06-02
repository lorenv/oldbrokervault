import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Users, Lock, Clock, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface CollaborationBannerProps {
  docId: number;
  isOwner: boolean;
  onEditingStatusChange?: (canEdit: boolean) => void;
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

export function CollaborationBanner({ docId, isOwner, onEditingStatusChange }: CollaborationBannerProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: "", permission: "view" });

  // Query editing status every 10 seconds
  const { data: editingStatus } = useQuery({
    queryKey: [`/api/cim/${docId}/editing-status`],
    refetchInterval: 10000, // Poll every 10 seconds
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
        description: "Others can now edit this document."
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
        title: "Collaborator Invited",
        description: "An invitation has been sent to the email address."
      });
    },
    onError: async (error: any) => {
      const errorData = await error.response?.json();
      toast({
        title: "Invitation Failed",
        description: errorData?.error || "Failed to invite collaborator",
        variant: "destructive"
      });
    }
  });

  // Heartbeat to maintain editing session
  useEffect(() => {
    if (editingStatus?.currentEditor?.id === user?.id) {
      const heartbeatInterval = setInterval(() => {
        apiRequest("POST", `/api/cim/${docId}/heartbeat`).catch(console.error);
      }, 60000); // Send heartbeat every minute

      return () => clearInterval(heartbeatInterval);
    }
  }, [editingStatus?.currentEditor?.id, user?.id, docId]);

  // Notify parent of editing status changes
  useEffect(() => {
    onEditingStatusChange?.(editingStatus?.canEdit || false);
  }, [editingStatus?.canEdit, onEditingStatusChange]);

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

  return (
    <div className="space-y-3 mb-6">
      {/* Editing Status Banner */}
      {editingStatus?.isBeingEdited && editingStatus.currentEditor && (
        <Alert>
          <Lock className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>
                {editingStatus.currentEditor.id === user.id 
                  ? "You are currently editing this document"
                  : `${editingStatus.currentEditor.name} is currently editing this document`
                }
              </span>
              <Badge variant="secondary" className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Since {new Date(editingStatus.currentEditor.editStartedAt).toLocaleTimeString()}
              </Badge>
            </div>
            
            {editingStatus.currentEditor.id === user.id && (
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

      {/* Collaboration Controls */}
      <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="text-sm font-medium">
              Collaboration {collaborators?.length ? `(${collaborators.length})` : ''}
            </span>
          </div>
          
          {!editingStatus?.isBeingEdited && (
            <Button 
              size="sm"
              onClick={() => startEditingMutation.mutate()}
              disabled={startEditingMutation.isPending}
            >
              Start Editing
            </Button>
          )}
        </div>

        {isOwner && (
          <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <UserPlus className="h-4 w-4 mr-1" />
                Invite
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite Collaborator</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleInviteSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="colleague@company.com"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="permission">Permission</Label>
                  <Select 
                    value={inviteForm.permission} 
                    onValueChange={(value) => setInviteForm(prev => ({ ...prev, permission: value }))}
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
      </div>

      {/* Collaborators List */}
      {collaborators && collaborators.length > 0 && (
        <div className="bg-gray-50 p-3 rounded-lg">
          <h4 className="text-sm font-medium mb-2">Collaborators</h4>
          <div className="space-y-2">
            {collaborators.map((collaborator) => (
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