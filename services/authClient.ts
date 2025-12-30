import { LoginCredentials, AuthSession, UserAccount, UserRole, UserStatus } from '../types';
import { getSupabaseClient } from './supabaseClient';
import { dbConfig } from './database';
import * as userService from './userService';
import { hashPassword, isSha256Hash } from './passwordUtil';

// Fallback mock users for development when Supabase is not configured
const DEFAULT_USERS = [
  {
    id: 'u-1001',
    name: 'Alicia Vega',
    email: 'admin@trackit.com',
    password: 'admin123',
    role: UserRole.ADMIN,
    status: UserStatus.ACTIVE,
    lastLogin: 'Just now'
  },
  {
    id: 'u-1002',
    name: 'Liam Chen',
    email: 'user@auralis.inc',
    password: 'user123',
    role: UserRole.USER,
    status: UserStatus.ACTIVE,
    lastLogin: 'Just now'
  }
];

/**
 * Check if Supabase is configured (still used for data access, not auth)
 */
const isSupabaseConfigured = (): boolean => {
  return dbConfig.type === 'supabase' && 
         !!dbConfig.supabaseUrl && 
         !!dbConfig.supabaseAnonKey;
};

/**
 * Initialize default admin user if none exists.
 * Uses users table only (custom auth), not Supabase Auth.
 */
export const initializeDefaultAdmin = async (): Promise<void> => {
  if (!isSupabaseConfigured()) {
    // In mock mode, default users are already available
    return;
  }

  try {
    const supabase = await getSupabaseClient();
    const defaultAdminEmail = 'admin@trackit.com';
    const defaultAdminPassword = 'admin123';
    const defaultAdminName = 'System Administrator';
    const defaultAdminPasswordHash = await hashPassword(defaultAdminPassword);

    // Try to use the database function first (if available)
    try {
      const { error: funcError } = await supabase.rpc('initialize_default_admin');
      if (!funcError) {
        console.log('✅ Default admin initialization attempted via database function');
      }
      // If function doesn't exist or RLS blocks it, continue with manual approach
    } catch (funcErr) {
      // Function might not exist or RLS might block it - that's okay
    }

    // Check if the default admin already exists in users table
    const { data: defaultAdminRecords, error: defaultAdminCheckError } = await supabase
      .from('users')
      .select('id')
      .eq('email', defaultAdminEmail)
      .limit(1);

    if (defaultAdminCheckError) {
      if (defaultAdminCheckError.code === '42501' || defaultAdminCheckError.message?.includes('permission denied')) {
        console.warn('⚠️  Cannot check for default admin user due to RLS policies.');
        console.warn('📝 Please create an admin user manually with:');
        console.warn('   Email: admin@trackit.com, Password: admin123 (auto-confirmed)');
        console.warn('   Then run in SQL Editor: SELECT initialize_default_admin();');
        return;
      }
      console.error('Error checking for default admin:', defaultAdminCheckError);
      return;
    }

    const defaultAdminExists = !!(defaultAdminRecords && defaultAdminRecords.length > 0);

    if (defaultAdminExists) {
      console.log('✅ Default admin account present in users table with password admin123');
      return;
    }

    // Fallback: Check if any admin user exists
    const { data: existingAdmins, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'Admin')
      .limit(1);

    // If RLS blocks the check, that's okay - user will need to create admin manually
    if (checkError) {
      if (checkError.code === '42501' || checkError.message?.includes('permission denied')) {
        console.warn('⚠️  Cannot check for admin users due to RLS policies.');
        console.warn('📝 Please create an admin user manually:');
        console.warn('   1. Go to Supabase Dashboard → Authentication → Users → Add User');
        console.warn('   2. Email: admin@trackit.com, Password: admin123 (auto-confirmed)');
        console.warn('   3. Then run in SQL Editor: SELECT initialize_default_admin();');
        return;
      }
      console.error('Error checking for existing admin:', checkError);
      return;
    }

    // If admin exists, we're done
    if (existingAdmins && existingAdmins.length > 0) {
      return;
    }

    // No admin exists - create default admin directly in users table
    console.log('No admin user found. Attempting to create default admin in users table...');

    const { error: userError } = await supabase
      .from('users')
      .insert({
        name: defaultAdminName,
        email: defaultAdminEmail,
        role: 'Admin',
        status: 'Active',
        password_hash: defaultAdminPasswordHash
      });

    if (userError) {
      if (userError.code === '42501' || userError.message?.includes('permission denied')) {
        console.warn('⚠️  RLS policy prevents creating admin user from client.');
        console.warn('📝 Please run in Supabase SQL Editor: SELECT initialize_default_admin();');
      } else {
        console.error('Error creating admin user record:', userError);
      }
    } else {
      console.log('✅ Default admin user created successfully!');
      console.log(`📧 Email: ${defaultAdminEmail}`);
      console.log(`🔑 Password: ${defaultAdminPassword}`);
      console.log('⚠️  IMPORTANT: Please change the password after first login!');
    }
  } catch (error) {
    console.error('Error initializing default admin:', error);
    // Don't throw - allow app to continue
  }
};

/**
 * Register a new user (called when admin creates a user)
 */
export const registerUser = async (userData: UserAccount & { password: string }): Promise<void> => {
  if (isSupabaseConfigured()) {
    await userService.createUser(
      {
        name: userData.name,
        email: userData.email,
        role: userData.role,
        status: userData.status
      },
      userData.password
    );
  } else {
    // Fallback to localStorage for development
    const stored = localStorage.getItem('auralis_users');
    const users = stored ? JSON.parse(stored) : DEFAULT_USERS;
    users.push({
      id: userData.id,
      name: userData.name,
      email: userData.email,
      password: userData.password,
      role: userData.role,
      status: userData.status,
      lastLogin: userData.lastLogin
    });
    localStorage.setItem('auralis_users', JSON.stringify(users));
  }
};

/**
 * Login function - uses Supabase Auth when configured, falls back to mock for development
 */
export const login = async (credentials: LoginCredentials): Promise<AuthSession> => {
  // Custom auth: check users table directly
  if (isSupabaseConfigured()) {
    const user = await userService.getUserByEmail(credentials.email);

    if (!user || !user.passwordHash) {
      throw new Error('Invalid email or password');
    }

    // Support hashed passwords (preferred) and fall back to plain for legacy rows
    if (isSha256Hash(user.passwordHash)) {
      const hashedInput = await hashPassword(credentials.password);
      if (user.passwordHash !== hashedInput) {
        throw new Error('Invalid email or password');
      }
    } else {
      if (user.passwordHash !== credentials.password) {
        throw new Error('Invalid email or password');
      }
    }

    if (user.status === UserStatus.INACTIVE) {
      throw new Error('Account is inactive. Please contact your administrator.');
    }

    await userService.updateLastLogin(user.id);

    return {
      user,
      rememberMe: credentials.rememberMe || false
    };
  }

  // Fallback to mock for development
  await new Promise(resolve => setTimeout(resolve, 800));

  const stored = localStorage.getItem('auralis_users');
  const users = stored ? JSON.parse(stored) : DEFAULT_USERS;
  const user = users.find(
    (u: any) => u.email === credentials.email && u.password === credentials.password
  );

  if (!user) {
    throw new Error('Invalid email or password');
  }

  if (user.status === UserStatus.INACTIVE) {
    throw new Error('Account is inactive. Please contact your administrator.');
  }

  const { password, ...userWithoutPassword } = user;

  return {
    user: userWithoutPassword,
    token: `mock-jwt-token-${user.id}`,
    rememberMe: credentials.rememberMe || false
  };
};

/**
 * Logout function - uses Supabase Auth when configured
 */
export const logout = async (): Promise<void> => {
  // Clear session from storage
  localStorage.removeItem('auralis_session');
};

/**
 * Restore session - uses Supabase Auth when configured
 * Returns Promise for Supabase, synchronous for mock
 */
export const restoreSession = async (): Promise<AuthSession | null> => {
  // Custom auth uses local storage session only
  const stored = localStorage.getItem('auralis_session');
  if (!stored) return null;
  
  try {
    return JSON.parse(stored) as AuthSession;
  } catch {
    return null;
  }
};

/**
 * Save session to storage
 */
export const saveSession = (session: AuthSession): void => {
  if (session.rememberMe) {
    localStorage.setItem('auralis_session', JSON.stringify(session));
  }
};

/**
 * Update password - uses Supabase Auth when configured
 */
export const updatePassword = async (
  currentPassword: string,
  newPassword: string,
  userId?: string
): Promise<void> => {
  // Validation
  if (currentPassword === newPassword) {
    throw new Error('New password must be different from current password');
  }
  
  if (newPassword.length < 6) {
    throw new Error('Password must be at least 6 characters');
  }
 
  if (isSupabaseConfigured()) {
    if (!userId) throw new Error('User ID required to update password');
    
    // First, verify the current password is correct
    const user = await userService.getUserById(userId);
    if (!user || !user.passwordHash) {
      throw new Error('User not found');
    }
    
    // Validate current password
    let isCurrentPasswordValid = false;
    if (isSha256Hash(user.passwordHash)) {
      const hashedInput = await hashPassword(currentPassword);
      isCurrentPasswordValid = user.passwordHash === hashedInput;
    } else {
      // Fallback for legacy plain text passwords
      isCurrentPasswordValid = user.passwordHash === currentPassword;
    }
    
    if (!isCurrentPasswordValid) {
      throw new Error('Current password is incorrect');
    }
    
    // Update to the new password
    await userService.updateUserPassword(userId, newPassword);
    return;
  }
 
  // Fallback for development
  await new Promise(resolve => setTimeout(resolve, 800));
  console.log('Password updated successfully (mock)');
};
