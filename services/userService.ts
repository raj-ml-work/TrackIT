/**
 * User Service
 * 
 * Handles all database operations for Users (system users, not employees)
 */

import { UserAccount, UserRole, UserStatus } from '../types';
import { getSupabaseClient } from './supabaseClient';
import { hashPassword } from './passwordUtil';

const TABLE_NAME = 'users';

/**
 * Get all users
 */
export const getUsers = async (): Promise<UserAccount[]> => {
  try {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(transformUserFromDB);
  } catch (error) {
    console.error('Error fetching users:', error);
    throw error;
  }
};

/**
 * Get a single user by ID
 */
export const getUserById = async (id: string): Promise<UserAccount | null> => {
  try {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!data) return null;

    return transformUserFromDB(data);
  } catch (error) {
    console.error('Error fetching user:', error);
    throw error;
  }
};

/**
 * Get user by email
 */
export const getUserByEmail = async (email: string): Promise<UserAccount | null> => {
  try {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;

    return transformUserFromDB(data);
  } catch (error) {
    console.error('Error fetching user by email:', error);
    throw error;
  }
};

/**
 * Create a new user
 * Creates user in both Supabase Auth and the users table
 * 
 * Note: This uses signUp which may require email confirmation unless disabled in Supabase settings.
 * For production, consider using a server-side endpoint with service role key for admin user creation.
 */
export const createUser = async (user: Omit<UserAccount, 'id' | 'lastLogin'>, password: string): Promise<UserAccount> => {
  try {
    // Check if email already exists in users table
    const existing = await getUserByEmail(user.email);
    if (existing) {
      throw new Error(`User with email "${user.email}" already exists`);
    }

    const supabase = await getSupabaseClient();
    const hashedPassword = await hashPassword(password);
    // Create user record in users table (custom auth)
    const userData = transformUserToDB({
      ...user,
      passwordHash: hashedPassword
    });
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .insert(userData)
      .select()
      .single();

    if (error) throw error;

    return transformUserFromDB(data);
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
};

/**
 * Update an existing user
 */
export const updateUser = async (user: UserAccount): Promise<UserAccount> => {
  try {
    const supabase = await getSupabaseClient();
    
    // First, get the current user data to compare changes
    const { data: currentUserData, error: fetchError } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('id', user.id)
      .single();

    if (fetchError) throw fetchError;
    
    const currentUser = transformUserFromDB(currentUserData);
    
    const userData = transformUserToDB(user);
    
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .update(userData)
      .eq('id', user.id)
      .select()
      .single();

    if (error) throw error;

    const updatedUser = transformUserFromDB(data);
    
    // Log changes for audit purposes
    const changes = getUserChanges(currentUser, updatedUser);
    if (changes.length > 0) {
      console.log(`User update audit: ${changes.join(', ')}`);
    }

    return updatedUser;
  } catch (error) {
    console.error('Error updating user:', error);
    throw error;
  }
};

/**
 * Update user password
 */
export const updateUserPassword = async (userId: string, newPassword: string): Promise<void> => {
  try {
    const supabase = await getSupabaseClient();
    const hashedPassword = await hashPassword(newPassword);
    
    const { error } = await supabase
      .from(TABLE_NAME)
      .update({ password_hash: hashedPassword })
      .eq('id', userId);

    if (error) throw error;
  } catch (error) {
    console.error('Error updating password:', error);
    throw error;
  }
};

/**
 * Delete a user
 */
export const deleteUser = async (id: string): Promise<void> => {
  try {
    const supabase = await getSupabaseClient();
    const { error } = await supabase
      .from(TABLE_NAME)
      .delete()
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
};

/**
 * Update last login timestamp
 */
export const updateLastLogin = async (userId: string): Promise<void> => {
  try {
    const supabase = await getSupabaseClient();
    const { error } = await supabase
      .from(TABLE_NAME)
      .update({ last_login: new Date().toISOString() })
      .eq('id', userId);

    if (error) throw error;
  } catch (error) {
    console.error('Error updating last login:', error);
    // Don't throw - this is not critical
  }
};

/**
 * Transform database format to app format
 */
const transformUserFromDB = (dbUser: any): UserAccount => {
  const lastLogin = dbUser.last_login 
    ? formatLastLogin(dbUser.last_login)
    : '—';

  return {
    id: dbUser.id,
    name: dbUser.name,
    email: dbUser.email,
    role: dbUser.role,
    status: dbUser.status,
    lastLogin,
    passwordHash: dbUser.password_hash
  };
};

/**
 * Compare two users and return a list of changes
 */
const getUserChanges = (oldUser: UserAccount, newUser: UserAccount): string[] => {
  const changes: string[] = [];
  
  if (oldUser.name !== newUser.name) {
    changes.push(`name changed from "${oldUser.name}" to "${newUser.name}"`);
  }
  
  if (oldUser.status !== newUser.status) {
    changes.push(`status changed from "${oldUser.status}" to "${newUser.status}"`);
  }
  
  if (oldUser.email !== newUser.email) {
    changes.push(`email changed from "${oldUser.email}" to "${newUser.email}"`);
  }
  
  if (oldUser.role !== newUser.role) {
    changes.push(`role changed from "${oldUser.role}" to "${newUser.role}"`);
  }
  
  return changes;
};

/**
 * Transform app format to database format
 */
const transformUserToDB = (user: UserAccount | Omit<UserAccount, 'id' | 'lastLogin'>): any => {
  return {
    id: 'id' in user ? user.id : undefined,
    name: user.name,
    email: user.email.toLowerCase(),
    role: user.role,
    status: user.status,
    password_hash: 'passwordHash' in user ? (user as any).passwordHash : undefined
  };
};

/**
 * Format last login timestamp to relative time
 */
const formatLastLogin = (timestamp: string): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

// Export the helper function for testing
export { getUserChanges };
