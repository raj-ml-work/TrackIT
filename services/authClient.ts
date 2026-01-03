import { LoginCredentials, AuthSession, UserAccount, UserRole, UserStatus } from '../types';
import { getSupabaseClient } from './supabaseClient';
import { dbConfig } from './database';
import * as userService from './userService';
import { hashPassword, hashPasswordSHA1, isSha256Hash, isSha1Hash } from './passwordUtil';

const apiBaseUrl = import.meta.env.VITE_API_URL || '';
const useApiAuth = (): boolean => Boolean(apiBaseUrl);

let accessToken: string | null = null;
let accessTokenExpiry: string | null = null;

const setAccessToken = (token: string | null, expiresAt?: string | null) => {
  accessToken = token;
  accessTokenExpiry = expiresAt ?? null;
};

export const getAccessToken = (): string | null => accessToken;

const apiRequest = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  if (!apiBaseUrl) {
    throw new Error('VITE_API_URL is not configured.');
  }

  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers,
    credentials: 'include'
  });

  if (!response.ok) {
    let message = 'Request failed.';
    try {
      const data = await response.json();
      message = data?.error || message;
    } catch {
      // Ignore JSON parse errors.
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
};

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
  if (useApiAuth()) {
    return;
  }

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
  const normalizedCredentials = {
    ...credentials,
    email: credentials.email.trim(),
    password: credentials.password
  };

  if (useApiAuth()) {
    const response = await apiRequest<{
      user: UserAccount;
      accessToken: string;
      expiresAt: string;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: normalizedCredentials.email,
        password: normalizedCredentials.password
      })
    });

    setAccessToken(response.accessToken, response.expiresAt);

    return {
      user: response.user,
      accessToken: response.accessToken,
      expiresAt: response.expiresAt,
      rememberMe: normalizedCredentials.rememberMe || false
    };
  }

  // Custom auth: check users table directly
  if (isSupabaseConfigured()) {
    const user = await userService.getUserByEmail(normalizedCredentials.email);

    if (!user || !user.passwordHash) {
      throw new Error('Invalid email or password');
    }

    // Support multiple hash formats for legacy compatibility
    let isPasswordValid = false;
    
    if (isSha256Hash(user.passwordHash)) {
      // SHA-256 (current standard)
      const hashedInput = await hashPassword(normalizedCredentials.password);
      isPasswordValid = user.passwordHash === hashedInput;
    } else if (isSha1Hash(user.passwordHash)) {
      // SHA-1 (legacy format)
      const hashedInput = await hashPasswordSHA1(normalizedCredentials.password);
      isPasswordValid = user.passwordHash === hashedInput;
    } else {
      // Plain text fallback (very old legacy)
      isPasswordValid = user.passwordHash === normalizedCredentials.password;
    }
    
    if (!isPasswordValid) {
      throw new Error('Invalid email or password');
    }

    if (user.status === UserStatus.INACTIVE) {
      throw new Error('Account is inactive. Please contact your administrator.');
    }

    await userService.updateLastLogin(user.id);

    return {
      user,
      rememberMe: normalizedCredentials.rememberMe || false
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
  if (useApiAuth()) {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch (error) {
      console.warn('Logout request failed:', error);
    } finally {
      setAccessToken(null, null);
    }
    return;
  }

  // Clear session from storage
  localStorage.removeItem('auralis_session');
};

export const refreshAccessToken = async (): Promise<{ accessToken: string; expiresAt: string } | null> => {
  if (!useApiAuth()) {
    return null;
  }

  try {
    const response = await apiRequest<{ accessToken: string; expiresAt: string }>('/auth/refresh', {
      method: 'POST'
    });
    setAccessToken(response.accessToken, response.expiresAt);
    return response;
  } catch (error) {
    setAccessToken(null, null);
    return null;
  }
};

/**
 * Restore session - uses Supabase Auth when configured
 * Returns Promise for Supabase, synchronous for mock
 */
export const restoreSession = async (): Promise<AuthSession | null> => {
  if (useApiAuth()) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) {
      return null;
    }

    const response = await apiRequest<{ user: UserAccount }>('/auth/me', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${refreshed.accessToken}`
      }
    });

    return {
      user: response.user,
      accessToken: refreshed.accessToken,
      expiresAt: refreshed.expiresAt,
      rememberMe: false
    };
  }

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
  if (useApiAuth()) {
    return;
  }

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
