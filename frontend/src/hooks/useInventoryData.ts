import { useState, useEffect, useCallback } from 'react';
import { usePerformanceMonitoring } from './usePerformanceMonitoring';
import { dataLoader } from '../services/dataLoader';
import { Asset, AssetStatus, AssetType } from '../types';

interface InventoryFilters {
  status?: AssetStatus | 'all';
  type?: AssetType | 'all';
  location?: string;
  assignedTo?: string;
  search?: string;
}

interface UseInventoryDataReturn {
  // Data
  assets: Asset[];
  total: number;
  loading: boolean;
  error: string | null;
  
  // Pagination
  currentPage: number;
  totalPages: number;
  setCurrentPage: (page: number) => void;
  
  // Filters
  filters: InventoryFilters;
  setFilters: (filters: Partial<InventoryFilters>) => void;
  
  // Sorting
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  setSort: (field: string) => void;
  
  // Actions
  refresh: () => Promise<void>;
  preloadNextPage: () => Promise<void>;
  
  // Metadata
  lastUpdated: Date | null;
  cacheHit: boolean;
}

export const useInventoryData = (
  initialFilters: InventoryFilters = {},
  initialPage: number = 1,
  initialSort: { field: string; order: 'asc' | 'desc' } = { field: 'name', order: 'asc' }
): UseInventoryDataReturn => {
  // State management
  const [assets, setAssets] = useState<Asset[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState<InventoryFilters>(initialFilters);
  const [sortBy, setSortBy] = useState(initialSort.field);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(initialSort.order);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [cacheHit, setCacheHit] = useState(false);

  const { trackUserAction, trackApiCall } = usePerformanceMonitoring();

  // Debounced search to prevent excessive API calls
  const [searchQuery, setSearchQuery] = useState(filters.search || '');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(filters.search || '');

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [searchQuery]);

  // Load inventory data
  const loadInventoryData = useCallback(async (page: number = currentPage) => {
    setLoading(true);
    setError(null);
    setCacheHit(false);
    const statusFilter = filters.status && filters.status !== 'all' ? filters.status : undefined;
    const typeFilter = filters.type && filters.type !== 'all' ? filters.type : undefined;

    try {
      const result = await trackApiCall(
        () => dataLoader.loadAllAssets(page, { status: statusFilter, type: typeFilter }),
        `inventory?page=${page}&filters=${JSON.stringify(filters)}&sort=${sortBy}:${sortOrder}`
      );

      setAssets(result.data);
      setTotal(result.total);
      setTotalPages(result.totalPages);
      setCurrentPage(result.page);
      setLastUpdated(new Date());
      setCacheHit(false);
    } catch (err) {
      console.error('Failed to load inventory data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load inventory data');
      setCacheHit(false);
    } finally {
      setLoading(false);
    }
  }, [currentPage, filters, sortBy, sortOrder, trackApiCall]);

  // Handle filter changes
  const handleFilterChange = useCallback((newFilters: Partial<InventoryFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setCurrentPage(1);
    trackUserAction('inventory_filter_change', { filters: newFilters });
  }, [trackUserAction]);

  // Handle search changes
  useEffect(() => {
    if (debouncedSearchQuery !== filters.search) {
      handleFilterChange({ search: debouncedSearchQuery });
    }
  }, [debouncedSearchQuery, filters.search, handleFilterChange]);

  // Handle sorting
  const handleSort = useCallback((field: string) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    trackUserAction('inventory_sort', { field, order: sortOrder === 'asc' ? 'desc' : 'asc' });
  }, [sortBy, sortOrder, trackUserAction]);

  // Preload next page for better UX
  const preloadNextPage = useCallback(async () => {
    if (currentPage < totalPages) {
      try {
        const statusFilter = filters.status && filters.status !== 'all' ? filters.status : undefined;
        const typeFilter = filters.type && filters.type !== 'all' ? filters.type : undefined;
        await dataLoader.preloadNextAssetsPage(currentPage, { status: statusFilter, type: typeFilter });
      } catch (error) {
        console.warn('Failed to preload next page:', error);
      }
    }
  }, [currentPage, filters.status, filters.type, totalPages]);

  // Refresh data
  const refresh = useCallback(async () => {
    trackUserAction('inventory_refresh');
    await loadInventoryData(currentPage);
  }, [currentPage, loadInventoryData, trackUserAction]);

  // Initialize data on mount
  useEffect(() => {
    loadInventoryData(1);
  }, [loadInventoryData]);

  // Preload next page when current page loads
  useEffect(() => {
    if (!loading && assets.length > 0) {
      preloadNextPage();
    }
  }, [loading, assets, preloadNextPage]);

  return {
    // Data
    assets,
    total,
    loading,
    error,
    
    // Pagination
    currentPage,
    totalPages,
    setCurrentPage,
    
    // Filters
    filters,
    setFilters: handleFilterChange,
    
    // Sorting
    sortBy,
    sortOrder,
    setSort: handleSort,
    
    // Actions
    refresh,
    preloadNextPage,
    
    // Metadata
    lastUpdated,
    cacheHit
  };
};
