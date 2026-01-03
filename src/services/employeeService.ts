import { Employee, EmployeePersonalInfo, EmployeeOfficialInfo } from '../types';
import { getSupabaseClient } from './supabaseClient';
import { isSupabaseConfigured } from './database';

/**
 * Get all employees with pagination and filtering
 */
export const getEmployees = async (
  page: number = 1,
  limit: number = 20,
  filters?: {
    status?: string;
    location?: string;
    department?: string;
  }
): Promise<{ data: Employee[]; total: number; page: number; totalPages: number }> => {
  if (!isSupabaseConfigured()) {
    // Mock data for development
    const mockEmployees: Employee[] = Array.from({ length: 30 }, (_, i) => ({
      id: `emp-${i + 1}`,
      employeeId: `EMP-${i + 1}`,
      name: `Employee ${i + 1}`,
      email: `employee${i + 1}@auralis.inc`,
      department: i % 3 === 0 ? 'Engineering' : i % 3 === 1 ? 'Sales' : 'Marketing',
      location: 'Headquarters',
      title: 'Software Engineer',
      status: 'Active'
    }));

    const filtered = mockEmployees.filter(emp => {
      if (filters?.status && emp.status !== filters.status) return false;
      if (filters?.location && emp.location !== filters.location) return false;
      if (filters?.department && emp.department !== filters.department) return false;
      return true;
    });

    const total = filtered.length;
    const totalPages = Math.ceil(total / limit);
    const data = filtered.slice((page - 1) * limit, page * limit);

    return {
      data,
      total,
      page,
      totalPages
    };
  }

  const supabase = await getSupabaseClient();

  // Build base query with joins to get denormalized data
  let query = supabase
    .from('employees')
    .select(`
      *,
      personal_info:personal_info (
        first_name,
        last_name,
        mobile_number,
        personal_email
      ),
      official_info:official_info (
        division,
        biometric_id,
        rfid_serial,
        agreement_signed,
        start_date,
        official_dob,
        official_email
      ),
      location:locations (
        name,
        city
      )
    `, { count: 'exact' })
    .order('employee_id', { ascending: true });

  // Apply filters
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.location) {
    query = query.eq('location.name', filters.location);
  }
  if (filters?.department) {
    query = query.eq('personal_info.division', filters.department);
  }

  // Apply pagination
  const offset = (page - 1) * limit;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching employees:', error);
    throw new Error('Failed to fetch employees');
  }

  const total = count || 0;
  const totalPages = Math.ceil(total / limit);

  // Transform data to match Employee interface
  const transformedData = (data || []).map(emp => ({
    id: emp.id,
    employeeId: emp.employee_id,
    clientId: emp.client_id,
    locationId: emp.location_id,
    personalInfoId: emp.personal_info_id,
    officialInfoId: emp.official_info_id,
    status: emp.status,
    // Denormalized fields
    name: `${emp.personal_info?.first_name || ''} ${emp.personal_info?.last_name || ''}`.trim(),
    email: emp.personal_info?.personal_email || emp.official_info?.official_email || '',
    department: emp.official_info?.division || '',
    location: emp.location?.name || '',
    title: emp.official_info?.division || '',
    // Full related objects
    personalInfo: emp.personal_info ? {
      id: emp.personal_info.id,
      firstName: emp.personal_info.first_name || '',
      lastName: emp.personal_info.last_name || '',
      gender: emp.personal_info.gender,
      mobileNumber: emp.personal_info.mobile_number,
      emergencyContactName: emp.personal_info.emergency_contact_name,
      emergencyContactNumber: emp.personal_info.emergency_contact_number,
      personalEmail: emp.personal_info.personal_email,
      linkedinUrl: emp.personal_info.linkedin_url,
      additionalComments: emp.personal_info.additional_comments
    } : undefined,
    officialInfo: emp.official_info ? {
      id: emp.official_info.id,
      division: emp.official_info.division,
      biometricId: emp.official_info.biometric_id,
      rfidSerial: emp.official_info.rfid_serial,
      agreementSigned: emp.official_info.agreement_signed,
      startDate: emp.official_info.start_date,
      officialDob: emp.official_info.official_dob,
      officialEmail: emp.official_info.official_email
    } : undefined
  }));

  return {
    data: transformedData,
    total,
    page,
    totalPages
  };
};

/**
 * Get employee by ID
 */
export const getEmployeeById = async (id: string): Promise<Employee | null> => {
  if (!isSupabaseConfigured()) {
    return {
      id,
      employeeId: 'EMP-001',
      name: 'Employee 1',
      email: 'employee1@auralis.inc',
      department: 'Engineering',
      location: 'Headquarters',
      title: 'Software Engineer',
      status: 'Active'
    };
  }

  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from('employees')
    .select(`
      *,
      personal_info:personal_info (
        first_name,
        last_name,
        mobile_number,
        personal_email
      ),
      official_info:official_info (
        division,
        biometric_id,
        rfid_serial,
        agreement_signed,
        start_date,
        official_dob,
        official_email
      ),
      location:locations (
        name,
        city
      )
    `)
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching employee:', error);
    throw new Error('Failed to fetch employee');
  }

  if (!data) return null;

  return {
    id: data.id,
    employeeId: data.employee_id,
    clientId: data.client_id,
    locationId: data.location_id,
    personalInfoId: data.personal_info_id,
    officialInfoId: data.official_info_id,
    status: data.status,
    // Denormalized fields
    name: `${data.personal_info?.first_name || ''} ${data.personal_info?.last_name || ''}`.trim(),
    email: data.personal_info?.personal_email || data.official_info?.official_email || '',
    department: data.official_info?.division || '',
    location: data.location?.name || '',
    title: data.official_info?.division || '',
    // Full related objects
    personalInfo: data.personal_info ? {
      id: data.personal_info.id,
      firstName: data.personal_info.first_name || '',
      lastName: data.personal_info.last_name || '',
      gender: data.personal_info.gender,
      mobileNumber: data.personal_info.mobile_number,
      emergencyContactName: data.personal_info.emergency_contact_name,
      emergencyContactNumber: data.personal_info.emergency_contact_number,
      personalEmail: data.personal_info.personal_email,
      linkedinUrl: data.personal_info.linkedin_url,
      additionalComments: data.personal_info.additional_comments
    } : undefined,
    officialInfo: data.official_info ? {
      id: data.official_info.id,
      division: data.official_info.division,
      biometricId: data.official_info.biometric_id,
      rfidSerial: data.official_info.rfid_serial,
      agreementSigned: data.official_info.agreement_signed,
      startDate: data.official_info.start_date,
      officialDob: data.official_info.official_dob,
      officialEmail: data.official_info.official_email
    } : undefined
  };
};

/**
 * Create a new employee
 */
export const createEmployee = async (
  employee: Omit<Employee, 'id' | 'employeeId' | 'personalInfo' | 'officialInfo'>,
  personalInfo: Omit<EmployeePersonalInfo, 'id'>,
  officialInfo: Omit<EmployeeOfficialInfo, 'id'>
): Promise<Employee> => {
  if (!isSupabaseConfigured()) {
    // Mock implementation for development
    return {
      ...employee,
      id: `emp-${Date.now()}`,
      employeeId: `EMP-${Date.now()}`,
      personalInfo,
      officialInfo
    };
  }

  const supabase = await getSupabaseClient();

  // Create personal info first
  const { data: personalData, error: personalError } = await supabase
    .from('personal_info')
    .insert({
      first_name: personalInfo.firstName,
      last_name: personalInfo.lastName,
      gender: personalInfo.gender,
      mobile_number: personalInfo.mobileNumber,
      emergency_contact_name: personalInfo.emergencyContactName,
      emergency_contact_number: personalInfo.emergencyContactNumber,
      personal_email: personalInfo.personalEmail,
      linkedin_url: personalInfo.linkedinUrl,
      additional_comments: personalInfo.additionalComments
    })
    .select()
    .single();

  if (personalError) {
    console.error('Error creating personal info:', personalError);
    throw new Error('Failed to create employee personal info');
  }

  // Create official info
  const { data: officialData, error: officialError } = await supabase
    .from('official_info')
    .insert({
      division: officialInfo.division,
      biometric_id: officialInfo.biometricId,
      rfid_serial: officialInfo.rfidSerial,
      agreement_signed: officialInfo.agreementSigned,
      start_date: officialInfo.startDate,
      official_dob: officialInfo.officialDob,
      official_email: officialInfo.officialEmail
    })
    .select()
    .single();

  if (officialError) {
    console.error('Error creating official info:', officialError);
    throw new Error('Failed to create employee official info');
  }

  // Create employee record
  const { data: employeeData, error: employeeError } = await supabase
    .from('employees')
    .insert({
      client_id: employee.clientId,
      location_id: employee.locationId,
      personal_info_id: personalData.id,
      official_info_id: officialData.id,
      status: employee.status
    })
    .select()
    .single();

  if (employeeError) {
    console.error('Error creating employee:', employeeError);
    throw new Error('Failed to create employee');
  }

  return {
    id: employeeData.id,
    employeeId: employeeData.employee_id,
    clientId: employeeData.client_id,
    locationId: employeeData.location_id,
    personalInfoId: employeeData.personal_info_id,
    officialInfoId: employeeData.official_info_id,
    status: employeeData.status,
    name: `${personalData.first_name || ''} ${personalData.last_name || ''}`.trim(),
    email: personalData.personal_email || officialData.official_email || '',
    department: officialData.division || '',
    location: '',
    title: officialData.division || '',
    personalInfo: {
      id: personalData.id,
      firstName: personalData.first_name || '',
      lastName: personalData.last_name || '',
      gender: personalData.gender,
      mobileNumber: personalData.mobile_number,
      emergencyContactName: personalData.emergency_contact_name,
      emergencyContactNumber: personalData.emergency_contact_number,
      personalEmail: personalData.personal_email,
      linkedinUrl: personalData.linkedin_url,
      additionalComments: personalData.additional_comments
    },
    officialInfo: {
      id: officialData.id,
      division: officialData.division,
      biometricId: officialData.biometric_id,
      rfidSerial: officialData.rfid_serial,
      agreementSigned: officialData.agreement_signed,
      startDate: officialData.start_date,
      officialDob: officialData.official_dob,
      officialEmail: officialData.official_email
    }
  };
};

/**
 * Update an employee
 */
export const updateEmployee = async (
  id: string,
  updates: Partial<Employee>
): Promise<Employee> => {
  if (!isSupabaseConfigured()) {
    // Mock implementation for development
    return {
      id,
      employeeId: updates.employeeId || 'EMP-001',
      name: updates.name || 'Employee 1',
      email: updates.email || 'employee1@auralis.inc',
      department: updates.department || 'Engineering',
      location: updates.location || 'Headquarters',
      title: updates.title || 'Software Engineer',
      status: updates.status || 'Active'
    };
  }

  const supabase = await getSupabaseClient();

  // Update employee record
  const { data: employeeData, error: employeeError } = await supabase
    .from('employees')
    .update({
      client_id: updates.clientId,
      location_id: updates.locationId,
      personal_info_id: updates.personalInfoId,
      official_info_id: updates.officialInfoId,
      status: updates.status
    })
    .eq('id', id)
    .select()
    .single();

  if (employeeError) {
    console.error('Error updating employee:', employeeError);
    throw new Error('Failed to update employee');
  }

  // Get related data for response
  const { data, error } = await supabase
    .from('employees')
    .select(`
      *,
      personal_info:personal_info (
        first_name,
        last_name,
        mobile_number,
        personal_email
      ),
      official_info:official_info (
        division,
        biometric_id,
        rfid_serial,
        agreement_signed,
        start_date,
        official_dob,
        official_email
      ),
      location:locations (
        name,
        city
      )
    `)
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching updated employee:', error);
    throw new Error('Failed to fetch updated employee');
  }

  if (!data) throw new Error('Employee not found');

  return {
    id: data.id,
    employeeId: data.employee_id,
    clientId: data.client_id,
    locationId: data.location_id,
    personalInfoId: data.personal_info_id,
    officialInfoId: data.official_info_id,
    status: data.status,
    // Denormalized fields
    name: `${data.personal_info?.first_name || ''} ${data.personal_info?.last_name || ''}`.trim(),
    email: data.personal_info?.personal_email || data.official_info?.official_email || '',
    department: data.official_info?.division || '',
    location: data.location?.name || '',
    title: data.official_info?.division || '',
    // Full related objects
    personalInfo: data.personal_info ? {
      id: data.personal_info.id,
      firstName: data.personal_info.first_name || '',
      lastName: data.personal_info.last_name || '',
      gender: data.personal_info.gender,
      mobileNumber: data.personal_info.mobile_number,
      emergencyContactName: data.personal_info.emergency_contact_name,
      emergencyContactNumber: data.personal_info.emergency_contact_number,
      personalEmail: data.personal_info.personal_email,
      linkedinUrl: data.personal_info.linkedin_url,
      additionalComments: data.personal_info.additional_comments
    } : undefined,
    officialInfo: data.official_info ? {
      id: data.official_info.id,
      division: data.official_info.division,
      biometricId: data.official_info.biometric_id,
      rfidSerial: data.official_info.rfid_serial,
      agreementSigned: data.official_info.agreement_signed,
      startDate: data.official_info.start_date,
      officialDob: data.official_info.official_dob,
      officialEmail: data.official_info.official_email
    } : undefined
  };
};

/**
 * Delete an employee
 */
export const deleteEmployee = async (id: string): Promise<void> => {
  if (!isSupabaseConfigured()) {
    // Mock implementation for development
    return;
  }

  const supabase = await getSupabaseClient();

  // Get employee data to find related records
  const { data: employeeData, error: fetchError } = await supabase
    .from('employees')
    .select('personal_info_id, official_info_id')
    .eq('id', id)
    .single();

  if (fetchError) {
    console.error('Error fetching employee for deletion:', fetchError);
    throw new Error('Failed to fetch employee for deletion');
  }

  // Delete employee record
  const { error: employeeError } = await supabase
    .from('employees')
    .delete()
    .eq('id', id);

  if (employeeError) {
    console.error('Error deleting employee:', employeeError);
    throw new Error('Failed to delete employee');
  }

  // Delete related personal info
  if (employeeData?.personal_info_id) {
    const { error: personalError } = await supabase
      .from('personal_info')
      .delete()
      .eq('id', employeeData.personal_info_id);

    if (personalError) {
      console.warn('Warning: Failed to delete personal info:', personalError);
    }
  }

  // Delete related official info
  if (employeeData?.official_info_id) {
    const { error: officialError } = await supabase
      .from('official_info')
      .delete()
      .eq('id', employeeData.official_info_id);

    if (officialError) {
      console.warn('Warning: Failed to delete official info:', officialError);
    }
  }
};

/**
 * Get employees by status
 */
export const getEmployeesByStatus = async (status: string): Promise<Employee[]> => {
  if (!isSupabaseConfigured()) {
    return [];
  }

  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from('employees')
    .select(`
      *,
      personal_info:personal_info (
        first_name,
        last_name,
        personal_email
      ),
      official_info:official_info (
        division,
        official_email
      ),
      location:locations (
        name
      )
    `)
    .eq('status', status)
    .order('employee_id', { ascending: true });

  if (error) {
    console.error('Error fetching employees by status:', error);
    throw new Error('Failed to fetch employees by status');
  }

  return (data || []).map(emp => ({
    id: emp.id,
    employeeId: emp.employee_id,
    clientId: emp.client_id,
    locationId: emp.location_id,
    personalInfoId: emp.personal_info_id,
    officialInfoId: emp.official_info_id,
    status: emp.status,
    name: `${emp.personal_info?.first_name || ''} ${emp.personal_info?.last_name || ''}`.trim(),
    email: emp.personal_info?.personal_email || emp.official_info?.official_email || '',
    department: emp.official_info?.division || '',
    location: emp.location?.name || '',
    title: emp.official_info?.division || ''
  }));
};

/**
 * Get employees by location
 */
export const getEmployeesByLocation = async (locationId: string): Promise<Employee[]> => {
  if (!isSupabaseConfigured()) {
    return [];
  }

  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from('employees')
    .select(`
      *,
      personal_info:personal_info (
        first_name,
        last_name,
        personal_email
      ),
      official_info:official_info (
        division,
        official_email
      ),
      location:locations (
        name
      )
    `)
    .eq('location_id', locationId)
    .order('employee_id', { ascending: true });

  if (error) {
    console.error('Error fetching employees by location:', error);
    throw new Error('Failed to fetch employees by location');
  }

  return (data || []).map(emp => ({
    id: emp.id,
    employeeId: emp.employee_id,
    clientId: emp.client_id,
    locationId: emp.location_id,
    personalInfoId: emp.personal_info_id,
    officialInfoId: emp.official_info_id,
    status: emp.status,
    name: `${emp.personal_info?.first_name || ''} ${emp.personal_info?.last_name || ''}`.trim(),
    email: emp.personal_info?.personal_email || emp.official_info?.official_email || '',
    department: emp.official_info?.division || '',
    location: emp.location?.name || '',
    title: emp.official_info?.division || ''
  }));
};
