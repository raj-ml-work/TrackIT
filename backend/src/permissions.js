/**
 * Permission Registry — Backend RBAC
 *
 * Single source of truth for all permission rules.
 * Mirrors the frontend permission registry structure.
 *
 * To add a new feature:  add entries to PERMISSION_REGISTRY.
 * To add a new role:     add the role string to relevant entries.
 */

// Valid roles in the system
export const VALID_ROLES = ['Admin', 'Management', 'IT', 'Delivery'];

// Legacy role mapping (for backward compatibility during migration)
export const LEGACY_ROLE_MAP = {
  'User': 'IT'
};

/**
 * Resolve a role string to its effective value.
 * Maps legacy 'User' role to 'IT'.
 */
export const resolveRole = (role) => {
  return LEGACY_ROLE_MAP[role] || role;
};

/**
 * Check if a role string is valid (including legacy roles).
 */
export const isValidRole = (role) => {
  return VALID_ROLES.includes(role) || Object.keys(LEGACY_ROLE_MAP).includes(role);
};

// ────────────────────────────────────────────────────────────
// THE Permission Registry
// ────────────────────────────────────────────────────────────

const PERMISSION_REGISTRY = [
  // ── Assets / Inventory ──
  { resource: 'assets', action: 'view',   roles: ['Admin', 'Management', 'IT'] },
  { resource: 'assets', action: 'create', roles: ['Admin', 'IT'] },
  { resource: 'assets', action: 'edit',   roles: ['Admin', 'IT'] },
  { resource: 'assets', action: 'delete', roles: ['Admin'] },

  // ── Employees — core records ──
  { resource: 'employees',      action: 'view',   roles: ['Admin', 'Management', 'IT', 'Delivery'] },
  { resource: 'employees',      action: 'create', roles: ['Admin', 'IT'] },
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
];

// ────────────────────────────────────────────────────────────
// Build a lookup map for O(1) permission checks
// ────────────────────────────────────────────────────────────

const permissionMap = new Map();
for (const entry of PERMISSION_REGISTRY) {
  permissionMap.set(`${entry.resource}::${entry.action}`, new Set(entry.roles));
}

/**
 * Check if a role has permission to perform an action on a resource.
 *
 * @param {string} role - The user's role (e.g. 'Admin', 'IT')
 * @param {string} resource - The resource identifier (e.g. 'assets', 'employees.salary')
 * @param {string} action - The action (e.g. 'view', 'create', 'edit', 'delete')
 * @returns {boolean}
 */
export const hasPermission = (role, resource, action) => {
  if (!role) return false;
  const effectiveRole = resolveRole(role);
  const allowedRoles = permissionMap.get(`${resource}::${action}`);
  if (!allowedRoles) return false;
  return allowedRoles.has(effectiveRole);
};

export { PERMISSION_REGISTRY };
