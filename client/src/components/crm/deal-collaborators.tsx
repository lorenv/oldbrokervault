import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Plus, X, Users, Eye, Edit } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Collaborator {
  id: number;
  organizationMemberId: number;
  userId: number | null;
  email: string;
  firstName: string | null;
  lastName: string | null;
  profilePhoto: string | null;
  permission: "view" | "edit";
  createdAt: string;
}

interface OrgMember {
  id: number;
  userId: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  profilePhoto: string | null;
  role: string;
}

interface DealCollaboratorsProps {
  dealId: number;
  dealOwnerId?: number;
  canManage?: boolean;
}

export function DealCollaborators({ dealId, dealOwnerId, canManage = true }: DealCollaboratorsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [selectedPermission, setSelectedPermission] = useState<"view" | "edit">("view");

  const { data: collaborators, isLoading } = useQuery<Collaborator[]>({
    queryKey: [`/api/crm/deals/${dealId}/collaborators`],
    enabled: !!dealId,
  });

  const { data: orgMembers } = useQuery<OrgMember[]>({
    queryKey: ["/api/crm/organization/members"],
  });

  const addMutation = useMutation({
    mutationFn: async (data: { organizationMemberId: number; permission: string }) => {
      const response = await apiRequest("POST", `/api/crm/deals/${dealId}/collaborators`, {
        body: data,
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to add collaborator");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/crm/deals/${dealId}/collaborators`] });
      setIsAddDialogOpen(false);
      setSelectedMemberId("");
      setSelectedPermission("view");
      toast({ title: "Collaborator added", description: "They now have access to this deal." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (collaboratorId: number) => {
      const response = await apiRequest(
        "DELETE",
        `/api/crm/deals/${dealId}/collaborators/${collaboratorId}`
      );
      if (!response.ok) throw new Error("Failed to remove collaborator");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/crm/deals/${dealId}/collaborators`] });
      toast({ title: "Collaborator removed", description: "Access has been revoked." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to remove collaborator", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      collaboratorId,
      permission,
    }: {
      collaboratorId: number;
      permission: string;
    }) => {
      const response = await apiRequest(
        "PATCH",
        `/api/crm/deals/${dealId}/collaborators/${collaboratorId}`,
        { body: { permission } }
      );
      if (!response.ok) throw new Error("Failed to update permission");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/crm/deals/${dealId}/collaborators`] });
      toast({ title: "Permission updated" });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update permission",
        variant: "destructive",
      });
    },
  });

  const getAvailableMembers = () => {
    if (!orgMembers || !collaborators) return [];
    const collaboratorMemberIds = new Set(collaborators.map((c) => c.organizationMemberId));
    return orgMembers.filter(
      (m) => !collaboratorMemberIds.has(m.id) && m.id !== dealOwnerId
    );
  };

  const getDisplayName = (collaborator: Collaborator) => {
    if (collaborator.firstName) {
      return `${collaborator.firstName} ${collaborator.lastName || ""}`.trim();
    }
    return collaborator.email;
  };

  const getInitials = (collaborator: Collaborator) => {
    if (collaborator.firstName) {
      return `${collaborator.firstName[0]}${collaborator.lastName?.[0] || ""}`.toUpperCase();
    }
    return collaborator.email[0].toUpperCase();
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="h-8 bg-gray-100 rounded animate-pulse" />
        <div className="h-8 bg-gray-100 rounded animate-pulse w-2/3" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Collaborators</span>
          {collaborators && collaborators.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {collaborators.length}
            </Badge>
          )}
        </div>
        {canManage && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={() => setIsAddDialogOpen(true)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </div>

      {collaborators && collaborators.length > 0 ? (
        <div className="space-y-2">
          {collaborators.map((collaborator) => (
            <div
              key={collaborator.id}
              className="flex items-center justify-between p-2 bg-gray-50 rounded-lg group"
            >
              <div className="flex items-center gap-2">
                {collaborator.profilePhoto ? (
                  <img
                    src={collaborator.profilePhoto}
                    className="w-7 h-7 rounded-full object-cover"
                    alt=""
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
                    <span className="text-xs font-medium text-blue-600">
                      {getInitials(collaborator)}
                    </span>
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {getDisplayName(collaborator)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge
                        variant="outline"
                        className={`text-xs cursor-pointer ${
                          collaborator.permission === "edit"
                            ? "border-green-200 bg-green-50 text-green-700"
                            : "border-gray-200 bg-white text-gray-600"
                        }`}
                        onClick={() => {
                          if (canManage) {
                            updateMutation.mutate({
                              collaboratorId: collaborator.id,
                              permission: collaborator.permission === "edit" ? "view" : "edit",
                            });
                          }
                        }}
                      >
                        {collaborator.permission === "edit" ? (
                          <Edit className="h-3 w-3 mr-1" />
                        ) : (
                          <Eye className="h-3 w-3 mr-1" />
                        )}
                        {collaborator.permission}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      {canManage ? "Click to toggle permission" : `${collaborator.permission} access`}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                {canManage && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => removeMutation.mutate(collaborator.id)}
                  >
                    <X className="h-3 w-3 text-gray-400 hover:text-red-500" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-500 text-center py-2">No collaborators</p>
      )}

      {/* Add Collaborator Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Collaborator</DialogTitle>
            <DialogDescription>
              Give a team member access to this deal. They'll be able to view or edit based on
              the permission you select.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-gray-900">Team Member</Label>
              <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a member" />
                </SelectTrigger>
                <SelectContent>
                  {getAvailableMembers().map((member) => (
                    <SelectItem key={member.id} value={String(member.id)}>
                      {member.firstName
                        ? `${member.firstName} ${member.lastName || ""}`
                        : member.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-gray-900">Permission</Label>
              <Select
                value={selectedPermission}
                onValueChange={(v) => setSelectedPermission(v as "view" | "edit")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="view">
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      <span>View only</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="edit">
                    <div className="flex items-center gap-2">
                      <Edit className="h-4 w-4" />
                      <span>Can edit</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                addMutation.mutate({
                  organizationMemberId: parseInt(selectedMemberId),
                  permission: selectedPermission,
                })
              }
              disabled={!selectedMemberId || addMutation.isPending}
            >
              {addMutation.isPending ? "Adding..." : "Add Collaborator"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
