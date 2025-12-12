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
    const assets = (data || []).map(transformAssetFromDB);
    
    // Fetch comments for all assets
    if (assets.length > 0) {
      const assetIds = assets.map(a => a.id);
      const { data: commentsData, error: commentsError } = await supabase
        .from(COMMENTS_TABLE_NAME)
        .select('*')
        .in('asset_id', assetIds)
        .order('created_at', { ascending: false });

      if (!commentsError && commentsData) {
        // Group comments by asset_id
        const commentsByAssetId: Record<string, AssetComment[]> = {};
        commentsData.forEach(dbComment => {
          const comment = transformCommentFromDB(dbComment);
          if (!commentsByAssetId[comment.assetId]) {
            commentsByAssetId[comment.assetId] = [];
          }
          commentsByAssetId[comment.assetId].push(comment);
        });

        // Attach comments to assets
        return assets.map(asset => ({
          ...asset,
          comments: commentsByAssetId[asset.id] || []
        }));
      }
    }

    return assets;
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

    const asset = transformAssetFromDB(data);
    
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
    const assetData = transformAssetToDB(asset);
    
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .insert(assetData)
      .select()
      .single();

    if (error) throw error;

    const createdAsset = transformAssetFromDB(data);
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
    const assetData = transformAssetToDB(asset);
    
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .update(assetData)
      .eq('id', asset.id)
      .select()
      .single();

    if (error) throw error;

    const updatedAsset = transformAssetFromDB(data);
    
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
  // Convert empty strings to null for date fields (PostgreSQL requires null, not empty string)
  const purchaseDate = asset.purchaseDate && asset.purchaseDate.trim() !== '' ? asset.purchaseDate : null;
  const warrantyExpiry = asset.warrantyExpiry && asset.warrantyExpiry.trim() !== '' ? asset.warrantyExpiry : null;
  
  return {
    id: 'id' in asset ? asset.id : undefined,
    name: asset.name,
    type: asset.type,
    status: asset.status,
    serial_number: asset.serialNumber,
    assigned_to: asset.assignedTo || null,
    purchase_date: purchaseDate,
    warranty_expiry: warrantyExpiry,
    cost: asset.cost || 0,
    location: asset.location || null,
    notes: asset.notes || null,
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

