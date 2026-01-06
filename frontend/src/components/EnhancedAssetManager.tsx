import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Search, Filter, Download, Share2, Edit, Trash2, Eye, 
  Tag, Monitor, Calendar, DollarSign, MapPin, User, Settings, AlertCircle,
  RefreshCw, FilterX, SlidersHorizontal, Clock, Wifi, WifiOff
} from 'lucide-react';
import { GlassCard } from './GlassCard';
import { LoadingSpinner } from './LoadingSpinner';
import { ErrorBoundary } from './ErrorBoundary';
import { usePerformanceMonitoring } from '../hooks/usePerformanceMonitoring';
import { useInventoryData } from '../hooks/useInventoryData';
import { useAsyncInsights } from '../hooks/useAsyncInsights';
import { Asset, AssetType, AssetStatus } from '../types';

interface AssetManagerProps {
  insights?: any[];
}

export const EnhancedAssetManager: React.FC<AssetManagerProps> = ({ insights: initialInsights }) => {
  // Use the new inventory data hook
  const {
    assets,
    total,
    loading,
    error,
    currentPage,
    totalPages,
    setCurrentPage,
    filters,
    setFilters,
    sortBy,
    sortOrder,
    setSort,
    refresh,
    preloadNextPage,
    lastUpdated,
    cacheHit
  } = useInventoryData();

  // Additional state for advanced features
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Performance monitoring
  const { trackUserAction } = usePerformanceMonitoring();
  
  // Async insights
  const { insights, loading: insightsLoading, generateInsight } = useAsyncInsights({
    autoGenerate: false,
    cacheDuration: 15 * 60 * 1000
  });

  // Generate insights when data loads
  useEffect(() => {
    if (assets.length > 0 && !insightsLoading && (!initialInsights || initialInsights.length === 0)) {
      generateInsight(
        `Analyze inventory data: ${assets.length} assets, distribution by status and type. Provide optimization recommendations.`,
        'inventory_analysis'
      );
    }
  }, [assets, insightsLoading, initialInsights, generateInsight]);

  // Handle search
  const handleSearch = useCallback((query: string) => {
    setFilters({ search: query });
    trackUserAction('inventory_search', { query, source: 'search_bar' });
  }, [setFilters, trackUserAction]);

  // Handle status filter
  const handleStatusFilter = useCallback((status: AssetStatus | 'all') => {
    setFilters({ status });
    trackUserAction('inventory_status_filter', { status });
  }, [setFilters, trackUserAction]);

  // Handle type filter
  const handleTypeFilter = useCallback((type: AssetType | 'all') => {
    setFilters({ type });
    trackUserAction('inventory_type_filter', { type });
  }, [setFilters, trackUserAction]);

  // Handle location filter
  const handleLocationFilter = useCallback((location: string) => {
    setFilters({ location });
    trackUserAction('inventory_location_filter', { location });
  }, [setFilters, trackUserAction]);

  // Handle assignment filter
  const handleAssignmentFilter = useCallback((assignedTo: string) => {
    setFilters({ assignedTo });
    trackUserAction('inventory_assignment_filter', { assignedTo });
  }, [setFilters, trackUserAction]);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilters({});
    trackUserAction('inventory_clear_filters');
  }, [setFilters, trackUserAction]);

  // Bulk actions
  const handleBulkAction = useCallback(async (action: string) => {
    if (selectedAssets.length === 0) return;

    try {
      trackUserAction('inventory_bulk_action', { action, count: selectedAssets.length });
      
      // Implement bulk action logic here
      switch (action) {
        case 'assign':
          // Bulk assignment logic
          break;
        case 'unassign':
          // Bulk unassignment logic
          break;
        case 'decommission':
          // Bulk decommission logic
          break;
        case 'export':
          // Bulk export logic
          break;
      }
      
      setSelectedAssets([]);
      setBulkAction('');
    } catch (error) {
      console.error('Bulk action failed:', error);
    }
  }, [selectedAssets, trackUserAction]);

  // Asset selection
  const toggleAssetSelection = useCallback((assetId: string) => {
    setSelectedAssets(prev => 
      prev.includes(assetId)
        ? prev.filter(id => id !== assetId)
        : [...prev, assetId]
    );
  }, []);

  const selectAllAssets = useCallback(() => {
    setSelectedAssets(assets.map(a => a.id));
  }, [assets]);

  const clearSelection = useCallback(() => {
    setSelectedAssets([]);
  }, []);

  // Asset status colors with enhanced styling
  const getStatusColor = (status: AssetStatus) => {
    switch (status) {
      case 'Available': return 'text-green-600 bg-green-100 border-green-200';
      case 'Shared Resource': return 'text-blue-600 bg-blue-100 border-blue-200';
      case 'Maintenance': return 'text-yellow-600 bg-yellow-100 border-yellow-200';
      case 'Retired': return 'text-gray-600 bg-gray-100 border-gray-200';
      default: return 'text-gray-600 bg-gray-100 border-gray-200';
    }
  };

  // Render asset card
  const renderAssetCard = (asset: Asset, index: number) => (
    <motion.div
      key={asset.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="relative"
    >
      <GlassCard className="hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-blue-300">
        <div className="p-6">
          {/* Selection checkbox */}
          <div className="absolute top-4 left-4">
            <input
              type="checkbox"
              checked={selectedAssets.includes(asset.id)}
              onChange={() => toggleAssetSelection(asset.id)}
              className="w-4 h-4 text-emerald-600 bg-gray-100 border-gray-300 rounded focus:ring-emerald-500"
            />
          </div>

          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">{asset.name}</h3>
              <p className="text-sm text-slate-600">{asset.type}</p>
            </div>
            <div className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(asset.status)}`}>
              {asset.status}
            </div>
          </div>
          
          <div className="space-y-2 text-sm text-slate-600">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4" />
              <span>{asset.serialNumber}</span>
            </div>
            <div className="flex items-center gap-2">
              <Monitor className="w-4 h-4" />
              <span>Device Type: {asset.type}</span>
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
            {asset.warrantyExpiry && (
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span>Warranty: {asset.warrantyExpiry}</span>
              </div>
            )}
          </div>

          <div className="mt-4 flex gap-2">
            <button className="relative flex items-center gap-2 px-3 py-1 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors overflow-hidden ring-1 ring-white/40 before:content-[''] before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/30 before:via-white/10 before:to-transparent before:pointer-events-none">
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
  );

  // Loading state
  if (loading && currentPage === 1) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="container mx-auto px-4 py-8">
          <LoadingSpinner message="Loading inventory..." />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <ErrorBoundary>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
          <GlassCard className="max-w-md">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-slate-900 mb-2">Failed to Load Inventory</h2>
              <p className="text-slate-600 mb-6">{error}</p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={refresh}
                  className="relative bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg transition-colors overflow-hidden ring-1 ring-white/40 before:content-[''] before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/35 before:via-white/10 before:to-transparent before:pointer-events-none"
                >
                  Try Again
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2 rounded-lg transition-colors"
                >
                  Reload Page
                </button>
              </div>
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
              <h1 className="text-3xl font-bold text-slate-900 mb-2">Inventory Management</h1>
              {lastUpdated && (
                <p className="text-xs text-slate-500 mt-1">
                  Last updated: {lastUpdated.toLocaleString()} {cacheHit && '(Cached)'}
                </p>
              )}
            </div>
            
            <div className="flex flex-wrap gap-3">
              <button className="relative flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors overflow-hidden ring-1 ring-white/40 before:content-[''] before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/35 before:via-white/10 before:to-transparent before:pointer-events-none">
                <Plus className="w-4 h-4" />
                Add Asset
              </button>
              <button className="relative flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors overflow-hidden ring-1 ring-white/40 before:content-[''] before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/35 before:via-white/10 before:to-transparent before:pointer-events-none">
                <Download className="w-4 h-4" />
                Export
              </button>
              <button className="flex items-center gap-2 bg-slate-500 hover:bg-slate-600 text-white px-4 py-2 rounded-lg transition-colors">
                <Share2 className="w-4 h-4" />
                Share
              </button>
              <button
                onClick={refresh}
                className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-900 px-4 py-2 rounded-lg border border-slate-300 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          {/* Bulk Actions Bar */}
          {selectedAssets.length > 0 && (
            <GlassCard className="mb-6">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium text-slate-700">
                    {selectedAssets.length} assets selected
                  </span>
                  <button
                    onClick={clearSelection}
                    className="text-sm text-slate-500 hover:text-slate-700"
                  >
                    Clear selection
                  </button>
                </div>
                <div className="flex gap-2">
                  <select
                    value={bulkAction}
                    onChange={(e) => setBulkAction(e.target.value)}
                    className="px-3 py-1 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Bulk Actions</option>
                    <option value="assign">Assign to User</option>
                    <option value="unassign">Unassign</option>
                    <option value="decommission">Decommission</option>
                    <option value="export">Export Selected</option>
                  </select>
                  <button
                    onClick={() => handleBulkAction(bulkAction)}
                    disabled={!bulkAction}
                    className="relative px-4 py-1 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden ring-1 ring-white/40 before:content-[''] before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/30 before:via-white/10 before:to-transparent before:pointer-events-none"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </GlassCard>
          )}

          {/* Filters and Search */}
          <GlassCard className="mb-6">
            <div className="grid grid-cols-1 lg:grid-cols-6 gap-4">
              {/* Search */}
              <div className="lg:col-span-2 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search assets by name, serial number, or location..."
                  value={filters.search || ''}
                  onChange={(e) => setFilters({ search: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              
              {/* Status Filter */}
              <select
                value={filters.status || 'all'}
                onChange={(e) => handleStatusFilter(e.target.value as AssetStatus | 'all')}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="Available">Available</option>
                <option value="Shared Resource">Shared Resource</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Retired">Retired</option>
              </select>

              {/* Type Filter */}
              <select
                value={filters.type || 'all'}
                onChange={(e) => handleTypeFilter(e.target.value as AssetType | 'all')}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                <option value="all">All Types</option>
                <option value="Laptop">Laptops</option>
                <option value="Desktop">Desktops</option>
                <option value="Monitor">Monitors</option>
                <option value="Keyboard">Keyboards</option>
                <option value="Mouse">Mice</option>
                <option value="Network devices">Network devices</option>
                <option value="Headphone">Head Phones</option>
                <option value="Storage">Storage</option>
                <option value="Other">Others</option>
              </select>

              {/* Advanced Filters Toggle */}
              <div className="flex gap-2">
                <button
                  onClick={() => setAdvancedFiltersOpen(!advancedFiltersOpen)}
                  className={`flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors ${
                    advancedFiltersOpen ? 'bg-slate-50 border-slate-400' : ''
                  }`}
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  Advanced
                </button>
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <FilterX className="w-4 h-4" />
                  Clear
                </button>
              </div>

              {/* View Toggle */}
              <div className="flex gap-2">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors ${
                    viewMode === 'grid' ? 'bg-slate-50 border-slate-400' : ''
                  }`}
                >
                  Grid
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors ${
                    viewMode === 'list' ? 'bg-slate-50 border-slate-400' : ''
                  }`}
                >
                  List
                </button>
              </div>
            </div>

            {/* Advanced Filters */}
            {advancedFiltersOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-4"
              >
                <select
                  value={filters.location || ''}
                  onChange={(e) => handleLocationFilter(e.target.value)}
                  className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  <option value="">All Locations</option>
                  <option value="HQ - Building A">HQ - Building A</option>
                  <option value="HQ - Warehouse">HQ - Warehouse</option>
                  <option value="Branch Office - NYC">Branch Office - NYC</option>
                  <option value="Remote">Remote</option>
                </select>

                <select
                  value={filters.assignedTo || ''}
                  onChange={(e) => handleAssignmentFilter(e.target.value)}
                  className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  <option value="">All Assignments</option>
                  <option value="Unassigned">Unassigned</option>
                  <option value="Sarah Johnson">Sarah Johnson</option>
                  <option value="Michael Chen">Michael Chen</option>
                  <option value="Emily Rodriguez">Emily Rodriguez</option>
                  <option value="David Kim">David Kim</option>
                </select>

                <div className="flex gap-2">
                  <button className="relative flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors overflow-hidden ring-1 ring-white/40 before:content-[''] before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/30 before:via-white/10 before:to-transparent before:pointer-events-none">
                    Apply Filters
                  </button>
                  <button
                    onClick={() => setAdvancedFiltersOpen(false)}
                    className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            )}
          </GlassCard>

          {/* Assets Grid/List */}
          <div className={`grid gap-6 mb-8 ${
            viewMode === 'grid' 
              ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' 
              : 'grid-cols-1'
          }`}>
            <AnimatePresence mode="wait">
              {assets.map((asset, index) => (
                viewMode === 'grid' 
                  ? renderAssetCard(asset, index)
                  : (
                    <motion.div
                      key={asset.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                    >
                      <GlassCard className="hover:shadow-lg transition-shadow">
                        <div className="p-6">
                          <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-4">
                              <input
                                type="checkbox"
                                checked={selectedAssets.includes(asset.id)}
                                onChange={() => toggleAssetSelection(asset.id)}
                                className="w-4 h-4 text-emerald-600 bg-gray-100 border-gray-300 rounded focus:ring-emerald-500"
                              />
                              <div>
                                <h3 className="text-lg font-semibold text-slate-900">{asset.name}</h3>
                                <p className="text-sm text-slate-600">{asset.type} • {asset.serialNumber}</p>
                              </div>
                            </div>
                            <div className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(asset.status)}`}>
                              {asset.status}
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-slate-600">
                            <div className="flex items-center gap-2">
                              <Monitor className="w-4 h-4" />
                              <span>Device Type: {asset.type}</span>
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
                            <button className="relative flex items-center gap-2 px-3 py-1 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors overflow-hidden ring-1 ring-white/40 before:content-[''] before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/30 before:via-white/10 before:to-transparent before:pointer-events-none">
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
                  )
              ))}
            </AnimatePresence>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-4">
              <button
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              
              <div className="text-sm text-slate-600">
                Page {currentPage} of {totalPages} • Showing {assets.length} of {total} assets
              </div>
              
              <button
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          )}

          {/* Summary */}
          <GlassCard className="mt-8">
            <div className="flex flex-col lg:flex-row justify-between items-center gap-4">
              <div>
                <p className="text-sm text-slate-600">Showing {assets.length} of {total} assets</p>
                <p className="text-xs text-slate-500 mt-1">
                  Use filters to narrow down results and improve performance
                </p>
              </div>
              <div className="flex gap-6 text-sm text-slate-600">
                <span>Available: {assets.filter(a => a.status === 'Available').length}</span>
                <span>Shared Resource: {assets.filter(a => a.status === 'Shared Resource').length}</span>
                <span>Maintenance: {assets.filter(a => a.status === 'Maintenance').length}</span>
                <span>Retired: {assets.filter(a => a.status === 'Retired').length}</span>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </ErrorBoundary>
  );
};
