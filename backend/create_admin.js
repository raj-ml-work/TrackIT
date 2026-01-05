/**
 * Script to create the default admin user in SQLite database
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import Database from 'better-sqlite3';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

// Hash password function (Node.js version)
const hashPassword = async (password) => {
  const hash = crypto.createHash('sha256');
  hash.update(password);
  return hash.digest('hex');
};

async function createAdminUser() {
  const dbPath = path.join(__dirname, 'data', 'inventory.db');

  console.log('Creating admin user in SQLite database...');

  try {
    const db = new Database(dbPath);

    const defaultAdminEmail = 'admin@trackit.com';
    const defaultAdminPassword = 'admin123';
    const defaultAdminName = 'System Administrator';

    // Hash the password
    const defaultAdminPasswordHash = await hashPassword(defaultAdminPassword);

    // Check if admin already exists
    const existingAdmin = db.prepare('SELECT id FROM users WHERE email = ?').get(defaultAdminEmail);

    if (existingAdmin) {
      console.log('✅ Admin user already exists!');
      console.log(`📧 Email: ${defaultAdminEmail}`);
      console.log(`🔑 Password: ${defaultAdminPassword}`);
      db.close();
      return;
    }

    // Create the admin user
    const insertStmt = db.prepare(`
      INSERT INTO users (name, email, role, status, password_hash)
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = insertStmt.run(
      defaultAdminName,
      defaultAdminEmail,
      'Admin',
      'Active',
      defaultAdminPasswordHash
    );

    if (result.changes > 0) {
      console.log('✅ Admin user created successfully!');
      console.log(`📧 Email: ${defaultAdminEmail}`);
      console.log(`🔑 Password: ${defaultAdminPassword}`);
      console.log('⚠️  IMPORTANT: Please change the password after first login!');
    } else {
      console.log('❌ Failed to create admin user');
    }

    db.close();
  } catch (error) {
    console.error('Error creating admin user:', error);
  }
}

// Run the script
createAdminUser();