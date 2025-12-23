import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Search, 
  Filter, 
  Download, 
  Share2, 
  Edit, 
  Trash2, 
  Eye, 
  User,
  Building2,
  Briefcase,
  Mail,
  Phone,
  Calendar,
  Settings,
  AlertCircle
} from 'lucide-react';
import { GlassCard } from './GlassCard';
import { LoadingSpinner } from './LoadingSpinner';
import { ErrorBoundary } from './ErrorBoundary';
import { usePerformanceMonitoring } from '../hooks/usePerformanceMonitoring';
import { dataLoader } from '../services/dataLoader';
import { Employee, EmployeeStatus } from '../types';

/**
 * Employee Management component with pagination and virtualization
 */
export const EmployeeManagement: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<EmployeeStatus | 'all'>('all');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Performance monitoring
  const { trackUserAction, trackApiCall } = usePerformanceMonitoring();

  // Load employees with pagination
  const loadEmployees = useCallback(async (page: number = 1) => {
    setLoading(true);
    setError(null);

    try {
      const result = await trackApiCall(
        () => dataLoader.loadAllEmployees(page),
        `employees?page=${page}&status=${filterStatus}&department=${filterDepartment}&search=${searchQuery}`
      );

      setEmployees(result.data);
      setTotal(result.total);
      setTotalPages(result.totalPages);
      setCurrentPage(result.page);
    } catch (err) {
      console.error('Failed to load employees:', err);
      setError(err instanceof Error ? err.message : 'Failed to load employees');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterDepartment, searchQuery, trackApiCall]);

  // Load next page for preloading
  const preloadNextPage = useCallback(async () => {
    if (currentPage < totalPages) {
      await dataLoader.preloadNextEmployeesPage(currentPage);
    }
  }, [currentPage, totalPages]);

  // Initialize and reload data
  useEffect(() => {
    loadEmployees(currentPage);
  }, [loadEmployees, currentPage]);

  // Preload next page when current page loads
  useEffect(() => {
    if (!loading && employees.length > 0) {
      preloadNextPage();
    }
  }, [loading, employees, preloadNextPage]);

  // Handle search
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
    trackUserAction('employee_search', { query });
  }, [trackUserAction]);

  // Handle filters
  const handleFilter = useCallback((status: EmployeeStatus | 'all', department: string) => {
    setFilterStatus(status);
    setFilterDepartment(department);
    setCurrentPage(1);
    trackUserAction('employee_filter', { status, department });
  }, [trackUserAction]);

  // Handle sorting
  const handleSort = useCallback((field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    trackUserAction('employee_sort', { field, order: sortOrder === 'asc' ? 'desc' : 'asc' });
  }, [sortBy, sortOrder, trackUserAction]);

  // Handle page change
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    trackUserAction('employee_page_change', { page });
  }, [trackUserAction]);

  // Employee status colors
  const getStatusColor = (status: EmployeeStatus) => {
    switch (status) {
      case 'Active': return 'text-green-600 bg-green-100';
      case 'Inactive': return 'text-yellow-600 bg-yellow-100';
      case 'Terminated': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  if (loading && currentPage === 1) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="container mx-auto px-4 py-8">
          <LoadingSpinner message="Loading employees..." />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <ErrorBoundary>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
          <GlassCard className="max-w-md">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-slate-900 mb-2">Failed to Load Employees</h2>
              <p className="text-slate-600 mb-6">{error}</p>
              <button
                onClick={() => loadEmployees(currentPage)}
                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg transition-colors"
              >
                Try Again
              </button>
            </div>
          </GlassCard>
        </div>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="flex flex-col lg:flex-row justify-between items-center mb-8 gap-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 mb-2">Employee Management</h1>
              <p className="text-slate-600">Manage your organization's employees and their information</p>
            </div>
            
            <div className="flex flex-wrap gap-3">
              <button className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-colors">
                <Plus className="w-4 h-4" />
                Add Employee
              </button>
              <button className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors">
                <Download className="w-4 h-4" />
                Export
              </button>
              <button className="flex items-center gap-2 bg-slate-500 hover:bg-slate-600 text-white px-4 py-2 rounded-lg transition-colors">
                <Share2 className="w-4 h-4" />
                Share
              </button>
            </div>
          </div>

          {/* Filters and Search */}
          <GlassCard className="mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search employees..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <select
                value={filterStatus}
                onChange={(e) => handleFilter(e.target.value as EmployeeStatus | 'all', filterDepartment)}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Terminated">Terminated</option>
              </select>

              <select
                value={filterDepartment}
                onChange={(e) => handleFilter(filterStatus, e.target.value)}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Departments</option>
                <option value="Engineering">Engineering</option>
                <option value="Sales">Sales</option>
                <option value="Marketing">Marketing</option>
                <option value="HR">HR</option>
                <option value="Finance">Finance</option>
              </select>

              <div className="flex gap-2">
                <button
                  onClick={() => handleSort('name')}
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Name {sortBy === 'name' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                </button>
                <button
                  onClick={() => handleSort('department')}
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Department {sortBy === 'department' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                </button>
              </div>

              <div className="flex gap-2">
                <button className="flex items-center gap-2 px-4 py-2 bg-slate-500 text-white rounded-lg hover:bg-slate-600 transition-colors">
                  <Settings className="w-4 h-4" />
                  Advanced
                </button>
              </div>
            </div>
          </GlassCard>

          {/* Employees Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <AnimatePresence mode="wait">
              {employees.map((employee, index) => (
                <motion.div
                  key={employee.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                >
                  <GlassCard className="hover:shadow-lg transition-shadow cursor-pointer">
                    <div className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-lg font-semibold text-slate-900 mb-1">{employee.name}</h3>
                          <p className="text-sm text-slate-600">{employee.title}</p>
                        </div>
                        <div className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(employee.status)}`}>
                          {employee.status}
                        </div>
                      </div>
                      
                      <div className="space-y-2 text-sm text-slate-600">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4" />
                          <span>{employee.employeeId}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4" />
                          <span>{employee.email}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4" />
                          <span>{employee.department}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Briefcase className="w-4 h-4" />
                          <span>{employee.title}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4" />
                          <span>{employee.personalInfo?.mobileNumber || 'Not provided'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          <span>Location: {employee.location}</span>
                        </div>
                      </div>

                      <div className="mt-4 flex gap-2">
                        <button className="flex items-center gap-2 px-3 py-1 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition-colors">
                          <Eye className="w-3 h-3" />
                          View Details
                        </button>
                        <button className="flex items-center gap-2 px-3 py-1 bg-yellow-500 text-white rounded-lg text-sm hover:bg-yellow-600 transition-colors">
                          <Edit className="w-3 h-3" />
                          Edit
                        </button>
                        <button className="flex items-center gap-2 px-3 py-1 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 transition-colors">
                          <Trash2 className="w-3 h-3" />
                          Delete
                        </button>
                      </div>
                    </div>
                  </GlassCard>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-4">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              
              <div className="text-sm text-slate-600">
                Page {currentPage} of {totalPages}
              </div>
              
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          )}

          {/* Summary */}
          <GlassCard className="mt-8">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-slate-600">Showing {employees.length} of {total} employees</p>
                <p className="text-xs text-slate-500 mt-1">
                  Use filters to narrow down results and improve performance
                </p>
              </div>
              <div className="flex gap-4 text-sm text-slate-600">
                <span>Active: {employees.filter(e => e.status === 'Active').length}</span>
                <span>Inactive: {employees.filter(e => e.status === 'Inactive').length}</span>
                <span>Terminated: {employees.filter(e => e.status === 'Terminated').length}</span>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </ErrorBoundary>
  );
};