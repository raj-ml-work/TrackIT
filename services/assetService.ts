/**
 * Asset Service
 * 
 * Handles all database operations for Assets
 */

import { Asset, AssetComment, AssetCommentType } from '../types';
import { getSupabaseClient } from './supabaseClient';

const TABLE_NAME = 'assets';
const COMMENTS_TABLE_NAME = 'asset_comments';

/**
 * Get all assets
 */
export const getAssets = async (): Promise<Asset[]> => {
  try {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Transform database format to app format
    return (data || []).map(transformAssetFromDB);
  } catch (error) {
    console.error('Error fetching assets:', error);
    throw error;
  }
};

/**
 * Get a single asset by ID
 */
export const getAssetById = async (id: string): Promise<Asset | null> => {
  try {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!data) return null;

    return transformAssetFromDB(data);
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
    const assetData = transformAssetToDB(asset);
    
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .insert(assetData)
      .select()
      .single();

    if (error) throw error;

    return transformAssetFromDB(data);
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
 */
export const deleteAsset = async (id: string): Promise<void> => {
  try {
    const supabase = await getSupabaseClient();
    
    // Delete associated comments first
    await supabase
      .from(COMMENTS_TABLE_NAME)
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
  return {
    id: dbAsset.id,
    name: dbAsset.name,
    type: dbAsset.type,
    status: dbAsset.status,
    serialNumber: dbAsset.serial_number,
    assignedTo: dbAsset.assigned_to,
    purchaseDate: dbAsset.purchase_date,
    warrantyExpiry: dbAsset.warranty_expiry,
    cost: dbAsset.cost,
    location: dbAsset.location,
    notes: dbAsset.notes,
    specs: dbAsset.specs ? (typeof dbAsset.specs === 'string' ? JSON.parse(dbAsset.specs) : dbAsset.specs) : undefined,
    // Comments are loaded separately from asset_comments table
    comments: undefined
  };
};

/**
 * Transform app format to database format
 */
const transformAssetToDB = (asset: Asset | Omit<Asset, 'id'>): any => {
  return {
    id: 'id' in asset ? asset.id : undefined,
    name: asset.name,
    type: asset.type,
    status: asset.status,
    serial_number: asset.serialNumber,
    assigned_to: asset.assignedTo,
    purchase_date: asset.purchaseDate,
    warranty_expiry: asset.warrantyExpiry,
    cost: asset.cost,
    location: asset.location,
    notes: asset.notes,
    specs: asset.specs ? (typeof asset.specs === 'string' ? asset.specs : JSON.stringify(asset.specs)) : null
    // Comments are stored in separate asset_comments table, not in assets table
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

