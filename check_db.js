import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'data', 'inventory.db');
const db = new Database(dbPath);

console.log('Database tables:');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
tables.forEach(table => {
  console.log('-', table.name);
});

console.log('\nUsers table content:');
const users = db.prepare("SELECT id, name, email, role FROM users").all();
console.log('Number of users:', users.length);
users.forEach(user => {
  console.log(' ', user);
});

db.close();