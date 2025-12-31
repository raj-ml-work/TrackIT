import React, { useState, useEffect } from 'react';
import { Asset, AssetType, AssetStatus, UserAccount, UserRole, UserStatus, AuthSession, LoginCredentials, AssetComment, AssetCommentType, Location, Employee, EmployeeStatus, Department } from './types';
import Dashboard from './components/Dashboard';
import AssetManager from './components/AssetManager';
import Settings from './components/Settings';
import UserManagement from './components/UserManagement';
import EmployeeManagement from './components/EmployeeManagement';
import LocationManagement from './components/LocationManagement';
import DepartmentManagementPage from './src/pages/DepartmentManagementPage';
import Login from './components/Login';
import ProfilePanel from './components/ProfilePanel';
import { LayoutDashboard, Box, Settings as SettingsIcon, Hexagon, Menu, X, Users, MapPin, Briefcase, Building2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import * as authClient from './services/authClient';
import ConfirmDialog, { DialogType } from './components/ConfirmDialog';
import { canCreate, canUpdate, canDelete, canView, getPermissionError, isAdmin } from './services/permissionUtil';
import {
  isDatabaseReady,
  getAssets, getAssetById, createAsset, updateAsset, deleteAsset, addAssetComment, getAssetComments,
  getEmployees, createEmployee, updateEmployee, deleteEmployee,
  getLocations, createLocation, updateLocation, deleteLocation,
  getUsers, createUser, updateUser, deleteUser, resetUserPassword,
  getDepartments, createDepartment, updateDepartment, deleteDepartment
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

const App: React.FC = () => {
  const [assets, setAssets] = useState<Asset[]>(MOCK_ASSETS);
  const [users, setUsers] = useState<UserAccount[]>(MOCK_USERS);
  const [employees, setEmployees] = useState<Employee[]>(MOCK_EMPLOYEES);
  const [locations, setLocations] = useState<Location[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [currentView, setCurrentView] = useState<View>(View.DASHBOARD);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Auth state
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [useBackend, setUseBackend] = useState(false);
  
  // Dialog state
  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    type: DialogType;
    title: string;
    message: string;
    onConfirm?: () => void;
  }>({
    isOpen: false,
    type: DialogType.ERROR,
    title: '',
    message: '',
    onConfirm: undefined
  });


  const showDialog = (type: DialogType, title: string, message: string, onConfirm?: () => void) => {
    setDialogState({
      isOpen: true,
      type,
      title,
      message,
      onConfirm: onConfirm || (() => setDialogState(prev => ({ ...prev, isOpen: false })))
    });
  };

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
        } else {
          console.warn('Database not configured. Location data will be unavailable.');
        }
      } catch (error) {
        console.error('Error initializing app:', error);
        // Don't fall back to mock data for locations
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
      const [assetsData, employeesData, locationsData, usersData, departmentsData] = await Promise.all([
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
          throw err; // Don't fallback to mock data for locations
        }),
        getUsers().catch(err => {
          console.error('Error loading users:', err);
          return MOCK_USERS;
        }),
        getDepartments().catch(err => {
          console.error('Error loading departments:', err);
          return []; // Fallback to empty array for departments
        })
      ]);

      setAssets(assetsData);
      setEmployees(employeesData);
      setLocations(locationsData);
      setUsers(usersData);
      setDepartments(departmentsData);
    } catch (error) {
      console.error('Error loading data from backend:', error);
    } finally {
      setIsDataLoading(false);
    }
  };

  // Redirect non-admins away from restricted views
  useEffect(() => {
    if (session && !isAdmin(session?.user || null) && (currentView === View.USERS || currentView === View.SETTINGS)) {
      setCurrentView(View.DASHBOARD);
    }
  }, [isAdmin(session?.user || null), currentView, session]);

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
        const createdAsset = await createAsset(newAsset, session?.user || null);
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
      showDialog(DialogType.ERROR, 'Add Asset Failed', 'Failed to add asset. Please try again.');
      throw error;
    }
  };

  const handleUpdateAsset = async (updatedAsset: Asset) => {
    try {
      const oldAsset = assets.find(a => a.id === updatedAsset.id);
      if (!oldAsset) return;

      if (useBackend) {
        const updated = await updateAsset(updatedAsset, session?.user || null);
        
        // Load the updated asset with all comments from the backend
        const updatedAssetWithComments = await getAssetById(updated.id);
        
        // Also get all comments for this asset
        const comments = await getAssetComments(updated.id);
        
        setAssets(prev => prev.map(a =>
          a.id === updated.id ? { ...updatedAssetWithComments, comments } : a
        ));
      } else {
        // Mock data fallback - keep existing audit logic
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
      showDialog(DialogType.ERROR, 'Update Asset Failed', 'Failed to update asset. Please try again.');
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
      showDialog(DialogType.ERROR, 'Add Comment Failed', 'Failed to add comment. Please try again.');
      throw error;
    }
  };

  const handleDeleteAsset = async (id: string) => {
    console.log('Delete asset clicked for ID:', id);
    console.log('Current session user:', session?.user);
    console.log('Can delete check:', canDelete(session?.user || null));
    
    if (!canDelete(session?.user || null)) {
      console.log('Permission denied - showing warning dialog');
      showDialog(DialogType.WARNING, 'Permission Denied', getPermissionError('delete', session?.user?.role || null));
      return;
    }

    const asset = assets.find(a => a.id === id);
    const isAssigned = !!(asset?.assignedToId || asset?.employeeId || asset?.assignedTo);
    if (isAssigned) {
      showDialog(
        DialogType.WARNING,
        'Cannot Delete Asset',
        'This asset must be unassigned before it can be deleted.'
      );
      return;
    }

    console.log('Showing confirmation dialog');
    showDialog(DialogType.DANGER, 'Confirm Deletion', 'Are you sure you want to delete this asset?', async () => {
      console.log('User confirmed deletion - proceeding');
      // Proceed with deletion after confirmation
      try {
        if (useBackend) {
          console.log('Calling deleteAsset with backend');
          await deleteAsset(id, session?.user || null);
        } else {
          console.log('Using mock data - removing from state');
        }
        // Only update state after successful deletion
        setAssets(prev => prev.filter(a => a.id !== id));
        console.log('Asset deleted successfully');
      } catch (error) {
        console.error('Error deleting asset:', error);
        showDialog(DialogType.ERROR, 'Delete Asset Failed', 'Failed to delete asset. Please try again.');
        // State is not updated, so the asset remains visible in the UI
        throw error;
      }
    });
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
        }, user.password, session?.user);
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
      showDialog(DialogType.ERROR, 'Add User Failed', 'Failed to add user. Please try again.');
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
      showDialog(DialogType.ERROR, 'Update User Failed', 'Failed to update user. Please try again.');
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
      showDialog(DialogType.ERROR, 'Update User Status Failed', 'Failed to update user status. Please try again.');
      throw error;
    }
  };

  const handleResetUserPassword = async (id: string, passwordOption?: string): Promise<string> => {
    try {
      if (!session?.user) {
        throw new Error('Not authenticated');
      }

      const temporaryPassword = await resetUserPassword(id, session.user, passwordOption);
      
      // Update the user list to reflect the password change (though we can't see the password)
      // Just ensure the user is still active and refresh the list
      if (useBackend) {
        const updatedUsers = await getUsers();
        setUsers(updatedUsers);
      }

      return temporaryPassword;
    } catch (error) {
      console.error('Error resetting user password:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to reset password. Please try again.';
      showDialog(DialogType.ERROR, 'Reset Password Failed', errorMessage);
      throw error;
    }
  };

  // Location handlers
  const handleAddLocation = async (location: Omit<Location, 'id'>) => {
    try {
      const createdLocation = await createLocation(location, session?.user || null);
      setLocations(prev => [createdLocation, ...prev]);
    } catch (error) {
      console.error('Error adding location:', error);
      showDialog(DialogType.ERROR, 'Add Location Failed', 'Failed to add location. Please try again.');
      throw error;
    }
  };

  const handleUpdateLocation = async (updated: Location) => {
    try {
      const updatedLocation = await updateLocation(updated, session?.user || null);
      setLocations(prev => prev.map(l => l.id === updatedLocation.id ? updatedLocation : l));
    } catch (error) {
      console.error('Error updating location:', error);
      showDialog(DialogType.ERROR, 'Update Location Failed', 'Failed to update location. Please try again.');
      throw error;
    }
  };

  const handleDeleteLocation = async (id: string) => {
    if (!canDelete(session?.user || null)) {
      showDialog(DialogType.WARNING, 'Permission Denied', getPermissionError('delete', session?.user?.role || null));
      return;
    }

    const location = locations.find(l => l.id === id);
    const assetCount = assets.filter(a => a.location === location?.name).length;
    const employeeCount = employees.filter(e => e.location === location?.name).length;

    if (assetCount > 0 || employeeCount > 0) {
      showDialog(DialogType.WARNING, 'Cannot Delete Location', `Cannot delete ${location?.name || 'this location'}. It has ${assetCount} asset(s) and ${employeeCount} employee(s). Please reassign them first.`);
      return;
    }

    try {
      if (useBackend) {
        await deleteLocation(id, session?.user || null);
      }
      // Only update state after successful deletion
      setLocations(prev => prev.filter(l => l.id !== id));
    } catch (error) {
      console.error('Error deleting location:', error);
      showDialog(DialogType.ERROR, 'Delete Location Failed', 'Failed to delete location. Please try again.');
      // State is not updated, so the location remains visible in the UI
      throw error;
    }
  };

  // Load fresh location data when navigating to locations view
  const loadFreshLocationData = async () => {
    try {
      const freshLocations = await getLocations();
      setLocations(freshLocations);
    } catch (error) {
      console.error('Error loading fresh location data:', error);
      showDialog(DialogType.ERROR, 'Load Location Data Failed', 'Failed to load latest location data. Please try again.');
    }
  };

  // Refresh location data when navigating to locations view
  useEffect(() => {
    if (currentView === View.LOCATIONS && useBackend) {
      loadFreshLocationData();
    }
  }, [currentView, useBackend]);

  // Employee handlers
  const handleAddEmployee = async (employee: Omit<Employee, 'id'>) => {
    try {
      if (useBackend) {
        const createdEmployee = await createEmployee(employee, session?.user || null);
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
      showDialog(DialogType.ERROR, 'Add Employee Failed', error instanceof Error ? error.message : 'Failed to add employee. Please try again.');
      throw error;
    }
  };

  const handleUpdateEmployee = async (updated: Employee) => {
    try {
      if (useBackend) {
        const updatedEmployee = await updateEmployee(updated, session?.user || null);
        setEmployees(prev => prev.map(e => e.id === updatedEmployee.id ? updatedEmployee : e));
      } else {
        setEmployees(prev => prev.map(e => e.id === updated.id ? updated : e));
      }
    } catch (error) {
      console.error('Error updating employee:', error);
      showDialog(DialogType.ERROR, 'Update Employee Failed', 'Failed to update employee. Please try again.');
      throw error;
    }
  };

  const handleDeleteEmployee = async (id: string) => {
   if (!canDelete(session?.user || null)) {
     showDialog(DialogType.WARNING, 'Permission Denied', getPermissionError('delete', session?.user?.role || null));
     return;
   }

   const employee = employees.find(e => e.id === id);
   const assetCount = assets.filter(a => a.assignedTo === employee?.name).length;

   if (assetCount > 0) {
     showDialog(DialogType.WARNING, 'Cannot Delete Employee', `Cannot delete ${employee?.name || 'this employee'}. They have ${assetCount} asset(s) assigned. Please reassign or unassign assets first.`);
     return;
   }

   try {
     if (useBackend) {
       await deleteEmployee(id, session?.user || null);
     }
     // Only update state after successful deletion
     setEmployees(prev => prev.filter(e => e.id !== id));
   } catch (error) {
     console.error('Error deleting employee:', error);
     showDialog(DialogType.ERROR, 'Delete Employee Failed', 'Failed to delete employee. Please try again.');
     // State is not updated, so the employee remains visible in the UI
     throw error;
   }
  };

  // Department handlers
  const handleAddDepartment = async (department: Omit<Department, 'id'>) => {
   try {
     const createdDepartment = await createDepartment(department, session?.user || null);
     setDepartments(prev => [createdDepartment, ...prev]);
   } catch (error) {
     console.error('Error adding department:', error);
     showDialog(DialogType.ERROR, 'Add Department Failed', 'Failed to add department. Please try again.');
     throw error;
   }
  };

  const handleUpdateDepartment = async (updated: Department) => {
   try {
     const updatedDepartment = await updateDepartment(updated, session?.user || null);
     setDepartments(prev => prev.map(d => d.id === updatedDepartment.id ? updatedDepartment : d));
   } catch (error) {
     console.error('Error updating department:', error);
     showDialog(DialogType.ERROR, 'Update Department Failed', 'Failed to update department. Please try again.');
     throw error;
   }
  };

  const handleDeleteDepartment = async (id: string) => {
   if (!canDelete(session?.user || null)) {
     showDialog(DialogType.WARNING, 'Permission Denied', getPermissionError('delete', session?.user?.role || null));
     return;
   }

   const department = departments.find(d => d.id === id);
   const employeeCount = employees.filter(e => e.department === department?.name).length;

   if (employeeCount > 0) {
     showDialog(DialogType.WARNING, 'Cannot Delete Department', `Cannot delete ${department?.name || 'this department'}. It has ${employeeCount} employee(s). Please reassign them first.`);
     return;
   }

   try {
     if (useBackend) {
       await deleteDepartment(id, session?.user || null);
     }
     // Only update state after successful deletion
     setDepartments(prev => prev.filter(d => d.id !== id));
   } catch (error) {
     console.error('Error deleting department:', error);
     showDialog(DialogType.ERROR, 'Delete Department Failed', 'Failed to delete department. Please try again.');
     // State is not updated, so the department remains visible in the UI
     throw error;
   }
  };

  // Load fresh department data when navigating to departments view
  const loadFreshDepartmentData = async () => {
   try {
     const freshDepartments = await getDepartments();
     setDepartments(freshDepartments);
   } catch (error) {
     console.error('Error loading fresh department data:', error);
     showDialog(DialogType.ERROR, 'Load Department Data Failed', 'Failed to load latest department data. Please try again.');
   }
  };

  // Refresh department data when navigating to departments view
  useEffect(() => {
   if (currentView === View.DEPARTMENTS && useBackend) {
     loadFreshDepartmentData();
   }
  }, [currentView, useBackend]);

  // Load fresh department data when navigating to employees view
  const loadFreshDepartmentDataForEmployees = async () => {
   try {
     const freshDepartments = await getDepartments();
     setDepartments(freshDepartments);
   } catch (error) {
     console.error('Error loading fresh department data for employees:', error);
     showDialog(DialogType.ERROR, 'Load Department Data Failed', 'Failed to load latest department data. Please try again.');
   }
  };

  // Load fresh location data when navigating to employees view
  const loadFreshLocationDataForEmployees = async () => {
   try {
     const freshLocations = await getLocations();
     setLocations(freshLocations);
   } catch (error) {
     console.error('Error loading fresh location data for employees:', error);
     showDialog(DialogType.ERROR, 'Load Location Data Failed', 'Failed to load latest location data. Please try again.');
   }
  };

  // Refresh department and location data when navigating to employees view
  useEffect(() => {
   if (currentView === View.EMPLOYEES && useBackend) {
     loadFreshDepartmentDataForEmployees();
     loadFreshLocationDataForEmployees();
   }
  }, [currentView, useBackend]);

  const NavItem = ({ view, icon: Icon }: { view: View, icon: any }) => (
    <button
      onClick={() => { setCurrentView(view); setIsMobileMenuOpen(false); }}
      className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 w-full text-left ${
        currentView === view 
          ? 'relative bg-green-50 text-green-600 font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] before:content-[\"\" ] before:absolute before:inset-0 before:rounded-lg before:bg-gradient-to-br before:from-white/40 before:via-white/10 before:to-transparent before:pointer-events-none' 
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
          <div className="inline-flex p-3 bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 rounded-2xl shadow-xl shadow-slate-900/20 ring-1 ring-white/20 mb-4 animate-pulse">
            <img
              src="/images/TrackIT-icon.png"
              alt="TrackIT"
              className="h-8 w-8 object-contain drop-shadow-sm"
            />
          </div>
          <p className="text-gray-600 font-medium">Loading TrackIT...</p>
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
        <div className="h-16 px-6 border-b border-gray-200 flex items-center justify-center">
          <div className="flex items-center justify-center">
            <img
              src="/images/TrackIT_v2.png"
              alt="TrackIT"
              className="h-12 w-auto"
            />
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <NavItem view={View.DASHBOARD} icon={LayoutDashboard} />
          <NavItem view={View.INVENTORY} icon={Box} />
          <NavItem view={View.EMPLOYEES} icon={Briefcase} />
          <NavItem view={View.DEPARTMENTS} icon={Building2} />
          <NavItem view={View.LOCATIONS} icon={MapPin} />
          {isAdmin(session?.user || null) && <NavItem view={View.USERS} icon={Users} />}
          {isAdmin(session?.user || null) && <NavItem view={View.SETTINGS} icon={SettingsIcon} />}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 font-medium mb-1">Pro Plan</p>
            <p className="text-sm font-semibold text-gray-900">TrackIT Corp</p>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 w-full z-30 px-4 py-3 bg-white border-b border-gray-200 flex justify-between items-center">
        <div className="flex items-center">
          <img
            src="/images/TrackIT_v2.png"
            alt="TrackIT"
            className="h-9 w-auto"
          />
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
              <NavItem view={View.DEPARTMENTS} icon={Building2} />
              <NavItem view={View.LOCATIONS} icon={MapPin} />
              {canDelete(session?.user || null) && <NavItem view={View.USERS} icon={Users} />}
              {canDelete(session?.user || null) && <NavItem view={View.SETTINGS} icon={SettingsIcon} />}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 lg:ml-64 bg-gray-50 min-h-screen">
        {/* Top Header Bar */}
        <div className="bg-white border-b border-gray-200 px-6 h-16 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto h-full flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">{currentView}</h1>
            <div className="flex items-center gap-4">
              <ProfilePanel user={session.user} onLogout={handleLogout} />
            </div>
          </div>
        </div>
        
        <div className="p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            <div className="mb-0" />

          <AnimatePresence mode='wait'>
            <motion.div
              key={currentView}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              {currentView === View.DASHBOARD && (
                <Dashboard assets={assets} locations={locations} employees={employees} />
              )}
              {currentView === View.INVENTORY && (
                <AssetManager
                  assets={assets}
                  employees={employees}
                  locations={locations}
                  onAdd={handleAddAsset}
                  onUpdate={handleUpdateAsset}
                  onDelete={handleDeleteAsset}
                  onAddComment={handleAddComment}
                  canCreate={canCreate(session?.user || null)}
                  canUpdate={canUpdate(session?.user || null)}
                  canDelete={canDelete(session?.user || null)}
                  useBackend={useBackend}
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
                  canCreate={canCreate(session?.user || null)}
                  canUpdate={canUpdate(session?.user || null)}
                  canDelete={canDelete(session?.user || null)}
                  useBackend={useBackend}
                  currentUser={session?.user || null}
                />
              )}
              {currentView === View.LOCATIONS && (
                <LocationManagement
                  locations={locations}
                  assets={assets}
                  onAdd={handleAddLocation}
                  onUpdate={handleUpdateLocation}
                  onDelete={handleDeleteLocation}
                  canCreate={canCreate(session?.user || null)}
                  canUpdate={canUpdate(session?.user || null)}
                  canDelete={canDelete(session?.user || null)}
                />
              )}
              {currentView === View.DEPARTMENTS && (
                <DepartmentManagementPage
                  departments={departments}
                  assets={assets}
                  employees={employees}
                  onAdd={handleAddDepartment}
                  onUpdate={handleUpdateDepartment}
                  onDelete={handleDeleteDepartment}
                  canCreate={canCreate(session?.user || null)}
                  canUpdate={canUpdate(session?.user || null)}
                  canDelete={canDelete(session?.user || null)}
                  currentUser={session?.user || null}
                />
              )}
              {currentView === View.USERS && canDelete(session?.user || null) && (
                <UserManagement
                  users={users}
                  onAdd={handleAddUser}
                  onUpdate={handleUpdateUser}
                  onToggleStatus={handleToggleUserStatus}
                  onResetPassword={handleResetUserPassword}
                />
              )}
              {currentView === View.SETTINGS && canDelete(session?.user || null) && <Settings />}
            </motion.div>
          </AnimatePresence>
          </div>
        </div>
      </main>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={dialogState.isOpen}
        onClose={() => setDialogState(prev => ({ ...prev, isOpen: false }))}
        onConfirm={dialogState.onConfirm}
        title={dialogState.title}
        message={dialogState.message}
        type={dialogState.type}
      />
    </div>
  );
};

export default App;
