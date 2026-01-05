/**
 * Database configuration interface
 */
export interface DatabaseConfig {
  type: 'supabase' | 'sqlite';
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  geminiApiKey?: string;
}

/**
 * Database configuration
 * This will be populated from environment variables
 */
export const dbConfig: DatabaseConfig = {
  type: (process.env.VITE_DB_TYPE as 'supabase' | 'sqlite') || 'supabase',
  supabaseUrl: process.env.VITE_SUPABASE_URL,
  supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY,
  geminiApiKey: process.env.VITE_GEMINI_API_KEY
};

/**
 * Check if Supabase is configured
 */
export const isSupabaseConfigured = (): boolean => {
  return dbConfig.type === 'supabase' && 
         !!dbConfig.supabaseUrl && 
         !!dbConfig.supabaseAnonKey;
};

/**
 * Check if Gemini API is configured
 */
export const isGeminiConfigured = (): boolean => {
  return !!dbConfig.geminiApiKey;
};