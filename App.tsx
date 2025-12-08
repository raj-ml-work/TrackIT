import React, { useState, useEffect } from 'react';
import { Asset, AssetType, AssetStatus, UserAccount, UserRole, UserStatus, AuthSession, LoginCredentials, AssetComment, AssetCommentType, Employee, EmployeeStatus } from './types';
import Dashboard from './components/Dashboard';
import AssetManager from './components/AssetManager';
import Settings from './components/Settings';
import UserManagement from './components/UserManagement';
import EmployeeManagement from './components/EmployeeManagement';
import Login from './components/Login';
import ProfilePanel from './components/ProfilePanel';
import { LayoutDashboard, Box, Settings as SettingsIcon, Hexagon, Menu, X, Users, Briefcase } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import * as authClient from './services/authClient';

// Mock Data
const MOCK_ASSETS: Asset[] = [
  { 
    id: '1',
    assetId: 'AST001',
    name: 'MacBook Pro 16"', 
    type: AssetType.LAPTOP, 
    status: AssetStatus.IN_USE, 
    serialNumber: 'C02XD4JHK', 
    purchaseDate: '2023-01-15', 
    warrantyExpiry: '2024-01-15', 
    cost: 2499, 
    location: 'HQ - Design', 
    assignedTo: 'Sarah Johnson',
    assignedToEmployeeId: 'emp-001',
    specs: { brand: 'Apple', model: 'MacBook Pro', cpu: 'M2 Max', ram: '32GB', storage: '1TB SSD' },
    comments: []
  },
  { 
    id: '2',
    assetId: 'AST002',
    name: 'Dell XPS 15', 
    type: AssetType.LAPTOP, 
    status: AssetStatus.AVAILABLE, 
    serialNumber: '8H2K921', 
    purchaseDate: '2022-11-20', 
    warrantyExpiry: '2025-11-20', 
    cost: 1899, 
    location: 'HQ - IT', 
    notes: 'Reimaged',
    specs: { brand: 'Dell', model: 'XPS 9520', cpu: 'Core i7-12700H', ram: '16GB', storage: '512GB SSD' },
    comments: []
  },
  { 
    id: '3',
    assetId: 'AST003',
    name: 'LG UltraFine 5K', 
    type: AssetType.MONITOR, 
    status: AssetStatus.IN_USE, 
    serialNumber: '992KLA2', 
    purchaseDate: '2023-03-10', 
    warrantyExpiry: '2026-03-10', 
    cost: 1299, 
    location: 'HQ - Design',
    assignedTo: 'Sarah Johnson',
    assignedToEmployeeId: 'emp-001',
    specs: { brand: 'LG', model: '27MD5KL-B', screenSize: '27 inch' },
    comments: []
  },
  { 
    id: '4',
    assetId: 'AST004',
    name: 'Keychron Q1', 
    type: AssetType.ACCESSORY, 
    status: AssetStatus.IN_USE, 
    serialNumber: 'KC-9921', 
    purchaseDate: '2023-06-01', 
    warrantyExpiry: '2024-06-01', 
    cost: 199, 
    location: 'Remote',
    assignedTo: 'Michael Chen',
    assignedToEmployeeId: 'emp-002',
    specs: { brand: 'Keychron', model: 'Q1 Pro' },
    comments: []
  },
  { 
    id: '5',
    assetId: 'AST005',
    name: 'ThinkPad X1 Carbon', 
    type: AssetType.LAPTOP, 
    status: AssetStatus.MAINTENANCE, 
    serialNumber: 'TP-2291', 
    purchaseDate: '2021-05-15', 
    warrantyExpiry: '2024-05-15', 
    cost: 1400, 
    location: 'HQ - Repair',
    specs: { brand: 'Lenovo', model: 'Gen 9', cpu: 'Core i5', ram: '8GB', storage: '256GB' },
    comments: []
  },
  { 
    id: '6',
    assetId: 'AST006',
    name: 'Herman Miller Aeron', 
    type: AssetType.ACCESSORY, 
    status: AssetStatus.IN_USE, 
    serialNumber: 'HM-1102', 
    purchaseDate: '2022-01-01', 
    warrantyExpiry: '2034-01-01', 
    cost: 1400, 
    location: 'HQ - Exec',
    specs: { brand: 'Herman Miller', model: 'Aeron B' },
    comments: []
  },
  {
    id: '7',
    assetId: 'AST007',
    name: 'Conf Room Projector',
    type: AssetType.PROJECTOR,
    status: AssetStatus.IN_USE,
    serialNumber: 'EPS-9912',
    purchaseDate: '2023-01-01',
    warrantyExpiry: '2025-01-01',
    cost: 899,
    location: 'Conf Room A',
    specs: { brand: 'Epson', model: 'VS260' },
    comments: []
  },
  {
    id: '8',
    assetId: 'AST008',
    name: 'Lobby TV',
    type: AssetType.TV,
    status: AssetStatus.IN_USE,
    serialNumber: 'SAM-TV-55',
    purchaseDate: '2023-02-15',
    warrantyExpiry: '2025-02-15',
    cost: 600,
    location: 'Lobby',
    specs: { brand: 'Samsung', model: 'Crystal UHD', screenSize: '55 inch' },
    comments: []
  },
  {
    id: '9',
    assetId: 'AST009',
    name: 'Admin Printer',
    type: AssetType.PRINTER,
    status: AssetStatus.IN_USE,
    serialNumber: 'HP-LJ-200',
    purchaseDate: '2022-06-01',
    warrantyExpiry: '2024-06-01',
    cost: 350,
    location: 'Admin Desk',
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

const MOCK_EMPLOYEES: Employee[] = [
  {
    id: 'emp-001',
    employeeId: 'EMP001',
    name: 'Sarah Johnson',
    email: 'sarah.j@company.com',
    department: 'Design',
    location: 'HQ',
    title: 'Senior Designer',
    status: EmployeeStatus.ACTIVE
  },
  {
    id: 'emp-002',
    employeeId: 'EMP002',
    name: 'Michael Chen',
    email: 'michael.c@company.com',
    department: 'Engineering',
    location: 'HQ',
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
    location: 'HQ',
    title: 'DevOps Engineer',
    status: EmployeeStatus.ACTIVE
  },
  {
    id: 'emp-005',
    employeeId: 'EMP005',
    name: 'Lisa Anderson',
    email: 'lisa.a@company.com',
    department: 'Sales',
    location: 'Branch Office',
    title: 'Sales Executive',
    status: EmployeeStatus.INACTIVE
  }
];

enum View {
  DASHBOARD = 'Dashboard',
  INVENTORY = 'Inventory',
  EMPLOYEES = 'Employees',
  USERS = 'Users',
  SETTINGS = 'Settings'
}

const App: React.FC = () => {
  const [assets, setAssets] = useState<Asset[]>(MOCK_ASSETS);
  const [users, setUsers] = useState<UserAccount[]>(MOCK_USERS);
  const [employees, setEmployees] = useState<Employee[]>(MOCK_EMPLOYEES);
  const [currentView, setCurrentView] = useState<View>(View.DASHBOARD);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Auth state
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAdmin = session?.user.role === UserRole.ADMIN;

  // Restore session on mount
  useEffect(() => {
    const restored = authClient.restoreSession();
    if (restored) {
      setSession(restored);
    }
    setIsLoading(false);
  }, []);

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
  const handleAddAsset = (newAsset: Omit<Asset, 'id'>) => {
    const assetId = Math.random().toString(36).substr(2, 9);
    
    // Auto-set status to In Use if asset is assigned during creation
    let finalAsset = { ...newAsset };
    if (finalAsset.assignedToEmployeeId && finalAsset.status === AssetStatus.AVAILABLE) {
      finalAsset.status = AssetStatus.IN_USE;
    }
    
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
      ...finalAsset, 
      id: assetId,
      comments: [creationComment]
    };
    setAssets(prev => [asset, ...prev]);
  };

  const handleUpdateAsset = (updatedAsset: Asset) => {
    setAssets(prev => prev.map(a => {
      if (a.id === updatedAsset.id) {
        // Auto-update status based on assignment
        let finalAsset = { ...updatedAsset };
        
        // If asset is being assigned and status is Available, change to In Use
        if (finalAsset.assignedToEmployeeId && !a.assignedToEmployeeId && finalAsset.status === AssetStatus.AVAILABLE) {
          finalAsset.status = AssetStatus.IN_USE;
        }
        
        // If asset is being unassigned and status is In Use, change to Available
        if (!finalAsset.assignedToEmployeeId && a.assignedToEmployeeId && finalAsset.status === AssetStatus.IN_USE) {
          finalAsset.status = AssetStatus.AVAILABLE;
        }
        
        // Generate audit trail for changes
        const auditComments: AssetComment[] = [];
        const now = new Date().toISOString();
        
        if (a.status !== finalAsset.status) {
          auditComments.push({
            id: Math.random().toString(36).substr(2, 9),
            assetId: a.id,
            authorName: session?.user.name || 'System',
            authorId: session?.user.id,
            message: `Status changed from "${a.status}" to "${finalAsset.status}"`,
            type: AssetCommentType.SYSTEM,
            createdAt: now
          });
        }
        
        if (a.assignedTo !== finalAsset.assignedTo) {
          auditComments.push({
            id: Math.random().toString(36).substr(2, 9),
            assetId: a.id,
            authorName: session?.user.name || 'System',
            authorId: session?.user.id,
            message: `Assigned to changed from "${a.assignedTo || 'Unassigned'}" to "${finalAsset.assignedTo || 'Unassigned'}"`,
            type: AssetCommentType.SYSTEM,
            createdAt: now
          });
        }
        
        if (a.location !== finalAsset.location) {
          auditComments.push({
            id: Math.random().toString(36).substr(2, 9),
            assetId: a.id,
            authorName: session?.user.name || 'System',
            authorId: session?.user.id,
            message: `Location changed from "${a.location}" to "${finalAsset.location}"`,
            type: AssetCommentType.SYSTEM,
            createdAt: now
          });
        }
        
        // Merge existing comments with new audit comments
        const allComments = [...(finalAsset.comments || []), ...auditComments];
        return { ...finalAsset, comments: allComments };
      }
      return a;
    }));
  };

  const handleAddComment = (assetId: string, message: string) => {
    const newComment: AssetComment = {
      id: Math.random().toString(36).substr(2, 9),
      assetId,
      authorName: session?.user.name || 'Unknown',
      authorId: session?.user.id,
      message,
      type: AssetCommentType.NOTE,
      createdAt: new Date().toISOString()
    };
    
    setAssets(prev => prev.map(a => {
      if (a.id === assetId) {
        return {
          ...a,
          comments: [...(a.comments || []), newComment]
        };
      }
      return a;
    }));
  };

  const handleDeleteAsset = (id: string) => {
    if (confirm('Are you sure you want to delete this asset?')) {
      setAssets(prev => prev.filter(a => a.id !== id));
    }
  };

  // User handlers
  const handleAddUser = (user: Omit<UserAccount, 'id' | 'lastLogin'>) => {
    const newUser: UserAccount = {
      ...user,
      id: Math.random().toString(36).substr(2, 9),
      lastLogin: '—'
    };
    
    // Register the user in auth system if password provided
    if (user.password) {
      authClient.registerUser({ ...newUser, password: user.password });
    }
    
    // Remove password before storing in state (security)
    const { password, ...userWithoutPassword } = newUser;
    setUsers(prev => [userWithoutPassword, ...prev]);
  };

  const handleUpdateUser = (updated: UserAccount) => {
    setUsers(prev => prev.map(u => u.id === updated.id ? updated : u));
  };

  const handleToggleUserStatus = (id: string) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, status: u.status === UserStatus.ACTIVE ? UserStatus.INACTIVE : UserStatus.ACTIVE } : u));
  };

  // Employee handlers
  const handleAddEmployee = (employee: Omit<Employee, 'id'>) => {
    const newEmployee: Employee = {
      ...employee,
      id: `emp-${Math.random().toString(36).substr(2, 9)}`
    };
    setEmployees(prev => [newEmployee, ...prev]);
  };

  const handleUpdateEmployee = (updated: Employee) => {
    setEmployees(prev => prev.map(e => e.id === updated.id ? updated : e));
  };

  const handleDeleteEmployee = (id: string) => {
    // Check if employee has assigned assets
    const hasAssignedAssets = assets.some(a => a.assignedToEmployeeId === id);
    if (hasAssignedAssets) {
      const employee = employees.find(e => e.id === id);
      const count = assets.filter(a => a.assignedToEmployeeId === id).length;
      alert(`Cannot delete ${employee?.name || 'this employee'}. They have ${count} asset(s) assigned. Please reassign or unassign assets first.`);
      return;
    }
    setEmployees(prev => prev.filter(e => e.id !== id));
  };

  const NavItem = ({ view, icon: Icon }: { view: View, icon: any }) => (
    <button
      onClick={() => { setCurrentView(view); setIsMobileMenuOpen(false); }}
      className={`flex items-center gap-3 px-6 py-3 rounded-2xl transition-all duration-300 w-full ${
        currentView === view 
          ? 'bg-gray-900 text-white shadow-lg shadow-gray-900/20' 
          : 'text-gray-500 hover:bg-white/50 hover:text-gray-900'
      }`}
    >
      <Icon size={20} />
      <span className="font-medium tracking-tight">{view}</span>
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
      <aside className="hidden lg:flex flex-col w-72 fixed h-full p-6 glass-panel border-r-0 rounded-r-3xl z-20">
        <div className="flex items-center gap-3 px-4 mb-12 mt-2">
          <div className="p-2 bg-gray-900 rounded-xl text-white">
            <Hexagon size={24} fill="currentColor" className="text-white" />
          </div>
          <h1 className="text-2xl font-display font-bold tracking-tight text-gray-900">Auralis</h1>
        </div>

        <nav className="space-y-2 flex-1">
          <NavItem view={View.DASHBOARD} icon={LayoutDashboard} />
          <NavItem view={View.INVENTORY} icon={Box} />
          <NavItem view={View.EMPLOYEES} icon={Briefcase} />
          {isAdmin && <NavItem view={View.USERS} icon={Users} />}
          {isAdmin && <NavItem view={View.SETTINGS} icon={SettingsIcon} />}
        </nav>

        <div className="mt-auto px-6 py-4 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg">
          <p className="text-xs opacity-80 font-medium mb-1">Pro Plan</p>
          <p className="text-sm font-bold">Auralis Corp</p>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 w-full z-30 px-6 py-4 glass-panel border-b border-white/20 flex justify-between items-center">
        <div className="flex items-center gap-2">
           <Hexagon size={24} className="text-gray-900" />
           <span className="font-bold text-lg">Auralis</span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 rounded-lg bg-white/50">
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
            className="fixed top-20 left-0 w-full z-20 bg-white/95 backdrop-blur-xl p-6 shadow-xl border-b border-gray-100 lg:hidden"
          >
             <nav className="space-y-2">
             <NavItem view={View.DASHBOARD} icon={LayoutDashboard} />
              <NavItem view={View.INVENTORY} icon={Box} />
              <NavItem view={View.EMPLOYEES} icon={Briefcase} />
              {isAdmin && <NavItem view={View.USERS} icon={Users} />}
              {isAdmin && <NavItem view={View.SETTINGS} icon={SettingsIcon} />}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 lg:ml-72 p-6 lg:p-10 pt-24 lg:pt-10 overflow-y-auto min-h-screen">
        <div className="max-w-7xl mx-auto">
          <header className="mb-8 flex justify-between items-end gap-4 flex-wrap">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 tracking-tight mb-2">{currentView}</h2>
              <p className="text-gray-500 font-medium">
                {currentView === View.DASHBOARD && `Overview of ${assets.length} managed assets.`}
                {currentView === View.INVENTORY && "Manage and track your corporate equipment."}
                {currentView === View.EMPLOYEES && "Manage organization employees and asset assignments."}
                {currentView === View.USERS && "Admin-only control of teammates, roles, and status."}
                {currentView === View.SETTINGS && "Configure your workspace."}
              </p>
            </div>
            <ProfilePanel user={session.user} onLogout={handleLogout} />
          </header>

          <AnimatePresence mode='wait'>
            <motion.div
              key={currentView}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              {currentView === View.DASHBOARD && <Dashboard assets={assets} />}
              {currentView === View.INVENTORY && (
                <AssetManager 
                  assets={assets}
                  employees={employees}
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
                  onAdd={handleAddEmployee}
                  onUpdate={handleUpdateEmployee}
                  onDelete={handleDeleteEmployee}
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
      </main>
    </div>
  );
};

export default App;
