/**
 * Script to check the admin user in SQLite database
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

function checkAdminUser() {
  const dbPath = path.join(__dirname, 'data', 'inventory.db');

  console.log('Checking admin user in SQLite database...');

  try {
    const db = new Database(dbPath);

    // Check users table
    const users = db.prepare('SELECT id, name, email, role, status, password_hash FROM users').all();

    console.log('Users in database:');
    users.forEach(user => {
      console.log(`- ID: ${user.id}`);
      console.log(`  Name: ${user.name}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Role: ${user.role}`);
      console.log(`  Status: ${user.status}`);
      console.log(`  Password Hash: ${user.password_hash || 'NULL'}`);
      console.log('');
    });

    db.close();
  } catch (error) {
    console.error('Error checking admin user:', error);
  }
}

// Run the script
checkAdminUser();