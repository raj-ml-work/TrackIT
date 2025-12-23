import { Location } from '../types';
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
 * Get all locations
 */
export const getLocations = async (): Promise<Location[]> => {
  if (!isSupabaseConfigured()) {
    return [
      { id: 'loc-1', name: 'Headquarters', city: 'New York' },
      { id: 'loc-2', name: 'Branch Office', city: 'San Francisco' }
    ];
  }

  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching locations:', error);
    throw new Error('Failed to fetch locations');
  }

  return data || [];
};

/**
 * Get location by ID
 */
export const getLocationById = async (id: string): Promise<Location | null> => {
  if (!isSupabaseConfigured()) {
    return {
      id,
      name: 'Headquarters',
      city: 'New York'
    };
  }

  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching location:', error);
    throw new Error('Failed to fetch location');
  }

  return data || null;
};

/**
 * Create a new location
 */
export const createLocation = async (location: Omit<Location, 'id'>): Promise<Location> => {
  if (!isSupabaseConfigured()) {
    // Mock implementation for development
    return {
      ...location,
      id: `loc-${Date.now()}`
    };
  }

  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from('locations')
    .insert({
      name: location.name,
      city: location.city
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating location:', error);
    throw new Error('Failed to create location');
  }

  return {
    id: data.id,
    name: data.name,
    city: data.city
  };
};

/**
 * Update a location
 */
export const updateLocation = async (id: string, updates: Partial<Location>): Promise<Location> => {
  if (!isSupabaseConfigured()) {
    // Mock implementation for development
    return {
      id,
      name: updates.name || 'Headquarters',
      city: updates.city || 'New York'
    };
  }

  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from('locations')
    .update({
      name: updates.name,
      city: updates.city
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating location:', error);
    throw new Error('Failed to update location');
  }

  return {
    id: data.id,
    name: data.name,
    city: data.city
  };
};

/**
 * Delete a location
 */
export const deleteLocation = async (id: string): Promise<void> => {
  if (!isSupabaseConfigured()) {
    // Mock implementation for development
    return;
  }

  const supabase = await getSupabaseClient();
  const { error } = await supabase
    .from('locations')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting location:', error);
    throw new Error('Failed to delete location');
  }
};