/**
 * Asset Service
 * 
 * Handles all database operations for Assets
 */

import { Asset, AssetComment, AssetCommentType } from '../types';
import { getSupabaseClient } from './supabaseClient';

const TABLE_NAME = 'assets';
const COMMENTS_TABLE_NAME = 'asset_comments';
const SPECS_TABLE_NAME = 'asset_specs';

/**
 * Check if serial number already exists
 */
export const checkSerialNumberExists = async (serialNumber: string, excludeAssetId?: string): Promise<boolean> => {
  try {
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
    
    // Fetch asset specs for all assets
    if (assets.length > 0) {
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
    }
    
    // Fetch comments for all assets (lazy load - only when needed)
    // For now, we'll load comments separately when viewing asset details

    return assets;
  } catch (error) {
    console.error('Error fetching assets:', error);
    throw error;
  }
};

/**
 * Get a single asset by ID with all related data
 */
export const getAssetById = async (id: string): Promise<Asset | null> => {
  try {
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
 */
export const createAsset = async (asset: Omit<Asset, 'id'>): Promise<Asset> => {
  try {
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
 */
export const updateAsset = async (asset: Asset): Promise<Asset> => {
  try {
    const supabase = await getSupabaseClient();
    
    // Check serial number uniqueness (excluding current asset)
    const serialExists = await checkSerialNumberExists(asset.serialNumber, asset.id);
    if (serialExists) {
      throw new Error(`Serial number "${asset.serialNumber}" already exists`);
    }

    const assetData = transformAssetToDB(asset);
    
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .update(assetData)
      .eq('id', asset.id)
      .select()
      .single();

    if (error) throw error;

    const updatedAsset = transformAssetFromDB(data);
    
    // Update asset specs if provided
    if (asset.assetSpecs || asset.specs) {
      const specsToSave = asset.assetSpecs || asset.specs;
      if (specsToSave) {
        await updateAssetSpecs(asset.id, asset.type, specsToSave);
      }
    }
    
    // Fetch comments for this asset
    const { data: commentsData, error: commentsError } = await supabase
      .from(COMMENTS_TABLE_NAME)
      .select('*')
      .eq('asset_id', asset.id)
      .order('created_at', { ascending: false });

    if (!commentsError && commentsData) {
      updatedAsset.comments = commentsData.map(transformCommentFromDB);
    } else {
      updatedAsset.comments = [];
    }

    return updatedAsset;
  } catch (error) {
    console.error('Error updating asset:', error);
    throw error;
  }
};

/**
 * Delete an asset (cascades to specs, comments, history)
 */
export const deleteAsset = async (id: string): Promise<void> => {
  try {
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
    status: dbAsset.status,
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
    status: asset.status,
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
