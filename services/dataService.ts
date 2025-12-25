/**
 * Data Service - Main Service Layer
 * 
 * This file provides a unified interface for all data operations.
 * It can switch between Supabase and local databases based on configuration.
 */

import { Asset, Employee, Location, UserAccount, Department } from '../types';
import * as assetService from './assetService';
import * as employeeService from './employeeService';
import * as locationService from './locationService';
import * as userService from './userService';
import * as departmentService from './departmentService';
import { dbConfig, DatabaseType } from './database';

/**
 * Check if database is configured and ready
 */
export const isDatabaseReady = (): boolean => {
  if (dbConfig.type === DatabaseType.SUPABASE) {
    return !!(dbConfig.supabaseUrl && dbConfig.supabaseAnonKey);
  }
  // For local databases, check if connection details are provided
  return !!(dbConfig.host && dbConfig.database && dbConfig.user);
};

/**
 * Initialize database connection
 */
export const initializeDatabase = async (): Promise<void> => {
  if (!isDatabaseReady()) {
    console.warn('Database not configured. Using mock data.');
    return;
  }

  try {
    if (dbConfig.type === DatabaseType.SUPABASE) {
      // Supabase client is initialized lazily
      const { getSupabaseClient } = await import('./supabaseClient');
      await getSupabaseClient();
      console.log('Supabase connection initialized');
    }
    // Future: Initialize local database connections here
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
};

// Re-export all service functions
export {
  // Asset services
  getAssets,
  getAssetById,
  createAsset,
  updateAsset,
  deleteAsset,
  getAssetComments,
  addAssetComment
} from './assetService';

export {
  // Employee services
  getEmployees,
  getEmployeeById,
  getEmployeeByEmployeeId,
  createEmployee,
  updateEmployee,
  deleteEmployee
} from './employeeService';

export {
  // Location services
  getLocations,
  getLocationById,
  getLocationByName,
  createLocation,
  updateLocation,
  deleteLocation
} from './locationService';

export {
  // User services
  getUsers,
  getUserById,
  getUserByEmail,
  createUser,
  updateUser,
  updateUserPassword,
  deleteUser,
  updateLastLogin
} from './userService';

export {
  // Department services
  getDepartments,
  getDepartmentById,
  getDepartmentByName,
  createDepartment,
  updateDepartment,
  deleteDepartment
} from './departmentService';

