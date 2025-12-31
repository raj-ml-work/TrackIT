/**
 * SQLite Database Initialization Script
 * Run this script to set up the SQLite database with the schema
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

// Get the directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database file path
const dbPath = path.join(__dirname, '..', 'data', 'inventory.db');

// Ensure data directory exists
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Connect to database
console.log('Initializing SQLite database...');
const db = new Database(dbPath);

// Enable foreign keys and WAL mode
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

// Read and execute schema
const schemaPath = path.join(__dirname, '..', 'database', 'schema_sqlite.sql');
const schemaSQL = fs.readFileSync(schemaPath, 'utf8');

console.log('Running schema...');

try {
  // Execute the entire schema at once - SQLite can handle multiple statements
  db.exec(schemaSQL);
  console.log('Schema executed successfully!');
} catch (error) {
  console.error('Error executing schema:', error.message);
  // Try to execute statements individually as fallback
  console.log('Attempting individual statement execution...');

  const statements = schemaSQL.split(';').filter(stmt => stmt.trim().length > 0);
  let successCount = 0;
  let errorCount = 0;

  for (const statement of statements) {
    const trimmed = statement.trim();
    if (trimmed) {
      try {
        db.exec(trimmed);
        successCount++;
      } catch (stmtError) {
        errorCount++;
        console.error(`Failed statement (${errorCount}):`, trimmed.substring(0, 100) + '...');
      }
    }
  }

  console.log(`Schema execution complete: ${successCount} successful, ${errorCount} failed`);
}

console.log('SQLite database initialized successfully!');
db.close();