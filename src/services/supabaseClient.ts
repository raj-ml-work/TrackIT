import { createClient } from '@supabase/supabase-js';
import { dbConfig } from './database';

/**
 * Create and configure Supabase client
 */
export const getSupabaseClient = async () => {
  if (!dbConfig.supabaseUrl || !dbConfig.supabaseAnonKey) {
    throw new Error('Supabase configuration is missing');
  }

  return createClient(dbConfig.supabaseUrl, dbConfig.supabaseAnonKey);
};