/**
 * User Service
 *
 * Handles all database operations for Users (system users, not employees)
 */

import { UserAccount, UserRole, UserStatus } from '../types';
import { getSupabaseClient } from './supabaseClient';
import { apiFetchJson, isApiConfigured } from './apiClient';
import { hashPassword, hashPasswordSHA1 } from './passwordUtil';
import { isAdmin, getPermissionError } from './permissionUtil';

const TABLE_NAME = 'users';

/**
 * Get all users
 */
export const getUsers = async (): Promise<UserAccount[]> => {
  try {
    if (isApiConfigured()) {
      return await apiFetchJson<UserAccount[]>('/users');
    }

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
    if (isApiConfigured()) {
      return await apiFetchJson<UserAccount>(`/users/${id}`);
    }

    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('id', id)
      .maybeSingle(); // Use maybeSingle() to handle 0 or 1 rows

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
    if (isApiConfigured()) {
      return await apiFetchJson<UserAccount | null>(`/users?email=${encodeURIComponent(email)}`);
    }

    const normalizedEmail = email.trim().toLowerCase();
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('email', normalizedEmail)
      .maybeSingle(); // Use maybeSingle() instead of single() to handle 0 or 1 rows

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) {
      const { data: ilikeData, error: ilikeError } = await supabase
        .from(TABLE_NAME)
        .select('*')
        .ilike('email', normalizedEmail)
        .maybeSingle();
      if (ilikeError && ilikeError.code !== 'PGRST116') throw ilikeError;
      if (!ilikeData) return null;
      return transformUserFromDB(ilikeData);
    }

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
 * @param user User data to create
 * @param password User password
 * @param currentUser Current authenticated user for permission check
 */
export const createUser = async (user: Omit<UserAccount, 'id' | 'lastLogin'>, password: string, currentUser: UserAccount | null = null): Promise<UserAccount> => {
  try {
    // Check permission - only admins can create users
    if (!isAdmin(currentUser)) {
      throw new Error(getPermissionError('manageUsers', currentUser?.role || null));
    }

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
 * @param user User data to update
 * @param requestingUser Current authenticated user for permission check
 */
export const updateUser = async (user: UserAccount, requestingUser: UserAccount | null = null): Promise<UserAccount> => {
  try {
    // Check permission - only admins can update users
    if (!isAdmin(requestingUser)) {
      throw new Error(getPermissionError('manageUsers', requestingUser?.role || null));
    }

    const supabase = await getSupabaseClient();
    
    // First, get the current user data to compare changes
    const { data: existingUserData, error: fetchError } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('id', user.id)
      .single();

    if (fetchError) throw fetchError;
    
    const existingUser = transformUserFromDB(existingUserData);
    
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
    const changes = getUserChanges(existingUser, updatedUser);
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
 * Reset user password - supports both generated and manual password options
 * This function is designed for admin-use only to help users who have forgotten their passwords
 * @param userId The ID of the user whose password should be reset
 * @param requestingUser The admin user requesting the password reset
 * @param passwordOption Optional password to set manually (if not provided, generates a temporary password)
 * @returns The password that was set (either the provided one or the generated temporary password)
 */
export const resetUserPassword = async (
  userId: string,
  requestingUser: UserAccount | null = null,
  passwordOption?: string
): Promise<string> => {
  try {
    // Check permission - only admins can reset passwords
    if (!isAdmin(requestingUser)) {
      throw new Error(getPermissionError('manageUsers', requestingUser?.role || null));
    }

    // Prevent admins from resetting their own password (security measure)
    if (requestingUser && requestingUser.id === userId) {
      throw new Error('Admins cannot reset their own password. Please ask another admin for assistance.');
    }

    // Get the target user
    const targetUser = await getUserById(userId);
    if (!targetUser) {
      throw new Error(`User with ID ${userId} not found`);
    }

    // Use provided password or generate a temporary one
    const passwordToSet = passwordOption || generateSecurePassword();
    const hashedPassword = await hashPassword(passwordToSet);

    // Update the user's password
    const supabase = await getSupabaseClient();
    const { error } = await supabase
      .from(TABLE_NAME)
      .update({ password_hash: hashedPassword })
      .eq('id', userId);

    if (error) throw error;

    // Log the password reset action for audit purposes
    console.log(`Password reset by admin ${requestingUser?.name || 'unknown'} for user ${targetUser.name} (${targetUser.email})`);

    return passwordToSet;
  } catch (error) {
    console.error('Error resetting password:', error);
    throw error;
  }
};

/**
 * Generate a secure temporary password
 * @returns A randomly generated secure password
 */
const generateSecurePassword = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*()_+';
  let password = '';
  
  // Ensure password contains at least one of each character type
  const getRandomChar = (charSet: string) => charSet.charAt(Math.floor(Math.random() * charSet.length));
  
  password += getRandomChar('ABCDEFGHJKLMNPQRSTUVWXYZ'); // Uppercase
  password += getRandomChar('abcdefghijkmnpqrstuvwxyz'); // Lowercase
  password += getRandomChar('23456789'); // Number
  password += getRandomChar('!@#$%^&*()_+'); // Special
  
  // Fill the rest to make 12 characters total
  for (let i = password.length; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  // Shuffle the characters to avoid predictable patterns
  return password.split('').sort(() => Math.random() - 0.5).join('');
};

/**
 * Delete a user
 * @param id User ID to delete
 * @param requestingUser Current authenticated user for permission check
 */
export const deleteUser = async (id: string, requestingUser: UserAccount | null = null): Promise<void> => {
  try {
    // Check permission - only admins can delete users
    if (!isAdmin(requestingUser)) {
      throw new Error(getPermissionError('manageUsers', requestingUser?.role || null));
    }

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
    role: dbUser.role as UserRole,
    status: dbUser.status as UserStatus,
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
