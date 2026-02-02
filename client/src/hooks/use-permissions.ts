import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { PermissionKey, Role } from '@shared/permissions';

interface UserPermissions {
  role: Role;
  permissions: Record<PermissionKey, boolean>;
}

export function usePermissions() {
  const { data, isLoading, error } = useQuery<UserPermissions>({
    queryKey: ['user-permissions'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/crm/organization/my-permissions');
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const role = data?.role;
  const permissions = data?.permissions;

  // Check if user has a specific permission
  const hasPermission = (key: PermissionKey): boolean => {
    if (!data || !permissions) return false;
    // Owner always has all permissions
    if (role === 'owner') return true;
    return permissions[key] ?? false;
  };

  // Convenience methods for common permission checks
  const canView = (feature: string): boolean => {
    const viewKey = `${feature}.view` as PermissionKey;
    return hasPermission(viewKey);
  };

  const canCreate = (feature: string): boolean => {
    const createKey = `${feature}.create` as PermissionKey;
    return hasPermission(createKey);
  };

  const canEdit = (feature: string): boolean => {
    const editKey = `${feature}.edit` as PermissionKey;
    return hasPermission(editKey);
  };

  const canDelete = (feature: string): boolean => {
    const deleteKey = `${feature}.delete` as PermissionKey;
    return hasPermission(deleteKey);
  };

  return {
    role,
    permissions,
    isLoading,
    error,
    hasPermission,
    canView,
    canCreate,
    canEdit,
    canDelete,
    isOwner: role === 'owner',
    isAdmin: role === 'admin',
    isMember: role === 'member',
    isViewer: role === 'viewer',
  };
}
