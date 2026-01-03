import type {
  Asset,
  AssetComment,
  AssetQuery,
  Department,
  Employee,
  EmployeeQuery,
  Location,
  PaginatedResult,
  UserAccount
} from '../../types';

export type DbProvider = 'supabase' | 'sqlite' | 'postgres';

export interface AuthLoginResponse {
  user: UserAccount;
  accessToken: string;
  expiresAt: string;
}

export interface AuthRefreshResponse {
  accessToken: string;
  expiresAt: string;
}

export interface AuthMeResponse {
  user: UserAccount;
}

export interface DataProvider {
  // Assets
  getAssets: () => Promise<Asset[]>;
  getAssetsPage: (query: AssetQuery) => Promise<PaginatedResult<Asset>>;
  getAssetById: (id: string) => Promise<Asset | null>;
  createAsset: (asset: Omit<Asset, 'id'>, currentUser: UserAccount | null) => Promise<Asset>;
  updateAsset: (asset: Asset, currentUser: UserAccount | null) => Promise<Asset>;
  deleteAsset: (id: string, currentUser: UserAccount | null) => Promise<void>;
  getAssetComments: (assetId: string) => Promise<AssetComment[]>;
  addAssetComment: (comment: Omit<AssetComment, 'id'>) => Promise<AssetComment>;
  checkSerialNumberExists: (serialNumber: string, excludeAssetId?: string) => Promise<boolean>;

  // Employees
  getEmployees: () => Promise<Employee[]>;
  getEmployeesPage: (query: EmployeeQuery) => Promise<PaginatedResult<Employee>>;
  getEmployeeById: (id: string) => Promise<Employee | null>;
  getEmployeeByEmployeeId: (employeeId: string) => Promise<Employee | null>;
  createEmployee: (employee: Omit<Employee, 'id'>, currentUser: UserAccount | null) => Promise<Employee>;
  updateEmployee: (employee: Employee, currentUser: UserAccount | null) => Promise<Employee>;
  deleteEmployee: (id: string, currentUser: UserAccount | null) => Promise<void>;

  // Locations
  getLocations: () => Promise<Location[]>;
  getLocationById: (id: string) => Promise<Location | null>;
  getLocationByName: (name: string) => Promise<Location | null>;
  createLocation: (location: Omit<Location, 'id'>, currentUser: UserAccount | null) => Promise<Location>;
  updateLocation: (location: Location, currentUser: UserAccount | null) => Promise<Location>;
  deleteLocation: (id: string, currentUser: UserAccount | null) => Promise<void>;

  // Users
  getUsers: () => Promise<UserAccount[]>;
  getUserById: (id: string) => Promise<UserAccount | null>;
  getUserByEmail: (email: string) => Promise<UserAccount | null>;
  createUser: (
    user: Omit<UserAccount, 'id' | 'lastLogin'>,
    password: string,
    currentUser: UserAccount | null
  ) => Promise<UserAccount>;
  updateUser: (user: UserAccount, currentUser: UserAccount | null) => Promise<UserAccount>;
  updateUserPassword: (userId: string, newPassword: string) => Promise<void>;
  resetUserPassword: (
    userId: string,
    currentUser: UserAccount | null,
    passwordOption?: string
  ) => Promise<string>;
  deleteUser: (id: string, currentUser: UserAccount | null) => Promise<void>;
  updateLastLogin: (userId: string) => Promise<void>;

  // Departments
  getDepartments: () => Promise<Department[]>;
  getDepartmentById: (id: string) => Promise<Department | null>;
  getDepartmentByName: (name: string) => Promise<Department | null>;
  createDepartment: (department: Omit<Department, 'id'>, currentUser: UserAccount | null) => Promise<Department>;
  updateDepartment: (department: Department, currentUser: UserAccount | null) => Promise<Department>;
  deleteDepartment: (id: string, currentUser: UserAccount | null) => Promise<void>;
}
