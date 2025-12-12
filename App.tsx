import React, { useState, useEffect } from 'react';
import { Asset, AssetType, AssetStatus, UserAccount, UserRole, UserStatus, AuthSession, LoginCredentials, AssetComment, AssetCommentType, Location, Department, Employee, EmployeeStatus } from './types';
import Dashboard from './components/Dashboard';
import AssetManager from './components/AssetManager';
import Settings from './components/Settings';
import UserManagement from './components/UserManagement';
import EmployeeManagement from './components/EmployeeManagement';
import LocationManagement from './components/LocationManagement';
import DepartmentManagement from './components/DepartmentManagement';
import Login from './components/Login';
import ProfilePanel from './components/ProfilePanel';
import { LayoutDashboard, Box, Settings as SettingsIcon, Hexagon, Menu, X, Users, MapPin, Briefcase, Building2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import * as authClient from './services/authClient';
import { 
  isDatabaseReady, 
  getAssets, createAsset, updateAsset, deleteAsset, addAssetComment,
  getEmployees, createEmployee, updateEmployee, deleteEmployee,
  getLocations, createLocation, updateLocation, deleteLocation,
  getUsers, createUser, updateUser, deleteUser
} from './services/dataService';

// Mock Data
const MOCK_ASSETS: Asset[] = [
  { 
    id: '1', 
    name: 'MacBook Pro 16"', 
    type: AssetType.LAPTOP, 
    status: AssetStatus.IN_USE, 
    serialNumber: 'C02XD4JHK', 
    purchaseDate: '2023-01-15', 
    warrantyExpiry: '2024-01-15', 
    cost: 2499, 
    location: 'HQ - Building A', 
    assignedTo: 'Sarah Johnson',
    specs: { brand: 'Apple', model: 'MacBook Pro', cpu: 'M2 Max', ram: '32GB', storage: '1TB SSD' },
    comments: []
  },
  { 
    id: '2', 
    name: 'Dell XPS 15', 
    type: AssetType.LAPTOP, 
    status: AssetStatus.AVAILABLE, 
    serialNumber: '8H2K921', 
    purchaseDate: '2022-11-20', 
    warrantyExpiry: '2025-11-20', 
    cost: 1899, 
    location: 'HQ - Building A', 
    notes: 'Reimaged',
    specs: { brand: 'Dell', model: 'XPS 9520', cpu: 'Core i7-12700H', ram: '16GB', storage: '512GB SSD' },
    comments: []
  },
  { 
    id: '3', 
    name: 'LG UltraFine 5K', 
    type: AssetType.MONITOR, 
    status: AssetStatus.IN_USE, 
    serialNumber: '992KLA2', 
    purchaseDate: '2023-03-10', 
    warrantyExpiry: '2026-03-10', 
    cost: 1299, 
    location: 'HQ - Building A',
    specs: { brand: 'LG', model: '27MD5KL-B', screenSize: '27 inch' },
    comments: []
  },
  { 
    id: '4', 
    name: 'Keychron Q1', 
    type: AssetType.ACCESSORY, 
    status: AssetStatus.IN_USE, 
    serialNumber: 'KC-9921', 
    purchaseDate: '2023-06-01', 
    warrantyExpiry: '2024-06-01', 
    cost: 199, 
    location: 'Remote',
    assignedTo: 'Emily Rodriguez',
    specs: { brand: 'Keychron', model: 'Q1 Pro' },
    comments: []
  },
  { 
    id: '5', 
    name: 'ThinkPad X1 Carbon', 
    type: AssetType.LAPTOP, 
    status: AssetStatus.MAINTENANCE, 
    serialNumber: 'TP-2291', 
    purchaseDate: '2021-05-15', 
    warrantyExpiry: '2024-05-15', 
    cost: 1400, 
    location: 'HQ - Warehouse',
    specs: { brand: 'Lenovo', model: 'Gen 9', cpu: 'Core i5', ram: '8GB', storage: '256GB' },
    comments: []
  },
  { 
    id: '6', 
    name: 'Herman Miller Aeron', 
    type: AssetType.ACCESSORY, 
    status: AssetStatus.IN_USE, 
    serialNumber: 'HM-1102', 
    purchaseDate: '2022-01-01', 
    warrantyExpiry: '2034-01-01', 
    cost: 1400, 
    location: 'HQ - Building A',
    specs: { brand: 'Herman Miller', model: 'Aeron B' },
    comments: []
  },
  {
    id: '7',
    name: 'Conf Room Projector',
    type: AssetType.PROJECTOR,
    status: AssetStatus.IN_USE,
    serialNumber: 'EPS-9912',
    purchaseDate: '2023-01-01',
    warrantyExpiry: '2025-01-01',
    cost: 899,
    location: 'HQ - Building A',
    specs: { brand: 'Epson', model: 'VS260' },
    comments: []
  },
  {
    id: '8',
    name: 'Lobby TV',
    type: AssetType.TV,
    status: AssetStatus.IN_USE,
    serialNumber: 'SAM-TV-55',
    purchaseDate: '2023-02-15',
    warrantyExpiry: '2025-02-15',
    cost: 600,
    location: 'HQ - Building A',
    specs: { brand: 'Samsung', model: 'Crystal UHD', screenSize: '55 inch' },
    comments: []
  },
  {
    id: '9',
    name: 'Admin Printer',
    type: AssetType.PRINTER,
    status: AssetStatus.IN_USE,
    serialNumber: 'HP-LJ-200',
    purchaseDate: '2022-06-01',
    warrantyExpiry: '2024-06-01',
    cost: 350,
    location: 'Branch Office - NYC',
    specs: { brand: 'HP', model: 'LaserJet Pro', printerType: 'Monochrome' },
    comments: []
  }
];

const MOCK_USERS: UserAccount[] = [
  {
    id: 'u-1001',
    name: 'Alicia Vega',
    email: 'alicia@auralis.inc',
    role: UserRole.ADMIN,
    status: UserStatus.ACTIVE,
    lastLogin: '2h ago'
  },
  {
    id: 'u-1002',
    name: 'Liam Chen',
    email: 'liam@auralis.inc',
    role: UserRole.USER,
    status: UserStatus.ACTIVE,
    lastLogin: '1d ago'
  },
  {
    id: 'u-1003',
    name: 'Priya Patel',
    email: 'priya@auralis.inc',
    role: UserRole.USER,
    status: UserStatus.INACTIVE,
    lastLogin: '7d ago'
  }
];

enum View {
  DASHBOARD = 'Dashboard',
  INVENTORY = 'Inventory',
  EMPLOYEES = 'Employees',
  LOCATIONS = 'Locations',
  DEPARTMENTS = 'Departments',
  USERS = 'Users',
  SETTINGS = 'Settings'
}

const MOCK_EMPLOYEES: Employee[] = [
  {
    id: 'emp-001',
    employeeId: 'EMP001',
    name: 'Sarah Johnson',
    email: 'sarah.j@company.com',
    department: 'Design',
    location: 'HQ - Building A',
    title: 'Senior Designer',
    status: EmployeeStatus.ACTIVE
  },
  {
    id: 'emp-002',
    employeeId: 'EMP002',
    name: 'Michael Chen',
    email: 'michael.c@company.com',
    department: 'Engineering',
    location: 'HQ - Building A',
    title: 'Software Engineer',
    status: EmployeeStatus.ACTIVE
  },
  {
    id: 'emp-003',
    employeeId: 'EMP003',
    name: 'Emily Rodriguez',
    email: 'emily.r@company.com',
    department: 'Marketing',
    location: 'Remote',
    title: 'Marketing Manager',
    status: EmployeeStatus.ACTIVE
  },
  {
    id: 'emp-004',
    employeeId: 'EMP004',
    name: 'David Kim',
    email: 'david.k@company.com',
    department: 'Engineering',
    location: 'HQ - Building A',
    title: 'DevOps Engineer',
    status: EmployeeStatus.ACTIVE
  },
  {
    id: 'emp-005',
    employeeId: 'EMP005',
    name: 'Lisa Anderson',
    email: 'lisa.a@company.com',
    department: 'Sales',
    location: 'Branch Office - NYC',
    title: 'Sales Executive',
    status: EmployeeStatus.INACTIVE
  }
];

const MOCK_LOCATIONS: Location[] = [
  {
    id: 'loc-001',
    name: 'HQ - Building A',
    city: 'San Francisco',
    comments: 'Main headquarters building'
  },
  {
    id: 'loc-002',
    name: 'HQ - Warehouse',
    city: 'San Francisco',
    comments: 'Storage and distribution center'
  },
  {
    id: 'loc-003',
    name: 'Branch Office - NYC',
    city: 'New York',
    comments: 'East coast regional office'
  },
  {
    id: 'loc-004',
    name: 'Remote',
    city: 'Various',
    comments: 'Work from home employees'
  }
];

const MOCK_DEPARTMENTS: Department[] = [
  {
    id: 'dept-001',
    name: 'Engineering',
    description: 'Software development and technical teams'
  },
  {
    id: 'dept-002',
    name: 'Sales',
    description: 'Sales and business development'
  },
  {
    id: 'dept-003',
    name: 'Marketing',
    description: 'Marketing and communications'
  },
  {
    id: 'dept-004',
    name: 'HR',
    description: 'Human resources and talent management'
  },
  {
    id: 'dept-005',
    name: 'Operations',
    description: 'Operations and logistics'
  }
];

const App: React.FC = () => {
  const [assets, setAssets] = useState<Asset[]>(MOCK_ASSETS);
  const [users, setUsers] = useState<UserAccount[]>(MOCK_USERS);
  const [employees, setEmployees] = useState<Employee[]>(MOCK_EMPLOYEES);
  const [locations, setLocations] = useState<Location[]>(MOCK_LOCATIONS);
  const [departments, setDepartments] = useState<Department[]>(MOCK_DEPARTMENTS);
  const [currentView, setCurrentView] = useState<View>(View.DASHBOARD);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Auth state
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [useBackend, setUseBackend] = useState(false);

  const isAdmin = session?.user.role === UserRole.ADMIN;

  // Initialize default admin and restore session on mount
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Check if database is configured
        const dbReady = isDatabaseReady();
        setUseBackend(dbReady);

        // Initialize default admin user if needed (only for Supabase)
        await authClient.initializeDefaultAdmin();
        
        // Restore session
        const restored = await authClient.restoreSession();
        if (restored) {
          setSession(restored);
        }

        // Load data from backend if configured
        if (dbReady) {
          await loadDataFromBackend();
        }
      } catch (error) {
        console.error('Error initializing app:', error);
        // Fall back to mock data if backend fails
        setUseBackend(false);
      } finally {
        setIsLoading(false);
      }
    };
    initializeApp();
  }, []);

  // Load data from backend
  const loadDataFromBackend = async () => {
    setIsDataLoading(true);
    try {
      const [assetsData, employeesData, locationsData, usersData] = await Promise.all([
        getAssets().catch(err => {
          console.error('Error loading assets:', err);
          return MOCK_ASSETS;
        }),
        getEmployees().catch(err => {
          console.error('Error loading employees:', err);
          return MOCK_EMPLOYEES;
        }),
        getLocations().catch(err => {
          console.error('Error loading locations:', err);
          return MOCK_LOCATIONS;
        }),
        getUsers().catch(err => {
          console.error('Error loading users:', err);
          return MOCK_USERS;
        })
      ]);

      setAssets(assetsData);
      setEmployees(employeesData);
      setLocations(locationsData);
      setUsers(usersData);
    } catch (error) {
      console.error('Error loading data from backend:', error);
    } finally {
      setIsDataLoading(false);
    }
  };

  // Redirect non-admins away from restricted views
  useEffect(() => {
    if (session && !isAdmin && (currentView === View.USERS || currentView === View.SETTINGS)) {
      setCurrentView(View.DASHBOARD);
    }
  }, [isAdmin, currentView, session]);

  // Auth handlers
  const handleLogin = async (credentials: LoginCredentials) => {
    const newSession = await authClient.login(credentials);
    setSession(newSession);
    authClient.saveSession(newSession);
  };

  const handleLogout = async () => {
    await authClient.logout();
    setSession(null);
    setCurrentView(View.DASHBOARD);
  };

  // Asset handlers
  const handleAddAsset = async (newAsset: Omit<Asset, 'id'>) => {
    try {
      if (useBackend) {
        const createdAsset = await createAsset(newAsset);
        // Add creation comment
        const creationComment = await addAssetComment({
          assetId: createdAsset.id,
          authorName: session?.user.name || 'System',
          authorId: session?.user.id,
          message: `Asset created by ${session?.user.name || 'System'}`,
          type: AssetCommentType.SYSTEM,
          createdAt: new Date().toISOString()
        });
        // Update local state with the created comment
        setAssets(prev => [{
          ...createdAsset,
          comments: [creationComment]
        }, ...prev]);
      } else {
        // Mock data fallback
        const assetId = Math.random().toString(36).substr(2, 9);
        const creationComment: AssetComment = {
          id: Math.random().toString(36).substr(2, 9),
          assetId,
          authorName: session?.user.name || 'System',
          authorId: session?.user.id,
          message: `Asset created by ${session?.user.name || 'System'}`,
          type: AssetCommentType.SYSTEM,
          createdAt: new Date().toISOString()
        };
        
        const asset: Asset = { 
          ...newAsset, 
          id: assetId,
          comments: [creationComment]
        };
        setAssets(prev => [asset, ...prev]);
      }
    } catch (error) {
      console.error('Error adding asset:', error);
      alert('Failed to add asset. Please try again.');
      throw error;
    }
  };

  const handleUpdateAsset = async (updatedAsset: Asset) => {
    try {
      const oldAsset = assets.find(a => a.id === updatedAsset.id);
      if (!oldAsset) return;

      // Generate audit trail for changes
      const auditComments: Omit<AssetComment, 'id'>[] = [];
      const now = new Date().toISOString();
      
      if (oldAsset.status !== updatedAsset.status) {
        auditComments.push({
          assetId: oldAsset.id,
          authorName: session?.user.name || 'System',
          authorId: session?.user.id,
          message: `Status changed from "${oldAsset.status}" to "${updatedAsset.status}"`,
          type: AssetCommentType.SYSTEM,
          createdAt: now
        });
      }
      
      if (oldAsset.assignedTo !== updatedAsset.assignedTo) {
        auditComments.push({
          assetId: oldAsset.id,
          authorName: session?.user.name || 'System',
          authorId: session?.user.id,
          message: `Assigned to changed from "${oldAsset.assignedTo || 'Unassigned'}" to "${updatedAsset.assignedTo || 'Unassigned'}"`,
          type: AssetCommentType.SYSTEM,
          createdAt: now
        });
      }
      
      if (oldAsset.location !== updatedAsset.location) {
        auditComments.push({
          assetId: oldAsset.id,
          authorName: session?.user.name || 'System',
          authorId: session?.user.id,
          message: `Location changed from "${oldAsset.location}" to "${updatedAsset.location}"`,
          type: AssetCommentType.SYSTEM,
          createdAt: now
        });
      }

      if (useBackend) {
        const updated = await updateAsset(updatedAsset);
        // Add audit comments to backend and collect created comments
        const createdComments: AssetComment[] = [];
        for (const comment of auditComments) {
          const createdComment = await addAssetComment(comment);
          createdComments.push(createdComment);
        }
        // Update local state with the updated asset and new comments
        // Use updated.comments as base (which has all existing comments from DB)
        // and append the newly created audit comments
        setAssets(prev => prev.map(a => {
          if (a.id === updated.id) {
            return {
              ...updated,
              comments: [...(updated.comments || []), ...createdComments]
            };
          }
          return a;
        }));
      } else {
        // Mock data fallback
        setAssets(prev => prev.map(a => {
          if (a.id === updatedAsset.id) {
            const allComments = [...(updatedAsset.comments || []), ...auditComments.map(c => ({ ...c, id: Math.random().toString(36).substr(2, 9) }))];
            return { ...updatedAsset, comments: allComments };
          }
          return a;
        }));
      }
    } catch (error) {
      console.error('Error updating asset:', error);
      alert('Failed to update asset. Please try again.');
      throw error;
    }
  };

  const handleAddComment = async (assetId: string, message: string) => {
    try {
      const newComment: Omit<AssetComment, 'id'> = {
        assetId,
        authorName: session?.user.name || 'Unknown',
        authorId: session?.user.id,
        message,
        type: AssetCommentType.NOTE,
        createdAt: new Date().toISOString()
      };

      if (useBackend) {
        const createdComment = await addAssetComment(newComment);
        setAssets(prev => prev.map(a => {
          if (a.id === assetId) {
            return {
              ...a,
              comments: [...(a.comments || []), createdComment]
            };
          }
          return a;
        }));
      } else {
        // Mock data fallback
        const comment: AssetComment = {
          ...newComment,
          id: Math.random().toString(36).substr(2, 9)
        };
        setAssets(prev => prev.map(a => {
          if (a.id === assetId) {
            return {
              ...a,
              comments: [...(a.comments || []), comment]
            };
          }
          return a;
        }));
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      alert('Failed to add comment. Please try again.');
      throw error;
    }
  };

  const handleDeleteAsset = async (id: string) => {
    if (!isAdmin) {
      alert('Only administrators can delete assets.');
      return;
    }

    if (!confirm('Are you sure you want to delete this asset?')) {
      return;
    }

    try {
      if (useBackend) {
        await deleteAsset(id);
      }
      // Only update state after successful deletion
      setAssets(prev => prev.filter(a => a.id !== id));
    } catch (error) {
      console.error('Error deleting asset:', error);
      alert('Failed to delete asset. Please try again.');
      // State is not updated, so the asset remains visible in the UI
      throw error;
    }
  };

  // User handlers
  const handleAddUser = async (user: Omit<UserAccount, 'id' | 'lastLogin'>) => {
    try {
      if (useBackend) {
        if (!user.password) {
          throw new Error('Password is required when creating a user');
        }
        const createdUser = await createUser({
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status
        }, user.password);
        setUsers(prev => [createdUser, ...prev]);
      } else {
        // Mock data fallback
        const newUser: UserAccount = {
          ...user,
          id: Math.random().toString(36).substr(2, 9),
          lastLogin: '—'
        };
        
        // Register the user in auth system if password provided
        if (user.password) {
          await authClient.registerUser({ ...newUser, password: user.password });
        }
        
        // Remove password before storing in state (security)
        const { password, ...userWithoutPassword } = newUser;
        setUsers(prev => [userWithoutPassword, ...prev]);
      }
    } catch (error) {
      console.error('Error adding user:', error);
      alert('Failed to add user. Please try again.');
      throw error;
    }
  };

  const handleUpdateUser = async (updated: UserAccount) => {
    try {
      if (useBackend) {
        const updatedUser = await updateUser(updated);
        setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
      } else {
        setUsers(prev => prev.map(u => u.id === updated.id ? updated : u));
      }
    } catch (error) {
      console.error('Error updating user:', error);
      alert('Failed to update user. Please try again.');
      throw error;
    }
  };

  const handleToggleUserStatus = async (id: string) => {
    try {
      const user = users.find(u => u.id === id);
      if (!user) return;

      const newStatus = user.status === UserStatus.ACTIVE ? UserStatus.INACTIVE : UserStatus.ACTIVE;
      
      if (useBackend) {
        const updatedUser = await updateUser({ ...user, status: newStatus });
        setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
      } else {
        setUsers(prev => prev.map(u => u.id === id ? { ...u, status: newStatus } : u));
      }
    } catch (error) {
      console.error('Error toggling user status:', error);
      alert('Failed to update user status. Please try again.');
      throw error;
    }
  };

  // Location handlers
  const handleAddLocation = async (location: Omit<Location, 'id'>) => {
    try {
      if (useBackend) {
        const createdLocation = await createLocation(location);
        setLocations(prev => [createdLocation, ...prev]);
      } else {
        // Mock data fallback
        const newLocation: Location = {
          ...location,
          id: `loc-${Math.random().toString(36).substr(2, 9)}`
        };
        setLocations(prev => [newLocation, ...prev]);
      }
    } catch (error) {
      console.error('Error adding location:', error);
      alert('Failed to add location. Please try again.');
      throw error;
    }
  };

  const handleUpdateLocation = async (updated: Location) => {
    try {
      if (useBackend) {
        const updatedLocation = await updateLocation(updated);
        setLocations(prev => prev.map(l => l.id === updatedLocation.id ? updatedLocation : l));
      } else {
        setLocations(prev => prev.map(l => l.id === updated.id ? updated : l));
      }
    } catch (error) {
      console.error('Error updating location:', error);
      alert('Failed to update location. Please try again.');
      throw error;
    }
  };

  const handleDeleteLocation = async (id: string) => {
    if (!isAdmin) {
      alert('Only administrators can delete locations.');
      return;
    }

    const location = locations.find(l => l.id === id);
    const assetCount = assets.filter(a => a.location === location?.name).length;
    const employeeCount = employees.filter(e => e.location === location?.name).length;
    
    if (assetCount > 0 || employeeCount > 0) {
      alert(`Cannot delete ${location?.name || 'this location'}. It has ${assetCount} asset(s) and ${employeeCount} employee(s). Please reassign them first.`);
      return;
    }

    try {
      if (useBackend) {
        await deleteLocation(id);
      }
      // Only update state after successful deletion
      setLocations(prev => prev.filter(l => l.id !== id));
    } catch (error) {
      console.error('Error deleting location:', error);
      alert('Failed to delete location. Please try again.');
      // State is not updated, so the location remains visible in the UI
      throw error;
    }
  };

  // Department handlers
  const handleAddDepartment = async (department: Omit<Department, 'id'>) => {
    try {
      // For now, using mock data. Backend integration can be added later
      const newDepartment: Department = {
        ...department,
        id: `dept-${Math.random().toString(36).substr(2, 9)}`
      };
      setDepartments(prev => [newDepartment, ...prev]);
    } catch (error) {
      console.error('Error adding department:', error);
      alert('Failed to add department. Please try again.');
      throw error;
    }
  };

  const handleDeleteDepartment = async (id: string) => {
    try {
      const department = departments.find(d => d.id === id);
      if (!department) return;

      // Check if department is used by any employees
      const employeesUsingDepartment = employees.filter(e => e.department === department.name);
      if (employeesUsingDepartment.length > 0) {
        alert(`Cannot delete "${department.name}". It is being used by ${employeesUsingDepartment.length} employee(s). Please reassign employees first.`);
        return;
      }

      // Only update state after successful deletion
      setDepartments(prev => prev.filter(d => d.id !== id));
    } catch (error) {
      console.error('Error deleting department:', error);
      alert('Failed to delete department. Please try again.');
      // State is not updated, so the department remains visible in the UI
      throw error;
    }
  };

  // Employee handlers
  const handleAddEmployee = async (employee: Omit<Employee, 'id'>) => {
    try {
      if (useBackend) {
        const createdEmployee = await createEmployee(employee);
        setEmployees(prev => [createdEmployee, ...prev]);
      } else {
        // Mock data fallback
        const newEmployee: Employee = {
          ...employee,
          id: `emp-${Math.random().toString(36).substr(2, 9)}`
        };
        setEmployees(prev => [newEmployee, ...prev]);
      }
    } catch (error) {
      console.error('Error adding employee:', error);
      alert(error instanceof Error ? error.message : 'Failed to add employee. Please try again.');
      throw error;
    }
  };

  const handleUpdateEmployee = async (updated: Employee) => {
    try {
      if (useBackend) {
        const updatedEmployee = await updateEmployee(updated);
        setEmployees(prev => prev.map(e => e.id === updatedEmployee.id ? updatedEmployee : e));
      } else {
        setEmployees(prev => prev.map(e => e.id === updated.id ? updated : e));
      }
    } catch (error) {
      console.error('Error updating employee:', error);
      alert('Failed to update employee. Please try again.');
      throw error;
    }
  };

  const handleDeleteEmployee = async (id: string) => {
    if (!isAdmin) {
      alert('Only administrators can delete employees.');
      return;
    }

    const employee = employees.find(e => e.id === id);
    const assetCount = assets.filter(a => a.assignedTo === employee?.name).length;
    
    if (assetCount > 0) {
      alert(`Cannot delete ${employee?.name || 'this employee'}. They have ${assetCount} asset(s) assigned. Please reassign or unassign assets first.`);
      return;
    }

    try {
      if (useBackend) {
        await deleteEmployee(id);
      }
      // Only update state after successful deletion
      setEmployees(prev => prev.filter(e => e.id !== id));
    } catch (error) {
      console.error('Error deleting employee:', error);
      alert('Failed to delete employee. Please try again.');
      // State is not updated, so the employee remains visible in the UI
      throw error;
    }
  };

  const NavItem = ({ view, icon: Icon }: { view: View, icon: any }) => (
    <button
      onClick={() => { setCurrentView(view); setIsMobileMenuOpen(false); }}
      className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 w-full text-left ${
        currentView === view 
          ? 'bg-blue-50 text-blue-600 font-semibold' 
          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
      }`}
    >
      <Icon size={20} />
      <span className="text-sm font-medium">{view}</span>
    </button>
  );

  // Show loading state while checking for session
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="inline-flex p-4 bg-gray-900 rounded-2xl text-white mb-4 animate-pulse">
            <Hexagon size={36} fill="currentColor" />
          </div>
          <p className="text-gray-600 font-medium">Loading Auralis...</p>
        </div>
      </div>
    );
  }

  // Show login screen if not authenticated
  if (!session) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen flex font-sans text-slate-800 selection:bg-indigo-100">
      {/* Sidebar for Desktop */}
      <aside className="hidden lg:flex flex-col w-64 fixed h-full bg-white border-r border-gray-200 z-20">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <Hexagon size={20} fill="white" className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Auralis</h1>
              <p className="text-xs text-gray-500">Inventory Management</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <NavItem view={View.DASHBOARD} icon={LayoutDashboard} />
          <NavItem view={View.INVENTORY} icon={Box} />
          <NavItem view={View.EMPLOYEES} icon={Briefcase} />
          <NavItem view={View.LOCATIONS} icon={MapPin} />
          <NavItem view={View.DEPARTMENTS} icon={Building2} />
          {isAdmin && <NavItem view={View.USERS} icon={Users} />}
          {isAdmin && <NavItem view={View.SETTINGS} icon={SettingsIcon} />}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 font-medium mb-1">Pro Plan</p>
            <p className="text-sm font-semibold text-gray-900">Auralis Corp</p>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 w-full z-30 px-4 py-3 bg-white border-b border-gray-200 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Hexagon size={18} fill="white" className="text-white" />
          </div>
          <span className="font-bold text-lg text-gray-900">Auralis</span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600">
           {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-14 left-0 w-full z-20 bg-white p-4 shadow-lg border-b border-gray-200 lg:hidden"
          >
             <nav className="space-y-1">
             <NavItem view={View.DASHBOARD} icon={LayoutDashboard} />
              <NavItem view={View.INVENTORY} icon={Box} />
              <NavItem view={View.EMPLOYEES} icon={Briefcase} />
              <NavItem view={View.LOCATIONS} icon={MapPin} />
              <NavItem view={View.DEPARTMENTS} icon={Building2} />
              {isAdmin && <NavItem view={View.USERS} icon={Users} />}
              {isAdmin && <NavItem view={View.SETTINGS} icon={SettingsIcon} />}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 lg:ml-64 bg-gray-50 min-h-screen">
        {/* Top Header Bar */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">{currentView}</h1>
            <div className="flex items-center gap-4">
              <ProfilePanel user={session.user} onLogout={handleLogout} />
            </div>
          </div>
        </div>
        
        <div className="p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            <div className="mb-6">
              <p className="text-gray-600 text-sm">
                {currentView === View.DASHBOARD && `Overview of ${assets.length} managed assets.`}
                {currentView === View.INVENTORY && "Manage and track your corporate equipment."}
                {currentView === View.EMPLOYEES && "Manage organization employees and asset assignments."}
                {currentView === View.LOCATIONS && "Manage office locations and standardize addresses."}
                {currentView === View.USERS && "Admin-only control of teammates, roles, and status."}
                {currentView === View.SETTINGS && "Configure your workspace."}
              </p>
            </div>

          <AnimatePresence mode='wait'>
            <motion.div
              key={currentView}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              {currentView === View.DASHBOARD && <Dashboard assets={assets} locations={locations} />}
              {currentView === View.INVENTORY && (
                <AssetManager 
                  assets={assets}
                  employees={employees}
                  locations={locations}
                  onAdd={handleAddAsset} 
                  onUpdate={handleUpdateAsset} 
                  onDelete={handleDeleteAsset}
                  onAddComment={handleAddComment}
                  canDelete={isAdmin}
                />
              )}
              {currentView === View.EMPLOYEES && (
                <EmployeeManagement 
                  employees={employees}
                  assets={assets}
                  locations={locations}
                  departments={departments}
                  onAdd={handleAddEmployee}
                  onUpdate={handleUpdateEmployee}
                  onDelete={handleDeleteEmployee}
                  canDelete={isAdmin}
                />
              )}
              {currentView === View.LOCATIONS && (
                <LocationManagement 
                  locations={locations}
                  assets={assets}
                  onAdd={handleAddLocation}
                  onUpdate={handleUpdateLocation}
                  onDelete={handleDeleteLocation}
                  canDelete={isAdmin}
                />
              )}
              {currentView === View.DEPARTMENTS && (
                <DepartmentManagement 
                  departments={departments}
                  employees={employees}
                  onAdd={handleAddDepartment}
                  onDelete={handleDeleteDepartment}
                  canDelete={isAdmin}
                />
              )}
              {currentView === View.USERS && isAdmin && (
                <UserManagement 
                  users={users} 
                  onAdd={handleAddUser} 
                  onUpdate={handleUpdateUser} 
                  onToggleStatus={handleToggleUserStatus} 
                />
              )}
              {currentView === View.SETTINGS && isAdmin && <Settings />}
            </motion.div>
          </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
