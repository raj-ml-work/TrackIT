import { LoginCredentials, AuthSession, UserAccount, UserRole, UserStatus } from '../types';

// Mock user database - replace with Supabase later
// Using a function to get users from localStorage if available
const getStoredUsers = () => {
  const stored = localStorage.getItem('auralis_users');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }
  return null;
};

const DEFAULT_USERS = [
  {
    id: 'u-1001',
    name: 'Alicia Vega',
    email: 'admin@auralis.inc',
    password: 'admin123', // In real app, this would be hashed
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

// Initialize with stored users or defaults
let MOCK_USERS = getStoredUsers() || DEFAULT_USERS;

// Save users to localStorage
const saveUsers = () => {
  localStorage.setItem('auralis_users', JSON.stringify(MOCK_USERS));
};

/**
 * Register a new user (called when admin creates a user)
 */
export const registerUser = (userData: UserAccount & { password: string }): void => {
  MOCK_USERS.push({
    id: userData.id,
    name: userData.name,
    email: userData.email,
    password: userData.password,
    role: userData.role,
    status: userData.status,
    lastLogin: userData.lastLogin
  });
  saveUsers();
};

/**
 * Mock login function - will be replaced with Supabase auth
 */
export const login = async (credentials: LoginCredentials): Promise<AuthSession> => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 800));

  const user = MOCK_USERS.find(
    u => u.email === credentials.email && u.password === credentials.password
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
 * Mock logout function - will be replaced with Supabase auth
 */
export const logout = async (): Promise<void> => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 300));
  // Clear session from storage if remember me was enabled
  localStorage.removeItem('auralis_session');
};

/**
 * Mock session restore - will be replaced with Supabase session management
 */
export const restoreSession = (): AuthSession | null => {
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
 * Mock password update - will be replaced with Supabase auth
 */
export const updatePassword = async (
  currentPassword: string,
  newPassword: string
): Promise<void> => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 800));
  
  // Mock validation
  if (currentPassword === newPassword) {
    throw new Error('New password must be different from current password');
  }
  
  if (newPassword.length < 6) {
    throw new Error('Password must be at least 6 characters');
  }
  
  // In real app, this would update the password in Supabase
  console.log('Password updated successfully (mock)');
};

