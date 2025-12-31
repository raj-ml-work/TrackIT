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
  Tag,
  Calendar,
  DollarSign,
  MapPin,
  User,
  Settings,
  AlertCircle
} from 'lucide-react';
import { GlassCard } from './GlassCard';
import { LoadingSpinner } from './LoadingSpinner';
import { ErrorBoundary } from './ErrorBoundary';
import { usePerformanceMonitoring } from '../hooks/usePerformanceMonitoring';
import { dataLoader } from '../services/dataLoader';
import { Asset, AssetType, AssetStatus } from '../types';

/**
 * Asset Manager component with pagination and virtualization
 */
export const AssetManager: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<AssetStatus | 'all'>('all');
  const [filterType, setFilterType] = useState<AssetType | 'all'>('all');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Performance monitoring
  const { trackUserAction, trackApiCall } = usePerformanceMonitoring();

  // Load assets with pagination
  const loadAssets = useCallback(async (page: number = 1) => {
    setLoading(true);
    setError(null);

    try {
      const result = await trackApiCall(
        () => dataLoader.loadAllAssets(page),
        `assets?page=${page}&status=${filterStatus}&type=${filterType}&search=${searchQuery}`
      );

      setAssets(result.data);
      setTotal(result.total);
      setTotalPages(result.totalPages);
      setCurrentPage(result.page);
    } catch (err) {
      console.error('Failed to load assets:', err);
      setError(err instanceof Error ? err.message : 'Failed to load assets');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterType, searchQuery, trackApiCall]);

  // Load next page for preloading
  const preloadNextPage = useCallback(async () => {
    if (currentPage < totalPages) {
      await dataLoader.preloadNextAssetsPage(currentPage);
    }
  }, [currentPage, totalPages]);

  // Initialize and reload data
  useEffect(() => {
    loadAssets(currentPage);
  }, [loadAssets, currentPage]);

  // Preload next page when current page loads
  useEffect(() => {
    if (!loading && assets.length > 0) {
      preloadNextPage();
    }
  }, [loading, assets, preloadNextPage]);

  // Handle search
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
    trackUserAction('asset_search', { query });
  }, [trackUserAction]);

  // Handle filters
  const handleFilter = useCallback((status: AssetStatus | 'all', type: AssetType | 'all') => {
    setFilterStatus(status);
    setFilterType(type);
    setCurrentPage(1);
    trackUserAction('asset_filter', { status, type });
  }, [trackUserAction]);

  // Handle sorting
  const handleSort = useCallback((field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    trackUserAction('asset_sort', { field, order: sortOrder === 'asc' ? 'desc' : 'asc' });
  }, [sortBy, sortOrder, trackUserAction]);

  // Handle page change
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    trackUserAction('asset_page_change', { page });
  }, [trackUserAction]);

  // Asset status colors
  const getStatusColor = (status: AssetStatus) => {
    switch (status) {
      case 'Available': return 'text-green-600 bg-green-100';
      case 'In Use': return 'text-blue-600 bg-blue-100';
      case 'Maintenance': return 'text-yellow-600 bg-yellow-100';
      case 'Retired': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  if (loading && currentPage === 1) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="container mx-auto px-4 py-8">
          <LoadingSpinner message="Loading assets..." />
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
              <h2 className="text-xl font-semibold text-slate-900 mb-2">Failed to Load Assets</h2>
              <p className="text-slate-600 mb-6">{error}</p>
              <button
                onClick={() => loadAssets(currentPage)}
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
          <div className="flex flex-col lg:flex-row justify-between items-center mb-4 gap-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 mb-2">Asset Management</h1>
            </div>
            
            <div className="flex flex-wrap gap-3">
              <button className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-colors">
                <Plus className="w-4 h-4" />
                Add Asset
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
                  placeholder="Search assets..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <select
                value={filterStatus}
                onChange={(e) => handleFilter(e.target.value as AssetStatus | 'all', filterType)}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="Available">Available</option>
                <option value="In Use">In Use</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Retired">Retired</option>
              </select>

              <select
                value={filterType}
                onChange={(e) => handleFilter(filterStatus, e.target.value as AssetType | 'all')}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Types</option>
                <option value="Laptop">Laptops</option>
                <option value="Desktop">Desktops</option>
                <option value="Monitor">Monitors</option>
                <option value="Keyboard">Keyboards</option>
                <option value="Mouse">Mice</option>
                <option value="Headphone">Headphones</option>
                <option value="Other">Other</option>
              </select>

              <div className="flex gap-2">
                <button
                  onClick={() => handleSort('name')}
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Name {sortBy === 'name' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                </button>
                <button
                  onClick={() => handleSort('status')}
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Status {sortBy === 'status' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
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

          {/* Assets Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <AnimatePresence mode="wait">
              {assets.map((asset, index) => (
                <motion.div
                  key={asset.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                >
                  <GlassCard className="hover:shadow-lg transition-shadow cursor-pointer">
                    <div className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-lg font-semibold text-slate-900 mb-1">{asset.name}</h3>
                          <p className="text-sm text-slate-600">{asset.type}</p>
                        </div>
                        <div className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(asset.status)}`}>
                          {asset.status}
                        </div>
                      </div>
                      
                      <div className="space-y-2 text-sm text-slate-600">
                        <div className="flex items-center gap-2">
                          <Tag className="w-4 h-4" />
                          <span>{asset.serialNumber}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4" />
                          <span>${asset.cost.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          <span>{asset.location}</span>
                        </div>
                        {asset.assignedTo && (
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4" />
                            <span>{asset.assignedTo}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          <span>Purchased: {asset.purchaseDate}</span>
                        </div>
                      </div>

                      <div className="mt-4 flex gap-2">
                        <button className="flex items-center gap-2 px-3 py-1 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition-colors">
                          <Eye className="w-3 h-3" />
                          View
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
                <p className="text-sm text-slate-600">Showing {assets.length} of {total} assets</p>
                <p className="text-xs text-slate-500 mt-1">
                  Use filters to narrow down results and improve performance
                </p>
              </div>
              <div className="flex gap-4 text-sm text-slate-600">
                <span>Available: {assets.filter(a => a.status === 'Available').length}</span>
                <span>In Use: {assets.filter(a => a.status === 'In Use').length}</span>
                <span>Maintenance: {assets.filter(a => a.status === 'Maintenance').length}</span>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </ErrorBoundary>
  );
};
