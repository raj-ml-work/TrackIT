/**
 * Employee Service
 * 
 * Handles all database operations for Employees
 */

import { Employee, EmployeeStatus } from '../types';
import { getSupabaseClient } from './supabaseClient';

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
 */
export const createEmployee = async (employee: Omit<Employee, 'id'>): Promise<Employee> => {
  try {
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
 */
export const updateEmployee = async (employee: Employee): Promise<Employee> => {
  try {
    const supabase = await getSupabaseClient();
    const employeeData = transformEmployeeToDB(employee);
    
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .update(employeeData)
      .eq('id', employee.id)
      .select()
      .single();

    if (error) throw error;

    return transformEmployeeFromDB(data);
  } catch (error) {
    console.error('Error updating employee:', error);
    throw error;
  }
};

/**
 * Delete an employee
 */
export const deleteEmployee = async (id: string): Promise<void> => {
  try {
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

