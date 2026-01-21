import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { rolePermissions, organizationMembers, organizations } from '@shared/schema';
import {
  DEFAULT_PERMISSIONS,
  PERMISSION_KEYS,
  isRoleLocked,
  type PermissionKey,
  type Role,
} from '@shared/permissions';
import { eq, and } from 'drizzle-orm';

// Get user's organization and membership
export async function getUserOrgMembership(userId: number) {
  const [membership] = await db
    .select({
      organization: organizations,
      membership: organizationMembers,
    })
    .from(organizationMembers)
    .innerJoin(organizations, eq(organizations.id, organizationMembers.organizationId))
    .where(eq(organizationMembers.userId, userId))
    .limit(1);

  return membership || null;
}

// Get effective permissions for a user based on their role and org customizations
export async function getUserPermissions(
  userId: number
): Promise<{ role: Role; permissions: Record<PermissionKey, boolean> } | null> {
  const orgData = await getUserOrgMembership(userId);
  if (!orgData) return null;

  const role = orgData.membership.role as Role;

  // Start with default permissions for the role
  const defaultPerms = DEFAULT_PERMISSIONS[role];
  if (!defaultPerms) return null;

  // For owner/viewer, return defaults (locked)
  if (isRoleLocked(role)) {
    return { role, permissions: { ...defaultPerms } };
  }

  // For admin/member, merge with org customizations
  const customizations = await db
    .select()
    .from(rolePermissions)
    .where(
      and(
        eq(rolePermissions.organizationId, orgData.organization.id),
        eq(rolePermissions.role, role)
      )
    );

  // Apply customizations over defaults
  const effectivePermissions = { ...defaultPerms };
  for (const custom of customizations) {
    if (custom.permissionKey in PERMISSION_KEYS) {
      effectivePermissions[custom.permissionKey as PermissionKey] = custom.granted;
    }
  }

  return { role, permissions: effectivePermissions };
}

// Get permissions matrix for all roles (for settings page)
export async function getPermissionsMatrix(organizationId: number) {
  // Get all customizations for this org
  const customizations = await db
    .select()
    .from(rolePermissions)
    .where(eq(rolePermissions.organizationId, organizationId));

  // Build customizations lookup
  const customLookup: Record<string, Record<string, boolean>> = {};
  for (const custom of customizations) {
    if (!customLookup[custom.role]) {
      customLookup[custom.role] = {};
    }
    customLookup[custom.role][custom.permissionKey] = custom.granted;
  }

  // Build matrix for all roles
  const matrix: Record<Role, Record<PermissionKey, boolean>> = {
    owner: { ...DEFAULT_PERMISSIONS.owner },
    admin: { ...DEFAULT_PERMISSIONS.admin },
    member: { ...DEFAULT_PERMISSIONS.member },
    viewer: { ...DEFAULT_PERMISSIONS.viewer },
  };

  // Apply customizations for admin and member
  for (const role of ['admin', 'member'] as const) {
    if (customLookup[role]) {
      for (const [key, granted] of Object.entries(customLookup[role])) {
        if (key in PERMISSION_KEYS) {
          matrix[role][key as PermissionKey] = granted;
        }
      }
    }
  }

  return matrix;
}

// Update a single permission
export async function updatePermission(
  organizationId: number,
  permissionKey: string,
  role: string,
  granted: boolean
): Promise<{ success: boolean; error?: string }> {
  // Validate permission key
  if (!(permissionKey in PERMISSION_KEYS)) {
    return { success: false, error: 'Invalid permission key' };
  }

  // Validate role is customizable
  if (role !== 'admin' && role !== 'member') {
    return { success: false, error: 'Cannot modify permissions for owner or viewer roles' };
  }

  try {
    // Check if there's an existing customization
    const [existing] = await db
      .select()
      .from(rolePermissions)
      .where(
        and(
          eq(rolePermissions.organizationId, organizationId),
          eq(rolePermissions.permissionKey, permissionKey),
          eq(rolePermissions.role, role)
        )
      )
      .limit(1);

    // Check if this is the same as the default
    const defaultValue = DEFAULT_PERMISSIONS[role as Role][permissionKey as PermissionKey];

    if (granted === defaultValue) {
      // If setting to default, remove any customization
      if (existing) {
        await db
          .delete(rolePermissions)
          .where(eq(rolePermissions.id, existing.id));
      }
    } else {
      // Setting to non-default value
      if (existing) {
        await db
          .update(rolePermissions)
          .set({ granted, updatedAt: new Date() })
          .where(eq(rolePermissions.id, existing.id));
      } else {
        await db.insert(rolePermissions).values({
          organizationId,
          permissionKey,
          role,
          granted,
        });
      }
    }

    return { success: true };
  } catch (error) {
    console.error('[Permissions] Error updating permission:', error);
    return { success: false, error: 'Failed to update permission' };
  }
}

// Middleware to check a specific permission
export function requirePermission(permissionKey: PermissionKey) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const userPerms = await getUserPermissions(req.user!.id);
    if (!userPerms) {
      return res.status(403).json({ error: 'No organization membership found' });
    }

    // Owner always passes
    if (userPerms.role === 'owner') {
      return next();
    }

    // Check specific permission
    if (!userPerms.permissions[permissionKey]) {
      return res.status(403).json({
        error: 'Permission denied',
        required: permissionKey
      });
    }

    next();
  };
}

// Check if user can manage permissions (must be owner or admin)
export async function canManagePermissions(userId: number): Promise<boolean> {
  const orgData = await getUserOrgMembership(userId);
  if (!orgData) return false;

  const role = orgData.membership.role as Role;
  return role === 'owner' || role === 'admin';
}
