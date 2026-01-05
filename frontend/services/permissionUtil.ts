/**
 * Permission Utility
 * 
 * Provides helper functions for checking user permissions
 */

import { UserRole, UserAccount } from '../types';

/**
 * Check if user has admin role
 */
export const isAdmin = (user: UserAccount | null): boolean => {
  return !!user && user.role === UserRole.ADMIN;
};


/**
 * Check if user is active
 */
export const isActiveUser = (user: UserAccount | null): boolean => {
  return !!user && user.status === 'Active';
};

/**
 * Check if user can create resources (Admin only, and active)
 */
export const canCreate = (user: UserAccount | null): boolean => {
  return isActiveUser(user) && isAdmin(user);
};

/**
 * Check if user can update resources (Admin only, and active)
 */
export const canUpdate = (user: UserAccount | null): boolean => {
  return isActiveUser(user) && isAdmin(user);
};

/**
 * Check if user can delete resources (Admin only, and active)
 */
export const canDelete = (user: UserAccount | null): boolean => {
  return isActiveUser(user) && isAdmin(user);
};

/**
 * Check if user can manage departments (Admin only, and active)
 */
export const canManageDepartments = (user: UserAccount | null): boolean => {
  return isActiveUser(user) && isAdmin(user);
};

/**
 * Check if user can manage locations (Admin only, and active)
 */
export const canManageLocations = (user: UserAccount | null): boolean => {
  return isActiveUser(user) && isAdmin(user);
};

/**
 * Check if user can manage employees (Admin only, and active)
 */
export const canManageEmployees = (user: UserAccount | null): boolean => {
  return isActiveUser(user) && isAdmin(user);
};

/**
 * Check if user can manage assets (Admin only, and active)
 */
export const canManageAssets = (user: UserAccount | null): boolean => {
  return isActiveUser(user) && isAdmin(user);
};

/**
 * Check if user can perform any management operation
 */
export const canManage = (user: UserAccount | null): boolean => {
  return canCreate(user) || canUpdate(user) || canDelete(user);
};

/**
 * Get detailed permission status for a user
 */
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

/**
 * Check if user can manage users (Admin only, and active)
 */
export const canManageUsers = (user: UserAccount | null): boolean => {
  return isActiveUser(user) && isAdmin(user);
};

/**
 * Check if user can view resources (all authenticated users)
 */
export const canView = (user: UserAccount | null): boolean => {
  return !!user;
};

/**
 * Get permission error message for unauthorized operations
 */
export const getPermissionError = (operation: string, userRole: UserRole | null): string => {
  if (!userRole) {
    return 'Unauthorized: User not authenticated';
  }
  
  switch (operation) {
    case 'create':
      return `Unauthorized: ${userRole} cannot create resources`;
    case 'update':
      return `Unauthorized: ${userRole} cannot update resources`;
    case 'delete':
      return `Unauthorized: ${userRole} cannot delete resources`;
    case 'manageUsers':
      return `Unauthorized: ${userRole} cannot manage users`;
    case 'manageDepartments':
      return `Unauthorized: ${userRole} cannot manage departments`;
    case 'manageLocations':
      return `Unauthorized: ${userRole} cannot manage locations`;
    case 'manageEmployees':
      return `Unauthorized: ${userRole} cannot manage employees`;
    case 'manageAssets':
      return `Unauthorized: ${userRole} cannot manage assets`;
    default:
      return `Unauthorized: ${userRole} cannot perform ${operation}`;
  }
};