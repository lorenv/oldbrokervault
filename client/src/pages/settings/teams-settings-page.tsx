import { useState } from "react";
import { useQuery, useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Users, Trash2, ChevronDown, ChevronRight, UserPlus, Lock, ArrowLeft } from "lucide-react";
import { SettingsLayout, useSettingsAccess } from "@/components/layout/settings-layout";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Link } from "wouter";

interface Team {
  id: number;
  name: string;
  description: string | null;
  memberCount: number;
  createdAt: string;
}

interface TeamMember {
  id: number;
  organizationMemberId: number;
  userId: number | null;
  email: string;
  firstName: string | null;
  lastName: string | null;
  profilePhoto: string | null;
  role: string;
  addedAt: string;
}

interface TeamWithMembers extends Team {
  members: TeamMember[];
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

export default function TeamsSettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canEdit } = useSettingsAccess();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isAddMemberDialogOpen, setIsAddMemberDialogOpen] = useState(false);
  const [selectedTeamIdForDialog, setSelectedTeamIdForDialog] = useState<number | null>(null);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamDescription, setNewTeamDescription] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [expandedTeams, setExpandedTeams] = useState<Set<number>>(new Set());

  const { data: teams, isLoading } = useQuery<Team[]>({
    queryKey: ["/api/crm/teams"],
  });

  const { data: orgMembers } = useQuery<OrgMember[]>({
    queryKey: ["/api/crm/organization/members"],
  });

  // Fetch details for ALL expanded teams
  const expandedTeamIds = Array.from(expandedTeams);
  const teamDetailsQueries = useQueries({
    queries: expandedTeamIds.map((teamId) => ({
      queryKey: ["/api/crm/teams", teamId],
      queryFn: async () => {
        const response = await apiRequest("GET", `/api/crm/teams/${teamId}`);
        if (!response.ok) throw new Error("Failed to fetch team details");
        return response.json() as Promise<TeamWithMembers>;
      },
    })),
  });

  // Build a map of team ID -> team details for quick lookup
  const teamDetailsMap = new Map<number, TeamWithMembers>();
  expandedTeamIds.forEach((teamId, index) => {
    const query = teamDetailsQueries[index];
    if (query.data) {
      teamDetailsMap.set(teamId, query.data);
    }
  });

  const createTeamMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      const response = await apiRequest("POST", "/api/crm/teams", { body: data });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create team");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/teams"] });
      setIsCreateDialogOpen(false);
      setNewTeamName("");
      setNewTeamDescription("");
      toast({ title: "Team created", description: "Your new team has been created successfully." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteTeamMutation = useMutation({
    mutationFn: async (teamId: number) => {
      const response = await apiRequest("DELETE", `/api/crm/teams/${teamId}`);
      if (!response.ok) throw new Error("Failed to delete team");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/teams"] });
      toast({ title: "Team deleted", description: "The team has been deleted." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete team", variant: "destructive" });
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: async ({ teamId, organizationMemberId }: { teamId: number; organizationMemberId: number }) => {
      const response = await apiRequest("POST", `/api/crm/teams/${teamId}/members`, {
        body: { organizationMemberId },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to add member");
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/teams"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/teams", variables.teamId] });
      setIsAddMemberDialogOpen(false);
      setSelectedMemberId("");
      toast({ title: "Member added", description: "Team member has been added." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async ({ teamId, memberId }: { teamId: number; memberId: number }) => {
      const response = await apiRequest("DELETE", `/api/crm/teams/${teamId}/members/${memberId}`);
      if (!response.ok) throw new Error("Failed to remove member");
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/teams"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/teams", variables.teamId] });
      toast({ title: "Member removed", description: "Team member has been removed." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to remove member", variant: "destructive" });
    },
  });

  const toggleTeamExpanded = (teamId: number) => {
    const newExpanded = new Set(expandedTeams);
    if (newExpanded.has(teamId)) {
      newExpanded.delete(teamId);
    } else {
      newExpanded.add(teamId);
    }
    setExpandedTeams(newExpanded);
  };

  const getTeamMembers = (teamId: number): TeamMember[] => {
    const teamDetails = teamDetailsMap.get(teamId);
    if (teamDetails) {
      return teamDetails.members || [];
    }
    return [];
  };

  const getAvailableMembers = (teamId: number) => {
    const teamMembers = getTeamMembers(teamId);
    const memberIds = new Set(teamMembers.map((m) => m.organizationMemberId));
    return (orgMembers || []).filter((m) => !memberIds.has(m.id));
  };

  return (
    <SettingsLayout
      title="Teams"
      description="Create teams to group users for visibility settings"
    >
      <div className="max-w-4xl space-y-6">
        {/* Back to Visibility Groups */}
        <Link href="/settings/crm-visibility">
          <Button variant="ghost" size="sm" className="gap-2 text-gray-600 hover:text-gray-900 -ml-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Visibility Groups
          </Button>
        </Link>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Teams</CardTitle>
              <CardDescription>
                Teams are used to control who can see which CRM records based on visibility settings.
              </CardDescription>
            </div>
            {canEdit ? (
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Team
              </Button>
            ) : (
              <Badge variant="secondary" className="bg-amber-100 text-amber-700 border-amber-200">
                <Lock className="h-3 w-3 mr-1" />
                View Only
              </Badge>
            )}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
                ))}
              </div>
            ) : teams && teams.length > 0 ? (
              <div className="space-y-3">
                {teams.map((team) => (
                  <Collapsible
                    key={team.id}
                    open={expandedTeams.has(team.id)}
                    onOpenChange={() => toggleTeamExpanded(team.id)}
                  >
                    <div className="border rounded-lg">
                      <CollapsibleTrigger asChild>
                        <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50">
                          <div className="flex items-center gap-3">
                            {expandedTeams.has(team.id) ? (
                              <ChevronDown className="h-4 w-4 text-gray-500" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-gray-500" />
                            )}
                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                              <Users className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{team.name}</p>
                              {team.description && (
                                <p className="text-sm text-gray-500">{team.description}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge variant="secondary">{team.memberCount} members</Badge>
                            {canEdit && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm("Are you sure you want to delete this team?")) {
                                    deleteTeamMutation.mutate(team.id);
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4 text-gray-400 hover:text-red-500" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="border-t px-4 py-3 bg-gray-50">
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-medium text-gray-700">Team Members</p>
                            {canEdit && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedTeamIdForDialog(team.id);
                                  setIsAddMemberDialogOpen(true);
                                }}
                              >
                                <UserPlus className="h-4 w-4 mr-1" />
                                Add Member
                              </Button>
                            )}
                          </div>
                          {getTeamMembers(team.id).length > 0 ? (
                            <div className="space-y-2">
                              {getTeamMembers(team.id).map((member) => (
                                <div
                                  key={member.id}
                                  className="flex items-center justify-between p-2 bg-white rounded border"
                                >
                                  <div className="flex items-center gap-2">
                                    {member.profilePhoto ? (
                                      <img
                                        src={member.profilePhoto}
                                        className="w-8 h-8 rounded-full object-cover"
                                        alt=""
                                      />
                                    ) : (
                                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                                        <Users className="h-4 w-4 text-gray-500" />
                                      </div>
                                    )}
                                    <div>
                                      <p className="text-sm font-medium text-gray-900">
                                        {member.firstName
                                          ? `${member.firstName} ${member.lastName || ""}`
                                          : member.email}
                                      </p>
                                      <p className="text-xs text-gray-500">{member.email}</p>
                                    </div>
                                  </div>
                                  {canEdit && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() =>
                                        removeMemberMutation.mutate({
                                          teamId: team.id,
                                          memberId: member.organizationMemberId,
                                        })
                                      }
                                    >
                                      <Trash2 className="h-4 w-4 text-gray-400 hover:text-red-500" />
                                    </Button>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500 text-center py-4">
                              No members in this team yet
                            </p>
                          )}
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Users className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500">No teams yet</p>
                <p className="text-sm text-gray-400 mt-1">
                  Create a team to group users for visibility settings
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create Team Dialog */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Team</DialogTitle>
              <DialogDescription>
                Create a new team to group users for CRM visibility settings.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-gray-900">Team Name</Label>
                <Input
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="e.g., Enterprise Sales, West Coast"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-900">Description (optional)</Label>
                <Textarea
                  value={newTeamDescription}
                  onChange={(e) => setNewTeamDescription(e.target.value)}
                  placeholder="What is this team for?"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() =>
                  createTeamMutation.mutate({
                    name: newTeamName,
                    description: newTeamDescription || undefined,
                  })
                }
                disabled={!newTeamName.trim() || createTeamMutation.isPending}
              >
                {createTeamMutation.isPending ? "Creating..." : "Create Team"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Member Dialog */}
        <Dialog open={isAddMemberDialogOpen} onOpenChange={setIsAddMemberDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Team Member</DialogTitle>
              <DialogDescription>
                Select a team member to add to this team.
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
                    {selectedTeamIdForDialog &&
                      getAvailableMembers(selectedTeamIdForDialog).map((member) => (
                        <SelectItem key={member.id} value={String(member.id)}>
                          {member.firstName
                            ? `${member.firstName} ${member.lastName || ""}`
                            : member.email}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddMemberDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() =>
                  selectedTeamIdForDialog &&
                  addMemberMutation.mutate({
                    teamId: selectedTeamIdForDialog,
                    organizationMemberId: parseInt(selectedMemberId),
                  })
                }
                disabled={!selectedMemberId || addMemberMutation.isPending}
              >
                {addMemberMutation.isPending ? "Adding..." : "Add Member"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </SettingsLayout>
  );
}
