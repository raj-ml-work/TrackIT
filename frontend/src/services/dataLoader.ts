import { DashboardMetrics, Asset, Employee, Location, Department, UserAccount } from '../types';
import * as dataService from './dataService';
import * as assetService from './assetService';
import * as employeeService from './employeeService';
import * as locationService from './locationService';
import * as userService from './userService';

/**
 * Priority levels for data loading
 */
export enum LoadPriority {
  CRITICAL = 1,    // Dashboard metrics, user info
  HIGH = 2,        // Active assets, current employees
  MEDIUM = 3,      // All assets, all employees
  LOW = 4          // Reference data, historical data
}

/**
 * Data loading configuration
 */
interface DataLoaderConfig {
  enableCaching: boolean;
  cacheTTL: number; // milliseconds
  batchSize: number;
  retryAttempts: number;
}

/**
 * Data loader class for managing priority-based data loading
 */
export class DataLoader {
  private config: DataLoaderConfig;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private loadingPromises: Map<string, Promise<any>> = new Map();

  constructor(config?: Partial<DataLoaderConfig>) {
    this.config = {
      enableCaching: true,
      cacheTTL: 5 * 60 * 1000, // 5 minutes
      batchSize: 20,
      retryAttempts: 3,
      ...config
    };
  }

  /**
   * Load dashboard metrics (CRITICAL priority)
   */
  async loadDashboardMetrics(): Promise<DashboardMetrics> {
    const cacheKey = 'dashboard_metrics';
    
    if (this.isCached(cacheKey)) {
      return this.getCachedData(cacheKey);
    }

    const promise = this.withRetry(async () => {
      const metrics = await dataService.getDashboardMetrics();
      this.setCachedData(cacheKey, metrics);
      return metrics;
    });

    this.loadingPromises.set(cacheKey, promise);
    return promise;
  }

  /**
   * Load active assets (HIGH priority)
   */
  async loadActiveAssets(): Promise<Asset[]> {
    const cacheKey = 'active_assets';
    
    if (this.isCached(cacheKey)) {
      return this.getCachedData(cacheKey);
    }

    const promise = this.withRetry(async () => {
      const { data } = await dataService.getAssets(1, 50, { status: ['Shared Resource', 'Assigned'] });
      this.setCachedData(cacheKey, data);
      return data;
    });

    this.loadingPromises.set(cacheKey, promise);
    return promise;
  }

  /**
   * Load current employees (HIGH priority)
   */
  async loadCurrentEmployees(): Promise<Employee[]> {
    const cacheKey = 'current_employees';
    
    if (this.isCached(cacheKey)) {
      return this.getCachedData(cacheKey);
    }

    const promise = this.withRetry(async () => {
      const { data } = await dataService.getEmployees(1, 50, { status: 'Active' });
      this.setCachedData(cacheKey, data);
      return data;
    });

    this.loadingPromises.set(cacheKey, promise);
    return promise;
  }

  /**
   * Load all laptop assets for dashboard summaries (HIGH priority)
   */
  async loadLaptopAssets(): Promise<Asset[]> {
    const cacheKey = 'laptop_assets';

    if (this.isCached(cacheKey)) {
      return this.getCachedData(cacheKey);
    }

    const promise = this.withRetry(async () => {
      const { data } = await dataService.getAssets(1, 1000, { type: 'Laptop' });
      this.setCachedData(cacheKey, data);
      return data;
    });

    this.loadingPromises.set(cacheKey, promise);
    return promise;
  }

  /**
   * Load employee directory for dashboard summaries (HIGH priority)
   */
  async loadEmployeeDirectory(): Promise<Employee[]> {
    const cacheKey = 'employee_directory';

    if (this.isCached(cacheKey)) {
      return this.getCachedData(cacheKey);
    }

    const promise = this.withRetry(async () => {
      const { data } = await dataService.getEmployees(1, 1000);
      this.setCachedData(cacheKey, data);
      return data;
    });

    this.loadingPromises.set(cacheKey, promise);
    return promise;
  }

  /**
   * Load all assets with pagination (MEDIUM priority)
   */
  async loadAllAssets(
    page: number = 1,
    filters?: { status?: string; type?: string }
  ): Promise<{ data: Asset[]; total: number; page: number; totalPages: number }> {
    const filterStatus = filters?.status ? filters.status : 'all';
    const filterType = filters?.type ? filters.type : 'all';
    const cacheKey = `all_assets_page_${page}_${filterStatus}_${filterType}`;
    
    if (this.isCached(cacheKey)) {
      return this.getCachedData(cacheKey);
    }

    const promise = this.withRetry(async () => {
      const result = await dataService.getAssets(page, this.config.batchSize, filters);
      this.setCachedData(cacheKey, result);
      return result;
    });

    this.loadingPromises.set(cacheKey, promise);
    return promise;
  }

  /**
   * Load all employees with pagination (MEDIUM priority)
   */
  async loadAllEmployees(
    page: number = 1,
    filters?: { department?: string }
  ): Promise<{ data: Employee[]; total: number; page: number; totalPages: number }> {
    const filterKey = filters?.department ? filters.department : 'all';
    const cacheKey = `all_employees_page_${page}_${filterKey}`;
    
    if (this.isCached(cacheKey)) {
      return this.getCachedData(cacheKey);
    }

    const promise = this.withRetry(async () => {
      const result = await dataService.getEmployees(page, this.config.batchSize, filters);
      this.setCachedData(cacheKey, result);
      return result;
    });

    this.loadingPromises.set(cacheKey, promise);
    return promise;
  }

  /**
   * Load reference data (LOW priority)
   */
  async loadReferenceData(): Promise<{
    locations: Location[];
    departments: Department[];
    users: UserAccount[];
  }> {
    const cacheKey = 'reference_data';
    
    if (this.isCached(cacheKey)) {
      return this.getCachedData(cacheKey);
    }

    const promise = this.withRetry(async () => {
      const [locations, departments, users] = await Promise.all([
        dataService.getLocations(),
        dataService.getDepartments(),
        dataService.getUsers()
      ]);

      const referenceData = { locations, departments, users };
      this.setCachedData(cacheKey, referenceData);
      return referenceData;
    });

    this.loadingPromises.set(cacheKey, promise);
    return promise;
  }

  /**
   * Load asset details (on-demand)
   */
  async loadAssetDetails(assetId: string): Promise<Asset | null> {
    const cacheKey = `asset_details_${assetId}`;
    
    if (this.isCached(cacheKey)) {
      return this.getCachedData(cacheKey);
    }

    const promise = this.withRetry(async () => {
      const asset = await dataService.getAssetById(assetId);
      this.setCachedData(cacheKey, asset);
      return asset;
    });

    this.loadingPromises.set(cacheKey, promise);
    return promise;
  }

  /**
   * Load employee details (on-demand)
   */
  async loadEmployeeDetails(employeeId: string): Promise<Employee | null> {
    const cacheKey = `employee_details_${employeeId}`;
    
    if (this.isCached(cacheKey)) {
      return this.getCachedData(cacheKey);
    }

    const promise = this.withRetry(async () => {
      const employee = await dataService.getEmployeeById(employeeId);
      this.setCachedData(cacheKey, employee);
      return employee;
    });

    this.loadingPromises.set(cacheKey, promise);
    return promise;
  }

  /**
   * Preload next page of assets
   */
  async preloadNextAssetsPage(
    currentPage: number,
    filters?: { status?: string; type?: string }
  ): Promise<void> {
    const nextPage = currentPage + 1;
    const filterStatus = filters?.status ? filters.status : 'all';
    const filterType = filters?.type ? filters.type : 'all';
    const cacheKey = `all_assets_page_${nextPage}_${filterStatus}_${filterType}`;
    
    if (this.isCached(cacheKey)) {
      return;
    }

    try {
      await this.loadAllAssets(nextPage, filters);
    } catch (error) {
      console.warn(`Failed to preload assets page ${nextPage}:`, error);
    }
  }

  /**
   * Preload next page of employees
   */
  async preloadNextEmployeesPage(
    currentPage: number,
    filters?: { department?: string }
  ): Promise<void> {
    const nextPage = currentPage + 1;
    const filterKey = filters?.department ? filters.department : 'all';
    const cacheKey = `all_employees_page_${nextPage}_${filterKey}`;
    
    if (this.isCached(cacheKey)) {
      return;
    }

    try {
      await this.loadAllEmployees(nextPage, filters);
    } catch (error) {
      console.warn(`Failed to preload employees page ${nextPage}:`, error);
    }
  }

  /**
   * Load inventory summary data (CRITICAL priority)
   */
  async loadInventorySummary(): Promise<{
    totalAssets: number;
    availableAssets: number;
    inUseAssets: number;
    maintenanceAssets: number;
    totalValue: number;
    locations: string[];
    assetTypes: string[];
  }> {
    const cacheKey = 'inventory_summary';
    
    if (this.isCached(cacheKey)) {
      return this.getCachedData(cacheKey);
    }

    const promise = this.withRetry(async () => {
      const [metrics, assets] = await Promise.all([
        dataService.getDashboardMetrics(),
        dataService.getAssets(1, 1000) // Get all assets for summary
      ]);

      const summary = {
        totalAssets: assets.total,
        availableAssets: assets.data.filter(a => a.status === 'Available').length,
        inUseAssets: assets.data.filter(a => a.status === 'Shared Resource').length,
        maintenanceAssets: assets.data.filter(a => a.status === 'Maintenance').length,
        totalValue: metrics.totalValue,
        locations: [...new Set(assets.data.map(a => a.location))] as string[],
        assetTypes: [...new Set(assets.data.map(a => a.type))] as string[]
      };

      this.setCachedData(cacheKey, summary);
      return summary;
    });

    this.loadingPromises.set(cacheKey, promise);
    return promise;
  }

  /**
   * Load inventory with advanced filtering
   */
  async loadInventoryWithFilters(
    page: number,
    filters: {
      status?: 'Available' | 'Shared Resource' | 'Maintenance' | 'Retired' | 'all';
      type?:
        | 'Laptop'
        | 'Desktop'
        | 'Monitor'
        | 'Keyboard'
        | 'Mouse'
        | 'Headphone'
        | 'Network devices'
        | 'Storage'
        | 'Other'
        | 'all';
      location?: string;
      assignedTo?: string;
      search?: string;
    },
    sortBy: string = 'name',
    sortOrder: 'asc' | 'desc' = 'asc'
  ): Promise<{ data: Asset[]; total: number; page: number; totalPages: number }> {
    const cacheKey = `inventory_filtered_page_${page}_${JSON.stringify(filters)}_${sortBy}_${sortOrder}`;
    
    if (this.isCached(cacheKey)) {
      return this.getCachedData(cacheKey);
    }

    const promise = this.withRetry(async () => {
      const result = await dataService.getAssets(page, this.config.batchSize, filters);
      
      // Apply client-side sorting if needed
      if (sortBy !== 'name' || sortOrder !== 'asc') {
        result.data.sort((a, b) => {
          const aValue = a[sortBy as keyof Asset];
          const bValue = b[sortBy as keyof Asset];
          
          if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
          if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
          return 0;
        });
      }

      this.setCachedData(cacheKey, result);
      return result;
    });

    this.loadingPromises.set(cacheKey, promise);
    return promise;
  }

  /**
   * Clear cache for specific key
   */
  clearCache(key?: string): void {
    if (key) {
      this.cache.delete(key);
      this.loadingPromises.delete(key);
    } else {
      this.cache.clear();
      this.loadingPromises.clear();
    }
  }

  /**
   * Check if data is cached and valid
   */
  private isCached(key: string): boolean {
    if (!this.config.enableCaching) {
      return false;
    }

    const cached = this.cache.get(key);
    if (!cached) {
      return false;
    }

    const isExpired = Date.now() - cached.timestamp > this.config.cacheTTL;
    if (isExpired) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Get cached data
   */
  private getCachedData<T>(key: string): T {
    const cached = this.cache.get(key);
    return cached?.data;
  }

  /**
   * Set cached data
   */
  private setCachedData<T>(key: string, data: T): void {
    if (!this.config.enableCaching) {
      return;
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Retry logic for failed requests
   */
  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === this.config.retryAttempts) {
          throw lastError;
        }

        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }

  /**
   * Get loading status for a specific key
   */
  isLoading(key: string): boolean {
    return this.loadingPromises.has(key);
  }

  /**
   * Get all loading promises (for concurrent loading)
   */
  getLoadingPromises(): Promise<any>[] {
    return Array.from(this.loadingPromises.values());
  }
}

/**
 * Global data loader instance
 */
export const dataLoader = new DataLoader();

/**
 * Load initial data for dashboard
 */
export const loadInitialDashboardData = async () => {
  try {
    const [metrics, activeAssets, currentEmployees] = await Promise.all([
      dataLoader.loadDashboardMetrics(),
      dataLoader.loadActiveAssets(),
      dataLoader.loadCurrentEmployees()
    ]);

    return {
      metrics,
      activeAssets,
      currentEmployees
    };
  } catch (error) {
    console.error('Failed to load initial dashboard data:', error);
    throw error;
  }
};

/**
 * Load initial data for asset management
 */
export const loadInitialAssetData = async (page: number = 1) => {
  try {
    const [assets, referenceData] = await Promise.all([
      dataLoader.loadAllAssets(page),
      dataLoader.loadReferenceData()
    ]);

    return {
      assets,
      referenceData
    };
  } catch (error) {
    console.error('Failed to load initial asset data:', error);
    throw error;
  }
};

/**
 * Load initial data for employee management
 */
export const loadInitialEmployeeData = async (page: number = 1) => {
  try {
    const [employees, referenceData] = await Promise.all([
      dataLoader.loadAllEmployees(page),
      dataLoader.loadReferenceData()
    ]);

    return {
      employees,
      referenceData
    };
  } catch (error) {
    console.error('Failed to load initial employee data:', error);
    throw error;
  }
};
