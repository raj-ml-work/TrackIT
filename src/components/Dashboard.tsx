import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  TrendingUp, 
  Users, 
  Package, 
  ShieldCheck, 
  AlertTriangle,
  Clock,
  Calendar,
  DollarSign,
  RefreshCw,
  Plus,
  Search,
  Filter,
  Download,
  Share2
} from 'lucide-react';
import { GlassCard } from './GlassCard';
import { LoadingSpinner } from './LoadingSpinner';
import { ErrorBoundary } from './ErrorBoundary';
import { usePerformanceMonitoring } from '../hooks/usePerformanceMonitoring';
import { useAsyncInsights } from '../hooks/useAsyncInsights';
import { dataLoader } from '../services/dataLoader';
import { GeminiInsight } from '../types';

interface DashboardProps {
  insights?: GeminiInsight[];
}

/**
 * Dashboard component with performance optimizations
 */
export const Dashboard: React.FC<DashboardProps> = ({ insights: initialInsights }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<any>(null);
  const [activeAssets, setActiveAssets] = useState<any[]>([]);
  const [currentEmployees, setCurrentEmployees] = useState<any[]>([]);
  const [laptopAssets, setLaptopAssets] = useState<any[]>([]);
  const [employeeDirectory, setEmployeeDirectory] = useState<any[]>([]);
  const [selectedTimeRange, setSelectedTimeRange] = useState('7d');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // Performance monitoring
  const { trackUserAction, trackMetric } = usePerformanceMonitoring();
  
  // Async insights
  const { insights, loading: insightsLoading, generateInsight } = useAsyncInsights({
    autoGenerate: false,
    cacheDuration: 15 * 60 * 1000 // 15 minutes
  });

  // Load initial data with priority-based loading
  const loadInitialData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Load critical data first
      const [
        dashboardMetrics, 
        activeAssetsData, 
        currentEmployeesData,
        laptopAssetsData,
        employeeDirectoryData
      ] = await Promise.all([
        dataLoader.loadDashboardMetrics(),
        dataLoader.loadActiveAssets(),
        dataLoader.loadCurrentEmployees(),
        dataLoader.loadLaptopAssets(),
        dataLoader.loadEmployeeDirectory()
      ]);

      setMetrics(dashboardMetrics);
      setActiveAssets(activeAssetsData);
      setCurrentEmployees(currentEmployeesData);
      setLaptopAssets(laptopAssetsData);
      setEmployeeDirectory(employeeDirectoryData);

      // Track successful data loading
      trackMetric('dashboard_data_loaded', {
        metricsLoaded: true,
        assetsCount: activeAssetsData.length,
        employeesCount: currentEmployeesData.length,
        laptopAssetsCount: laptopAssetsData.length,
        directoryCount: employeeDirectoryData.length
      });

      setLoading(false);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
      setLoading(false);
    }
  }, [trackMetric]);

  // Initialize data on mount
  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Generate insights when data is loaded
  useEffect(() => {
    if (metrics && !insightsLoading && (!initialInsights || initialInsights.length === 0)) {
      generateInsight(
        `Analyze dashboard metrics: ${metrics.totalAssets} total assets, ${metrics.utilizationRate}% utilization rate, ${metrics.expiringWarranties} expiring warranties. Provide optimization recommendations.`,
        'utilization'
      );
    }
  }, [metrics, insightsLoading, initialInsights, generateInsight]);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    trackUserAction('dashboard_refresh');
    await loadInitialData();
  }, [loadInitialData, trackUserAction]);

  // Handle search
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    trackUserAction('dashboard_search', { query });
  }, [trackUserAction]);

  // Handle filter
  const handleFilter = useCallback((status: string) => {
    setFilterStatus(status);
    trackUserAction('dashboard_filter', { status });
  }, [trackUserAction]);

  const usedStatuses = useMemo(() => new Set(['In Use', 'Assigned']), []);

  const laptopLocationStats = useMemo(() => {
    const stats = new Map<string, { used: number; available: number; total: number }>();

    laptopAssets.forEach((asset) => {
      const locationValue = typeof asset.location === 'string'
        ? asset.location
        : asset.location?.name || asset.locationName || asset.location_name;
      const location = (locationValue || 'Unassigned').toString().trim() || 'Unassigned';
      const entry = stats.get(location) || { used: 0, available: 0, total: 0 };

      if (usedStatuses.has(asset.status)) {
        entry.used += 1;
      }
      if (asset.status === 'Available') {
        entry.available += 1;
      }

      entry.total += 1;
      stats.set(location, entry);
    });

    return Array.from(stats.entries())
      .map(([location, counts]) => ({ location, ...counts }))
      .sort((a, b) => b.total - a.total);
  }, [laptopAssets, usedStatuses]);

  const laptopDepartmentStats = useMemo(() => {
    const employeeLookup = new Map<string, any>();
    employeeDirectory.forEach((employee) => {
      if (employee?.id) employeeLookup.set(employee.id, employee);
      if (employee?.employeeId) employeeLookup.set(employee.employeeId, employee);
      if (employee?.name) employeeLookup.set(employee.name, employee);
    });

    const counts = new Map<string, number>();

    laptopAssets.forEach((asset) => {
      if (!usedStatuses.has(asset.status)) {
        return;
      }

      const assigneeKey = asset.employeeId
        || asset.employee_id
        || asset.assignedToId
        || asset.assigned_to_uuid
        || asset.assignedTo
        || asset.assigned_to;

      let department = 'Unassigned';

      if (assigneeKey) {
        const employee = employeeLookup.get(assigneeKey);
        department = employee?.department?.trim()
          || employee?.officialInfo?.division
          || 'Unknown';
      }

      counts.set(department, (counts.get(department) || 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([department, used]) => ({ department, used }))
      .sort((a, b) => b.used - a.used);
  }, [laptopAssets, employeeDirectory, usedStatuses]);

  // Calculate asset distribution
  const assetDistribution = [
    { name: 'In Use', value: activeAssets.length, color: '#10b981' },
    { name: 'Available', value: Math.max(0, metrics?.totalAssets - activeAssets.length), color: '#3b82f6' },
    { name: 'Maintenance', value: 5, color: '#f59e0b' },
    { name: 'Retired', value: 2, color: '#6b7280' }
  ];

  // Calculate utilization trend (mock data for demo)
  const utilizationTrend = [
    { date: '12/16', value: 82 },
    { date: '12/17', value: 84 },
    { date: '12/18', value: 86 },
    { date: '12/19', value: 85 },
    { date: '12/20', value: 87 },
    { date: '12/21', value: 86 },
    { date: '12/22', value: 87 }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <GlassCard key={i} className="animate-pulse">
                <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-slate-200 rounded w-1/2"></div>
              </GlassCard>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <GlassCard key={i} className="animate-pulse">
                <div className="h-6 bg-slate-200 rounded w-1/3 mb-4"></div>
                <div className="space-y-3">
                  {[...Array(5)].map((_, j) => (
                    <div key={j} className="h-4 bg-slate-200 rounded"></div>
                  ))}
                </div>
              </GlassCard>
            ))}
          </div>
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
              <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-slate-900 mb-2">Failed to Load Dashboard</h2>
              <p className="text-slate-600 mb-6">{error}</p>
              <button
                onClick={handleRefresh}
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
        {/* Header */}
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col lg:flex-row justify-between items-center mb-4 gap-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 mb-2">Dashboard</h1>
            </div>
            
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleRefresh}
                className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-900 px-4 py-2 rounded-lg border border-slate-200 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
              
              <button className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-colors">
                <Plus className="w-4 h-4" />
                Add Asset
              </button>
            </div>
          </div>

          {/* Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <GlassCard>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Total Assets</p>
                  <p className="text-2xl font-bold text-slate-900">{metrics?.totalAssets || 0}</p>
                </div>
                <Package className="w-8 h-8 text-blue-500" />
              </div>
            </GlassCard>

            <GlassCard>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Total Value</p>
                  <p className="text-2xl font-bold text-slate-900">
                    ${metrics?.totalValue?.toLocaleString() || '0'}
                  </p>
                </div>
                <DollarSign className="w-8 h-8 text-green-500" />
              </div>
            </GlassCard>

            <GlassCard>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Utilization Rate</p>
                  <p className="text-2xl font-bold text-slate-900">{metrics?.utilizationRate || 0}%</p>
                </div>
                <TrendingUp className="w-8 h-8 text-purple-500" />
              </div>
            </GlassCard>

            <GlassCard>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Expiring Warranties</p>
                  <p className="text-2xl font-bold text-slate-900 text-orange-500">
                    {metrics?.expiringWarranties || 0}
                  </p>
                </div>
                <ShieldCheck className="w-8 h-8 text-orange-500" />
              </div>
            </GlassCard>
          </div>

          {/* Charts and Data */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Asset Distribution */}
            <GlassCard className="lg:col-span-1">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Asset Distribution</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={assetDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {assetDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>

            {/* Utilization Trend */}
            <GlassCard className="lg:col-span-2">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-slate-900">Utilization Trend</h3>
                <div className="flex gap-2">
                  {['7d', '30d', '90d'].map((range) => (
                    <button
                      key={range}
                      onClick={() => setSelectedTimeRange(range)}
                      className={`px-3 py-1 rounded-lg text-sm ${
                        selectedTimeRange === range
                          ? 'bg-blue-500 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {range}
                    </button>
                  ))}
                </div>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={utilizationTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>
          </div>

          {/* Laptop Status Wizards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <GlassCard>
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Laptops Used/Available by Location</h3>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {laptopLocationStats.length === 0 ? (
                  <p className="text-sm text-slate-500">No laptop data available yet.</p>
                ) : (
                  laptopLocationStats.map((entry) => (
                    <div
                      key={entry.location}
                      className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{entry.location}</p>
                        <p className="text-xs text-slate-500">Total {entry.total}</p>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-700">
                          Used {entry.used}
                        </span>
                        <span className="rounded-full bg-sky-100 px-2 py-1 text-sky-700">
                          Available {entry.available}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </GlassCard>

            <GlassCard>
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Laptops Used by Department</h3>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {laptopDepartmentStats.length === 0 ? (
                  <p className="text-sm text-slate-500">No assigned laptops yet.</p>
                ) : (
                  laptopDepartmentStats.map((entry) => (
                    <div
                      key={entry.department}
                      className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{entry.department}</p>
                        <p className="text-xs text-slate-500">Assigned laptops</p>
                      </div>
                      <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
                        {entry.used}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </GlassCard>
          </div>

          {/* Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Active Assets */}
            <GlassCard>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-slate-900">Active Assets</h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Search assets..."
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="px-3 py-1 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <select
                    value={filterStatus}
                    onChange={(e) => handleFilter(e.target.value)}
                    className="px-3 py-1 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Status</option>
                    <option value="In Use">In Use</option>
                    <option value="Available">Available</option>
                    <option value="Maintenance">Maintenance</option>
                  </select>
                </div>
              </div>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {activeAssets.slice(0, 5).map((asset) => (
                  <div key={asset.id} className="flex justify-between items-center p-3 bg-white rounded-lg border border-slate-200">
                    <div>
                      <p className="font-medium text-slate-900">{asset.name}</p>
                      <p className="text-sm text-slate-600">{asset.type} • {asset.serialNumber}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-slate-900">{asset.status}</p>
                      <p className="text-xs text-slate-500">{asset.location}</p>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>

            {/* Current Employees */}
            <GlassCard>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-slate-900">Current Employees</h3>
                <div className="flex gap-2">
                  <button className="flex items-center gap-2 px-3 py-1 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600">
                    <Plus className="w-4 h-4" />
                    Add
                  </button>
                </div>
              </div>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {currentEmployees.slice(0, 5).map((employee) => (
                  <div key={employee.id} className="flex justify-between items-center p-3 bg-white rounded-lg border border-slate-200">
                    <div>
                      <p className="font-medium text-slate-900">{employee.name}</p>
                      <p className="text-sm text-slate-600">{employee.department} • {employee.title}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-slate-900">{employee.status}</p>
                      <p className="text-xs text-slate-500">{employee.location}</p>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>

          {/* AI Insights */}
          <GlassCard>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-slate-900">AI Insights</h3>
              <div className="flex gap-2">
                <button className="flex items-center gap-2 px-3 py-1 bg-purple-500 text-white rounded-lg text-sm hover:bg-purple-600">
                  <RefreshCw className="w-4 h-4" />
                  Refresh Insights
                </button>
                <button className="flex items-center gap-2 px-3 py-1 bg-slate-500 text-white rounded-lg text-sm hover:bg-slate-600">
                  <Share2 className="w-4 h-4" />
                  Export
                </button>
              </div>
            </div>
            <div className="space-y-4">
              {(initialInsights || insights).map((insight) => (
                <div key={insight.id} className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200">
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-sm font-medium text-purple-600">AI Analysis</span>
                    <span className="text-xs text-slate-500">{new Date(insight.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-slate-800">{insight.response}</p>
                  <div className="mt-2 flex items-center gap-4 text-xs text-slate-600">
                    <span>Confidence: {(insight.confidence * 100).toFixed(0)}%</span>
                    <span>•</span>
                    <span>Type: {insight.type}</span>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>
    </ErrorBoundary>
  );
};
