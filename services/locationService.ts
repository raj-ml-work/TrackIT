/**
 * Location Service
 * 
 * Handles all database operations for Locations
 */

import { Location } from '../types';
import { getSupabaseClient } from './supabaseClient';

const TABLE_NAME = 'locations';

/**
 * Get all locations
 */
export const getLocations = async (): Promise<Location[]> => {
  try {
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
 */
export const createLocation = async (location: Omit<Location, 'id'>): Promise<Location> => {
  try {
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
 */
export const updateLocation = async (location: Location): Promise<Location> => {
  try {
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
 */
export const deleteLocation = async (id: string): Promise<void> => {
  try {
    const supabase = await getSupabaseClient();
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

