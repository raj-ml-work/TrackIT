import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { dbConfig, isSupabaseConfigured } from './database';

type SupabaseProvider = {
  mode: 'supabase';
  client: SupabaseClient;
};

type MockProvider = {
  mode: 'mock';
  client: null;
};

export type DataProvider = SupabaseProvider | MockProvider;

let cachedClient: SupabaseClient | null = null;

export const getDataProvider = (): DataProvider => {
  if (!isSupabaseConfigured()) {
    return { mode: 'mock', client: null };
  }

  if (!cachedClient) {
    cachedClient = createClient(
      dbConfig.supabaseUrl!,
      dbConfig.supabaseAnonKey!
    );
  }

  return { mode: 'supabase', client: cachedClient };
};
