import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SettingsLayout, useSettingsAccess } from "@/components/layout/settings-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lock, Check, X, AlertCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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

interface PermissionsResponse {
  matrix: Record<Role, Record<PermissionKey, boolean>>;
  permissionKeys: typeof PERMISSION_KEYS;
  categoryInfo: typeof CATEGORY_INFO;
  roles: typeof ALL_ROLES;
}

interface UpdatePermissionResponse {
  success: boolean;
  matrix: Record<Role, Record<PermissionKey, boolean>>;
}

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

export default function PermissionsPage() {
  const [activeTab, setActiveTab] = useState<PermissionCategory>("crm");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canEdit, isViewOnly } = useSettingsAccess();

  // Fetch permissions matrix
  const { data, isLoading, error } = useQuery<PermissionsResponse>({
    queryKey: ["organization-permissions"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/crm/organization/permissions");
      return res.json();
    },
  });

  // Update permission mutation
  const updateMutation = useMutation({
    mutationFn: async ({
      permissionKey,
      role,
      granted,
    }: {
      permissionKey: string;
      role: string;
      granted: boolean;
    }) => {
      const res = await apiRequest("PUT", "/api/crm/organization/permissions", {
        body: { permissionKey, role, granted },
      });
      return res.json() as Promise<UpdatePermissionResponse>;
    },
    onMutate: async ({ permissionKey, role, granted }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["organization-permissions"] });

      // Snapshot previous value
      const previousData = queryClient.getQueryData<PermissionsResponse>(["organization-permissions"]);

      // Optimistically update
      if (previousData) {
        queryClient.setQueryData<PermissionsResponse>(["organization-permissions"], {
          ...previousData,
          matrix: {
            ...previousData.matrix,
            [role]: {
              ...previousData.matrix[role as Role],
              [permissionKey]: granted,
            },
          },
        });
      }

      return { previousData };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(["organization-permissions"], context.previousData);
      }
      toast({
        title: "Error",
        description: "Failed to update permission. Please try again.",
        variant: "destructive",
      });
    },
    onSuccess: (data) => {
      // Update with server response
      queryClient.setQueryData<PermissionsResponse>(["organization-permissions"], (prev) => {
        if (!prev) return prev;
        return { ...prev, matrix: data.matrix };
      });
      // Also invalidate user permissions
      queryClient.invalidateQueries({ queryKey: ["user-permissions"] });
    },
  });

  const handleToggle = (permissionKey: PermissionKey, role: Role, currentValue: boolean) => {
    if (isRoleLocked(role)) return;
    updateMutation.mutate({
      permissionKey,
      role,
      granted: !currentValue,
    });
  };

  const permissions = getPermissionsByCategory(activeTab);

  // Group permissions by their group property
  const groupedPermissions = permissions.reduce((acc, perm) => {
    if (!acc[perm.group]) {
      acc[perm.group] = [];
    }
    acc[perm.group].push(perm);
    return acc;
  }, {} as Record<string, typeof permissions>);

  if (error) {
    return (
      <SettingsLayout
        title="Permissions"
        description="Manage role-based access control and permissions"
      >
        <div className="max-w-6xl">
          <Card>
            <CardContent className="py-12">
              <div className="flex flex-col items-center justify-center text-center">
                <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Unable to Load Permissions
                </h3>
                <p className="text-gray-600 max-w-sm">
                  You don't have access to view permissions settings, or there was an error loading the data.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </SettingsLayout>
    );
  }

  return (
    <SettingsLayout
      title="Permissions"
      description="Manage role-based access control and permissions"
    >
      <div className="max-w-6xl space-y-4">
        {isViewOnly && (
          <Alert className="bg-amber-50 border-amber-200">
            <Lock className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-700">
              You have view-only access to permissions settings. Contact an admin or owner to make changes.
            </AlertDescription>
          </Alert>
        )}
        <Card>
          <CardContent className="pt-6">
            {/* Category Tabs */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as PermissionCategory)}>
              <TabsList variant="underline" className="mb-6 w-full justify-start flex-wrap">
                {CATEGORY_TABS.map((tab) => (
                  <TabsTrigger key={tab.value} value={tab.value} variant="underline">
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              {CATEGORY_TABS.map((tab) => (
                <TabsContent key={tab.value} value={tab.value} className="mt-0">
                  {isLoading ? (
                    <PermissionsTableSkeleton />
                  ) : (
                    <PermissionsTable
                      groupedPermissions={groupedPermissions}
                      matrix={data?.matrix || ({} as Record<Role, Record<PermissionKey, boolean>>)}
                      onToggle={handleToggle}
                      isUpdating={updateMutation.isPending}
                      isViewOnly={isViewOnly}
                    />
                  )}
                </TabsContent>
              ))}
            </Tabs>

            {/* Legend */}
            <div className="mt-6 pt-4 border-t flex items-center gap-6 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-green-100 flex items-center justify-center">
                  <Check className="h-3 w-3 text-green-600" />
                </div>
                <span>Granted</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-gray-100 flex items-center justify-center">
                  <X className="h-3 w-3 text-gray-400" />
                </div>
                <span>Denied</span>
              </div>
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-gray-400" />
                <span>Locked (cannot be changed)</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </SettingsLayout>
  );
}

interface PermissionsTableProps {
  groupedPermissions: Record<string, Array<{ key: PermissionKey; label: string; group: string }>>;
  matrix: Record<Role, Record<PermissionKey, boolean>>;
  onToggle: (permissionKey: PermissionKey, role: Role, currentValue: boolean) => void;
  isUpdating: boolean;
  isViewOnly?: boolean;
}

function PermissionsTable({ groupedPermissions, matrix, onToggle, isUpdating, isViewOnly }: PermissionsTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full table-fixed">
        <thead>
          <tr className="border-b">
            <th className="w-[35%] text-left py-3 px-4 text-sm font-medium text-gray-700">
              Permission
            </th>
            {ALL_ROLES.map((role) => (
              <th key={role} className="w-[16.25%] text-center py-3 px-2">
                <Badge className={`${ROLE_COLORS[role]} border font-medium`}>
                  {ROLE_LABELS[role]}
                  {isRoleLocked(role) && <Lock className="h-3 w-3 ml-1" />}
                </Badge>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Object.entries(groupedPermissions).map(([group, permissions]) => (
            <>
              {/* Group header */}
              <tr key={`group-${group}`} className="bg-gray-50">
                <td
                  colSpan={5}
                  className="py-2 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider"
                >
                  {group}
                </td>
              </tr>
              {/* Permission rows */}
              {permissions.map((perm) => (
                <tr key={perm.key} className="border-b border-gray-100 hover:bg-gray-50/50">
                  <td className="py-3 px-4 text-sm text-gray-800">{perm.label}</td>
                  {ALL_ROLES.map((role) => {
                    const granted = matrix[role]?.[perm.key] ?? false;
                    const locked = isRoleLocked(role);

                    return (
                      <td key={`${perm.key}-${role}`} className="py-3 px-2 text-center">
                        {locked ? (
                          // Locked roles show static indicator
                          <div className="flex items-center justify-center gap-1">
                            {granted ? (
                              <div className="w-6 h-6 rounded bg-green-100 flex items-center justify-center">
                                <Check className="h-4 w-4 text-green-600" />
                              </div>
                            ) : (
                              <div className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center">
                                <X className="h-4 w-4 text-gray-400" />
                              </div>
                            )}
                            <Lock className="h-3 w-3 text-gray-300" />
                          </div>
                        ) : (
                          // Editable roles show switch
                          <div className="flex justify-center">
                            <Switch
                              checked={granted}
                              onCheckedChange={() => onToggle(perm.key, role, granted)}
                              disabled={isUpdating || isViewOnly}
                              checkedColor={granted ? "#22c55e" : undefined}
                            />
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
            <th className="w-[35%] text-left py-3 px-4">
              <Skeleton className="h-4 w-24" />
            </th>
            {[1, 2, 3, 4].map((i) => (
              <th key={i} className="w-[16.25%] text-center py-3 px-2">
                <Skeleton className="h-6 w-16 mx-auto rounded-full" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[1, 2, 3, 4, 5].map((row) => (
            <tr key={row} className="border-b border-gray-100">
              <td className="py-3 px-4">
                <Skeleton className="h-4 w-32" />
              </td>
              {[1, 2, 3, 4].map((col) => (
                <td key={col} className="py-3 px-2 text-center">
                  <Skeleton className="h-6 w-11 mx-auto rounded-full" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
