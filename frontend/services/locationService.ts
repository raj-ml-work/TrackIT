/**
 * Location Service
 *
 * Handles all database operations for Locations
 */

import { Location, UserAccount, Asset, Employee } from '../types';
import { getSupabaseClient } from './supabaseClient';
import { apiFetchJson, isApiConfigured } from './apiClient';
import { isAdmin, getPermissionError } from './permissionUtil';

const TABLE_NAME = 'locations';

/**
 * Get all locations
 */
export const getLocations = async (): Promise<Location[]> => {
  try {
    if (isApiConfigured()) {
      return await apiFetchJson<Location[]>('/locations');
    }

    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;

    return (data || []).map(transformLocationFromDB);
  } catch (error) {
    console.error('Error fetching locations:', error);
    throw error;
  }
};

/**
 * Get a single location by ID
 */
export const getLocationById = async (id: string): Promise<Location | null> => {
  try {
    if (isApiConfigured()) {
      return await apiFetchJson<Location>(`/locations/${id}`);
    }

    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!data) return null;

    return transformLocationFromDB(data);
  } catch (error) {
    console.error('Error fetching location:', error);
    throw error;
  }
};

/**
 * Get location by name
 */
export const getLocationByName = async (name: string): Promise<Location | null> => {
  try {
    if (isApiConfigured()) {
      const locations = await apiFetchJson<Location[]>('/locations');
      const match = locations.find(location => location.name === name);
      return match || null;
    }

    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('name', name)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;

    return transformLocationFromDB(data);
  } catch (error) {
    console.error('Error fetching location by name:', error);
    throw error;
  }
};

/**
 * Create a new location
 * @param location Location data to create
 * @param currentUser Current authenticated user for permission check
 */
export const createLocation = async (location: Omit<Location, 'id'>, currentUser: UserAccount | null = null): Promise<Location> => {
  try {
    // Check permission - only admins can create locations
    if (!isAdmin(currentUser)) {
      throw new Error(getPermissionError('create', currentUser?.role || null));
    }

    if (isApiConfigured()) {
      return await apiFetchJson<Location>('/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(location)
      });
    }

    const supabase = await getSupabaseClient();
    const locationData = transformLocationToDB(location);
    
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .insert(locationData)
      .select()
      .single();

    if (error) throw error;

    return transformLocationFromDB(data);
  } catch (error) {
    console.error('Error creating location:', error);
    throw error;
  }
};

/**
 * Update an existing location
 * @param location Location data to update
 * @param currentUser Current authenticated user for permission check
 */
export const updateLocation = async (location: Location, currentUser: UserAccount | null = null): Promise<Location> => {
  try {
    // Check permission - only admins can update locations
    if (!isAdmin(currentUser)) {
      throw new Error(getPermissionError('update', currentUser?.role || null));
    }

    if (isApiConfigured()) {
      return await apiFetchJson<Location>(`/locations/${location.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: location.name, city: location.city })
      });
    }

    const supabase = await getSupabaseClient();
    const locationData = transformLocationToDB(location);
    
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .update(locationData)
      .eq('id', location.id)
      .select()
      .single();

    if (error) throw error;

    return transformLocationFromDB(data);
  } catch (error) {
    console.error('Error updating location:', error);
    throw error;
  }
};

/**
 * Delete a location
 * @param id Location ID to delete
 * @param currentUser Current authenticated user for permission check
 */
export const deleteLocation = async (id: string, currentUser: UserAccount | null = null): Promise<void> => {
  try {
    // Check permission - only admins can delete locations
    if (!isAdmin(currentUser)) {
      throw new Error(getPermissionError('delete', currentUser?.role || null));
    }

    if (isApiConfigured()) {
      await apiFetchJson<{ ok: boolean }>(`/locations/${id}`, { method: 'DELETE' });
      return;
    }

    // Check foreign key constraints - ensure no assets or employees are assigned to this location
    const supabase = await getSupabaseClient();

    // Check for assets assigned to this location
    const { data: assets, error: assetsError } = await supabase
      .from('assets')
      .select('id')
      .eq('location_id', id);

    if (assetsError) throw assetsError;

    // Check for employees assigned to this location
    const { data: employees, error: employeesError } = await supabase
      .from('employees')
      .select('id')
      .eq('location_id', id);

    if (employeesError) throw employeesError;

    const totalDependencies = (assets?.length || 0) + (employees?.length || 0);
    if (totalDependencies > 0) {
      throw new Error(`Cannot delete location. It has ${assets?.length || 0} asset(s) and ${employees?.length || 0} employee(s) assigned. Please reassign them first.`);
    }

    const { error } = await supabase
      .from(TABLE_NAME)
      .delete()
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting location:', error);
    throw error;
  }
};

/**
 * Transform database format to app format
 */
const transformLocationFromDB = (dbLocation: any): Location => {
  return {
    id: dbLocation.id,
    name: dbLocation.name,
    city: dbLocation.city,
    comments: dbLocation.comments || undefined
  };
};

/**
 * Transform app format to database format
 */
const transformLocationToDB = (location: Location | Omit<Location, 'id'>): any => {
  return {
    id: 'id' in location ? location.id : undefined,
    name: location.name,
    city: location.city,
    comments: location.comments || null
  };
};
