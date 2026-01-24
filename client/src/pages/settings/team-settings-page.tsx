import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Users, Trash2, CreditCard, Eye, AlertCircle, Clock, Mail } from "lucide-react";
import { SettingsLayout } from "@/components/layout/settings-layout";
import { Link } from "wouter";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function TeamSettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");

  const { data: organization } = useQuery<any>({
    queryKey: ["/api/crm/organization"],
  });

  const { data: members, isLoading } = useQuery<any[]>({
    queryKey: ["/api/crm/organization/members"],
  });

  const licenses = organization?.licenses || { totalSeats: 1, usedSeats: 0, availableSeats: 1, viewerCount: 0 };
  const hasAvailableSeats = licenses.availableSeats > 0;

  const inviteMutation = useMutation({
    mutationFn: async (data: { email: string; role: string }) => {
      const response = await apiRequest("POST", "/api/crm/organization/members/invite", { body: data });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.error || "Failed to invite member");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/organization/members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/organization"] });
      setIsInviteDialogOpen(false);
      setInviteEmail("");
      setInviteRole("member");

      if (data.isPending) {
        toast({
          title: "Invitation sent",
          description: "They'll join your team when they create their account."
        });
      } else {
        toast({
          title: "Member added",
          description: "Team member has been added to your workspace."
        });
      }
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to invite member", variant: "destructive" });
    },
  });

  const [removingMemberId, setRemovingMemberId] = useState<number | null>(null);

  const removeMutation = useMutation({
    mutationFn: (memberId: number) => {
      setRemovingMemberId(memberId);
      return apiRequest("DELETE", `/api/crm/organization/members/${memberId}`);
    },
    onSuccess: () => {
      const member = members?.find(m => m.id === removingMemberId);
      const isPending = member?.isPending || member?.status === 'pending';

      queryClient.invalidateQueries({ queryKey: ["/api/crm/organization/members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/organization"] });
      toast({
        title: isPending ? "Invitation cancelled" : "Member removed",
        description: isPending
          ? "The pending invitation has been cancelled."
          : "The team member has been removed from your workspace."
      });
      setRemovingMemberId(null);
    },
    onError: () => {
      setRemovingMemberId(null);
    },
  });

  const roleColors: Record<string, string> = {
    owner: "bg-purple-100 text-purple-800",
    admin: "bg-blue-100 text-blue-800",
    member: "bg-gray-100 text-gray-800",
    viewer: "bg-green-100 text-green-800",
  };

  const roleDescriptions: Record<string, string> = {
    admin: "Full access to all features",
    member: "Can create and edit records",
    viewer: "Read-only access (free)",
  };

  // Check if selected role needs a paid seat
  const selectedRoleNeedsSeat = inviteRole !== "viewer";
  const canInviteWithSelectedRole = inviteRole === "viewer" || hasAvailableSeats;

  return (
    <SettingsLayout
      title="Team Settings"
      description="Manage your team members and permissions"
    >
      <div className="max-w-4xl space-y-6">
        {/* License Overview Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Pro Licenses
            </CardTitle>
            <CardDescription>
              Manage your team's Pro licenses. Viewer seats are always free.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {licenses.usedSeats} / {licenses.totalSeats}
                  </p>
                  <p className="text-sm text-gray-500">Pro licenses used</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-green-600">
                    {licenses.availableSeats} available
                  </p>
                  {licenses.viewerCount > 0 && (
                    <p className="text-sm text-gray-500 flex items-center justify-end gap-1">
                      <Eye className="h-3 w-3" />
                      {licenses.viewerCount} viewer(s) (free)
                    </p>
                  )}
                </div>
              </div>

              <Progress
                value={(licenses.usedSeats / licenses.totalSeats) * 100}
                className="h-2"
              />

              <div className="flex items-center justify-between pt-2">
                <p className="text-sm text-gray-600">
                  Need more licenses? Add them in billing settings.
                </p>
                <Link href="/settings/billing">
                  <Button variant="outline" size="sm">
                    <CreditCard className="h-4 w-4 mr-2" />
                    Manage Billing
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Team Members Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Team Members</CardTitle>
              <CardDescription>People who have access to your workspace</CardDescription>
            </div>
            <Button onClick={() => setIsInviteDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Invite Member
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />)}</div>
            ) : members && members.length > 0 ? (
              <div className="space-y-3">
                {members.map((member) => {
                  const isPending = member.isPending || member.status === 'pending';

                  return (
                    <div
                      key={member.id}
                      className={`flex items-center justify-between p-3 border rounded-lg ${
                        isPending ? 'bg-amber-50 border-amber-200' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          isPending ? 'bg-amber-100' : 'bg-gray-100'
                        }`}>
                          {isPending ? (
                            <Mail className="h-5 w-5 text-amber-600" />
                          ) : member.profilePhoto ? (
                            <img src={member.profilePhoto} className="w-10 h-10 rounded-full object-cover" alt="" />
                          ) : (
                            <Users className="h-5 w-5 text-gray-500" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900">
                              {member.firstName ? `${member.firstName} ${member.lastName}` : member.email}
                            </p>
                            {isPending && (
                              <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300 text-xs">
                                <Clock className="h-3 w-3 mr-1" />
                                Pending
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-500">
                            {isPending ? (
                              <span className="text-amber-600">Invitation sent - waiting for signup</span>
                            ) : (
                              member.email
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className={roleColors[member.role] || roleColors.member}>
                          {member.role}
                          {member.role === 'viewer' && <span className="ml-1 opacity-70">(free)</span>}
                        </Badge>
                        {member.role !== "owner" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeMutation.mutate(member.id)}
                            title={isPending ? "Cancel invitation" : "Remove member"}
                          >
                            <Trash2 className="h-4 w-4 text-gray-400 hover:text-red-500" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No team members yet</p>
            )}
          </CardContent>
        </Card>

        {/* Invite Dialog */}
        <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite Team Member</DialogTitle>
              <DialogDescription>
                Add a new member to your workspace. Pro licenses are required for Admin and Member roles.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-gray-900">Email Address</Label>
                <Input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-900">Role</Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">
                      <div className="flex flex-col">
                        <span>Admin</span>
                        <span className="text-xs text-gray-500">Full access (uses Pro license)</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="member">
                      <div className="flex flex-col">
                        <span>Member</span>
                        <span className="text-xs text-gray-500">Can create and edit (uses Pro license)</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="viewer">
                      <div className="flex flex-col">
                        <span>Viewer</span>
                        <span className="text-xs text-green-600">Read-only access (free)</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                {inviteRole && (
                  <p className="text-xs text-gray-500">{roleDescriptions[inviteRole]}</p>
                )}
              </div>

              {/* License warning */}
              {selectedRoleNeedsSeat && !hasAvailableSeats && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No Pro licenses available. You're using {licenses.usedSeats} of {licenses.totalSeats} licenses.
                    <Link href="/settings/billing" className="ml-1 underline font-medium">
                      Purchase more licenses
                    </Link>
                    {" "}or invite as a Viewer (free).
                  </AlertDescription>
                </Alert>
              )}

              {selectedRoleNeedsSeat && hasAvailableSeats && (
                <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                  This will use 1 of your {licenses.availableSeats} available Pro license(s).
                </p>
              )}

              {!selectedRoleNeedsSeat && (
                <p className="text-sm text-green-600 bg-green-50 p-3 rounded-lg">
                  Viewers are free and don't use a Pro license.
                </p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsInviteDialogOpen(false)}>Cancel</Button>
              <Button
                onClick={() => inviteMutation.mutate({ email: inviteEmail, role: inviteRole })}
                disabled={!inviteEmail || inviteMutation.isPending || !canInviteWithSelectedRole}
              >
                {inviteMutation.isPending ? "Inviting..." : "Send Invite"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </SettingsLayout>
  );
}
