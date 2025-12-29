/**
 * Employee Service
 *
 * Handles all database operations for Employees
 */

import { Employee, EmployeeStatus, UserAccount } from '../types';
import { getSupabaseClient } from './supabaseClient';
import { canCreateOrUpdate, canDelete, getPermissionError } from './permissionUtil';

const TABLE_NAME = 'employees';

/**
 * Get all employees
 */
export const getEmployees = async (): Promise<Employee[]> => {
  try {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(transformEmployeeFromDB);
  } catch (error) {
    console.error('Error fetching employees:', error);
    throw error;
  }
};

/**
 * Get a single employee by ID
 */
export const getEmployeeById = async (id: string): Promise<Employee | null> => {
  try {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!data) return null;

    return transformEmployeeFromDB(data);
  } catch (error) {
    console.error('Error fetching employee:', error);
    throw error;
  }
};

/**
 * Get employee by employee ID (unique identifier)
 */
export const getEmployeeByEmployeeId = async (employeeId: string): Promise<Employee | null> => {
  try {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('employee_id', employeeId.toUpperCase())
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
    if (!data) return null;

    return transformEmployeeFromDB(data);
  } catch (error) {
    console.error('Error fetching employee by ID:', error);
    throw error;
  }
};

/**
 * Create a new employee
 * @param employee Employee data to create
 * @param currentUser Current authenticated user for permission check
 */
export const createEmployee = async (employee: Omit<Employee, 'id'>, currentUser: UserAccount | null = null): Promise<Employee> => {
  try {
    // Check permission
    if (!canCreateOrUpdate(currentUser)) {
      throw new Error(getPermissionError('create', currentUser?.role || null));
    }

    // Check if employee ID already exists
    const existing = await getEmployeeByEmployeeId(employee.employeeId);
    if (existing) {
      throw new Error(`Employee ID "${employee.employeeId}" already exists`);
    }

    const supabase = await getSupabaseClient();
    const employeeData = transformEmployeeToDB(employee);
    
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .insert(employeeData)
      .select()
      .single();

    if (error) throw error;

    return transformEmployeeFromDB(data);
  } catch (error) {
    console.error('Error creating employee:', error);
    throw error;
  }
};

/**
 * Update an existing employee
 * @param employee Employee data to update
 * @param currentUser Current authenticated user for permission check
 */
export const updateEmployee = async (employee: Employee, currentUser: UserAccount | null = null): Promise<Employee> => {
  try {
    // Check permission
    if (!canCreateOrUpdate(currentUser)) {
      throw new Error(getPermissionError('update', currentUser?.role || null));
    }

    const supabase = await getSupabaseClient();
    
    // First, get the current employee data to compare changes
    const { data: currentEmployeeData, error: fetchError } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('id', employee.id)
      .single();

    if (fetchError) throw fetchError;
    
    const currentEmployee = transformEmployeeFromDB(currentEmployeeData);
    
    const employeeData = transformEmployeeToDB(employee);
    
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .update(employeeData)
      .eq('id', employee.id)
      .select()
      .single();

    if (error) throw error;

    const updatedEmployee = transformEmployeeFromDB(data);
    
    // Log changes for audit purposes
    const changes = getEmployeeChanges(currentEmployee, updatedEmployee);
    if (changes.length > 0) {
      console.log(`Employee update audit: ${changes.join(', ')}`);
    }

    return updatedEmployee;
  } catch (error) {
    console.error('Error updating employee:', error);
    throw error;
  }
};

/**
 * Delete an employee
 * @param id Employee ID to delete
 * @param currentUser Current authenticated user for permission check
 */
export const deleteEmployee = async (id: string, currentUser: UserAccount | null = null): Promise<void> => {
  try {
    // Check permission
    if (!canDelete(currentUser)) {
      throw new Error(getPermissionError('delete', currentUser?.role || null));
    }

    const supabase = await getSupabaseClient();
    const { error } = await supabase
      .from(TABLE_NAME)
      .delete()
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting employee:', error);
    throw error;
  }
};

/**
 * Transform database format to app format
 */
const transformEmployeeFromDB = (dbEmployee: any): Employee => {
  return {
    id: dbEmployee.id,
    employeeId: dbEmployee.employee_id,
    name: dbEmployee.name,
    email: dbEmployee.email,
    department: dbEmployee.department,
    location: dbEmployee.location,
    title: dbEmployee.title,
    status: dbEmployee.status
  };
};

/**
 * Compare two employees and return a list of changes
 */
const getEmployeeChanges = (oldEmployee: Employee, newEmployee: Employee): string[] => {
  const changes: string[] = [];
  
  if (oldEmployee.name !== newEmployee.name) {
    changes.push(`name changed from "${oldEmployee.name}" to "${newEmployee.name}"`);
  }
  
  if (oldEmployee.status !== newEmployee.status) {
    changes.push(`status changed from "${oldEmployee.status}" to "${newEmployee.status}"`);
  }
  
  if (oldEmployee.email !== newEmployee.email) {
    changes.push(`email changed from "${oldEmployee.email || 'N/A'}" to "${newEmployee.email || 'N/A'}"`);
  }
  
  if (oldEmployee.department !== newEmployee.department) {
    changes.push(`department changed from "${oldEmployee.department || 'N/A'}" to "${newEmployee.department || 'N/A'}"`);
  }
  
  if (oldEmployee.location !== newEmployee.location) {
    changes.push(`location changed from "${oldEmployee.location || 'N/A'}" to "${newEmployee.location || 'N/A'}"`);
  }
  
  if (oldEmployee.title !== newEmployee.title) {
    changes.push(`title changed from "${oldEmployee.title || 'N/A'}" to "${newEmployee.title || 'N/A'}"`);
  }
  
  return changes;
};

/**
 * Transform app format to database format
 */
const transformEmployeeToDB = (employee: Employee | Omit<Employee, 'id'>): any => {
  return {
    id: 'id' in employee ? employee.id : undefined,
    employee_id: employee.employeeId.toUpperCase(),
    name: employee.name,
    email: employee.email || null,
    department: employee.department || null,
    location: employee.location || null,
    title: employee.title || null,
    status: employee.status
  };
};

// Export the helper function for testing
export { getEmployeeChanges };

