/**
 * Script to reset the admin password to 'admin123'
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

// Hash password function
const hashPassword = (password) => {
  const hash = crypto.createHash('sha256');
  hash.update(password);
  return hash.digest('hex');
};

async function resetAdminPassword() {
  const dbPath = path.join(__dirname, 'data', 'inventory.db');

  console.log('Resetting admin password to "admin123"...');

  try {
    const db = new Database(dbPath);

    const defaultAdminEmail = 'admin@trackit.com';
    const newPassword = 'admin123';
    const newPasswordHash = hashPassword(newPassword);

    // Update the admin password
    const updateStmt = db.prepare(`
      UPDATE users
      SET password_hash = ?
      WHERE email = ? AND role = 'Admin'
    `);

    const result = updateStmt.run(newPasswordHash, defaultAdminEmail);

    if (result.changes > 0) {
      console.log('✅ Admin password reset successfully!');
      console.log(`📧 Email: ${defaultAdminEmail}`);
      console.log(`🔑 New Password: ${newPassword}`);
      console.log('⚠️  IMPORTANT: Please change the password after first login!');
    } else {
      console.log('❌ Admin user not found or password not updated');
    }

    db.close();
  } catch (error) {
    console.error('Error resetting admin password:', error);
  }
}

// Run the script
resetAdminPassword();