/**
 * Test script for SQLite database functionality
 */

import { getDatabaseClient } from './services/databaseClient.js';
import { initializeDatabase } from './services/dataService.js';

async function testSQLite() {
  try {
    console.log('Testing SQLite database setup...');

    // Set environment variable for SQLite
    process.env.VITE_DB_TYPE = 'sqlite';
    process.env.VITE_DB_FILE_PATH = './data/test_inventory.db';

    // Initialize database
    await initializeDatabase();
    console.log('Database initialized successfully');

    // Get database client
    const db = await getDatabaseClient();
    console.log('Database client obtained');

    // Test basic query - check if users table exists and has data
    const { data: users, error } = await db.from('users').select('*').limit(5);

    if (error) {
      console.error('Error querying users:', error);
    } else {
      console.log('Users in database:', users?.length || 0);
      if (users && users.length > 0) {
        console.log('Sample user:', users[0]);
      }
    }

    // Test inserting a test location
    const { data: insertResult, error: insertError } = await db
      .from('locations')
      .insert({ name: 'Test Location', city: 'Test City', country: 'Test Country' });

    if (insertError) {
      console.error('Error inserting location:', insertError);
    } else {
      console.log('Location inserted successfully:', insertResult);
    }

    // Test querying the inserted location
    const { data: locations, error: locationError } = await db
      .from('locations')
      .select('*')
      .eq('name', 'Test Location');

    if (locationError) {
      console.error('Error querying locations:', locationError);
    } else {
      console.log('Locations found:', locations?.length || 0);
      if (locations && locations.length > 0) {
        console.log('Test location:', locations[0]);
      }
    }

    console.log('SQLite test completed successfully!');

  } catch (error) {
    console.error('Test failed:', error);
  }
}

testSQLite();