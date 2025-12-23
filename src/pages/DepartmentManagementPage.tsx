import React, { useState, useEffect } from 'react';
import DepartmentManagement from '../../components/DepartmentManagement';
import { GlassCard } from '../components/GlassCard';
import { Building2, Users, AlertCircle, RefreshCw } from 'lucide-react';
import { Department, Employee } from '../types';
import { departmentService } from '../services/departmentService';
import { getEmployees } from '../services/employeeService';
import { dataLoader } from '../services/dataLoader';

interface DepartmentManagementPageProps {
  onAddDepartment?: (department: Omit<Department, 'id'>) => Promise<void>;
  onDeleteDepartment?: (id: string) => Promise<void>;
}

const DepartmentManagementPage: React.FC<DepartmentManagementPageProps> = ({
  onAddDepartment,
  onDeleteDepartment
}) => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'online' | 'offline' | 'checking'>('checking');

  // Check connection status
  useEffect(() => {
    const checkConnection = async () => {
      try {
        setConnectionStatus('checking');
        await departmentService.getAll();
        setConnectionStatus('online');
      } catch (err) {
        setConnectionStatus('offline');
      }
    };

    checkConnection();
  }, []);

  // Load data with fresh fetch on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Clear cache to ensure fresh data
        dataLoader.clearCache('reference_data');
        dataLoader.clearCache('current_employees');

        // Load departments and employees
        const [departmentsData, employeesData] = await Promise.all([
          departmentService.getAll(),
          getEmployees(1, 1000)
        ]);

        setDepartments(departmentsData);
        setEmployees(employeesData);
      } catch (err) {
        console.error('Error loading department data:', err);
        setError('Failed to load department data. Please check your connection and try again.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Handle adding a new department
  const handleAddDepartment = async (departmentData: Omit<Department, 'id'>) => {
    try {
      setLoading(true);
      setError(null);

      const newDepartment = await departmentService.create(departmentData);
      setDepartments(prev => [...prev, newDepartment]);

      // Show success message
      alert(`Department "${newDepartment.name}" has been added successfully.`);
    } catch (err: any) {
      console.error('Error adding department:', err);
      setError(err.message || 'Failed to add department. Please try again.');
      throw err; // Re-throw to prevent modal from closing
    } finally {
      setLoading(false);
    }
  };

  // Handle deleting a department
  const handleDeleteDepartment = async (id: string) => {
    try {
      setLoading(true);
      setError(null);

      await departmentService.delete(id);
      setDepartments(prev => prev.filter(dept => dept.id !== id));

      // Show success message
      alert('Department has been deleted successfully.');
    } catch (err: any) {
      console.error('Error deleting department:', err);
      setError(err.message || 'Failed to delete department. Please try again.');
      throw err; // Re-throw to prevent deletion confirmation
    } finally {
      setLoading(false);
    }
  };

  // Handle refresh data
  const handleRefresh = async () => {
    try {
      setLoading(true);
      setError(null);

      // Clear cache and reload data
      dataLoader.clearCache('reference_data');
      dataLoader.clearCache('current_employees');

      const [departmentsData, employeesData] = await Promise.all([
        departmentService.getAll(),
        getEmployees(1, 1000)
      ]);

      setDepartments(departmentsData);
      setEmployees(employeesData);
    } catch (err) {
      console.error('Error refreshing data:', err);
      setError('Failed to refresh data. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  // Render connection status indicator
  const renderConnectionStatus = () => {
    if (connectionStatus === 'online') {
      return (
        <div className="flex items-center gap-2 px-3 py-2 bg-green-100 text-green-700 rounded-lg">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-sm font-medium">Connected to database</span>
        </div>
      );
    } else if (connectionStatus === 'offline') {
      return (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-100 text-red-700 rounded-lg">
          <AlertCircle size={16} />
          <span className="text-sm font-medium">Database connection lost</span>
        </div>
      );
    } else {
      return (
        <div className="flex items-center gap-2 px-3 py-2 bg-yellow-100 text-yellow-700 rounded-lg">
          <RefreshCw size={16} className="animate-spin" />
          <span className="text-sm font-medium">Checking connection...</span>
        </div>
      );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-white/20 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl shadow-lg">
                <Building2 size={32} className="text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Department Management</h1>
                <p className="text-gray-600 mt-1">Manage departments and track employee assignments</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {renderConnectionStatus()}
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error Alert */}
        {error && (
          <div className="mb-6">
            <GlassCard>
              <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
                <AlertCircle size={20} className="text-red-500 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-red-800 font-medium">{error}</p>
                  <p className="text-red-600 text-sm mt-1">
                    If this problem persists, please contact your system administrator.
                  </p>
                </div>
                <button
                  onClick={() => setError(null)}
                  className="text-red-500 hover:text-red-700"
                >
                  ×
                </button>
              </div>
            </GlassCard>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <GlassCard>
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 font-medium">Total Departments</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {loading ? '...' : departments.length}
                  </p>
                </div>
                <div className="p-3 bg-blue-100 rounded-xl">
                  <Building2 size={28} className="text-blue-600" />
                </div>
              </div>
            </div>
          </GlassCard>

          <GlassCard>
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 font-medium">Total Employees</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {loading ? '...' : employees.length}
                  </p>
                </div>
                <div className="p-3 bg-green-100 rounded-xl">
                  <Users size={28} className="text-green-600" />
                </div>
              </div>
            </div>
          </GlassCard>

          <GlassCard>
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 font-medium">Usage Status</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {loading ? '...' : 'Real-time'}
                  </p>
                </div>
                <div className="p-3 bg-purple-100 rounded-xl">
                  <RefreshCw size={28} className="text-purple-600" />
                </div>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Department Management Component */}
        <GlassCard>
          <div className="p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                  <p className="text-gray-600">Loading departments...</p>
                </div>
              </div>
            ) : (
              <DepartmentManagement
                departments={departments}
                employees={employees}
                onAdd={handleAddDepartment}
                onDelete={handleDeleteDepartment}
                canDelete={connectionStatus === 'online'}
              />
            )}
          </div>
        </GlassCard>

        {/* Instructions */}
        <GlassCard className="mt-6">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">How to Use</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
              <div>
                <strong className="text-gray-900">Add Departments:</strong> Click "Add Department" to create new departments. 
                Department names must be unique.
              </div>
              <div>
                <strong className="text-gray-900">Delete Departments:</strong> Click on a department tag to delete it. 
                Departments in use by employees cannot be deleted.
              </div>
              <div>
                <strong className="text-gray-900">Track Usage:</strong> The number on each department tag shows how many 
                employees are assigned to that department.
              </div>
              <div>
                <strong className="text-gray-900">Real-time Updates:</strong> Data is fetched fresh from the database 
                on each page load and refresh.
              </div>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
};

export default DepartmentManagementPage;