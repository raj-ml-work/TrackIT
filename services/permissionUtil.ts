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
 * Check if user has power user role
 */
export const isPowerUser = (user: UserAccount | null): boolean => {
  return !!user && user.role === UserRole.POWER_USER;
};

/**
 * Check if user has normal user role
 */
export const isNormalUser = (user: UserAccount | null): boolean => {
  return !!user && user.role === UserRole.NORMAL_USER;
};

/**
 * Check if user is active
 */
export const isActiveUser = (user: UserAccount | null): boolean => {
  return !!user && user.status === 'Active';
};

/**
 * Check if user can create/update resources (Power User or Admin, and active)
 */
export const canCreateOrUpdate = (user: UserAccount | null): boolean => {
  return isActiveUser(user) && (isAdmin(user) || isPowerUser(user));
};

/**
 * Check if user can delete resources (Admin only, and active)
 */
export const canDelete = (user: UserAccount | null): boolean => {
  return isActiveUser(user) && isAdmin(user);
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
    case 'update':
      return `Unauthorized: ${userRole} cannot ${operation} resources`;
    case 'delete':
      return `Unauthorized: ${userRole} cannot delete resources`;
    case 'manageUsers':
      return `Unauthorized: ${userRole} cannot manage users`;
    default:
      return `Unauthorized: ${userRole} cannot perform ${operation}`;
  }
};