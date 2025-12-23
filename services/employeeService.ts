/**
 * Employee Service
 * 
 * Handles all database operations for Employees
 */

import { Employee, EmployeeStatus, EmployeePersonalInfo, EmployeeOfficialInfo } from '../types';
import { getSupabaseClient } from './supabaseClient';
import { createEmployeePersonalInfo, updateEmployeePersonalInfo } from './employeePersonalInfoService';
import { createEmployeeOfficialInfo, updateEmployeeOfficialInfo } from './employeeOfficialInfoService';

const TABLE_NAME = 'employees';

/**
 * Get all employees with related data
 */
export const getEmployees = async (): Promise<Employee[]> => {
  try {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select(`
        *,
        personal_info:employee_personal_info(*),
        official_info:employee_official_info(*),
        location:locations(name, city, country),
        client:clients(name, code)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(transformEmployeeFromDB);
  } catch (error) {
    console.error('Error fetching employees:', error);
    throw error;
  }
};

/**
 * Get a single employee by ID with related data
 */
export const getEmployeeById = async (id: string): Promise<Employee | null> => {
  try {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select(`
        *,
        personal_info:employee_personal_info(*),
        official_info:employee_official_info(*),
        location:locations(name, city, country),
        client:clients(name, code)
      `)
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
 * Get employee by employee ID (unique identifier) with related data
 */
export const getEmployeeByEmployeeId = async (employeeId: string): Promise<Employee | null> => {
  try {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select(`
        *,
        personal_info:employee_personal_info(*),
        official_info:employee_official_info(*),
        location:locations(name, city, country),
        client:clients(name, code)
      `)
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

    // Create personal info if provided
    let personalInfoId: string | undefined;
    if (employee.personalInfo) {
      const personalInfo = await createEmployeePersonalInfo(employee.personalInfo);
      personalInfoId = personalInfo.id;
    }

    // Create official info if provided
    let officialInfoId: string | undefined;
    if (employee.officialInfo) {
      const officialInfo = await createEmployeeOfficialInfo(employee.officialInfo);
      officialInfoId = officialInfo.id;
    }

    const supabase = await getSupabaseClient();
    
    // Build name from personal info for legacy compatibility
    const employeeName = employee.personalInfo 
      ? `${employee.personalInfo.firstName || ''} ${employee.personalInfo.lastName || ''}`.trim()
      : employee.name || employee.employeeId; // Fallback to employeeId if no name
    
    const employeeData = transformEmployeeToDB({
      ...employee,
      name: employeeName, // Include name for legacy compatibility
      personalInfoId,
      officialInfoId
    });
    
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .insert(employeeData)
      .select(`
        *,
        personal_info:employee_personal_info(*),
        official_info:employee_official_info(*),
        location:locations(name, city, country),
        client:clients(name, code)
      `)
      .single();

    if (error) {
      // Provide more meaningful error messages
      if (error.code === 'PGRST116') {
        throw new Error('Failed to create employee. Please ensure all required information is provided.');
      } else if (error.code === '23502') {
        const column = error.message.match(/column "(\w+)"/)?.[1] || 'unknown';
        throw new Error(`Required field "${column}" is missing. Please fill in all required fields.`);
      } else if (error.code === '23505') {
        // Unique constraint violation
        throw new Error(`Employee ID "${employee.employeeId}" already exists. Please use a different ID.`);
      } else if (error.code === '23503') {
        // Foreign key violation
        throw new Error('Invalid reference. Please check that the selected location exists.');
      }
      throw error;
    }

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
    
    // Update personal info if provided
    if (employee.personalInfo) {
      if (employee.personalInfoId && employee.personalInfo.id) {
        // Update existing personal info
        await updateEmployeePersonalInfo(employee.personalInfo);
      } else if (!employee.personalInfoId) {
        // Create new personal info if it doesn't exist
        const { id, ...personalInfoData } = employee.personalInfo;
        const personalInfo = await createEmployeePersonalInfo(personalInfoData);
        employee.personalInfoId = personalInfo.id;
      }
    }

    // Update official info if provided
    if (employee.officialInfo) {
      if (employee.officialInfoId && employee.officialInfo.id) {
        // Update existing official info
        await updateEmployeeOfficialInfo(employee.officialInfo);
      } else if (!employee.officialInfoId) {
        // Create new official info if it doesn't exist
        const { id, ...officialInfoData } = employee.officialInfo;
        const officialInfo = await createEmployeeOfficialInfo(officialInfoData);
        employee.officialInfoId = officialInfo.id;
      }
    }

    const employeeData = transformEmployeeToDB(employee);
    
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .update(employeeData)
      .eq('id', employee.id)
      .select(`
        *,
        personal_info:employee_personal_info(*),
        official_info:employee_official_info(*),
        location:locations(name, city, country),
        client:clients(name, code)
      `)
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
  const personalInfo = dbEmployee.personal_info;
  const officialInfo = dbEmployee.official_info;
  const location = dbEmployee.location;
  const client = dbEmployee.client;

  // Build name from personal info
  const name = personalInfo 
    ? `${personalInfo.first_name || ''} ${personalInfo.last_name || ''}`.trim()
    : undefined;

  // Get email from official info first, then personal info
  const email = officialInfo?.official_email || personalInfo?.personal_email;

  // Get department from official info division
  const department = officialInfo?.division;

  // Get location name
  const locationName = location?.name;

  return {
    id: dbEmployee.id,
    employeeId: dbEmployee.employee_id,
    clientId: dbEmployee.client_id,
    locationId: dbEmployee.location_id,
    personalInfoId: dbEmployee.personal_info_id,
    officialInfoId: dbEmployee.official_info_id,
    status: dbEmployee.status as EmployeeStatus,
    // Denormalized fields for backward compatibility
    name: name || undefined,
    email: email || undefined,
    department: department || undefined,
    location: locationName || undefined,
    title: undefined, // Can be added to official_info if needed
    // Full related objects
    personalInfo: personalInfo ? {
      id: personalInfo.id,
      firstName: personalInfo.first_name,
      lastName: personalInfo.last_name,
      gender: personalInfo.gender,
      mobileNumber: personalInfo.mobile_number,
      emergencyContactName: personalInfo.emergency_contact_name,
      emergencyContactNumber: personalInfo.emergency_contact_number,
      personalEmail: personalInfo.personal_email,
      linkedinUrl: personalInfo.linkedin_url,
      additionalComments: personalInfo.additional_comments
    } : undefined,
    officialInfo: officialInfo ? {
      id: officialInfo.id,
      division: officialInfo.division,
      biometricId: officialInfo.biometric_id,
      rfidSerial: officialInfo.rfid_serial,
      agreementSigned: officialInfo.agreement_signed,
      startDate: officialInfo.start_date,
      officialDob: officialInfo.official_dob,
      officialEmail: officialInfo.official_email
    } : undefined
  };
};

/**
 * Transform app format to database format
 */
const transformEmployeeToDB = (employee: Employee | Omit<Employee, 'id'>): any => {
  // Build name from personal info if available, otherwise use provided name
  const name = 'name' in employee && employee.name 
    ? employee.name 
    : (employee.personalInfo 
        ? `${employee.personalInfo.firstName || ''} ${employee.personalInfo.lastName || ''}`.trim()
        : employee.employeeId); // Fallback to employeeId
  
  return {
    id: 'id' in employee ? employee.id : undefined,
    employee_id: employee.employeeId.toUpperCase(),
    name: name || employee.employeeId, // Always provide name for legacy compatibility
    client_id: employee.clientId || null,
    location_id: employee.locationId || null,
    personal_info_id: employee.personalInfoId || null,
    official_info_id: employee.officialInfoId || null,
    status: employee.status
  };
};

