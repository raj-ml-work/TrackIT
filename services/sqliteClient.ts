/**
 * SQLite Client Configuration
 *
 * This file initializes and exports the SQLite database client for local database operations.
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { dbConfig } from './database';

let sqliteDb: Database.Database | null = null;

/**
 * Initialize SQLite database
 */
const initializeSQLite = (): Database.Database => {
  if (!dbConfig.filePath) {
    throw new Error('SQLite file path not configured');
  }

  // Ensure the directory exists
  const dbDir = path.dirname(dbConfig.filePath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const db = new Database(dbConfig.filePath);

  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // Enable WAL mode for better performance
  db.pragma('journal_mode = WAL');

  return db;
};

/**
 * Get SQLite database instance
 */
export const getSQLiteClient = (): Database.Database => {
  if (!sqliteDb) {
    sqliteDb = initializeSQLite();
  }
  return sqliteDb;
};

/**
 * Close SQLite database connection
 */
export const closeSQLiteClient = (): void => {
  if (sqliteDb) {
    sqliteDb.close();
    sqliteDb = null;
  }
};

/**
 * Execute a SQL query with parameters
 */
export const executeQuery = (sql: string, params: any[] = []): any[] => {
  const db = getSQLiteClient();
  const stmt = db.prepare(sql);
  return stmt.all(params);
};

/**
 * Execute a SQL query that returns a single row
 */
export const executeQuerySingle = (sql: string, params: any[] = []): any => {
  const db = getSQLiteClient();
  const stmt = db.prepare(sql);
  return stmt.get(params);
};

/**
 * Execute a SQL statement (INSERT, UPDATE, DELETE)
 */
export const executeStatement = (sql: string, params: any[] = []): Database.RunResult => {
  const db = getSQLiteClient();
  const stmt = db.prepare(sql);
  return stmt.run(params);
};

/**
 * Execute multiple SQL statements in a transaction
 */
export const executeTransaction = (statements: Array<{ sql: string; params?: any[] }>): void => {
  const db = getSQLiteClient();
  const transaction = db.transaction(() => {
    for (const stmt of statements) {
      const prepared = db.prepare(stmt.sql);
      prepared.run(stmt.params || []);
    }
  });
  transaction();
};

/**
 * Check if a table exists
 */
export const tableExists = (tableName: string): boolean => {
  const result = executeQuerySingle(
    "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
    [tableName]
  );
  return !!result;
};

/**
 * Get table schema
 */
export const getTableSchema = (tableName: string): any[] => {
  return executeQuery("PRAGMA table_info(?)", [tableName]);
};