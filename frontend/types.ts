export enum AssetType {
  LAPTOP = 'Laptop',
  DESKTOP = 'Desktop',
  MONITOR = 'Monitor',
  PRINTER = 'Printer',
  ACCESSORY = 'Accessory',
  HEADPHONE = 'Headphone',
  MOBILE = 'Mobile',
  PROJECTOR = 'Projector',
  TV = 'TV',
  NETWORK_DEVICES = 'Network devices',
  STORAGE = 'Storage',
  OTHER = 'Other'
}

export enum AssetStatus {
  IN_USE = 'Shared Resource',
  AVAILABLE = 'Available',
  MAINTENANCE = 'Maintenance',
  RETIRED = 'Retired',
  ASSIGNED = 'Assigned'
}

export interface AssetSpecs {
  id?: string;
  assetId?: string;
  assetType?: string;
  brand?: string;
  model?: string;
  processorType?: string; // CPU/Processor
  ramCapacity?: string; // e.g., "16GB", "32GB"
  storageCapacity?: string; // e.g., "512GB SSD"
  osDetails?: string; // e.g., "Windows 11 Pro", "Dual Boot (Windows + Ubuntu)"
  screenSize?: string; // Monitor, TV (e.g. "27 inch")
  isTouchscreen?: boolean;
  printerType?: 'Color' | 'Monochrome'; // Printer
  // Legacy fields for backward compatibility
  cpu?: string;
  ram?: string;
  storage?: string;
  os?: string;
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
  assignedTo?: string; // Legacy: employee name (for backward compatibility)
  assignedToId?: string; // UUID of assigned employee (FK to employees.id)
  employeeId?: string; // Alternative assignment field (FK to employees.id)
  purchaseDate: string;
  acquisitionDate?: string; // When asset was actually acquired/assigned
  warrantyExpiry: string;
  cost: number;
  location: string; // Legacy: location name (for backward compatibility)
  locationId?: string; // UUID of location (FK to locations.id)
  manufacturer?: string;
  previousTag?: string; // For historical tracking
  notes?: string;
  specs?: AssetSpecs; // Legacy JSONB specs
  assetSpecs?: AssetSpecs; // Normalized specs from asset_specs table
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
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;
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
  country?: string;
  comments?: string;
}

export interface Department {
  id: string;
  name: string;
  description?: string;
}

export enum EmployeeStatus {
  ACTIVE = 'Active',
  INACTIVE = 'Inactive'
}

export enum EmployeeAssignmentType {
  CLIENT_BILLABLE = 'Client Billable',
  BENCH = 'Bench',
  SUPPORT = 'Support'
}

export interface EmployeePersonalInfo {
  id: string;
  firstName: string;
  lastName?: string;
  gender?: string;
  mobileNumber?: string;
  emergencyContactName?: string;
  emergencyContactNumber?: string;
  personalEmail?: string;
  linkedinUrl?: string;
  photoUrl?: string;
  additionalComments?: string;
}

export interface EmployeeOfficialInfo {
  id: string;
  division?: string;
  biometricId?: string;
  rfidSerial?: string;
  agreementSigned?: boolean;
  startDate?: string;
  officialDob?: string;
  officialEmail?: string;
  assignmentType?: EmployeeAssignmentType;
  clientName?: string;
  clientLocation?: string;
  managerName?: string;
  directorName?: string;
  projectDescription?: string;
  clientWorkNotes?: string;
  assignmentDate?: string;
}

export interface EmployeeEngagementHistory {
  id: string;
  employeeId: string;
  assignmentType: EmployeeAssignmentType;
  clientName?: string;
  clientLocation?: string;
  managerName?: string;
  directorName?: string;
  projectDescription?: string;
  clientWorkNotes?: string;
  assignmentDate?: string;
  transitionType: string;
  transitionSummary: string;
  transitionNote?: string;
  performanceSummary?: string;
  changedBy?: string;
  changedByName?: string;
  changedAt: string;
}

export interface EmployeeEngagementTransition {
  transitionNote?: string;
  performanceSummary?: string;
}

export enum EmployeeFeedbackCategory {
  GENERAL = 'General',
  CLIENT_ENGAGEMENT = 'Client Engagement',
  BENCH_PERFORMANCE = 'Bench Performance'
}

export enum EmployeeFeedbackSentiment {
  POSITIVE = 'Positive',
  NEUTRAL = 'Neutral',
  NEEDS_ATTENTION = 'Needs Attention'
}

export interface EmployeeFeedbackEntry {
  id: string;
  employeeId: string;
  feedbackCategory: EmployeeFeedbackCategory;
  sentiment?: EmployeeFeedbackSentiment;
  feedbackDate?: string;
  feedbackText: string;
  sourceAssignmentType?: EmployeeAssignmentType;
  sourceClientName?: string;
  sourceProjectDescription?: string;
  entryType?: string;
  createdBy?: string;
  createdByName?: string;
  createdAt: string;
}

export interface Employee {
  id: string;
  employeeId: string; // Unique employee identifier (e.g., BS0001, EMP001)
  clientId?: string; // FK to clients.id
  locationId?: string; // FK to locations.id
  personalInfoId?: string; // FK to employee_personal_info.id
  officialInfoId?: string; // FK to employee_official_info.id
  status: EmployeeStatus;
  // Denormalized fields for easy access (populated via joins)
  name?: string; // From personal_info.first_name + last_name
  email?: string; // From official_info.official_email or personal_info.personal_email
  department?: string; // From official_info.division
  location?: string; // From locations.name
  title?: string; // Can be added to official_info if needed
  // Full related objects (optional, populated when needed)
  personalInfo?: EmployeePersonalInfo;
  officialInfo?: EmployeeOfficialInfo;
  engagementHistory?: EmployeeEngagementHistory[];
  feedbackHistory?: EmployeeFeedbackEntry[];
  engagementTransition?: EmployeeEngagementTransition;
}

export interface EmployeeQuery {
  page: number;
  pageSize: number;
  search?: string;
  department?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AssetHistory {
  id: string;
  assetId: string;
  fieldName: string;
  oldValue?: string;
  newValue?: string;
  changedBy?: string; // FK to users.id
  changedAt: string;
}

export interface AssetQuery {
  page: number;
  pageSize: number;
  search?: string;
  type?: AssetType | 'All';
  status?: AssetStatus | 'All';
  locationId?: string;
}
