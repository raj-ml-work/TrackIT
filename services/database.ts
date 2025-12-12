/**
 * Database Configuration
 * 
 * This file provides a configurable database layer that can switch between
 * Supabase (cloud) and local PostgreSQL/SQL databases.
 */

export enum DatabaseType {
  SUPABASE = 'supabase',
  POSTGRES = 'postgres',
  SQL = 'sql'
}

export interface DatabaseConfig {
  type: DatabaseType;
  // Supabase config
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  // Local database config
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
}

// Get database configuration from environment variables
export const getDatabaseConfig = (): DatabaseConfig => {
  const dbType = (import.meta.env.VITE_DB_TYPE || 'supabase') as DatabaseType;
  
  if (dbType === DatabaseType.SUPABASE) {
    return {
      type: DatabaseType.SUPABASE,
      supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
      supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || ''
    };
  }
  
  // For local databases (future implementation)
  return {
    type: dbType,
    host: import.meta.env.VITE_DB_HOST || 'localhost',
    port: parseInt(import.meta.env.VITE_DB_PORT || '5432'),
    database: import.meta.env.VITE_DB_NAME || 'auralis_inventory',
    user: import.meta.env.VITE_DB_USER || 'postgres',
    password: import.meta.env.VITE_DB_PASSWORD || ''
  };
};

export const dbConfig = getDatabaseConfig();




