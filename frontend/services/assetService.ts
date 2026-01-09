/**
 * Asset Service
 *
 * Handles all database operations for Assets
 */

import { Asset, AssetComment, AssetCommentType, AssetQuery, AssetStatus, PaginatedResult, UserAccount } from '../types';
import { getSupabaseClient } from './supabaseClient';
import { apiFetchJson, isApiConfigured } from './apiClient';
import { isAdmin, getPermissionError } from './permissionUtil';

const TABLE_NAME = 'assets';
const COMMENTS_TABLE_NAME = 'asset_comments';
const SPECS_TABLE_NAME = 'asset_specs';
const LEGACY_UNDER_MAINTENANCE = 'Under Maintenance';
const LEGACY_IN_USE = 'In Use';

const normalizeAssetStatus = (status: string | null | undefined): AssetStatus => {
  if (!status) return AssetStatus.AVAILABLE;
  if (status === LEGACY_IN_USE) return AssetStatus.IN_USE;
  if (status === LEGACY_UNDER_MAINTENANCE) return AssetStatus.MAINTENANCE;
  return status as AssetStatus;
};

const attachAssetSpecs = async (supabase: any, assets: Asset[]): Promise<Asset[]> => {
  if (assets.length === 0) return assets;
  const assetIds = assets.map(a => a.id);
  const { data: specsData, error: specsError } = await supabase
    .from(SPECS_TABLE_NAME)
    .select('*')
    .in('asset_id', assetIds);

  if (!specsError && specsData) {
    const specsByAssetId: Record<string, any> = {};
    specsData.forEach(dbSpec => {
      specsByAssetId[dbSpec.asset_id] = transformSpecsFromDB(dbSpec);
    });

    assets.forEach(asset => {
      if (specsByAssetId[asset.id]) {
        asset.assetSpecs = specsByAssetId[asset.id];
      }
    });
  }

  return assets;
};

/**
 * Check if serial number already exists
 */
export const checkSerialNumberExists = async (serialNumber: string, excludeAssetId?: string): Promise<boolean> => {
  try {
    if (isApiConfigured()) {
      const params = new URLSearchParams();
      params.set('serial', serialNumber);
      if (excludeAssetId) params.set('excludeId', excludeAssetId);
      const result = await apiFetchJson<{ exists: boolean }>(`/assets/check-serial?${params.toString()}`);
      return result.exists;
    }

    const supabase = await getSupabaseClient();
    let query = supabase
      .from(TABLE_NAME)
      .select('id')
      .eq('serial_number', serialNumber.trim())
      .limit(1);

    if (excludeAssetId) {
      query = query.neq('id', excludeAssetId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return (data || []).length > 0;
  } catch (error) {
    console.error('Error checking serial number:', error);
    throw error;
  }
};

/**
 * Get all assets with related data
 */
export const getAssets = async (): Promise<Asset[]> => {
  try {
    if (isApiConfigured()) {
      return await apiFetchJson<Asset[]>('/assets');
    }

    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select(`
        *,
        assigned_employee:employees!employee_id(id, employee_id, personal_info:employee_personal_info(first_name, last_name)),
        location:locations(id, name, city, country)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Transform database format to app format
    const assets = (data || []).map(transformAssetFromDB);
    await attachAssetSpecs(supabase, assets);
    
    // Fetch comments for all assets (lazy load - only when needed)
    // For now, we'll load comments separately when viewing asset details

    return assets;
  } catch (error) {
    console.error('Error fetching assets:', error);
    throw error;
  }
};

/**
 * Get a paginated list of assets with optional search and type filtering
 */
export const getAssetsPage = async (query: AssetQuery): Promise<PaginatedResult<Asset>> => {
  try {
    if (isApiConfigured()) {
      const params = new URLSearchParams();
      params.set('page', String(query.page || 1));
      params.set('pageSize', String(query.pageSize || 20));
      if (query.search) params.set('search', query.search);
      if (query.type) params.set('type', query.type);
      if (query.status) params.set('status', query.status);
      return await apiFetchJson<PaginatedResult<Asset>>(`/assets/page?${params.toString()}`);
    }

    const supabase = await getSupabaseClient();
    const page = Math.max(1, query.page || 1);
    const pageSize = Math.max(1, Math.min(query.pageSize || 20, 100));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const search = query.search?.trim();

    if (search) {
      const pattern = `%${search.toLowerCase()}%`;
      try {
        let searchRequest = supabase
          .from('asset_search_view')
          .select('asset_id', { count: 'exact' })
          .ilike('search_text', pattern)
          .order('created_at', { ascending: false })
          .range(from, to);

        if (query.type && query.type !== 'All') {
          searchRequest = searchRequest.eq('asset_type', query.type);
        }
        if (query.status && query.status !== 'All') {
          searchRequest = searchRequest.eq('status', query.status);
        }

        const { data: matches, error: searchError, count } = await searchRequest;
        if (searchError) throw searchError;

        const ids = (matches || []).map((row: { asset_id: string }) => row.asset_id);
        if (ids.length === 0) {
          return {
            data: [],
            total: count || 0,
            page,
            pageSize
          };
        }

        const { data, error } = await supabase
          .from(TABLE_NAME)
          .select(
            `
        *,
        assigned_employee:employees!employee_id(id, employee_id, personal_info:employee_personal_info(first_name, last_name)),
        location:locations(id, name, city, country)
      `
          )
          .in('id', ids)
          .order('created_at', { ascending: false });

        if (error) throw error;

        const order = new Map(ids.map((id, index) => [id, index]));
        const sorted = (data || []).sort((a, b) => {
          return (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0);
        });

        const assets = sorted.map(transformAssetFromDB);
        await attachAssetSpecs(supabase, assets);

        return {
          data: assets,
          total: count || 0,
          page,
          pageSize
        };
      } catch (error: any) {
        const isPostgreSQLError = error?.code && typeof error.code === 'string';
        const isSQLiteError = !isPostgreSQLError && error?.message && error.message.includes('no such table');

        if (!isPostgreSQLError && !isSQLiteError) {
          throw error;
        }
        
        console.warn('asset_search_view missing; falling back to table search.');
        let fallbackRequest = supabase
          .from(TABLE_NAME)
          .select(
            `
        *,
        assigned_employee:employees!employee_id(id, employee_id, personal_info:employee_personal_info(first_name, last_name)),
        location:locations(id, name, city, country),
        asset_specs:asset_specs(brand, model)
      `,
            { count: 'exact' }
          )
          .order('created_at', { ascending: false })
          .range(from, to);

        if (query.type && query.type !== 'All') {
          fallbackRequest = fallbackRequest.eq('type', query.type);
        }
        if (query.status && query.status !== 'All') {
          fallbackRequest = fallbackRequest.eq('status', query.status);
        }

        fallbackRequest = fallbackRequest.or(
          [
            `UPPER(name) LIKE '%${search.toUpperCase()}%'`,
            `UPPER(serial_number) LIKE '%${search.toUpperCase()}%'`,
            `UPPER(type) LIKE '%${search.toUpperCase()}%'`,
            `UPPER(specs) LIKE '%${search.toUpperCase()}%'`
          ].join(',')
        );

        // Add asset_specs search
        fallbackRequest = fallbackRequest.or(
          `UPPER(asset_specs.brand) LIKE '%${search.toUpperCase()}%'`,
          `UPPER(asset_specs.model) LIKE '%${search.toUpperCase()}%'`
        );

        // Add locations search
        fallbackRequest = fallbackRequest.or(
          `UPPER(locations.name) LIKE '%${search.toUpperCase()}%'`
        );

        const { data, error: fallbackError, count } = await fallbackRequest;
        if (fallbackError) throw fallbackError;

        const assets = (data || []).map(transformAssetFromDB);
        await attachAssetSpecs(supabase, assets);

        return {
          data: assets,
          total: count || 0,
          page,
          pageSize
        };
      }
    }

    let request = supabase
      .from(TABLE_NAME)
      .select(
        `
        *,
        assigned_employee:employees!employee_id(id, employee_id, personal_info:employee_personal_info(first_name, last_name)),
        location:locations(id, name, city, country)
      `,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(from, to);

    if (query.type && query.type !== 'All') {
      request = request.eq('type', query.type);
    }
    if (query.status && query.status !== 'All') {
      request = request.eq('status', query.status);
    }

    const { data, error, count } = await request;
    if (error) throw error;

    const assets = (data || []).map(transformAssetFromDB);
    await attachAssetSpecs(supabase, assets);

    return {
      data: assets,
      total: count || 0,
      page,
      pageSize
    };
  } catch (error) {
    console.error('Error fetching assets page:', error);
    throw error;
  }
};

/**
 * Get a single asset by ID with all related data
 */
export const getAssetById = async (id: string): Promise<Asset | null> => {
  try {
    if (isApiConfigured()) {
      return await apiFetchJson<Asset>(`/assets/${id}`);
    }

    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select(`
        *,
        assigned_employee:employees!employee_id(id, employee_id, personal_info:employee_personal_info(first_name, last_name)),
        location:locations(id, name, city, country)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!data) return null;

    const asset = transformAssetFromDB(data);
    
    // Fetch asset specs
    const { data: specsData, error: specsError } = await supabase
      .from(SPECS_TABLE_NAME)
      .select('*')
      .eq('asset_id', id)
      .single();

    if (!specsError && specsData) {
      asset.assetSpecs = transformSpecsFromDB(specsData);
    }
    
    // Fetch comments for this asset
    const { data: commentsData, error: commentsError } = await supabase
      .from(COMMENTS_TABLE_NAME)
      .select('*')
      .eq('asset_id', id)
      .order('created_at', { ascending: false });

    if (!commentsError && commentsData) {
      asset.comments = commentsData.map(transformCommentFromDB);
    } else {
      asset.comments = [];
    }

    return asset;
  } catch (error) {
    console.error('Error fetching asset:', error);
    throw error;
  }
};

/**
 * Create a new asset
 * @param asset Asset data to create
 * @param currentUser Current authenticated user for permission check
 */
export const createAsset = async (asset: Omit<Asset, 'id'>, currentUser: UserAccount | null = null): Promise<Asset> => {
  try {
    // Check permission - only admins can create assets
    if (!isAdmin(currentUser)) {
      throw new Error(getPermissionError('create', currentUser?.role || null));
    }

    if (isApiConfigured()) {
      return await apiFetchJson<Asset>('/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(asset)
      });
    }

    const supabase = await getSupabaseClient();
    
    // Check serial number uniqueness
    const serialExists = await checkSerialNumberExists(asset.serialNumber);
    if (serialExists) {
      throw new Error(`Serial number "${asset.serialNumber}" already exists`);
    }

    const assetData = transformAssetToDB(asset);
    
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .insert(assetData)
      .select()
      .single();

    if (error) throw error;

    const createdAsset = transformAssetFromDB(data);
    
    // Create asset specs if provided
    if (asset.assetSpecs || asset.specs) {
      const specsToSave = asset.assetSpecs || asset.specs;
      if (specsToSave) {
        await createAssetSpecs(createdAsset.id, asset.type, specsToSave);
      }
    }

    // Initialize comments array (new assets won't have comments yet)
    createdAsset.comments = [];
    return createdAsset;
  } catch (error) {
    console.error('Error creating asset:', error);
    throw error;
  }
};

/**
 * Update an existing asset
 * @param asset Asset data to update
 * @param currentUser Current authenticated user for permission check
 */
export const updateAsset = async (asset: Asset, currentUser: UserAccount | null = null): Promise<Asset> => {
  try {
    // Check permission - only admins can update assets
    if (!isAdmin(currentUser)) {
      throw new Error(getPermissionError('update', currentUser?.role || null));
    }

    if (isApiConfigured()) {
      const currentAsset = await apiFetchJson<Asset>(`/assets/${asset.id}`);
      const updatedAsset = await apiFetchJson<Asset>(`/assets/${asset.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(asset)
      });
      const changes = getAssetChanges(currentAsset, updatedAsset);
      if (changes.length > 0) {
        const systemComment: Omit<AssetComment, 'id'> = {
          assetId: asset.id,
          authorName: 'System',
          authorId: undefined,
          message: `Asset updated: ${changes.join(', ')}`,
          type: AssetCommentType.SYSTEM,
          createdAt: new Date().toISOString()
        };
        await addAssetComment(systemComment);
      }
      return updatedAsset;
    }

    const supabase = await getSupabaseClient();
    
    // Check serial number uniqueness (excluding current asset)
    const serialExists = await checkSerialNumberExists(asset.serialNumber, asset.id);
    if (serialExists) {
      throw new Error(`Serial number "${asset.serialNumber}" already exists`);
    }

    const assetData = transformAssetToDB(asset);
    
    // First, get the current asset data to compare changes
    const { data: currentAssetData, error: fetchError } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('id', asset.id)
      .single();

    if (fetchError) throw fetchError;
    
    const currentAsset = transformAssetFromDB(currentAssetData);
    
    // Update the asset
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .update(assetData)
      .eq('id', asset.id)
      .select()
      .single();

    if (error) throw error;

    const updatedAsset = transformAssetFromDB(data);
    
    // Generate system comment for changes
    const changes = getAssetChanges(currentAsset, updatedAsset);
    if (changes.length > 0) {
      const systemComment: Omit<AssetComment, 'id'> = {
        assetId: asset.id,
        authorName: 'System',
        authorId: undefined, // System comments don't have a specific user ID
        message: `Asset updated: ${changes.join(', ')}`,
        type: AssetCommentType.SYSTEM,
        createdAt: new Date().toISOString()
      };
     
      await addAssetComment(systemComment);
    }

    return updatedAsset;
  } catch (error) {
    console.error('Error updating asset:', error);
    throw error;
  }
};

/**
 * Compare two assets and return a list of changes
 */
const getAssetChanges = (oldAsset: Asset, newAsset: Asset): string[] => {
  const changes: string[] = [];
  
  // Compare basic fields
  if (oldAsset.name !== newAsset.name) {
    changes.push(`name changed from "${oldAsset.name}" to "${newAsset.name}"`);
  }
  
  if (oldAsset.status !== newAsset.status) {
    changes.push(`status changed from "${oldAsset.status}" to "${newAsset.status}"`);
  }
  
  if (oldAsset.assignedTo !== newAsset.assignedTo) {
    if (newAsset.assignedTo) {
      changes.push(`assigned to "${newAsset.assignedTo}"`);
    } else {
      changes.push(`unassigned from "${oldAsset.assignedTo}"`);
    }
  }
  
  if (oldAsset.location !== newAsset.location) {
    changes.push(`location changed from "${oldAsset.location}" to "${newAsset.location}"`);
  }
  
  if (oldAsset.cost !== newAsset.cost) {
    changes.push(`cost changed from $${oldAsset.cost} to $${newAsset.cost}`);
  }
  
  // Compare specs if they exist
  if (oldAsset.specs && newAsset.specs) {
    if (oldAsset.specs.brand !== newAsset.specs.brand) {
      changes.push(`brand changed from "${oldAsset.specs.brand || 'N/A'}" to "${newAsset.specs.brand || 'N/A'}"`);
    }
    
    if (oldAsset.specs.model !== newAsset.specs.model) {
      changes.push(`model changed from "${oldAsset.specs.model || 'N/A'}" to "${newAsset.specs.model || 'N/A'}"`);
    }
    
    if (oldAsset.specs.cpu !== newAsset.specs.cpu) {
      changes.push(`CPU changed from "${oldAsset.specs.cpu || 'N/A'}" to "${newAsset.specs.cpu || 'N/A'}"`);
    }
    
    if (oldAsset.specs.ram !== newAsset.specs.ram) {
      changes.push(`RAM changed from "${oldAsset.specs.ram || 'N/A'}" to "${newAsset.specs.ram || 'N/A'}"`);
    }
    
    if (oldAsset.specs.storage !== newAsset.specs.storage) {
      changes.push(`storage changed from "${oldAsset.specs.storage || 'N/A'}" to "${newAsset.specs.storage || 'N/A'}"`);
    }
  } else if (!oldAsset.specs && newAsset.specs) {
    changes.push('specs added');
  } else if (oldAsset.specs && !newAsset.specs) {
    changes.push('specs removed');
  }
  
  return changes;
};

/**
 * Delete an asset
 * @param id Asset ID to delete
 * @param currentUser Current authenticated user for permission check
 */
export const deleteAsset = async (id: string, currentUser: UserAccount | null = null): Promise<void> => {
  try {
    // Check permission - only admins can delete assets
    if (!isAdmin(currentUser)) {
      throw new Error(getPermissionError('delete', currentUser?.role || null));
    }

    if (isApiConfigured()) {
      await apiFetchJson<{ ok: boolean }>(`/assets/${id}`, { method: 'DELETE' });
      return;
    }

    const supabase = await getSupabaseClient();
    
    // Delete asset specs (if exists)
    await supabase
      .from(SPECS_TABLE_NAME)
      .delete()
      .eq('asset_id', id);

    // Delete associated comments (cascade should handle this, but being explicit)
    await supabase
      .from(COMMENTS_TABLE_NAME)
      .delete()
      .eq('asset_id', id);

    // Delete asset history
    await supabase
      .from('asset_history')
      .delete()
      .eq('asset_id', id);

    // Delete the asset
    const { error } = await supabase
      .from(TABLE_NAME)
      .delete()
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting asset:', error);
    throw error;
  }
};

/**
 * Get comments for an asset
 */
export const getAssetComments = async (assetId: string): Promise<AssetComment[]> => {
  try {
    if (isApiConfigured()) {
      return await apiFetchJson<AssetComment[]>(`/assets/${assetId}/comments`);
    }

    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from(COMMENTS_TABLE_NAME)
      .select('*')
      .eq('asset_id', assetId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(transformCommentFromDB);
  } catch (error) {
    console.error('Error fetching comments:', error);
    throw error;
  }
};

/**
 * Add a comment to an asset
 */
export const addAssetComment = async (comment: Omit<AssetComment, 'id'>): Promise<AssetComment> => {
  try {
    if (isApiConfigured()) {
      return await apiFetchJson<AssetComment>(`/assets/${comment.assetId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorName: comment.authorName,
          authorId: comment.authorId,
          message: comment.message,
          type: comment.type,
          createdAt: comment.createdAt
        })
      });
    }

    const supabase = await getSupabaseClient();
    const commentData = transformCommentToDB(comment);
    
    const { data, error } = await supabase
      .from(COMMENTS_TABLE_NAME)
      .insert(commentData)
      .select()
      .single();

    if (error) throw error;

    return transformCommentFromDB(data);
  } catch (error) {
    console.error('Error adding comment:', error);
    throw error;
  }
};

/**
 * Transform database format to app format
 */
const transformAssetFromDB = (dbAsset: any): Asset => {
  // Get assigned employee name from joined data
  const assignedEmployee = dbAsset.assigned_employee;
  const assignedToName = assignedEmployee?.personal_info
    ? `${assignedEmployee.personal_info.first_name || ''} ${assignedEmployee.personal_info.last_name || ''}`.trim()
    : dbAsset.assigned_to; // Fallback to legacy field

  // Get location name from joined data
  const locationName = dbAsset.location?.name || dbAsset.location; // Fallback to legacy field

  return {
    id: dbAsset.id,
    name: dbAsset.name,
    type: dbAsset.type,
    status: normalizeAssetStatus(dbAsset.status),
    serialNumber: dbAsset.serial_number,
    assignedTo: assignedToName || undefined, // Legacy: employee name
    assignedToId: dbAsset.employee_id || dbAsset.assigned_to_uuid || dbAsset.assigned_to || undefined, // UUID of assigned employee
    employeeId: dbAsset.employee_id || dbAsset.assigned_to_uuid || dbAsset.assigned_to || undefined, // Alternative assignment field
    purchaseDate: dbAsset.purchase_date || '',
    acquisitionDate: dbAsset.acquisition_date || undefined,
    warrantyExpiry: dbAsset.warranty_expiry || '',
    cost: dbAsset.cost || 0,
    location: locationName || dbAsset.location || '', // Legacy: location name
    locationId: dbAsset.location_id || undefined, // UUID of location
    manufacturer: dbAsset.manufacturer || undefined,
    previousTag: dbAsset.previous_tag || undefined,
    notes: dbAsset.notes || undefined,
    specs: dbAsset.specs ? (typeof dbAsset.specs === 'string' ? JSON.parse(dbAsset.specs) : dbAsset.specs) : undefined, // Legacy JSONB specs
    // assetSpecs will be populated separately from asset_specs table
    comments: undefined
  };
};

/**
 * Transform app format to database format
 */
const transformAssetToDB = (asset: Asset | Omit<Asset, 'id'>): any => {
  // Convert empty strings to null for date fields (PostgreSQL requires null, not empty string)
  const purchaseDate = asset.purchaseDate && asset.purchaseDate.trim() !== '' ? asset.purchaseDate : null;
  const warrantyExpiry = asset.warrantyExpiry && asset.warrantyExpiry.trim() !== '' ? asset.warrantyExpiry : null;
  const acquisitionDate = asset.acquisitionDate && asset.acquisitionDate.trim() !== '' ? asset.acquisitionDate : null;
  
  // Use employee_id/assignedToId if available, otherwise fallback to assignedTo (legacy)
  const assignedEmployeeId = asset.assignedToId || asset.employeeId || null;
  
  return {
    id: 'id' in asset ? asset.id : undefined,
    name: asset.name,
    type: asset.type,
    status: normalizeAssetStatus(asset.status),
    serial_number: asset.serialNumber.trim(),
    // Keep legacy assigned_to string for backward compatibility/readability
    assigned_to: (asset as any).assignedTo || null,
    assigned_to_uuid: assignedEmployeeId, // UUID foreign key
    employee_id: assignedEmployeeId, // Primary UUID foreign key for employee assignment
    purchase_date: purchaseDate,
    acquisition_date: acquisitionDate,
    warranty_expiry: warrantyExpiry,
    cost: asset.cost || 0,
    location_id: asset.locationId || null, // UUID foreign key
    location: asset.location || null, // Legacy: keep for backward compatibility
    manufacturer: asset.manufacturer || null,
    previous_tag: asset.previousTag || null,
    notes: asset.notes || null,
    specs: asset.specs ? (typeof asset.specs === 'string' ? asset.specs : JSON.stringify(asset.specs)) : null // Legacy JSONB specs
    // Comments are stored in separate asset_comments table, not in assets table
    // Asset specs are stored in asset_specs table
  };
};

/**
 * Create asset specs
 */
const createAssetSpecs = async (assetId: string, assetType: string, specs: any): Promise<void> => {
  try {
    const supabase = await getSupabaseClient();
    const specsData = transformSpecsToDB(assetId, assetType, specs);
    
    const { error } = await supabase
      .from(SPECS_TABLE_NAME)
      .insert(specsData);

    if (error) throw error;
  } catch (error) {
    console.error('Error creating asset specs:', error);
    throw error;
  }
};

/**
 * Update asset specs (upsert)
 */
const updateAssetSpecs = async (assetId: string, assetType: string, specs: any): Promise<void> => {
  try {
    const supabase = await getSupabaseClient();
    const specsData = transformSpecsToDB(assetId, assetType, specs);
    
    // Check if specs exist
    const { data: existing } = await supabase
      .from(SPECS_TABLE_NAME)
      .select('id')
      .eq('asset_id', assetId)
      .single();

    if (existing) {
      // Update existing
      const { error } = await supabase
        .from(SPECS_TABLE_NAME)
        .update(specsData)
        .eq('asset_id', assetId);
      
      if (error) throw error;
    } else {
      // Create new
      const { error } = await supabase
        .from(SPECS_TABLE_NAME)
        .insert(specsData);
      
      if (error) throw error;
    }
  } catch (error) {
    console.error('Error updating asset specs:', error);
    throw error;
  }
};

/**
 * Transform specs from database format
 */
const transformSpecsFromDB = (dbSpecs: any): any => {
  return {
    id: dbSpecs.id,
    assetId: dbSpecs.asset_id,
    assetType: dbSpecs.asset_type,
    brand: dbSpecs.brand,
    model: dbSpecs.model,
    processorType: dbSpecs.processor_type,
    ramCapacity: dbSpecs.ram_capacity,
    storageCapacity: dbSpecs.storage_capacity,
    screenSize: dbSpecs.screen_size,
    isTouchscreen: dbSpecs.is_touchscreen || false,
    printerType: dbSpecs.printer_type,
    // Legacy field mappings
    cpu: dbSpecs.processor_type,
    ram: dbSpecs.ram_capacity,
    storage: dbSpecs.storage_capacity
  };
};

/**
 * Transform specs to database format
 */
const transformSpecsToDB = (assetId: string, assetType: string, specs: any): any => {
  return {
    asset_id: assetId,
    asset_type: assetType,
    brand: specs.brand || null,
    model: specs.model || null,
    processor_type: specs.processorType || specs.cpu || null,
    ram_capacity: specs.ramCapacity || specs.ram || null,
    storage_capacity: specs.storageCapacity || specs.storage || null,
    screen_size: specs.screenSize || null,
    is_touchscreen: specs.isTouchscreen || false,
    printer_type: specs.printerType || null
  };
};

/**
 * Transform comment from database format
 */
const transformCommentFromDB = (dbComment: any): AssetComment => {
  return {
    id: dbComment.id,
    assetId: dbComment.asset_id,
    authorName: dbComment.author_name,
    authorId: dbComment.author_id,
    message: dbComment.message,
    type: dbComment.type,
    createdAt: dbComment.created_at
  };
};

/**
 * Transform comment to database format
 */
const transformCommentToDB = (comment: Omit<AssetComment, 'id'>): any => {
  return {
    asset_id: comment.assetId,
    author_name: comment.authorName,
    author_id: comment.authorId,
    message: comment.message,
    type: comment.type,
    created_at: comment.createdAt
  };
};

// Export the helper function for testing
export { getAssetChanges };
