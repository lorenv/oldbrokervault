import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, Mail, Trash2, UserPlus, Plus, History } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { DocumentActivityLog } from "@/components/document-activity-log";

interface CollaboratorsSectionProps {
  documentId: number;
  isOwner: boolean;
  user: any;
}

interface Collaborator {
  id: number;
  email: string;
  permission: "Edit" | "Assist";
  status: "pending" | "active" | "removed";
  invitedAt: string;
  acceptedAt?: string;
}

export function CollaboratorsSection({ documentId, isOwner, user }: CollaboratorsSectionProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePermission, setInvitePermission] = useState<"Edit" | "Assist">("Assist");
  const [collaboratorToRemove, setCollaboratorToRemove] = useState<Collaborator | null>(null);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);

  // Fetch collaborators
  const { data: collaborators = [], isLoading } = useQuery<Collaborator[]>({
    queryKey: [`/api/cim/${documentId}/collaborators`],
    enabled: !!documentId,
  });

  // Get subscription limit
  const collaboratorLimit = user.subscriptionStatus === 'starter' ? 1
    : user.subscriptionStatus === 'standard' ? 3
    : user.subscriptionStatus === 'enterprise' || user.subscriptionStatus === 'admin' ? 999
    : 0;

  // Count both active and pending collaborators against the limit
  const activeCollaboratorCount = collaborators.filter(c => c.status === 'active' || c.status === 'pending').length;
  const canAddMore = activeCollaboratorCount < collaboratorLimit;

  // Invite collaborator mutation
  const inviteMutation = useMutation({
    mutationFn: async (data: { email: string; permission: "Edit" | "Assist" }) => {
      const response = await apiRequest("POST", `/api/cim/${documentId}/invite`, { body: data });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Invitation sent",
        description: "The collaborator has been invited via email.",
      });
      setInviteEmail("");
      setInviteDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: [`/api/cim/${documentId}/collaborators`] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send invitation",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update permission mutation
  const updatePermissionMutation = useMutation({
    mutationFn: async ({ collaboratorId, permission }: { collaboratorId: number; permission: string }) => {
      await apiRequest("PATCH", `/api/cim/${documentId}/collaborators/${collaboratorId}`, { body: { permission } });
    },
    onSuccess: () => {
      toast({
        title: "Permission updated",
        description: "Collaborator permission has been changed.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/cim/${documentId}/collaborators`] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update permission",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Remove collaborator mutation
  const removeMutation = useMutation({
    mutationFn: async (collaboratorId: number) => {
      await apiRequest("DELETE", `/api/cim/${documentId}/collaborators/${collaboratorId}`);
    },
    onSuccess: () => {
      toast({
        title: "Collaborator removed",
        description: "The collaborator has been removed from this document.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/cim/${documentId}/collaborators`] });
      setCollaboratorToRemove(null);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to remove collaborator",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleInvite = () => {
    if (!inviteEmail.trim()) {
      toast({
        title: "Email required",
        description: "Please enter an email address.",
        variant: "destructive",
      });
      return;
    }

    if (!canAddMore) {
      toast({
        title: "Collaborator limit reached",
        description: `Your subscription plan allows up to ${collaboratorLimit} collaborator${collaboratorLimit === 1 ? '' : 's'} per document.`,
        variant: "destructive",
      });
      return;
    }

    inviteMutation.mutate({ email: inviteEmail, permission: invitePermission });
  };

  if (!isOwner) {
    return (
      <div className="space-y-4">
        <div className="text-center py-8 px-4 bg-muted/50 rounded-lg border border-dashed">
          <UserPlus className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
          <h3 className="font-semibold text-lg mb-2">Collaboration</h3>
          <p className="text-sm text-muted-foreground">
            You are a collaborator on this document. Only the document owner can manage collaborators and view activity logs.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue="collaborators" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="collaborators">
            <UserPlus className="h-4 w-4 mr-2" />
            Collaborate ({activeCollaboratorCount})
          </TabsTrigger>
          <TabsTrigger value="activity">
            <History className="h-4 w-4 mr-2" />
            Activity Log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="collaborators" className="space-y-4 mt-4">
          {/* Header with stats and invite button */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {collaboratorLimit === 0
                ? "Collaboration is a premium feature. Upgrade your plan to invite collaborators."
                : `${activeCollaboratorCount} of ${collaboratorLimit} collaborator${collaboratorLimit === 1 ? '' : 's'} used`}
            </div>
            {collaboratorLimit > 0 && (
              <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" disabled={!canAddMore}>
                    <Plus className="h-4 w-4 mr-2" />
                    Invite
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Invite Collaborator</DialogTitle>
                    <DialogDescription>
                      Invite someone to help manage this document. They'll receive an email invitation.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="colleague@example.com"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        disabled={inviteMutation.isPending}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="permission">Permission Level</Label>
                      <Select
                        value={invitePermission}
                        onValueChange={(value: "Edit" | "Assist") => setInvitePermission(value)}
                        disabled={inviteMutation.isPending}
                      >
                        <SelectTrigger id="permission">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Edit">Edit</SelectItem>
                          <SelectItem value="Assist">Assist</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="bg-muted/50 p-3 rounded-lg text-sm space-y-1">
                      <p className="font-medium">Permission Levels:</p>
                      <ul className="space-y-1 text-muted-foreground text-xs">
                        <li><strong>Edit:</strong> Can edit document, manage sharing, and approve NDAs</li>
                        <li><strong>Assist:</strong> Can manage sharing and approve NDAs (cannot edit content)</li>
                      </ul>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={handleInvite}
                      disabled={inviteMutation.isPending}
                    >
                      {inviteMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Mail className="h-4 w-4 mr-2" />
                          Send Invitation
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {/* Collaborators List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : collaborators.length > 0 ? (
            <div className="space-y-2">
              {collaborators
                .filter(c => c.status !== 'removed')
                .map((collaborator) => (
                  <div
                    key={collaborator.id}
                    className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                        <Mail className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{collaborator.email}</span>
                          {collaborator.status === 'pending' && (
                            <Badge variant="secondary" className="text-xs">
                              Pending
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          Invited {new Date(collaborator.invitedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select
                        value={collaborator.permission}
                        onValueChange={(value) =>
                          updatePermissionMutation.mutate({
                            collaboratorId: collaborator.id,
                            permission: value,
                          })
                        }
                      >
                        <SelectTrigger className="w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Edit">Edit</SelectItem>
                          <SelectItem value="Assist">Assist</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setCollaboratorToRemove(collaborator)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted mb-4">
                <UserPlus className="h-10 w-10 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">No collaborators yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Click the Invite button above to add collaborators
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <DocumentActivityLog documentId={documentId} />
        </TabsContent>
      </Tabs>

      {/* Remove Confirmation Dialog */}
      <AlertDialog open={!!collaboratorToRemove} onOpenChange={() => setCollaboratorToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Collaborator</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {collaboratorToRemove?.email} from this document?
              They will no longer have access and will be notified via email.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => collaboratorToRemove && removeMutation.mutate(collaboratorToRemove.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removeMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Remove"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
