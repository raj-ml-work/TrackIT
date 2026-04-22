/**
 * Permission Utility — Registry-Based RBAC
 *
 * All permissions are declared in PERMISSION_REGISTRY as
 * { resource, action, roles[] } tuples.
 *
 * To add a new feature:  add entries to PERMISSION_REGISTRY.
 * To add a new role:     add the role string to relevant entries.
 * Components never hardcode role names — they receive boolean props.
 */

import { UserRole, UserAccount } from '../types';

// ────────────────────────────────────────────────────────────
// Permission Entry Type
// ────────────────────────────────────────────────────────────

interface PermissionEntry {
  /** Dot-namespaced resource identifier, e.g. 'employees.salary' */
  resource: string;
  /** CRUD action: 'view' | 'create' | 'edit' | 'delete' */
  action: string;
  /** Roles that are allowed to perform this action on this resource */
  roles: string[];
}

// ────────────────────────────────────────────────────────────
// THE Permission Registry (single source of truth)
// ────────────────────────────────────────────────────────────

const PERMISSION_REGISTRY: PermissionEntry[] = [
  // ── Assets / Inventory ──
  { resource: 'assets', action: 'view',   roles: ['Admin', 'Management', 'IT'] },
  { resource: 'assets', action: 'create', roles: ['Admin', 'IT'] },
  { resource: 'assets', action: 'edit',   roles: ['Admin', 'IT'] },
  { resource: 'assets', action: 'delete', roles: ['Admin'] },

  // ── Employees — core records ──
  { resource: 'employees',      action: 'view',   roles: ['Admin', 'Management', 'IT', 'Delivery'] },
  { resource: 'employees',      action: 'create', roles: ['Admin', 'IT'] },
  { resource: 'employees.info', action: 'view',   roles: ['Admin', 'Management', 'IT'] },
  { resource: 'employees.info', action: 'edit',   roles: ['Admin', 'IT'] },
  { resource: 'employees',      action: 'delete', roles: ['Admin'] },

  // ── Employees — engagement & feedback ──
  { resource: 'employees.engagement', action: 'view', roles: ['Admin', 'Management', 'IT', 'Delivery'] },
  { resource: 'employees.engagement', action: 'edit', roles: ['Admin', 'Delivery'] },
  { resource: 'employees.feedback',   action: 'view', roles: ['Admin', 'Management', 'IT', 'Delivery'] },
  { resource: 'employees.feedback',   action: 'edit', roles: ['Admin', 'Delivery'] },

  // ── Employees — salary (sensitive) ──
  { resource: 'employees.salary', action: 'view',   roles: ['Admin', 'Management'] },
  { resource: 'employees.salary', action: 'edit',   roles: ['Admin', 'Management'] },
  { resource: 'employees.salary', action: 'delete', roles: ['Admin'] },

  // ── Locations ──
  { resource: 'locations', action: 'view',   roles: ['Admin', 'Management', 'IT'] },
  { resource: 'locations', action: 'create', roles: ['Admin', 'IT'] },
  { resource: 'locations', action: 'edit',   roles: ['Admin', 'IT'] },
  { resource: 'locations', action: 'delete', roles: ['Admin'] },

  // ── Departments ──
  { resource: 'departments', action: 'view',   roles: ['Admin', 'Management', 'IT'] },
  { resource: 'departments', action: 'create', roles: ['Admin'] },
  { resource: 'departments', action: 'edit',   roles: ['Admin'] },
  { resource: 'departments', action: 'delete', roles: ['Admin'] },

  // ── User management ──
  { resource: 'users', action: 'view',   roles: ['Admin'] },
  { resource: 'users', action: 'create', roles: ['Admin'] },
  { resource: 'users', action: 'edit',   roles: ['Admin'] },
  { resource: 'users', action: 'delete', roles: ['Admin'] },

  // ── Navigation / sidebar visibility ──
  { resource: 'nav.dashboard',      action: 'view', roles: ['Admin', 'Management', 'IT', 'Delivery'] },
  { resource: 'nav.mgmtDashboard',  action: 'view', roles: ['Admin', 'Management'] },
  { resource: 'nav.inventory',      action: 'view', roles: ['Admin', 'Management', 'IT'] },
  { resource: 'nav.employees',      action: 'view', roles: ['Admin', 'Management', 'IT', 'Delivery'] },
  { resource: 'nav.departments',    action: 'view', roles: ['Admin', 'Management', 'IT'] },
  { resource: 'nav.locations',      action: 'view', roles: ['Admin', 'Management', 'IT'] },
  { resource: 'nav.users',          action: 'view', roles: ['Admin'] },
  { resource: 'nav.settings',       action: 'view', roles: ['Admin'] },
];

// ────────────────────────────────────────────────────────────
// Build a lookup map for O(1) permission checks
// ────────────────────────────────────────────────────────────

const buildPermissionMap = (registry: PermissionEntry[]): Map<string, Set<string>> => {
  const map = new Map<string, Set<string>>();
  for (const entry of registry) {
    const key = `${entry.resource}::${entry.action}`;
    map.set(key, new Set(entry.roles));
  }
  return map;
};

const permissionMap = buildPermissionMap(PERMISSION_REGISTRY);

// ────────────────────────────────────────────────────────────
// Core Permission Check Function
// ────────────────────────────────────────────────────────────

/**
 * Check if a user has permission to perform an action on a resource.
 *
 * Usage:
 *   checkPermission(user, 'assets', 'create')     // Can user create assets?
 *   checkPermission(user, 'employees.salary', 'view')  // Can user see salary?
 *   checkPermission(user, 'nav.inventory', 'view')     // Show inventory sidebar?
 */
export const checkPermission = (
  user: UserAccount | null,
  resource: string,
  action: string
): boolean => {
  if (!user || !isActiveUser(user)) return false;

  const allowedRoles = permissionMap.get(`${resource}::${action}`);
  if (!allowedRoles) return false;

  // Treat legacy 'User' role as 'IT' for backward compatibility
  const effectiveRole = user.role === UserRole.USER ? UserRole.IT : user.role;
  return allowedRoles.has(effectiveRole);
};

// ────────────────────────────────────────────────────────────
// Role Check Helpers
// ────────────────────────────────────────────────────────────

/** Check if user has admin role */
export const isAdmin = (user: UserAccount | null): boolean => {
  return !!user && user.role === UserRole.ADMIN;
};

/** Check if user is active */
export const isActiveUser = (user: UserAccount | null): boolean => {
  return !!user && user.status === 'Active';
};

// ────────────────────────────────────────────────────────────
// Backward-Compatible Helpers
// (Existing code imports these — they now delegate to checkPermission)
// ────────────────────────────────────────────────────────────

/** @deprecated Use checkPermission(user, resource, 'create') instead */
export const canCreate = (user: UserAccount | null): boolean => {
  return checkPermission(user, 'assets', 'create');
};

/** @deprecated Use checkPermission(user, resource, 'edit') instead */
export const canUpdate = (user: UserAccount | null): boolean => {
  return checkPermission(user, 'assets', 'edit');
};

/** @deprecated Use checkPermission(user, resource, 'delete') instead */
export const canDelete = (user: UserAccount | null): boolean => {
  return checkPermission(user, 'assets', 'delete');
};

/** Check if user can view resources (all authenticated active users) */
export const canView = (user: UserAccount | null): boolean => {
  return !!user && isActiveUser(user);
};

export const canManageUsers = (user: UserAccount | null): boolean => {
  return checkPermission(user, 'users', 'edit');
};

export const canManageDepartments = (user: UserAccount | null): boolean => {
  return checkPermission(user, 'departments', 'edit');
};

export const canManageLocations = (user: UserAccount | null): boolean => {
  return checkPermission(user, 'locations', 'edit');
};

export const canManageEmployees = (user: UserAccount | null): boolean => {
  return checkPermission(user, 'employees.info', 'edit');
};

export const canManageAssets = (user: UserAccount | null): boolean => {
  return checkPermission(user, 'assets', 'edit');
};

export const canManage = (user: UserAccount | null): boolean => {
  return canCreate(user) || canUpdate(user) || canDelete(user);
};

// ────────────────────────────────────────────────────────────
// Permission Status & Error Helpers
// ────────────────────────────────────────────────────────────

/** Get detailed permission status for a user */
export const getPermissionStatus = (user: UserAccount | null) => {
  return {
    isAuthenticated: !!user,
    isActive: isActiveUser(user),
    isAdmin: isAdmin(user),
    canView: canView(user),
    canCreate: canCreate(user),
    canUpdate: canUpdate(user),
    canDelete: canDelete(user),
    canManageUsers: canManageUsers(user),
    canManageDepartments: canManageDepartments(user),
    canManageLocations: canManageLocations(user),
    canManageEmployees: canManageEmployees(user),
    canManageAssets: canManageAssets(user),
    canManage: canManage(user)
  };
};

/** Get permission error message for unauthorized operations */
export const getPermissionError = (operation: string, userRole: UserRole | null): string => {
  if (!userRole) {
    return 'Unauthorized: User not authenticated';
  }

  return `Unauthorized: ${userRole} role does not have permission to ${operation}`;
};