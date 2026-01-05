/**
 * Test script to verify database client switching between SQLite and Supabase
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

import { dbConfig, DatabaseType } from './services/database';
import { getDatabaseClient } from './services/databaseClient';

async function testDatabaseSwitch() {
  console.log('Testing database client switching...');

  // Test SQLite configuration
  console.log('\n1. Testing SQLite configuration:');
  dbConfig.type = DatabaseType.SQLITE;
  dbConfig.filePath = './test_inventory.db';

  try {
    const sqliteClient = await getDatabaseClient();
    console.log('✓ SQLite client initialized successfully');

    // Test a simple query
    const result = await sqliteClient.from('locations').select('*').limit(1);
    console.log('✓ SQLite query executed:', result.error ? 'Error' : 'Success');
  } catch (error) {
    console.log('✗ SQLite client failed:', error);
  }

  // Test Supabase configuration
  console.log('\n2. Testing Supabase configuration:');
  dbConfig.type = DatabaseType.SUPABASE;
  dbConfig.supabaseUrl = process.env.VITE_SUPABASE_URL || '';
  dbConfig.supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

  try {
    const supabaseClient = await getDatabaseClient();
    console.log('✓ Supabase client initialized successfully');

    // Test a simple query
    const result = await supabaseClient.from('locations').select('*').limit(1);
    console.log('✓ Supabase query executed:', result.error ? 'Error' : 'Success');
  } catch (error) {
    console.log('✗ Supabase client failed:', error);
  }

  console.log('\nDatabase switching test completed.');
}

// Run the test
testDatabaseSwitch().catch(console.error);