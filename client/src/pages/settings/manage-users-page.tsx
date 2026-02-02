import { useState } from "react";
import { useQuery, useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { SettingsLayout, useSettingsAccess } from "@/components/layout/settings-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Users,
  CreditCard,
  Plus,
  Minus,
  Eye,
  Check,
  X,
  Zap,
  Crown,
  Lock,
  Trash2,
  Mail,
  Clock,
  AlertCircle,
  Shield,
  ChevronDown,
  ChevronRight,
  UserPlus,
  User,
  Globe,
  Briefcase,
  Building,
  UsersRound,
} from "lucide-react";
import { Link } from "wouter";
import {
  PERMISSION_KEYS,
  CATEGORY_INFO,
  ALL_ROLES,
  isRoleLocked,
  getPermissionsByCategory,
  type PermissionKey,
  type Role,
  type PermissionCategory,
} from "@shared/permissions";

// ============ Types ============
interface OrgMember {
  id: number;
  userId: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  profilePhoto: string | null;
  role: string;
  isPending?: boolean;
  status?: string;
}

interface TeamMemberPreview {
  firstName: string | null;
  lastName: string | null;
  profilePhoto: string | null;
}

interface Team {
  id: number;
  name: string;
  description: string | null;
  memberCount: number;
  createdAt: string;
  memberPreviews?: TeamMemberPreview[];
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

type CrmVisibility = "owner_only" | "team" | "organization";

interface VisibilitySettings {
  deals: CrmVisibility;
  contacts: CrmVisibility;
  companies: CrmVisibility;
}

interface PermissionsResponse {
  matrix: Record<Role, Record<PermissionKey, boolean>>;
  permissionKeys: typeof PERMISSION_KEYS;
  categoryInfo: typeof CATEGORY_INFO;
  roles: typeof ALL_ROLES;
}

// ============ Constants ============
const PRO_MONTHLY_PRICE = 59;
const PRO_ANNUAL_PRICE = 49;

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

const ROLE_COLORS: Record<Role, string> = {
  owner: "bg-purple-100 text-purple-700 border-purple-200",
  admin: "bg-blue-100 text-blue-700 border-blue-200",
  member: "bg-gray-100 text-gray-700 border-gray-200",
  viewer: "bg-green-100 text-green-700 border-green-200",
};

const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  viewer: "Viewer",
};

const CATEGORY_TABS: { value: PermissionCategory; label: string }[] = [
  { value: "crm", label: "CRM" },
  { value: "documents", label: "Documents" },
  { value: "esign", label: "E-Signatures" },
  { value: "analytics", label: "Analytics" },
  { value: "messages", label: "Messages" },
  { value: "sde_analyzer", label: "SDE Analyzer" },
  { value: "settings", label: "Settings" },
];

const visibilityOptions = [
  {
    value: "owner_only" as CrmVisibility,
    label: "Owner Only",
    description: "Users can only see records they own",
    icon: User,
    iconBg: "bg-orange-100",
    iconColor: "text-orange-600",
  },
  {
    value: "team" as CrmVisibility,
    label: "Team",
    description: "Users can see records owned by anyone in their team(s)",
    icon: Users,
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
  },
  {
    value: "organization" as CrmVisibility,
    label: "Organization",
    description: "Everyone can see all records (current default)",
    icon: Globe,
    iconBg: "bg-green-100",
    iconColor: "text-green-600",
  },
];

// ============ Main Component ============
export default function ManageUsersPage() {
  const [activeMainTab, setActiveMainTab] = useState("users");

  return (
    <SettingsLayout
      title="Manage Users"
      description="Manage team members, permissions, and visibility settings"
    >
      <div className="max-w-6xl">
        <Tabs value={activeMainTab} onValueChange={setActiveMainTab}>
          <TabsList variant="underline" className="mb-6">
            <TabsTrigger value="users" variant="underline">
              <Users className="h-4 w-4 mr-2" />
              Users
            </TabsTrigger>
            <TabsTrigger value="permissions" variant="underline">
              <Shield className="h-4 w-4 mr-2" />
              Permissions
            </TabsTrigger>
            <TabsTrigger value="visibility" variant="underline">
              <Eye className="h-4 w-4 mr-2" />
              Visibility Groups
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="mt-0">
            <UsersTab />
          </TabsContent>

          <TabsContent value="permissions" className="mt-0">
            <PermissionsTab />
          </TabsContent>

          <TabsContent value="visibility" className="mt-0">
            <VisibilityTab />
          </TabsContent>
        </Tabs>
      </div>
    </SettingsLayout>
  );
}

// ============ Users Tab ============
function UsersTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canEdit, isViewOnly } = useSettingsAccess();

  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [confirmRemoveDialog, setConfirmRemoveDialog] = useState<{ open: boolean; member: any | null }>({ open: false, member: null });
  const [removingMemberId, setRemovingMemberId] = useState<number | null>(null);
  const [additionalSeats, setAdditionalSeats] = useState(1);
  const [isLoadingPortal, setIsLoadingPortal] = useState(false);
  const [isAddingLicenses, setIsAddingLicenses] = useState(false);

  const { data: organization } = useQuery<any>({
    queryKey: ["/api/crm/organization"],
  });

  const { data: members, isLoading } = useQuery<OrgMember[]>({
    queryKey: ["/api/crm/organization/members"],
  });

  const licenses = organization?.licenses || { totalSeats: 1, usedSeats: 0, availableSeats: 1, viewerCount: 0 };
  const hasAvailableSeats = licenses.availableSeats > 0;

  const isPro = user?.subscriptionStatus === 'pro' || user?.subscriptionStatus === 'pro_monthly' || user?.subscriptionStatus === 'standard' || user?.subscriptionStatus === 'starter' || user?.subscriptionStatus === 'starter_monthly';
  const isAnnual = user?.subscriptionStatus === 'pro' || user?.subscriptionStatus === 'standard' || user?.subscriptionStatus === 'starter';
  const isFree = !isPro && user?.subscriptionStatus !== 'enterprise' && user?.subscriptionStatus !== 'admin';
  const pricePerSeat = isAnnual ? PRO_ANNUAL_PRICE : PRO_MONTHLY_PRICE;

  const selectedRoleNeedsSeat = inviteRole !== "viewer";
  const canInviteWithSelectedRole = inviteRole === "viewer" || hasAvailableSeats;

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
      toast({
        title: data.isPending ? "Invitation sent" : "Member added",
        description: data.isPending
          ? "They'll join your team when they create their account."
          : "Team member has been added to your workspace."
      });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to invite member", variant: "destructive" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (memberId: number) => {
      setRemovingMemberId(memberId);
      return apiRequest("DELETE", `/api/crm/organization/members/${memberId}`);
    },
    onSuccess: async () => {
      const member = members?.find(m => m.id === removingMemberId);
      const isPending = member?.isPending || member?.status === 'pending';
      await queryClient.refetchQueries({ queryKey: ["/api/crm/organization/members"] });
      await queryClient.refetchQueries({ queryKey: ["/api/crm/organization"] });
      toast({
        title: isPending ? "Invitation cancelled" : "Member removed",
        description: isPending ? "The pending invitation has been cancelled." : "The team member has been removed."
      });
      setRemovingMemberId(null);
      setConfirmRemoveDialog({ open: false, member: null });
    },
    onError: () => {
      setRemovingMemberId(null);
      toast({ title: "Error", description: "Failed to remove member", variant: "destructive" });
    },
  });

  const handleManageSubscription = async () => {
    setIsLoadingPortal(true);
    try {
      const response = await apiRequest("POST", "/api/subscription/create-portal-session");
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No portal URL received");
      }
    } catch (error) {
      toast({ title: "Unable to open billing portal", description: "Please try again.", variant: "destructive" });
    } finally {
      setIsLoadingPortal(false);
    }
  };

  const handleAddLicenses = async () => {
    setIsAddingLicenses(true);
    try {
      const response = await apiRequest("POST", "/api/subscription/add-licenses", {
        body: { additionalSeats },
      });
      const data = await response.json();
      if (data.success) {
        toast({ title: "Licenses Added", description: data.message });
        queryClient.invalidateQueries({ queryKey: ["/api/crm/organization"] });
        setAdditionalSeats(1);
      } else {
        throw new Error(data.error || "Failed to add licenses");
      }
    } catch (error) {
      toast({ title: "Unable to add licenses", description: "Please try again.", variant: "destructive" });
    } finally {
      setIsAddingLicenses(false);
    }
  };

  const getPlanDisplayName = () => {
    switch (user?.subscriptionStatus) {
      case 'pro':
      case 'pro_monthly':
      case 'standard':
        return 'Pro';
      case 'starter':
      case 'starter_monthly':
        return 'Starter';
      case 'enterprise':
        return 'Enterprise';
      case 'admin':
        return 'Admin';
      default:
        return 'Free';
    }
  };

  return (
    <div className="space-y-6">
      {/* License & Billing Card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                isPro ? 'bg-blue-100' : isFree ? 'bg-gray-100' : 'bg-purple-100'
              }`}>
                {isPro ? <Zap className="h-5 w-5 text-blue-600" /> : isFree ? <CreditCard className="h-5 w-5 text-gray-600" /> : <Crown className="h-5 w-5 text-purple-600" />}
              </div>
              <div>
                <CardTitle className="text-base">{getPlanDisplayName()} Plan</CardTitle>
                <CardDescription>
                  {isFree ? "Limited to 1 CIM document" : "Unlimited CIM documents & features"}
                </CardDescription>
              </div>
            </div>
            {isPro && (
              <div className="text-right">
                <p className="text-xl font-bold text-gray-900">
                  ${licenses.totalSeats * pricePerSeat}<span className="text-sm font-normal text-gray-500">/mo</span>
                </p>
                <p className="text-xs text-gray-500">{licenses.totalSeats} license{licenses.totalSeats !== 1 ? 's' : ''} x ${pricePerSeat}</p>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isPro && (
            <>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Pro licenses</span>
                  <span className="text-sm font-medium text-gray-900">{licenses.usedSeats} of {licenses.totalSeats} used</span>
                </div>
                <Progress value={(licenses.usedSeats / licenses.totalSeats) * 100} className="h-2" />
                {licenses.availableSeats > 0 && (
                  <p className="text-xs text-green-600 mt-1">{licenses.availableSeats} license{licenses.availableSeats !== 1 ? 's' : ''} available</p>
                )}
              </div>

              {licenses.viewerCount > 0 && (
                <div className="flex items-center justify-between py-2 border-t">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-600">Viewer seats</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{licenses.viewerCount}</span>
                    <Badge variant="outline" className="text-xs text-green-600 border-green-200">Free</Badge>
                  </div>
                </div>
              )}

              {!isViewOnly && (
                <div className="pt-3 border-t">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Add licenses</p>
                      <p className="text-xs text-gray-500">${pricePerSeat}/license/month</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setAdditionalSeats(Math.max(1, additionalSeats - 1))} disabled={additionalSeats <= 1}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <Input type="number" value={additionalSeats} onChange={(e) => setAdditionalSeats(Math.max(1, parseInt(e.target.value) || 1))} className="w-14 h-8 text-center text-sm" min={1} />
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setAdditionalSeats(additionalSeats + 1)}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-sm text-gray-600">+${additionalSeats * pricePerSeat}/month</span>
                    <Button size="sm" onClick={handleAddLicenses} disabled={isAddingLicenses}>
                      {isAddingLicenses ? "Adding..." : "Add Licenses"}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}

          <div className="flex gap-3 pt-2">
            {isFree ? (
              <Link href="/pricing" className="flex-1">
                <Button className="w-full" disabled={isViewOnly}>
                  <Zap className="h-4 w-4 mr-2" />
                  Upgrade to Pro
                </Button>
              </Link>
            ) : (
              <Button variant="outline" onClick={handleManageSubscription} disabled={isLoadingPortal || isViewOnly} className="flex-1">
                {isViewOnly ? <><Lock className="h-4 w-4 mr-2" />View Only</> : isLoadingPortal ? "Loading..." : "Manage Subscription"}
              </Button>
            )}
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
          {canEdit ? (
            <Button onClick={() => setIsInviteDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Invite Member
            </Button>
          ) : (
            <Badge variant="secondary" className="bg-amber-100 text-amber-700 border-amber-200">
              <Lock className="h-3 w-3 mr-1" />View Only
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />)}</div>
          ) : members && members.length > 0 ? (
            <div className="space-y-3">
              {members.map((member) => {
                const isPending = member.isPending || member.status === 'pending';
                return (
                  <div key={member.id} className={`flex items-center justify-between p-3 border rounded-lg ${isPending ? 'bg-amber-50 border-amber-200' : ''}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isPending ? 'bg-amber-100' : 'bg-gray-100'}`}>
                        {isPending ? <Mail className="h-5 w-5 text-amber-600" /> : member.profilePhoto ? (
                          <img src={member.profilePhoto} className="w-10 h-10 rounded-full object-cover" alt="" />
                        ) : <Users className="h-5 w-5 text-gray-500" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900">{member.firstName ? `${member.firstName} ${member.lastName}` : member.email}</p>
                          {isPending && (
                            <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300 text-xs">
                              <Clock className="h-3 w-3 mr-1" />Pending
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">{isPending ? <span className="text-amber-600">Invitation sent</span> : member.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={roleColors[member.role] || roleColors.member}>
                        {member.role}{member.role === 'viewer' && <span className="ml-1 opacity-70">(free)</span>}
                      </Badge>
                      {member.role !== "owner" && canEdit && (
                        <Button variant="ghost" size="sm" onClick={() => setConfirmRemoveDialog({ open: true, member })}>
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

      {/* Remove Member Dialog */}
      <Dialog open={confirmRemoveDialog.open} onOpenChange={(open) => setConfirmRemoveDialog({ open, member: open ? confirmRemoveDialog.member : null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmRemoveDialog.member?.isPending || confirmRemoveDialog.member?.status === 'pending' ? "Cancel Invitation" : "Remove Team Member"}</DialogTitle>
            <DialogDescription>
              {confirmRemoveDialog.member?.isPending || confirmRemoveDialog.member?.status === 'pending' ? (
                <>Are you sure you want to cancel the invitation for <span className="font-medium">{confirmRemoveDialog.member?.email}</span>?</>
              ) : (
                <>Are you sure you want to remove <span className="font-medium">{confirmRemoveDialog.member?.firstName ? `${confirmRemoveDialog.member.firstName} ${confirmRemoveDialog.member.lastName}` : confirmRemoveDialog.member?.email}</span>?<br /><br /><span className="text-red-600 font-medium">This will immediately revoke their access.</span></>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRemoveDialog({ open: false, member: null })}>Cancel</Button>
            <Button variant="destructive" onClick={() => confirmRemoveDialog.member && removeMutation.mutate(confirmRemoveDialog.member.id)} disabled={removeMutation.isPending}>
              {removeMutation.isPending ? "Removing..." : confirmRemoveDialog.member?.isPending ? "Cancel Invitation" : "Remove Member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite Dialog */}
      <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>Add a new member to your workspace.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-gray-900">Email Address</Label>
              <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="colleague@company.com" />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-900">Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin"><div className="flex flex-col"><span>Admin</span><span className="text-xs text-gray-500">Full access (uses Pro license)</span></div></SelectItem>
                  <SelectItem value="member"><div className="flex flex-col"><span>Member</span><span className="text-xs text-gray-500">Can create and edit (uses Pro license)</span></div></SelectItem>
                  <SelectItem value="viewer"><div className="flex flex-col"><span>Viewer</span><span className="text-xs text-green-600">Read-only access (free)</span></div></SelectItem>
                </SelectContent>
              </Select>
              {inviteRole && <p className="text-xs text-gray-500">{roleDescriptions[inviteRole]}</p>}
            </div>
            {selectedRoleNeedsSeat && !hasAvailableSeats && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>No Pro licenses available. <Link href="/settings/manage-users" className="underline font-medium">Add more licenses</Link> or invite as Viewer (free).</AlertDescription>
              </Alert>
            )}
            {selectedRoleNeedsSeat && hasAvailableSeats && (
              <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">This will use 1 of your {licenses.availableSeats} available Pro license(s).</p>
            )}
            {!selectedRoleNeedsSeat && (
              <p className="text-sm text-green-600 bg-green-50 p-3 rounded-lg">Viewers are free and don't use a Pro license.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsInviteDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => inviteMutation.mutate({ email: inviteEmail, role: inviteRole })} disabled={!inviteEmail || inviteMutation.isPending || !canInviteWithSelectedRole}>
              {inviteMutation.isPending ? "Inviting..." : "Send Invite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============ Permissions Tab ============
function PermissionsTab() {
  const [activeTab, setActiveTab] = useState<PermissionCategory>("crm");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isViewOnly } = useSettingsAccess();

  const { data, isLoading, error } = useQuery<PermissionsResponse>({
    queryKey: ["organization-permissions"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/crm/organization/permissions");
      return res.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ permissionKey, role, granted }: { permissionKey: string; role: string; granted: boolean }) => {
      const res = await apiRequest("PUT", "/api/crm/organization/permissions", { body: { permissionKey, role, granted } });
      return res.json();
    },
    onMutate: async ({ permissionKey, role, granted }) => {
      await queryClient.cancelQueries({ queryKey: ["organization-permissions"] });
      const previousData = queryClient.getQueryData<PermissionsResponse>(["organization-permissions"]);
      if (previousData) {
        queryClient.setQueryData<PermissionsResponse>(["organization-permissions"], {
          ...previousData,
          matrix: { ...previousData.matrix, [role]: { ...previousData.matrix[role as Role], [permissionKey]: granted } },
        });
      }
      return { previousData };
    },
    onError: (err, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(["organization-permissions"], context.previousData);
      }
      toast({ title: "Error", description: "Failed to update permission.", variant: "destructive" });
    },
    onSuccess: (data) => {
      queryClient.setQueryData<PermissionsResponse>(["organization-permissions"], (prev) => prev ? { ...prev, matrix: data.matrix } : prev);
      queryClient.invalidateQueries({ queryKey: ["user-permissions"] });
    },
  });

  const handleToggle = (permissionKey: PermissionKey, role: Role, currentValue: boolean) => {
    if (isRoleLocked(role)) return;
    updateMutation.mutate({ permissionKey, role, granted: !currentValue });
  };

  const permissions = getPermissionsByCategory(activeTab);
  const groupedPermissions = permissions.reduce((acc, perm) => {
    if (!acc[perm.group]) acc[perm.group] = [];
    acc[perm.group].push(perm);
    return acc;
  }, {} as Record<string, typeof permissions>);

  if (error) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Unable to Load Permissions</h3>
            <p className="text-gray-600 max-w-sm">You don't have access to view permissions settings.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {isViewOnly && (
        <Alert className="bg-amber-50 border-amber-200">
          <Lock className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-700">You have view-only access. Contact an admin to make changes.</AlertDescription>
        </Alert>
      )}
      <Card>
        <CardContent className="pt-6">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as PermissionCategory)}>
            <TabsList variant="underline" className="mb-6 w-full justify-start flex-wrap">
              {CATEGORY_TABS.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value} variant="underline">{tab.label}</TabsTrigger>
              ))}
            </TabsList>
            {CATEGORY_TABS.map((tab) => (
              <TabsContent key={tab.value} value={tab.value} className="mt-0">
                {isLoading ? <PermissionsTableSkeleton /> : (
                  <PermissionsTable groupedPermissions={groupedPermissions} matrix={data?.matrix || ({} as Record<Role, Record<PermissionKey, boolean>>)} onToggle={handleToggle} isUpdating={updateMutation.isPending} isViewOnly={isViewOnly} />
                )}
              </TabsContent>
            ))}
          </Tabs>
          <div className="mt-6 pt-4 border-t flex items-center gap-6 text-sm text-gray-600">
            <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-green-100 flex items-center justify-center"><Check className="h-3 w-3 text-green-600" /></div><span>Granted</span></div>
            <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-gray-100 flex items-center justify-center"><X className="h-3 w-3 text-gray-400" /></div><span>Denied</span></div>
            <div className="flex items-center gap-2"><Lock className="h-4 w-4 text-gray-400" /><span>Locked</span></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PermissionsTable({ groupedPermissions, matrix, onToggle, isUpdating, isViewOnly }: {
  groupedPermissions: Record<string, Array<{ key: PermissionKey; label: string; group: string }>>;
  matrix: Record<Role, Record<PermissionKey, boolean>>;
  onToggle: (permissionKey: PermissionKey, role: Role, currentValue: boolean) => void;
  isUpdating: boolean;
  isViewOnly?: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full table-fixed">
        <thead>
          <tr className="border-b">
            <th className="w-[35%] text-left py-3 px-4 text-sm font-medium text-gray-700">Permission</th>
            {ALL_ROLES.map((role) => (
              <th key={role} className="w-[16.25%] text-center py-3 px-2">
                <Badge className={`${ROLE_COLORS[role]} border font-medium`}>{ROLE_LABELS[role]}{isRoleLocked(role) && <Lock className="h-3 w-3 ml-1" />}</Badge>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Object.entries(groupedPermissions).map(([group, permissions]) => (
            <>
              <tr key={`group-${group}`} className="bg-gray-50">
                <td colSpan={5} className="py-2 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">{group}</td>
              </tr>
              {permissions.map((perm) => (
                <tr key={perm.key} className="border-b border-gray-100 hover:bg-gray-50/50">
                  <td className="py-3 px-4 text-sm text-gray-800">{perm.label}</td>
                  {ALL_ROLES.map((role) => {
                    const granted = matrix[role]?.[perm.key] ?? false;
                    const locked = isRoleLocked(role);
                    return (
                      <td key={`${perm.key}-${role}`} className="py-3 px-2 text-center">
                        {locked ? (
                          <div className="flex items-center justify-center gap-1">
                            {granted ? <div className="w-6 h-6 rounded bg-green-100 flex items-center justify-center"><Check className="h-4 w-4 text-green-600" /></div> : <div className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center"><X className="h-4 w-4 text-gray-400" /></div>}
                            <Lock className="h-3 w-3 text-gray-300" />
                          </div>
                        ) : (
                          <div className="flex justify-center">
                            <Switch checked={granted} onCheckedChange={() => onToggle(perm.key, role, granted)} disabled={isUpdating || isViewOnly} checkedColor={granted ? "#3b82f6" : undefined} />
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PermissionsTableSkeleton() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full table-fixed">
        <thead>
          <tr className="border-b">
            <th className="w-[35%] text-left py-3 px-4"><Skeleton className="h-4 w-24" /></th>
            {[1, 2, 3, 4].map((i) => <th key={i} className="w-[16.25%] text-center py-3 px-2"><Skeleton className="h-6 w-16 mx-auto rounded-full" /></th>)}
          </tr>
        </thead>
        <tbody>
          {[1, 2, 3, 4, 5].map((row) => (
            <tr key={row} className="border-b border-gray-100">
              <td className="py-3 px-4"><Skeleton className="h-4 w-32" /></td>
              {[1, 2, 3, 4].map((col) => <td key={col} className="py-3 px-2 text-center"><Skeleton className="h-6 w-11 mx-auto rounded-full" /></td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============ Visibility Tab ============
function VisibilityTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canEdit } = useSettingsAccess();

  const [showTeams, setShowTeams] = useState(false);

  const { data: settings, isLoading: settingsLoading } = useQuery<VisibilitySettings>({
    queryKey: ["/api/crm/organization/visibility-settings"],
  });

  const { data: teams, isLoading: teamsLoading } = useQuery<Team[]>({
    queryKey: ["/api/crm/teams"],
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<VisibilitySettings>) => {
      const response = await apiRequest("PATCH", "/api/crm/organization/visibility-settings", { body: data });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update settings");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/organization/visibility-settings"] });
      toast({ title: "Settings updated", description: "Visibility settings have been saved." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleChange = (entity: keyof VisibilitySettings, value: CrmVisibility) => {
    updateMutation.mutate({ [entity]: value });
  };

  if (settingsLoading) {
    return <div className="space-y-6">{[1, 2, 3].map((i) => <div key={i} className="h-32 bg-gray-100 rounded-lg animate-pulse" />)}</div>;
  }

  const hasTeams = teams && teams.length > 0;

  const recordTypes = [
    { key: "deals" as const, label: "Deals", icon: Briefcase, color: "text-purple-600", bg: "bg-purple-100" },
    { key: "contacts" as const, label: "Contacts", icon: Users, color: "text-cyan-600", bg: "bg-cyan-100" },
    { key: "companies" as const, label: "Companies", icon: Building, color: "text-amber-600", bg: "bg-amber-100" },
  ];

  return (
    <div className="space-y-6">
      {!canEdit && (
        <Alert className="bg-amber-50 border-amber-200">
          <Lock className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-700">Only owners and admins can change visibility settings.</AlertDescription>
        </Alert>
      )}

      {/* Main Visibility Settings Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Record Visibility</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {/* Visibility Matrix */}
          <div className="border rounded-lg overflow-hidden">
            {/* Header Row */}
            <div className="grid grid-cols-4 bg-gray-50 border-b">
              <div className="p-4 font-medium text-gray-700 text-sm flex items-center">Record Type</div>
              {visibilityOptions.map((option) => {
                const OptionIcon = option.icon;
                return (
                  <div key={option.value} className="p-4 text-center">
                    <div className="flex flex-col items-center gap-1.5">
                      <div className={`p-2 rounded-lg ${option.iconBg}`}>
                        <OptionIcon className={`h-5 w-5 ${option.iconColor}`} />
                      </div>
                      <span className="text-sm font-medium text-gray-800">{option.label}</span>
                      <span className="text-xs text-gray-500 leading-snug max-w-[140px]">{option.description}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Data Rows */}
            {recordTypes.map((record, idx) => {
              const RecordIcon = record.icon;
              const currentValue = settings?.[record.key] || "organization";
              return (
                <div key={record.key} className={`grid grid-cols-4 ${idx !== recordTypes.length - 1 ? 'border-b' : ''}`}>
                  <div className="p-4 flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${record.bg}`}>
                      <RecordIcon className={`h-4 w-4 ${record.color}`} />
                    </div>
                    <span className="font-medium text-gray-900">{record.label}</span>
                  </div>
                  {visibilityOptions.map((option) => (
                    <div key={option.value} className="p-4 flex items-center justify-center">
                      <button
                        onClick={() => !canEdit || updateMutation.isPending ? null : handleChange(record.key, option.value)}
                        disabled={!canEdit || updateMutation.isPending}
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                          currentValue === option.value
                            ? 'bg-blue-600 text-white shadow-md scale-110'
                            : 'bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600'
                        } ${!canEdit ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                      >
                        {currentValue === option.value ? (
                          <Check className="h-5 w-5" />
                        ) : (
                          <div className="w-2 h-2 rounded-full bg-current" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

        </CardContent>
      </Card>

      {/* Teams Section */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-teal-100">
                <UsersRound className="h-5 w-5 text-teal-600" />
              </div>
              <div>
                <CardTitle className="text-lg">Teams</CardTitle>
                <CardDescription>Group users into teams for team-based visibility</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {hasTeams && (
                <Badge variant="secondary" className="bg-teal-50 text-teal-700 border-teal-200">
                  {teams.length} team{teams.length !== 1 ? "s" : ""}
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowTeams(!showTeams)}
                className="text-gray-600"
              >
                {showTeams ? (
                  <>Hide <ChevronDown className="h-4 w-4 ml-1" /></>
                ) : (
                  <>Manage <ChevronRight className="h-4 w-4 ml-1" /></>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        {!showTeams && !hasTeams && (
          <CardContent className="pt-0 pb-4">
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-600">
                No teams created yet. Create teams to enable team-based record visibility.
              </p>
              {canEdit && (
                <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowTeams(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Create Your First Team
                </Button>
              )}
            </div>
          </CardContent>
        )}
        {showTeams && (
          <CardContent className="pt-2">
            <TeamsSection teams={teams || []} isLoading={teamsLoading} canEdit={canEdit} />
          </CardContent>
        )}
      </Card>

      {/* Info Card */}
      <Card className="bg-gradient-to-br from-slate-50 to-blue-50 border-slate-200">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-start gap-4">
            <div className="p-2.5 bg-white rounded-lg shadow-sm border">
              <Eye className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-2">How Visibility Works</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-2" />
                  <p className="text-sm text-gray-600"><span className="font-medium text-gray-800">Owners & Admins</span> always see all records regardless of settings</p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2" />
                  <p className="text-sm text-gray-600"><span className="font-medium text-gray-800">Team visibility</span> requires users to be assigned to at least one team</p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-2" />
                  <p className="text-sm text-gray-600"><span className="font-medium text-gray-800">Deal Collaborators</span> can always access deals they're added to</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============ Teams Section (inline in Visibility Tab) ============
function TeamsSection({ teams, isLoading, canEdit }: { teams: Team[]; isLoading: boolean; canEdit: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isAddMemberDialogOpen, setIsAddMemberDialogOpen] = useState(false);
  const [selectedTeamIdForDialog, setSelectedTeamIdForDialog] = useState<number | null>(null);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamDescription, setNewTeamDescription] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [expandedTeams, setExpandedTeams] = useState<Set<number>>(new Set());
  const [selectedNewTeamMembers, setSelectedNewTeamMembers] = useState<Set<number>>(new Set());
  const [memberSearchQuery, setMemberSearchQuery] = useState("");

  const { data: orgMembers } = useQuery<OrgMember[]>({
    queryKey: ["/api/crm/organization/members"],
  });

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

  const teamDetailsMap = new Map<number, TeamWithMembers>();
  expandedTeamIds.forEach((teamId, index) => {
    const query = teamDetailsQueries[index];
    if (query.data) teamDetailsMap.set(teamId, query.data);
  });

  const createTeamMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string; memberIds: number[] }) => {
      // First create the team
      const response = await apiRequest("POST", "/api/crm/teams", { body: { name: data.name, description: data.description } });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create team");
      }
      const team = await response.json();

      // Then add members if any were selected
      if (data.memberIds.length > 0) {
        for (const memberId of data.memberIds) {
          const memberResponse = await apiRequest("POST", `/api/crm/teams/${team.id}/members`, { body: { organizationMemberId: memberId } });
          if (!memberResponse.ok) {
            console.error(`Failed to add member ${memberId} to team`);
          }
        }
      }

      return team;
    },
    onSuccess: (team, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/teams"] });
      if (variables.memberIds.length > 0) {
        queryClient.invalidateQueries({ queryKey: ["/api/crm/teams", team.id] });
      }
      setIsCreateDialogOpen(false);
      setNewTeamName("");
      setNewTeamDescription("");
      setSelectedNewTeamMembers(new Set());
      const memberCount = variables.memberIds.length;
      toast({
        title: "Team created",
        description: memberCount > 0
          ? `Your new team has been created with ${memberCount} member${memberCount !== 1 ? 's' : ''}.`
          : "Your new team has been created."
      });
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
      const response = await apiRequest("POST", `/api/crm/teams/${teamId}/members`, { body: { organizationMemberId } });
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
    if (newExpanded.has(teamId)) newExpanded.delete(teamId);
    else newExpanded.add(teamId);
    setExpandedTeams(newExpanded);
  };

  const getTeamMembers = (teamId: number): TeamMember[] => {
    const teamDetails = teamDetailsMap.get(teamId);
    return teamDetails?.members || [];
  };

  const getAvailableMembers = (teamId: number) => {
    const teamMembers = getTeamMembers(teamId);
    const memberIds = new Set(teamMembers.map((m) => m.organizationMemberId));
    return (orgMembers || []).filter((m) => !memberIds.has(m.id));
  };

  return (
    <div className="space-y-4">
      {/* Header with Create Button */}
      {canEdit && (
        <div className="flex justify-end">
          <Button onClick={() => setIsCreateDialogOpen(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />Create Team
          </Button>
        </div>
      )}

      {/* Teams List */}
      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />)}</div>
      ) : teams && teams.length > 0 ? (
        <div className="space-y-3">
          {teams.map((team) => (
            <Collapsible key={team.id} open={expandedTeams.has(team.id)} onOpenChange={() => toggleTeamExpanded(team.id)}>
              <div className="border rounded-lg bg-white">
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${expandedTeams.has(team.id) ? 'bg-teal-100' : 'bg-gray-100'}`}>
                        <Users className={`h-4 w-4 ${expandedTeams.has(team.id) ? 'text-teal-600' : 'text-gray-500'}`} />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{team.name}</p>
                        {team.description && <p className="text-xs text-gray-500">{team.description}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {/* Avatar Stack */}
                      {team.memberPreviews && team.memberPreviews.length > 0 && (
                        <div className="flex items-center">
                          <div className="flex -space-x-2">
                            {team.memberPreviews.slice(0, 5).map((member, idx) => (
                              <div
                                key={idx}
                                className="w-7 h-7 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center overflow-hidden"
                                title={member.firstName ? `${member.firstName} ${member.lastName || ""}` : "Team member"}
                              >
                                {member.profilePhoto ? (
                                  <img src={member.profilePhoto} className="w-full h-full object-cover" alt="" />
                                ) : (
                                  <User className="h-3.5 w-3.5 text-gray-500" />
                                )}
                              </div>
                            ))}
                          </div>
                          {team.memberCount > 5 && (
                            <span className="ml-1.5 text-xs text-gray-500">+{team.memberCount - 5}</span>
                          )}
                        </div>
                      )}
                      <Badge variant="outline" className="text-xs">{team.memberCount} member{team.memberCount !== 1 ? 's' : ''}</Badge>
                      {canEdit && (
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); if (confirm("Delete this team?")) deleteTeamMutation.mutate(team.id); }}>
                          <Trash2 className="h-3.5 w-3.5 text-gray-400 hover:text-red-500" />
                        </Button>
                      )}
                      {expandedTeams.has(team.id) ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="border-t px-3 py-3 bg-gray-50/50">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Members</p>
                      {canEdit && (
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setSelectedTeamIdForDialog(team.id); setIsAddMemberDialogOpen(true); }}>
                          <UserPlus className="h-3.5 w-3.5 mr-1" />Add
                        </Button>
                      )}
                    </div>
                    {getTeamMembers(team.id).length > 0 ? (
                      <div className="space-y-1.5">
                        {getTeamMembers(team.id).map((member) => (
                          <div key={member.id} className="flex items-center justify-between p-2 bg-white rounded-md border">
                            <div className="flex items-center gap-2">
                              {member.profilePhoto ? (
                                <img src={member.profilePhoto} className="w-6 h-6 rounded-full object-cover" alt="" />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
                                  <User className="h-3 w-3 text-gray-500" />
                                </div>
                              )}
                              <div>
                                <p className="text-sm font-medium text-gray-900">{member.firstName ? `${member.firstName} ${member.lastName || ""}` : member.email}</p>
                              </div>
                            </div>
                            {canEdit && (
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => removeMemberMutation.mutate({ teamId: team.id, memberId: member.organizationMemberId })}>
                                <X className="h-3 w-3 text-gray-400 hover:text-red-500" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 text-center py-3">No members yet</p>
                    )}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          ))}
        </div>
      ) : (
        <div className="text-center py-6 bg-gray-50 rounded-lg">
          <Users className="h-8 w-8 mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-500">No teams created yet</p>
        </div>
      )}

      {/* Create Team Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
        setIsCreateDialogOpen(open);
        if (!open) {
          setNewTeamName("");
          setNewTeamDescription("");
          setSelectedNewTeamMembers(new Set());
          setMemberSearchQuery("");
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Team</DialogTitle>
            <DialogDescription>Create a new team to group users for CRM visibility settings.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-gray-900">Team Name</Label>
              <Input value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} placeholder="e.g., Enterprise Sales, West Coast" />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-900">Description (optional)</Label>
              <Textarea value={newTeamDescription} onChange={(e) => setNewTeamDescription(e.target.value)} placeholder="What is this team for?" rows={2} />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-900">Add Members</Label>
              {orgMembers && orgMembers.length > 0 ? (
                <>
                  <div className="relative">
                    <Input
                      value={memberSearchQuery}
                      onChange={(e) => setMemberSearchQuery(e.target.value)}
                      placeholder="Search members..."
                      className="pl-9"
                    />
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  </div>
                  <div className="border rounded-lg max-h-48 overflow-y-auto">
                    {orgMembers
                      .filter((member) => {
                        if (!memberSearchQuery.trim()) return true;
                        const query = memberSearchQuery.toLowerCase();
                        const fullName = `${member.firstName || ""} ${member.lastName || ""}`.toLowerCase();
                        return fullName.includes(query) || member.email.toLowerCase().includes(query);
                      })
                      .map((member) => {
                        const isSelected = selectedNewTeamMembers.has(member.id);
                        return (
                          <div
                            key={member.id}
                            className={`flex items-center gap-3 p-2.5 cursor-pointer hover:bg-gray-50 transition-colors border-b last:border-b-0 ${isSelected ? 'bg-blue-50' : ''}`}
                            onClick={() => {
                              const newSelected = new Set(selectedNewTeamMembers);
                              if (isSelected) newSelected.delete(member.id);
                              else newSelected.add(member.id);
                              setSelectedNewTeamMembers(newSelected);
                            }}
                          >
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                              {isSelected && <Check className="h-3 w-3 text-white" />}
                            </div>
                            {member.profilePhoto ? (
                              <img src={member.profilePhoto} className="w-7 h-7 rounded-full object-cover" alt="" />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center">
                                <User className="h-3.5 w-3.5 text-gray-500" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {member.firstName ? `${member.firstName} ${member.lastName || ""}` : member.email}
                              </p>
                              {member.firstName && <p className="text-xs text-gray-500 truncate">{member.email}</p>}
                            </div>
                            <Badge className={`${roleColors[member.role] || roleColors.member} text-xs`}>{member.role}</Badge>
                          </div>
                        );
                      })}
                    {orgMembers.filter((member) => {
                      if (!memberSearchQuery.trim()) return true;
                      const query = memberSearchQuery.toLowerCase();
                      const fullName = `${member.firstName || ""} ${member.lastName || ""}`.toLowerCase();
                      return fullName.includes(query) || member.email.toLowerCase().includes(query);
                    }).length === 0 && (
                      <div className="p-4 text-center text-sm text-gray-500">No members match your search</div>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-500 py-2">No team members available</p>
              )}
              {selectedNewTeamMembers.size > 0 && (
                <p className="text-xs text-blue-600">{selectedNewTeamMembers.size} member{selectedNewTeamMembers.size !== 1 ? 's' : ''} selected</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createTeamMutation.mutate({
                name: newTeamName,
                description: newTeamDescription || undefined,
                memberIds: Array.from(selectedNewTeamMembers)
              })}
              disabled={!newTeamName.trim() || createTeamMutation.isPending}
            >
              {createTeamMutation.isPending ? "Creating..." : `Create Team${selectedNewTeamMembers.size > 0 ? ` (${selectedNewTeamMembers.size})` : ''}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Member Dialog */}
      <Dialog open={isAddMemberDialogOpen} onOpenChange={setIsAddMemberDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Team Member</DialogTitle>
            <DialogDescription>Select a team member to add to this team.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-gray-900">Team Member</Label>
              <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
                <SelectTrigger><SelectValue placeholder="Select a member" /></SelectTrigger>
                <SelectContent>
                  {selectedTeamIdForDialog && getAvailableMembers(selectedTeamIdForDialog).map((member) => (
                    <SelectItem key={member.id} value={String(member.id)}>{member.firstName ? `${member.firstName} ${member.lastName || ""}` : member.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddMemberDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => selectedTeamIdForDialog && addMemberMutation.mutate({ teamId: selectedTeamIdForDialog, organizationMemberId: parseInt(selectedMemberId) })} disabled={!selectedMemberId || addMemberMutation.isPending}>
              {addMemberMutation.isPending ? "Adding..." : "Add Member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
