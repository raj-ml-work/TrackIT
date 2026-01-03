/**
 * User-related types
 */
export interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  lastLogin: string;
  passwordHash?: string;
}

export type UserRole = 'Admin' | 'User';
export type UserStatus = 'Active' | 'Inactive';

/**
 * Location types
 */
export interface Location {
  id: string;
  name: string;
  city: string;
}

/**
 * Department types
 */
export interface Department {
  id: string;
  name: string;
  description: string;
}

/**
 * Employee types
 */
export interface Employee {
  id: string;
  employeeId: string;
  clientId: string;
  locationId: string;
  personalInfoId: string;
  officialInfoId: string;
  status: EmployeeStatus;
  name: string;
  email: string;
  department: string;
  location: string;
  title: string;
  personalInfo?: EmployeePersonalInfo;
  officialInfo?: EmployeeOfficialInfo;
}

export type EmployeeStatus = 'Active' | 'Inactive' | 'Terminated';

export interface EmployeePersonalInfo {
  id: string;
  firstName: string;
  lastName: string;
  gender: Gender;
  mobileNumber: string;
  emergencyContactName: string;
  emergencyContactNumber: string;
  personalEmail: string;
  linkedinUrl?: string;
  additionalComments?: string;
}

export type Gender = 'Male' | 'Female' | 'Other';

export interface EmployeeOfficialInfo {
  id: string;
  division: string;
  biometricId?: string;
  rfidSerial?: string;
  agreementSigned: boolean;
  startDate: string;
  officialDob: string;
  officialEmail: string;
}

/**
 * Asset types
 */
export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  status: AssetStatus;
  serialNumber: string;
  assignedTo?: string;
  purchaseDate: string;
  warrantyExpiry: string;
  cost: number;
  location: string;
}

export type AssetType = 'Laptop' | 'Desktop' | 'Monitor' | 'Keyboard' | 'Mouse' | 'Headphone' | 'Other';
export type AssetStatus = 'Available' | 'In Use' | 'Maintenance' | 'Retired';

export interface AssetComment {
  id: string;
  assetId: string;
  authorName: string;
  authorId?: string;
  message: string;
  type: CommentType;
  createdAt: string;
}

export type CommentType = 'System' | 'Note' | 'Warning';

/**
 * Dashboard types
 */
export interface DashboardMetrics {
  totalAssets: number;
  totalValue: number;
  utilizationRate: number;
  expiringWarranties: number;
}

/**
 * AI Insights types
 */
export interface GeminiInsight {
  id: string;
  type: string;
  prompt: string;
  response: string;
  createdAt: string;
  confidence: number;
}

/**
 * Authentication types
 */
export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface AuthSession {
  user: UserAccount;
  token?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;
  rememberMe: boolean;
}

/**
 * API Response types
 */
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Pagination types
 */
export interface PaginationParams {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface FilterParams {
  status?: string;
  type?: string;
  location?: string;
  assignedTo?: string;
  department?: string;
}
