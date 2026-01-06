import { Asset, AssetComment, AssetType } from '../types';
import { getSupabaseClient } from './supabaseClient';
import { isSupabaseConfigured } from './database';
import { isApiConfigured, request } from './apiClient';
import { mapAssetRecord, normalizeDateInput, normalizeDateOutput } from './assetMapper';

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
  if (isApiConfigured()) {
    const query = new URLSearchParams({
      page: String(page),
      pageSize: String(limit),
      ...(filters?.type ? { type: String(filters.type) } : {}),
      ...(filters?.status ? { status: String(filters.status) } : {})
    });
    const result = await request<{ data: any[]; total: number; page: number; totalPages: number }>(
      `/assets/page?${query.toString()}`
    );
    return {
      ...result,
      data: (result.data || []).map(mapAssetRecord)
    };
  }

  if (!isSupabaseConfigured()) {
    // Mock data for development
    const mockAssets: Asset[] = Array.from({ length: 50 }, (_, i) => ({
      id: `asset-${i + 1}`,
      name: `Laptop ${i + 1}`,
      type: 'Laptop' as AssetType,
      status: i % 3 === 0 ? 'Shared Resource' : 'Available',
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
    data: (data || []).map(mapAssetRecord),
    total,
    page,
    totalPages
  };
};

/**
 * Get asset by ID
 */
export const getAssetById = async (id: string): Promise<Asset | null> => {
  if (isApiConfigured()) {
    const record = await request<any>(`/assets/${id}`);
    return record ? mapAssetRecord(record) : null;
  }

  if (!isSupabaseConfigured()) {
    return {
      id,
      name: 'Laptop 1',
      type: 'Laptop' as AssetType,
      status: 'Shared Resource',
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

  return data ? mapAssetRecord(data) : null;
};

/**
 * Create a new asset
 */
export const createAsset = async (asset: Omit<Asset, 'id'>): Promise<Asset> => {
  const purchaseDate = normalizeDateInput(asset.purchaseDate);
  const warrantyExpiry = normalizeDateInput(asset.warrantyExpiry);
  const payload = {
    ...asset,
    purchaseDate,
    warrantyExpiry
  };

  if (isApiConfigured()) {
    const created = await request<any>('/assets', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return mapAssetRecord(created);
  }

  if (!isSupabaseConfigured()) {
    // Mock implementation for development
    return {
      ...asset,
      purchaseDate: normalizeDateOutput(asset.purchaseDate),
      warrantyExpiry: normalizeDateOutput(asset.warrantyExpiry),
      id: `asset-${Date.now()}`
    };
  }

  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from('assets')
    .insert({
      name: payload.name,
      type: payload.type,
      status: payload.status,
      serial_number: payload.serialNumber,
      assigned_to: payload.assignedTo,
      purchase_date: payload.purchaseDate,
      warranty_expiry: payload.warrantyExpiry,
      cost: payload.cost,
      location: payload.location
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating asset:', error);
    throw new Error('Failed to create asset');
  }

  return mapAssetRecord(data);
};

/**
 * Update an asset
 */
export const updateAsset = async (id: string, updates: Partial<Asset>): Promise<Asset> => {
  const purchaseDate =
    updates.purchaseDate === undefined ? undefined : normalizeDateInput(updates.purchaseDate);
  const warrantyExpiry =
    updates.warrantyExpiry === undefined ? undefined : normalizeDateInput(updates.warrantyExpiry);
  const payload = {
    ...updates,
    purchaseDate,
    warrantyExpiry
  };

  if (isApiConfigured()) {
    const updated = await request<any>(`/assets/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ ...payload, id })
    });
    return mapAssetRecord(updated);
  }

  if (!isSupabaseConfigured()) {
    // Mock implementation for development
    return {
      id,
      name: updates.name || 'Laptop 1',
      type: updates.type || 'Laptop' as AssetType,
      status: updates.status || 'Shared Resource',
      serialNumber: updates.serialNumber || 'SN-001',
      assignedTo: updates.assignedTo,
      purchaseDate: normalizeDateOutput(updates.purchaseDate) || '2024-01-01',
      warrantyExpiry: normalizeDateOutput(updates.warrantyExpiry) || '2025-01-01',
      cost: updates.cost || 1500,
      location: updates.location || 'Headquarters'
    };
  }

  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from('assets')
    .update({
      name: payload.name,
      type: payload.type,
      status: payload.status,
      serial_number: payload.serialNumber,
      assigned_to: payload.assignedTo,
      purchase_date: payload.purchaseDate,
      warranty_expiry: payload.warrantyExpiry,
      cost: payload.cost,
      location: payload.location
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating asset:', error);
    throw new Error('Failed to update asset');
  }

  return mapAssetRecord(data);
};

/**
 * Delete an asset
 */
export const deleteAsset = async (id: string): Promise<void> => {
  if (isApiConfigured()) {
    await request<{ ok: boolean }>(`/assets/${id}`, { method: 'DELETE' });
    return;
  }

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
