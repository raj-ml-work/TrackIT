import { 
  Asset, 
  Employee, 
  Location, 
  Department, 
  UserAccount, 
  DashboardMetrics,
  AssetComment,
  EmployeePersonalInfo,
  EmployeeOfficialInfo
} from '../types';
import { getSupabaseClient } from './supabaseClient';
import { isSupabaseConfigured } from './database';

/**
 * Get dashboard metrics with optimized queries
 */
export const getDashboardMetrics = async (): Promise<DashboardMetrics> => {
  if (!isSupabaseConfigured()) {
    // Mock data for development
    return {
      totalAssets: 156,
      totalValue: 285000,
      utilizationRate: 87.5,
      expiringWarranties: 12
    };
  }

  const supabase = await getSupabaseClient();

  // Get total assets count
  const { count: totalAssets, error: assetsError } = await supabase
    .from('assets')
    .select('*', { count: 'exact', head: true });

  if (assetsError) {
    console.error('Error fetching total assets:', assetsError);
    throw new Error('Failed to fetch dashboard metrics');
  }

  // Get total value (sum of cost)
  const { data: totalValueData, error: valueError } = await supabase
    .from('assets')
    .select('cost')
    .is('cost', null);

  if (valueError) {
    console.error('Error fetching total value:', valueError);
    throw new Error('Failed to fetch dashboard metrics');
  }

  const totalValue = totalValueData?.reduce((sum, asset) => sum + (asset.cost || 0), 0) || 0;

  // Get utilization rate (assets in use / total assets)
  const { count: inUseAssets, error: utilizationError } = await supabase
    .from('assets')
    .select('*', { count: 'exact', head: true })
    .in('status', ['In Use', 'Assigned']);

  if (utilizationError) {
    console.error('Error fetching utilization rate:', utilizationError);
    throw new Error('Failed to fetch dashboard metrics');
  }

  const utilizationRate = totalAssets && totalAssets > 0 
    ? Math.round((inUseAssets || 0) / totalAssets * 100) 
    : 0;

  // Get expiring warranties (within next 30 days)
  const today = new Date();
  const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
  
  const { count: expiringWarranties, error: warrantyError } = await supabase
    .from('assets')
    .select('*', { count: 'exact', head: true })
    .gte('warranty_expiry', today.toISOString().split('T')[0])
    .lte('warranty_expiry', thirtyDaysFromNow.toISOString().split('T')[0]);

  if (warrantyError) {
    console.error('Error fetching expiring warranties:', warrantyError);
    throw new Error('Failed to fetch dashboard metrics');
  }

  return {
    totalAssets: totalAssets || 0,
    totalValue,
    utilizationRate,
    expiringWarranties: expiringWarranties || 0
  };
};

/**
 * Get all assets with pagination and filtering
 */
export const getAssets = async (
  page: number = 1,
  limit: number = 20,
  filters?: {
    status?: string | string[];
    type?: string;
    location?: string;
    assignedTo?: string;
  }
): Promise<{ data: Asset[]; total: number; page: number; totalPages: number }> => {
  if (!isSupabaseConfigured()) {
    // Mock data for development
    const mockAssets: Asset[] = Array.from({ length: 50 }, (_, i) => ({
      id: `asset-${i + 1}`,
      name: `Laptop ${i + 1}`,
      type: 'Laptop' as any,
      status: i % 3 === 0 ? 'In Use' : 'Available',
      serialNumber: `SN-${i + 1}`,
      assignedTo: i % 3 === 0 ? `Employee ${i + 1}` : undefined,
      purchaseDate: '2024-01-01',
      warrantyExpiry: '2025-01-01',
      cost: 1500 + i * 100,
      location: 'Headquarters'
    }));

    const filtered = mockAssets.filter(asset => {
      if (filters?.status) {
        const statusFilter = Array.isArray(filters.status) ? filters.status : [filters.status];
        if (!statusFilter.includes(asset.status)) return false;
      }
      if (filters?.type && asset.type !== filters.type) return false;
      if (filters?.location && asset.location !== filters.location) return false;
      if (filters?.assignedTo && asset.assignedTo !== filters.assignedTo) return false;
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

  // Build base query
  let query = supabase
    .from('assets')
    .select('*', { count: 'exact' })
    .order('name', { ascending: true });

  // Apply filters
  if (filters?.status) {
    if (Array.isArray(filters.status)) {
      query = query.in('status', filters.status);
    } else {
      query = query.eq('status', filters.status);
    }
  }
  if (filters?.type) {
    query = query.eq('type', filters.type);
  }
  if (filters?.location) {
    query = query.eq('location', filters.location);
  }
  if (filters?.assignedTo) {
    query = query.eq('assigned_to', filters.assignedTo);
  }

  // Apply pagination
  const offset = (page - 1) * limit;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching assets:', error);
    throw new Error('Failed to fetch assets');
  }

  const total = count || 0;
  const totalPages = Math.ceil(total / limit);

  return {
    data: data || [],
    total,
    page,
    totalPages
  };
};

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
 * Get all locations
 */
export const getLocations = async (): Promise<Location[]> => {
  if (!isSupabaseConfigured()) {
    return [
      { id: 'loc-1', name: 'Headquarters', city: 'New York' },
      { id: 'loc-2', name: 'Branch Office', city: 'San Francisco' }
    ];
  }

  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching locations:', error);
    throw new Error('Failed to fetch locations');
  }

  return data || [];
};

/**
 * Get all departments
 */
export const getDepartments = async (): Promise<Department[]> => {
  if (!isSupabaseConfigured()) {
    return [
      { id: 'dept-1', name: 'Engineering', description: 'Software development team' },
      { id: 'dept-2', name: 'Sales', description: 'Sales and marketing team' },
      { id: 'dept-3', name: 'HR', description: 'Human resources team' }
    ];
  }

  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from('departments')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching departments:', error);
    throw new Error('Failed to fetch departments');
  }

  return data || [];
};

/**
 * Add a new department
 */
export const addDepartment = async (department: Omit<Department, 'id'>): Promise<Department> => {
  if (!isSupabaseConfigured()) {
    return {
      id: `dept-${Date.now()}`,
      name: department.name,
      description: department.description || ''
    };
  }

  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from('departments')
    .insert([{
      name: department.name.trim(),
      description: department.description || null
    }])
    .select()
    .single();

  if (error) {
    console.error('Error adding department:', error);
    throw new Error('Failed to add department');
  }

  return data;
};

/**
 * Delete a department
 */
export const deleteDepartment = async (id: string): Promise<void> => {
  if (!isSupabaseConfigured()) {
    return;
  }

  const supabase = await getSupabaseClient();
  const { error } = await supabase
    .from('departments')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting department:', error);
    throw new Error('Failed to delete department');
  }
};

/**
 * Get all users
 */
export const getUsers = async (): Promise<UserAccount[]> => {
  if (!isSupabaseConfigured()) {
    return [
      { id: 'u-1001', name: 'Alicia Vega', email: 'admin@auralis.inc', role: 'Admin', status: 'Active', lastLogin: 'Just now' },
      { id: 'u-1002', name: 'Liam Chen', email: 'user@auralis.inc', role: 'User', status: 'Active', lastLogin: 'Just now' }
    ];
  }

  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching users:', error);
    throw new Error('Failed to fetch users');
  }

  return data || [];
};

/**
 * Get asset comments
 */
export const getAssetComments = async (assetId: string): Promise<AssetComment[]> => {
  if (!isSupabaseConfigured()) {
    return [
      {
        id: 'comment-1',
        assetId,
        authorName: 'System',
        message: 'Asset created',
        type: 'System',
        createdAt: new Date().toISOString()
      }
    ];
  }

  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from('asset_comments')
    .select('*')
    .eq('asset_id', assetId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching asset comments:', error);
    throw new Error('Failed to fetch asset comments');
  }

  return data || [];
};

/**
 * Add asset comment
 */
export const addAssetComment = async (
  assetId: string,
  message: string,
  authorName: string,
  authorId?: string
): Promise<AssetComment> => {
  if (!isSupabaseConfigured()) {
    return {
      id: `comment-${Date.now()}`,
      assetId,
      authorName,
      authorId,
      message,
      type: 'Note',
      createdAt: new Date().toISOString()
    };
  }

  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from('asset_comments')
    .insert({
      asset_id: assetId,
      author_name: authorName,
      author_id: authorId,
      message,
      type: 'Note'
    })
    .select()
    .single();

  if (error) {
    console.error('Error adding asset comment:', error);
    throw new Error('Failed to add asset comment');
  }

  return data;
};

/**
 * Get asset by ID
 */
export const getAssetById = async (id: string): Promise<Asset | null> => {
  if (!isSupabaseConfigured()) {
    return {
      id,
      name: 'Laptop 1',
      type: 'Laptop' as any,
      status: 'In Use',
      serialNumber: 'SN-001',
      assignedTo: 'Employee 1',
      purchaseDate: '2024-01-01',
      warrantyExpiry: '2025-01-01',
      cost: 1500,
      location: 'Headquarters'
    };
  }

  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from('assets')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching asset:', error);
    throw new Error('Failed to fetch asset');
  }

  return data || null;
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
