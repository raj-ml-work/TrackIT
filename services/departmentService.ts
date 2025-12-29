/**
 * Department Service
 *
 * Handles all database operations for Departments
 */

import { Department, UserAccount, Employee } from '../types';
import { getSupabaseClient } from './supabaseClient';
import { isAdmin, getPermissionError } from './permissionUtil';

const TABLE_NAME = 'departments';

/**
 * Get all departments
 */
export const getDepartments = async (): Promise<Department[]> => {
  try {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;

    return (data || []).map(transformDepartmentFromDB);
  } catch (error) {
    console.error('Error fetching departments:', error);
    throw error;
  }
};

/**
 * Get a single department by ID
 */
export const getDepartmentById = async (id: string): Promise<Department | null> => {
  try {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!data) return null;

    return transformDepartmentFromDB(data);
  } catch (error) {
    console.error('Error fetching department:', error);
    throw error;
  }
};

/**
 * Get department by name
 */
export const getDepartmentByName = async (name: string): Promise<Department | null> => {
  try {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('name', name)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;

    return transformDepartmentFromDB(data);
  } catch (error) {
    console.error('Error fetching department by name:', error);
    throw error;
  }
};

/**
 * Create a new department
 * @param department Department data to create
 * @param currentUser Current authenticated user for permission check
 */
export const createDepartment = async (department: Omit<Department, 'id'>, currentUser: UserAccount | null = null): Promise<Department> => {
  try {
    // Check permission - only admins can create departments
    if (!isAdmin(currentUser)) {
      throw new Error(getPermissionError('create', currentUser?.role || null));
    }

    const supabase = await getSupabaseClient();
    const departmentData = transformDepartmentToDB(department);
    
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .insert(departmentData)
      .select()
      .single();

    if (error) throw error;

    return transformDepartmentFromDB(data);
  } catch (error) {
    console.error('Error creating department:', error);
    throw error;
  }
};

/**
 * Update an existing department
 * @param department Department data to update
 * @param currentUser Current authenticated user for permission check
 */
export const updateDepartment = async (department: Department, currentUser: UserAccount | null = null): Promise<Department> => {
  try {
    // Check permission - only admins can update departments
    if (!isAdmin(currentUser)) {
      throw new Error(getPermissionError('update', currentUser?.role || null));
    }

    const supabase = await getSupabaseClient();
    const departmentData = transformDepartmentToDB(department);
    
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .update(departmentData)
      .eq('id', department.id)
      .select()
      .single();

    if (error) throw error;

    return transformDepartmentFromDB(data);
  } catch (error) {
    console.error('Error updating department:', error);
    throw error;
  }
};

/**
 * Delete a department
 * @param id Department ID to delete
 * @param currentUser Current authenticated user for permission check
 */
export const deleteDepartment = async (id: string, currentUser: UserAccount | null = null): Promise<void> => {
  try {
    // Check permission - only admins can delete departments
    if (!isAdmin(currentUser)) {
      throw new Error(getPermissionError('delete', currentUser?.role || null));
    }

    // Check foreign key constraints - ensure no employees are assigned to this department
    const supabase = await getSupabaseClient();
    const { data: employees, error: employeesError } = await supabase
      .from('employees')
      .select('id')
      .eq('department', id);

    if (employeesError) throw employeesError;

    if (employees && employees.length > 0) {
      throw new Error(`Cannot delete department. It has ${employees.length} employee(s) assigned. Please reassign them first.`);
    }

    const { error } = await supabase
      .from(TABLE_NAME)
      .delete()
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting department:', error);
    throw error;
  }
};

/**
 * Transform database format to app format
 */
const transformDepartmentFromDB = (dbDepartment: any): Department => {
  return {
    id: dbDepartment.id,
    name: dbDepartment.name,
    description: dbDepartment.description || undefined
  };
};

/**
 * Transform app format to database format
 */
const transformDepartmentToDB = (department: Department | Omit<Department, 'id'>): any => {
  return {
    id: 'id' in department ? department.id : undefined,
    name: department.name,
    description: department.description || null
  };
};