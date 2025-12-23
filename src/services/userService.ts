import { UserAccount, UserRole, UserStatus } from '../types';
import { getSupabaseClient } from './supabaseClient';
import { dbConfig } from './database';
import { hashPassword, isSha256Hash } from './passwordUtil';

/**
 * Check if Supabase is configured
 */
const isSupabaseConfigured = (): boolean => {
  return dbConfig.type === 'supabase' && 
         !!dbConfig.supabaseUrl && 
         !!dbConfig.supabaseAnonKey;
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

  return (data || []).map(user => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as UserRole,
    status: user.status as UserStatus,
    lastLogin: user.last_login || 'Never'
  }));
};

/**
 * Get user by ID
 */
export const getUserById = async (id: string): Promise<UserAccount | null> => {
  if (!isSupabaseConfigured()) {
    return {
      id,
      name: 'Alicia Vega',
      email: 'admin@auralis.inc',
      role: 'Admin',
      status: 'Active',
      lastLogin: 'Just now'
    };
  }

  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching user:', error);
    throw new Error('Failed to fetch user');
  }

  if (!data) return null;

  return {
    id: data.id,
    name: data.name,
    email: data.email,
    role: data.role as UserRole,
    status: data.status as UserStatus,
    lastLogin: data.last_login || 'Never',
    passwordHash: data.password_hash
  };
};

/**
 * Get user by email
 */
export const getUserByEmail = async (email: string): Promise<UserAccount | null> => {
  if (!isSupabaseConfigured()) {
    const mockUsers = [
      { id: 'u-1001', name: 'Alicia Vega', email: 'admin@auralis.inc', role: 'Admin', status: 'Active', lastLogin: 'Just now' },
      { id: 'u-1002', name: 'Liam Chen', email: 'user@auralis.inc', role: 'User', status: 'Active', lastLogin: 'Just now' }
    ];
    
    const user = mockUsers.find(u => u.email === email);
    return user || null;
  }

  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();

  if (error) {
    console.error('Error fetching user by email:', error);
    throw new Error('Failed to fetch user');
  }

  if (!data) return null;

  return {
    id: data.id,
    name: data.name,
    email: data.email,
    role: data.role as UserRole,
    status: data.status as UserStatus,
    lastLogin: data.last_login || 'Never',
    passwordHash: data.password_hash
  };
};

/**
 * Create a new user
 */
export const createUser = async (
  userData: Omit<UserAccount, 'id' | 'lastLogin' | 'passwordHash'>,
  password: string
): Promise<UserAccount> => {
  if (!isSupabaseConfigured()) {
    // Mock implementation for development
    return {
      ...userData,
      id: `u-${Date.now()}`,
      lastLogin: 'Just now',
      passwordHash: password // In mock mode, store plain text
    };
  }

  const supabase = await getSupabaseClient();
  const passwordHash = await hashPassword(password);

  const { data, error } = await supabase
    .from('users')
    .insert({
      name: userData.name,
      email: userData.email,
      role: userData.role,
      status: userData.status,
      password_hash: passwordHash
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating user:', error);
    throw new Error('Failed to create user');
  }

  return {
    id: data.id,
    name: data.name,
    email: data.email,
    role: data.role as UserRole,
    status: data.status as UserStatus,
    lastLogin: data.last_login || 'Never',
    passwordHash: data.password_hash
  };
};

/**
 * Update a user
 */
export const updateUser = async (
  id: string,
  updates: Partial<UserAccount>
): Promise<UserAccount> => {
  if (!isSupabaseConfigured()) {
    // Mock implementation for development
    return {
      id,
      name: updates.name || 'Alicia Vega',
      email: updates.email || 'admin@auralis.inc',
      role: updates.role || 'Admin',
      status: updates.status || 'Active',
      lastLogin: updates.lastLogin || 'Just now'
    };
  }

  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from('users')
    .update({
      name: updates.name,
      email: updates.email,
      role: updates.role,
      status: updates.status
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating user:', error);
    throw new Error('Failed to update user');
  }

  return {
    id: data.id,
    name: data.name,
    email: data.email,
    role: data.role as UserRole,
    status: data.status as UserStatus,
    lastLogin: data.last_login || 'Never'
  };
};

/**
 * Update user password
 */
export const updateUserPassword = async (id: string, newPassword: string): Promise<void> => {
  if (!isSupabaseConfigured()) {
    // Mock implementation for development
    return;
  }

  const supabase = await getSupabaseClient();
  const passwordHash = await hashPassword(newPassword);

  const { error } = await supabase
    .from('users')
    .update({
      password_hash: passwordHash
    })
    .eq('id', id);

  if (error) {
    console.error('Error updating user password:', error);
    throw new Error('Failed to update user password');
  }
};

/**
 * Update user last login
 */
export const updateLastLogin = async (id: string): Promise<void> => {
  if (!isSupabaseConfigured()) {
    // Mock implementation for development
    return;
  }

  const supabase = await getSupabaseClient();
  const { error } = await supabase
    .from('users')
    .update({
      last_login: new Date().toISOString()
    })
    .eq('id', id);

  if (error) {
    console.error('Error updating last login:', error);
    throw new Error('Failed to update last login');
  }
};

/**
 * Delete a user
 */
export const deleteUser = async (id: string): Promise<void> => {
  if (!isSupabaseConfigured()) {
    // Mock implementation for development
    return;
  }

  const supabase = await getSupabaseClient();
  const { error } = await supabase
    .from('users')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting user:', error);
    throw new Error('Failed to delete user');
  }
};

/**
 * Get users by role
 */
export const getUsersByRole = async (role: UserRole): Promise<UserAccount[]> => {
  if (!isSupabaseConfigured()) {
    return [];
  }

  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('role', role)
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching users by role:', error);
    throw new Error('Failed to fetch users by role');
  }

  return (data || []).map(user => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as UserRole,
    status: user.status as UserStatus,
    lastLogin: user.last_login || 'Never'
  }));
};

/**
 * Get users by status
 */
export const getUsersByStatus = async (status: UserStatus): Promise<UserAccount[]> => {
  if (!isSupabaseConfigured()) {
    return [];
  }

  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('status', status)
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching users by status:', error);
    throw new Error('Failed to fetch users by status');
  }

  return (data || []).map(user => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as UserRole,
    status: user.status as UserStatus,
    lastLogin: user.last_login || 'Never'
  }));
};