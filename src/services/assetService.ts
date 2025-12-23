import { Asset, AssetComment, AssetType } from '../types';
import { getSupabaseClient } from './supabaseClient';
import { dbConfig } from './database';

/**
 * Check if Supabase is configured
 */
const isSupabaseConfigured = (): boolean => {
  return dbConfig.type === 'supabase' && 
         !!dbConfig.supabaseUrl && 
         !!dbConfig.supabaseAnonKey;
};

/**
 * Get all assets with pagination and filtering
 */
export const getAssets = async (
  page: number = 1,
  limit: number = 20,
  filters?: {
    status?: string;
    type?: AssetType;
    location?: string;
    assignedTo?: string;
  }
): Promise<{ data: Asset[]; total: number; page: number; totalPages: number }> => {
  if (!isSupabaseConfigured()) {
    // Mock data for development
    const mockAssets: Asset[] = Array.from({ length: 50 }, (_, i) => ({
      id: `asset-${i + 1}`,
      name: `Laptop ${i + 1}`,
      type: 'Laptop' as AssetType,
      status: i % 3 === 0 ? 'In Use' : 'Available',
      serialNumber: `SN-${i + 1}`,
      assignedTo: i % 3 === 0 ? `Employee ${i + 1}` : undefined,
      purchaseDate: '2024-01-01',
      warrantyExpiry: '2025-01-01',
      cost: 1500 + i * 100,
      location: 'Headquarters'
    }));

    const filtered = mockAssets.filter(asset => {
      if (filters?.status && asset.status !== filters.status) return false;
      if (filters?.type && asset.type !== filters.type) return false;
      if (filters?.location && asset.location !== filters.location) return false;
      if (filters?.assignedTo && asset.assignedTo !== filters.assignedTo) return false;
      return true;
    });

    const total = filtered.length;
    const totalPages = Math.ceil(total / limit);
    const data = filtered.slice((page - 1) * limit, page * limit);

    return {
      data,
      total,
      page,
      totalPages
    };
  }

  const supabase = await getSupabaseClient();

  // Build base query
  let query = supabase
    .from('assets')
    .select('*', { count: 'exact' })
    .order('name', { ascending: true });

  // Apply filters
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.type) {
    query = query.eq('type', filters.type);
  }
  if (filters?.location) {
    query = query.eq('location', filters.location);
  }
  if (filters?.assignedTo) {
    query = query.eq('assigned_to', filters.assignedTo);
  }

  // Apply pagination
  const offset = (page - 1) * limit;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching assets:', error);
    throw new Error('Failed to fetch assets');
  }

  const total = count || 0;
  const totalPages = Math.ceil(total / limit);

  return {
    data: data || [],
    total,
    page,
    totalPages
  };
};

/**
 * Get asset by ID
 */
export const getAssetById = async (id: string): Promise<Asset | null> => {
  if (!isSupabaseConfigured()) {
    return {
      id,
      name: 'Laptop 1',
      type: 'Laptop' as AssetType,
      status: 'In Use',
      serialNumber: 'SN-001',
      assignedTo: 'Employee 1',
      purchaseDate: '2024-01-01',
      warrantyExpiry: '2025-01-01',
      cost: 1500,
      location: 'Headquarters'
    };
  }

  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from('assets')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching asset:', error);
    throw new Error('Failed to fetch asset');
  }

  return data || null;
};

/**
 * Create a new asset
 */
export const createAsset = async (asset: Omit<Asset, 'id'>): Promise<Asset> => {
  if (!isSupabaseConfigured()) {
    // Mock implementation for development
    return {
      ...asset,
      id: `asset-${Date.now()}`
    };
  }

  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from('assets')
    .insert({
      name: asset.name,
      type: asset.type,
      status: asset.status,
      serial_number: asset.serialNumber,
      assigned_to: asset.assignedTo,
      purchase_date: asset.purchaseDate,
      warranty_expiry: asset.warrantyExpiry,
      cost: asset.cost,
      location: asset.location
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating asset:', error);
    throw new Error('Failed to create asset');
  }

  return {
    id: data.id,
    name: data.name,
    type: data.type,
    status: data.status,
    serialNumber: data.serial_number,
    assignedTo: data.assigned_to,
    purchaseDate: data.purchase_date,
    warrantyExpiry: data.warranty_expiry,
    cost: data.cost,
    location: data.location
  };
};

/**
 * Update an asset
 */
export const updateAsset = async (id: string, updates: Partial<Asset>): Promise<Asset> => {
  if (!isSupabaseConfigured()) {
    // Mock implementation for development
    return {
      id,
      name: updates.name || 'Laptop 1',
      type: updates.type || 'Laptop' as AssetType,
      status: updates.status || 'In Use',
      serialNumber: updates.serialNumber || 'SN-001',
      assignedTo: updates.assignedTo,
      purchaseDate: updates.purchaseDate || '2024-01-01',
      warrantyExpiry: updates.warrantyExpiry || '2025-01-01',
      cost: updates.cost || 1500,
      location: updates.location || 'Headquarters'
    };
  }

  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from('assets')
    .update({
      name: updates.name,
      type: updates.type,
      status: updates.status,
      serial_number: updates.serialNumber,
      assigned_to: updates.assignedTo,
      purchase_date: updates.purchaseDate,
      warranty_expiry: updates.warrantyExpiry,
      cost: updates.cost,
      location: updates.location
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating asset:', error);
    throw new Error('Failed to update asset');
  }

  return {
    id: data.id,
    name: data.name,
    type: data.type,
    status: data.status,
    serialNumber: data.serial_number,
    assignedTo: data.assigned_to,
    purchaseDate: data.purchase_date,
    warrantyExpiry: data.warranty_expiry,
    cost: data.cost,
    location: data.location
  };
};

/**
 * Delete an asset
 */
export const deleteAsset = async (id: string): Promise<void> => {
  if (!isSupabaseConfigured()) {
    // Mock implementation for development
    return;
  }

  const supabase = await getSupabaseClient();
  const { error } = await supabase
    .from('assets')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting asset:', error);
    throw new Error('Failed to delete asset');
  }
};

/**
 * Get asset comments
 */
export const getAssetComments = async (assetId: string): Promise<AssetComment[]> => {
  if (!isSupabaseConfigured()) {
    return [
      {
        id: 'comment-1',
        assetId,
        authorName: 'System',
        message: 'Asset created',
        type: 'System',
        createdAt: new Date().toISOString()
      }
    ];
  }

  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from('asset_comments')
    .select('*')
    .eq('asset_id', assetId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching asset comments:', error);
    throw new Error('Failed to fetch asset comments');
  }

  return data || [];
};

/**
 * Add asset comment
 */
export const addAssetComment = async (
  assetId: string,
  message: string,
  authorName: string,
  authorId?: string
): Promise<AssetComment> => {
  if (!isSupabaseConfigured()) {
    return {
      id: `comment-${Date.now()}`,
      assetId,
      authorName,
      authorId,
      message,
      type: 'Note',
      createdAt: new Date().toISOString()
    };
  }

  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from('asset_comments')
    .insert({
      asset_id: assetId,
      author_name: authorName,
      author_id: authorId,
      message,
      type: 'Note'
    })
    .select()
    .single();

  if (error) {
    console.error('Error adding asset comment:', error);
    throw new Error('Failed to add asset comment');
  }

  return data;
};

/**
 * Get assets by status
 */
export const getAssetsByStatus = async (status: string): Promise<Asset[]> => {
  if (!isSupabaseConfigured()) {
    return [];
  }

  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from('assets')
    .select('*')
    .eq('status', status)
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching assets by status:', error);
    throw new Error('Failed to fetch assets by status');
  }

  return data || [];
};

/**
 * Get assets by type
 */
export const getAssetsByType = async (type: AssetType): Promise<Asset[]> => {
  if (!isSupabaseConfigured()) {
    return [];
  }

  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from('assets')
    .select('*')
    .eq('type', type)
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching assets by type:', error);
    throw new Error('Failed to fetch assets by type');
  }

  return data || [];
};

/**
 * Get assets by location
 */
export const getAssetsByLocation = async (location: string): Promise<Asset[]> => {
  if (!isSupabaseConfigured()) {
    return [];
  }

  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from('assets')
    .select('*')
    .eq('location', location)
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching assets by location:', error);
    throw new Error('Failed to fetch assets by location');
  }

  return data || [];
};

/**
 * Get assets expiring warranty
 */
export const getAssetsExpiringWarranty = async (days: number = 30): Promise<Asset[]> => {
  if (!isSupabaseConfigured()) {
    return [];
  }

  const supabase = await getSupabaseClient();
  const today = new Date();
  const expiryDate = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);
  
  const { data, error } = await supabase
    .from('assets')
    .select('*')
    .gte('warranty_expiry', today.toISOString().split('T')[0])
    .lte('warranty_expiry', expiryDate.toISOString().split('T')[0])
    .order('warranty_expiry', { ascending: true });

  if (error) {
    console.error('Error fetching assets with expiring warranty:', error);
    throw new Error('Failed to fetch assets with expiring warranty');
  }

  return data || [];
};