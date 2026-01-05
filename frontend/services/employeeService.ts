/**
 * Employee Service
 *
 * Handles all database operations for Employees
 */

import { Employee, EmployeeQuery, EmployeeStatus, PaginatedResult, UserAccount } from '../types';
import { getSupabaseClient } from './supabaseClient';
import { apiFetchJson, isApiConfigured } from './apiClient';
import { isAdmin, getPermissionError } from './permissionUtil';
import { createEmployeePersonalInfo, updateEmployeePersonalInfo } from './employeePersonalInfoService';
import { createEmployeeOfficialInfo, updateEmployeeOfficialInfo } from './employeeOfficialInfoService';

const TABLE_NAME = 'employees';

/**
 * Get all employees with related data
 */
export const getEmployees = async (): Promise<Employee[]> => {
  try {
    if (isApiConfigured()) {
      return await apiFetchJson<Employee[]>('/employees');
    }

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
 * Get a paginated list of employees with optional search and department filtering
 */
export const getEmployeesPage = async (query: EmployeeQuery): Promise<PaginatedResult<Employee>> => {
  try {
    if (isApiConfigured()) {
      const params = new URLSearchParams();
      params.set('page', String(query.page || 1));
      params.set('pageSize', String(query.pageSize || 20));
      if (query.search) params.set('search', query.search);
      if (query.department) params.set('department', query.department);
      return await apiFetchJson<PaginatedResult<Employee>>(`/employees/page?${params.toString()}`);
    }

    const supabase = await getSupabaseClient();
    const page = Math.max(1, query.page || 1);
    const pageSize = Math.max(1, Math.min(query.pageSize || 20, 100));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const search = query.search?.trim();
    const departmentFilter = query.department?.trim();
    const normalizedDepartmentFilter = departmentFilter && departmentFilter !== 'All'
      ? departmentFilter
      : undefined;
    const departmentPattern = normalizedDepartmentFilter
      ? normalizedDepartmentFilter.replace(/%/g, '\\%').replace(/_/g, '\\_')
      : undefined;

    if (search) {
      const pattern = `%${search.toLowerCase()}%`;
      let shouldUseFallback = !!normalizedDepartmentFilter;
      if (!shouldUseFallback) {
        try {
          let searchRequest = supabase
            .from('employee_search_view')
            .select('employee_id', { count: 'exact' })
            .ilike('search_text', pattern)
            .order('created_at', { ascending: false })
            .range(from, to);

          const { data: matches, error: searchError, count } = await searchRequest;
          if (searchError) throw searchError;

          const ids = (matches || []).map((row: { employee_id: string }) => row.employee_id);
          if (ids.length === 0) {
            return {
              data: [],
              total: count || 0,
              page,
              pageSize
            };
          }

          const { data, error } = await supabase
            .from(TABLE_NAME)
            .select(
              `
        *,
        personal_info:employee_personal_info(*),
        official_info:employee_official_info(*),
        location:locations(name, city, country),
        client:clients(name, code)
      `
            )
            .in('id', ids)
            .order('created_at', { ascending: false });

          if (error) throw error;

          const order = new Map(ids.map((id, index) => [id, index]));
          const sorted = (data || []).sort((a, b) => {
            return (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0);
          });

          return {
            data: sorted.map(transformEmployeeFromDB),
            total: count || 0,
            page,
            pageSize
          };
        } catch (error: any) {
          if (error?.code !== 'PGRST205') {
            throw error;
          }
          console.warn('employee_search_view missing; falling back to table search.');
          shouldUseFallback = true;
        }
      }

      if (shouldUseFallback) {
        let fallbackRequest = supabase
          .from(TABLE_NAME)
          .select(
            `
        *,
        personal_info:employee_personal_info(*),
        official_info:employee_official_info(*),
        location:locations(name, city, country),
        client:clients(name, code)
      `,
            { count: 'exact' }
          )
          .order('created_at', { ascending: false })
          .range(from, to);

        if (departmentPattern) {
          fallbackRequest = fallbackRequest.ilike('official_info.division', departmentPattern);
        }

        fallbackRequest = fallbackRequest.or([`employee_id.ilike.${pattern}`, `name.ilike.${pattern}`].join(','));
        fallbackRequest = fallbackRequest.or(
          [
            `first_name.ilike.${pattern}`,
            `last_name.ilike.${pattern}`,
            `personal_email.ilike.${pattern}`
          ].join(','),
          { foreignTable: 'employee_personal_info' }
        );
        fallbackRequest = fallbackRequest.or(
          [`official_email.ilike.${pattern}`, `division.ilike.${pattern}`].join(','),
          { foreignTable: 'employee_official_info' }
        );

        const { data, error: fallbackError, count } = await fallbackRequest;
        if (fallbackError) throw fallbackError;

        return {
          data: (data || []).map(transformEmployeeFromDB),
          total: count || 0,
          page,
          pageSize
        };
      }
    }

    let request = supabase
      .from(TABLE_NAME)
      .select(
        `
        *,
        personal_info:employee_personal_info(*),
        official_info:employee_official_info(*),
        location:locations(name, city, country),
        client:clients(name, code)
      `,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(from, to);

    if (departmentPattern) {
      request = request.ilike('official_info.division', departmentPattern);
    }

    const { data, error, count } = await request;

    if (error) throw error;

    return {
      data: (data || []).map(transformEmployeeFromDB),
      total: count || 0,
      page,
      pageSize
    };
  } catch (error) {
    console.error('Error fetching employees page:', error);
    throw error;
  }
};

/**
 * Get a single employee by ID with related data
 */
export const getEmployeeById = async (id: string): Promise<Employee | null> => {
  try {
    if (isApiConfigured()) {
      return await apiFetchJson<Employee>(`/employees/${id}`);
    }

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
    if (isApiConfigured()) {
      return await apiFetchJson<Employee | null>(`/employees?employeeId=${encodeURIComponent(employeeId)}`);
    }

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
 * @param employee Employee data to create
 * @param currentUser Current authenticated user for permission check
 */
export const createEmployee = async (employee: Omit<Employee, 'id'>, currentUser: UserAccount | null = null): Promise<Employee> => {
  try {
    // Check permission - only admins can create employees
    if (!isAdmin(currentUser)) {
      throw new Error(getPermissionError('create', currentUser?.role || null));
    }

    if (isApiConfigured()) {
      return await apiFetchJson<Employee>('/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(employee)
      });
    }

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
        throw new Error('Unable to save employee right now. Please try again.');
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
 * @param employee Employee data to update
 * @param currentUser Current authenticated user for permission check
 */
export const updateEmployee = async (employee: Employee, currentUser: UserAccount | null = null): Promise<Employee> => {
  try {
    // Check permission - only admins can update employees
    if (!isAdmin(currentUser)) {
      throw new Error(getPermissionError('update', currentUser?.role || null));
    }

    if (isApiConfigured()) {
      const currentEmployee = await apiFetchJson<Employee>(`/employees/${employee.id}`);
      const mergedEmployee = mergeEmployeeForAudit(currentEmployee, employee);
      const changes = getEmployeeChanges(currentEmployee, mergedEmployee);
      const auditEntry = changes.length > 0 ? buildEmployeeAuditEntry(changes, currentUser) : null;
      const payload = auditEntry
        ? {
            ...employee,
            personalInfo: {
              ...(mergedEmployee.personalInfo || {}),
              additionalComments: appendAuditComments(
                mergedEmployee.personalInfo?.additionalComments,
                auditEntry
              )
            }
          }
        : employee;

      const updatedEmployee = await apiFetchJson<Employee>(`/employees/${employee.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (auditEntry && updatedEmployee.personalInfo) {
        updatedEmployee.personalInfo = {
          ...updatedEmployee.personalInfo,
          additionalComments: (payload as Employee).personalInfo?.additionalComments
        };
      }

      return updatedEmployee;
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
    let personalInfoId = employee.personalInfoId || currentEmployee.personalInfoId;
    if (employee.personalInfo) {
      const resolvedPersonalInfoId = employee.personalInfo.id || personalInfoId;
      if (resolvedPersonalInfoId) {
        const updatedPersonalInfo = await updateEmployeePersonalInfo({
          ...employee.personalInfo,
          id: resolvedPersonalInfoId
        });
        personalInfoId = updatedPersonalInfo.id;
      } else {
        const createdPersonalInfo = await createEmployeePersonalInfo(employee.personalInfo);
        personalInfoId = createdPersonalInfo.id;
      }
    }

    let officialInfoId = employee.officialInfoId || currentEmployee.officialInfoId;
    if (employee.officialInfo) {
      const resolvedOfficialInfoId = employee.officialInfo.id || officialInfoId;
      if (resolvedOfficialInfoId) {
        const updatedOfficialInfo = await updateEmployeeOfficialInfo({
          ...employee.officialInfo,
          id: resolvedOfficialInfoId
        });
        officialInfoId = updatedOfficialInfo.id;
      } else {
        const createdOfficialInfo = await createEmployeeOfficialInfo(employee.officialInfo);
        officialInfoId = createdOfficialInfo.id;
      }
    }
    
    const employeeData = transformEmployeeToDB({
      ...employee,
      personalInfoId,
      officialInfoId
    });
    
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

    const updatedEmployee = transformEmployeeFromDB(data);
    
    // Log changes for audit purposes
    const changes = getEmployeeChanges(currentEmployee, updatedEmployee);
    if (changes.length > 0) {
      const auditEntry = buildEmployeeAuditEntry(changes, currentUser);
      if (updatedEmployee.personalInfo?.id) {
        const updatedPersonalInfo = await updateEmployeePersonalInfo({
          ...updatedEmployee.personalInfo,
          additionalComments: appendAuditComments(
            updatedEmployee.personalInfo.additionalComments,
            auditEntry
          )
        });
        updatedEmployee.personalInfo = updatedPersonalInfo;
      }
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
    // Check permission - only admins can delete employees
    if (!isAdmin(currentUser)) {
      throw new Error(getPermissionError('delete', currentUser?.role || null));
    }

    if (isApiConfigured()) {
      await apiFetchJson<{ ok: boolean }>(`/employees/${id}`, { method: 'DELETE' });
      return;
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

  const oldPersonal = oldEmployee.personalInfo || {};
  const newPersonal = newEmployee.personalInfo || {};
  if (oldPersonal.gender !== newPersonal.gender) {
    changes.push(`gender changed from "${oldPersonal.gender || 'N/A'}" to "${newPersonal.gender || 'N/A'}"`);
  }
  if (oldPersonal.mobileNumber !== newPersonal.mobileNumber) {
    changes.push(`mobile number changed from "${oldPersonal.mobileNumber || 'N/A'}" to "${newPersonal.mobileNumber || 'N/A'}"`);
  }
  if (oldPersonal.personalEmail !== newPersonal.personalEmail) {
    changes.push(`personal email changed from "${oldPersonal.personalEmail || 'N/A'}" to "${newPersonal.personalEmail || 'N/A'}"`);
  }
  if (oldPersonal.emergencyContactName !== newPersonal.emergencyContactName) {
    changes.push(`emergency contact name changed from "${oldPersonal.emergencyContactName || 'N/A'}" to "${newPersonal.emergencyContactName || 'N/A'}"`);
  }
  if (oldPersonal.emergencyContactNumber !== newPersonal.emergencyContactNumber) {
    changes.push(`emergency contact number changed from "${oldPersonal.emergencyContactNumber || 'N/A'}" to "${newPersonal.emergencyContactNumber || 'N/A'}"`);
  }
  if (oldPersonal.linkedinUrl !== newPersonal.linkedinUrl) {
    changes.push(`LinkedIn URL changed from "${oldPersonal.linkedinUrl || 'N/A'}" to "${newPersonal.linkedinUrl || 'N/A'}"`);
  }

  const oldOfficial = oldEmployee.officialInfo || {};
  const newOfficial = newEmployee.officialInfo || {};
  if (oldOfficial.officialEmail !== newOfficial.officialEmail) {
    changes.push(`official email changed from "${oldOfficial.officialEmail || 'N/A'}" to "${newOfficial.officialEmail || 'N/A'}"`);
  }
  if (oldOfficial.startDate !== newOfficial.startDate) {
    changes.push(`start date changed from "${oldOfficial.startDate || 'N/A'}" to "${newOfficial.startDate || 'N/A'}"`);
  }
  if (oldOfficial.officialDob !== newOfficial.officialDob) {
    changes.push(`date of birth changed from "${oldOfficial.officialDob || 'N/A'}" to "${newOfficial.officialDob || 'N/A'}"`);
  }
  if (oldOfficial.biometricId !== newOfficial.biometricId) {
    changes.push(`biometric ID changed from "${oldOfficial.biometricId || 'N/A'}" to "${newOfficial.biometricId || 'N/A'}"`);
  }
  if (oldOfficial.rfidSerial !== newOfficial.rfidSerial) {
    changes.push(`RFID serial changed from "${oldOfficial.rfidSerial || 'N/A'}" to "${newOfficial.rfidSerial || 'N/A'}"`);
  }
  if (oldOfficial.agreementSigned !== newOfficial.agreementSigned) {
    changes.push(
      `agreement signed changed from "${oldOfficial.agreementSigned ? 'Yes' : 'No'}" to "${newOfficial.agreementSigned ? 'Yes' : 'No'}"`
    );
  }
  
  return changes;
};

const mergeEmployeeForAudit = (current: Employee, updated: Employee): Employee => {
  return {
    ...current,
    ...updated,
    personalInfo: {
      ...(current.personalInfo || {}),
      ...(updated.personalInfo || {})
    },
    officialInfo: {
      ...(current.officialInfo || {}),
      ...(updated.officialInfo || {})
    }
  };
};

const buildEmployeeAuditEntry = (changes: string[], currentUser: UserAccount | null): string => {
  const author = currentUser?.name || 'System';
  return `[${new Date().toISOString()}] ${author}: ${changes.join('; ')}`;
};

const AUDIT_COMMENT_SEPARATOR = '\n---\n';

const splitEmployeeComments = (comments: string | undefined): string[] => {
  if (!comments || comments.trim().length === 0) {
    return [];
  }

  if (comments.includes(AUDIT_COMMENT_SEPARATOR)) {
    return comments
      .split(AUDIT_COMMENT_SEPARATOR)
      .map(entry => entry.trim())
      .filter(Boolean);
  }

  const lines = comments
    .split('\n')
    .map(entry => entry.trim())
    .filter(Boolean);
  const looksLikeAudit = lines.length > 1 && lines.every(line => line.startsWith('[') && line.includes(']'));
  return looksLikeAudit ? lines : [comments.trim()];
};

const joinEmployeeComments = (entries: string[]): string => {
  return entries.join(AUDIT_COMMENT_SEPARATOR);
};

const appendAuditComments = (existing: string | undefined, entry: string): string => {
  const entries = splitEmployeeComments(existing);
  entries.push(entry);
  return joinEmployeeComments(entries);
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

// Export the helper function for testing
export { getEmployeeChanges };
