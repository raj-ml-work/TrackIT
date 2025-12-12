export enum AssetType {
  LAPTOP = 'Laptop',
  DESKTOP = 'Desktop',
  MONITOR = 'Monitor',
  PRINTER = 'Printer',
  ACCESSORY = 'Accessory',
  MOBILE = 'Mobile',
  PROJECTOR = 'Projector',
  TV = 'TV'
}

export enum AssetStatus {
  IN_USE = 'In Use',
  AVAILABLE = 'Available',
  MAINTENANCE = 'Maintenance',
  RETIRED = 'Retired'
}

export interface AssetSpecs {
  brand?: string;
  model?: string;
  cpu?: string; // Laptop, Desktop
  ram?: string; // Laptop, Desktop, Mobile
  storage?: string; // Laptop, Desktop, Mobile
  screenSize?: string; // Monitor, TV (e.g. "27 inch")
  printerType?: 'Color' | 'Monochrome'; // Printer
}

export enum AssetCommentType {
  NOTE = 'Note',
  SYSTEM = 'System'
}

export interface AssetComment {
  id: string;
  assetId: string;
  authorName: string;
  authorId?: string;
  message: string;
  type: AssetCommentType;
  createdAt: string;
}

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
  notes?: string;
  specs?: AssetSpecs;
  comments?: AssetComment[];
}

export interface DashboardStats {
  totalAssets: number;
  totalValue: number;
  assignedRate: number;
  expiringWarranties: number;
}

export enum UserRole {
  ADMIN = 'Admin',
  USER = 'User'
}

export enum UserStatus {
  ACTIVE = 'Active',
  INACTIVE = 'Inactive'
}

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  lastLogin: string;
  password?: string; // Only used during creation, not stored in state
  passwordHash?: string; // Stored hash/value used for custom auth
}

export interface AuthSession {
  user: UserAccount;
  token?: string;
  rememberMe: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface Location {
  id: string;
  name: string;
  city: string;
  comments?: string;
}

export enum EmployeeStatus {
  ACTIVE = 'Active',
  INACTIVE = 'Inactive'
}

export interface Employee {
  id: string;
  employeeId: string; // Unique employee identifier (e.g., EMP001)
  name: string;
  email?: string;
  department?: string;
  location?: string;
  title?: string;
  status: EmployeeStatus;
}
