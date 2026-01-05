/**
 * Supabase Client Configuration
 * 
 * This file initializes and exports the Supabase client for database operations.
 * For local database support, this can be extended or replaced with a different client.
 */

import { dbConfig } from './database';

let supabaseClient: any = null;
let supabaseModule: any = null;

/**
 * Dynamically import Supabase client (only when needed)
 */
const loadSupabaseClient = async () => {
  if (!supabaseModule) {
    try {
      supabaseModule = await import('@supabase/supabase-js');
    } catch (error) {
      throw new Error('@supabase/supabase-js package is not installed. Run: npm install @supabase/supabase-js');
    }
  }
  return supabaseModule;
};

/**
 * Initialize and get Supabase client
 */
export const getSupabaseClient = async (): Promise<any> => {
  if (supabaseClient) {
    return supabaseClient;
  }

  if (dbConfig.type !== 'supabase') {
    throw new Error('Supabase client requested but database type is not Supabase');
  }

  if (!dbConfig.supabaseUrl || !dbConfig.supabaseAnonKey) {
    throw new Error('Supabase URL and Anon Key must be provided in environment variables');
  }

  const { createClient } = await loadSupabaseClient();

  supabaseClient = createClient(
    dbConfig.supabaseUrl,
    dbConfig.supabaseAnonKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  );

  return supabaseClient;
};

/**
 * Reset client (useful for testing or reconfiguration)
 */
export const resetSupabaseClient = () => {
  supabaseClient = null;
};

