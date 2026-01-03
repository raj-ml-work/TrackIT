import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import { hashPasswordSha256 } from '../utils/password.js';
import { mapUserRow } from '../utils/user.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const loadSchema = () => {
  const schemaPath = path.resolve(__dirname, '..', '..', '..', 'database', 'schema_sqlite.sql');
  return fs.readFileSync(schemaPath, 'utf8');
};

const ensureSchema = (db) => {
  const table = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
    .get();

  if (table) return;

  const schemaSQL = loadSchema();
  db.exec(schemaSQL);
};

const ensureDefaultAdmin = (db, config) => {
  const existing = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (existing?.count > 0) return;

  const hashedPassword = hashPasswordSha256(config.defaults.adminPassword);
  db.prepare(
    `INSERT INTO users (name, email, password_hash, role, status)
     VALUES (?, ?, ?, ?, ?)`
  ).run('System Administrator', config.defaults.adminEmail.toLowerCase(), hashedPassword, 'Admin', 'Active');
};

const notImplemented = (name) => {
  return async () => {
    throw new Error(`SQLite provider: ${name} not implemented yet`);
  };
};

const mapLocationRow = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    city: row.city
  };
};

export const createSqliteProvider = (config) => {
  const dbDir = path.dirname(config.sqlitePath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const db = new Database(config.sqlitePath);
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');

  ensureSchema(db);
  ensureDefaultAdmin(db, config);

  const getUserByEmail = async (email) => {
    const row = db
      .prepare('SELECT * FROM users WHERE lower(email) = ? LIMIT 1')
      .get(email.trim().toLowerCase());

    return row ? mapUserRow(row) : null;
  };

  const getUserById = async (id) => {
    const row = db.prepare('SELECT * FROM users WHERE id = ? LIMIT 1').get(id);
    return row ? mapUserRow(row) : null;
  };

  const updateLastLogin = async (userId) => {
    db.prepare('UPDATE users SET last_login = ? WHERE id = ?').run(new Date().toISOString(), userId);
  };

  const getUsers = async () => {
    const rows = db.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
    return rows.map(mapUserRow);
  };

  const createUser = async (user, password, currentUser) => {
    if (!currentUser || currentUser.role !== 'Admin') {
      throw new Error('Permission denied: admin access required');
    }

    const hashedPassword = hashPasswordSha256(password);
    db.prepare(
      `INSERT INTO users (name, email, password_hash, role, status)
       VALUES (?, ?, ?, ?, ?)`
    ).run(user.name, user.email.toLowerCase(), hashedPassword, user.role, user.status);

    return getUserByEmail(user.email);
  };

  const updateUserPassword = async (userId, newPassword) => {
    const hashedPassword = hashPasswordSha256(newPassword);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashedPassword, userId);
  };

  const getLocations = async () => {
    const rows = db.prepare('SELECT id, name, city FROM locations ORDER BY name ASC').all();
    return rows.map(mapLocationRow);
  };

  const getLocationById = async (id) => {
    const row = db
      .prepare('SELECT id, name, city FROM locations WHERE id = ? LIMIT 1')
      .get(id);
    return mapLocationRow(row);
  };

  const getLocationByName = async (name) => {
    const row = db
      .prepare('SELECT id, name, city FROM locations WHERE lower(name) = lower(?) LIMIT 1')
      .get(name.trim());
    return mapLocationRow(row);
  };

  const createLocation = async (location) => {
    const trimmedName = location.name?.trim();
    const trimmedCity = location.city?.trim();
    if (!trimmedName || !trimmedCity) {
      throw new Error('Location name and city are required');
    }

    const existing = await getLocationByName(trimmedName);
    if (existing) {
      throw new Error(`Location "${trimmedName}" already exists`);
    }

    const info = db
      .prepare('INSERT INTO locations (name, city) VALUES (?, ?)')
      .run(trimmedName, trimmedCity);
    const created = db
      .prepare('SELECT id, name, city FROM locations WHERE rowid = ?')
      .get(info.lastInsertRowid);
    return mapLocationRow(created);
  };

  const updateLocation = async (location) => {
    if (!location?.id) {
      throw new Error('Location id is required');
    }
    const trimmedName = location.name?.trim();
    const trimmedCity = location.city?.trim();
    if (!trimmedName || !trimmedCity) {
      throw new Error('Location name and city are required');
    }

    const existing = await getLocationById(location.id);
    if (!existing) {
      throw new Error('Location not found');
    }

    const duplicate = db
      .prepare('SELECT id FROM locations WHERE lower(name) = lower(?) AND id != ? LIMIT 1')
      .get(trimmedName, location.id);
    if (duplicate) {
      throw new Error(`Location "${trimmedName}" already exists`);
    }

    db.prepare('UPDATE locations SET name = ?, city = ? WHERE id = ?')
      .run(trimmedName, trimmedCity, location.id);
    return await getLocationById(location.id);
  };

  const deleteLocation = async (id) => {
    if (!id) {
      throw new Error('Location id is required');
    }
    db.prepare('DELETE FROM locations WHERE id = ?').run(id);
  };

  return {
    // Assets
    getAssets: notImplemented('getAssets'),
    getAssetsPage: notImplemented('getAssetsPage'),
    getAssetById: notImplemented('getAssetById'),
    createAsset: notImplemented('createAsset'),
    updateAsset: notImplemented('updateAsset'),
    deleteAsset: notImplemented('deleteAsset'),
    getAssetComments: notImplemented('getAssetComments'),
    addAssetComment: notImplemented('addAssetComment'),
    checkSerialNumberExists: notImplemented('checkSerialNumberExists'),

    // Employees
    getEmployees: notImplemented('getEmployees'),
    getEmployeesPage: notImplemented('getEmployeesPage'),
    getEmployeeById: notImplemented('getEmployeeById'),
    getEmployeeByEmployeeId: notImplemented('getEmployeeByEmployeeId'),
    createEmployee: notImplemented('createEmployee'),
    updateEmployee: notImplemented('updateEmployee'),
    deleteEmployee: notImplemented('deleteEmployee'),

    // Locations
    getLocations,
    getLocationById,
    getLocationByName,
    createLocation,
    updateLocation,
    deleteLocation,

    // Users
    getUsers,
    getUserById,
    getUserByEmail,
    createUser,
    updateUser: notImplemented('updateUser'),
    updateUserPassword,
    resetUserPassword: notImplemented('resetUserPassword'),
    deleteUser: notImplemented('deleteUser'),
    updateLastLogin,

    // Departments
    getDepartments: notImplemented('getDepartments'),
    getDepartmentById: notImplemented('getDepartmentById'),
    getDepartmentByName: notImplemented('getDepartmentByName'),
    createDepartment: notImplemented('createDepartment'),
    updateDepartment: notImplemented('updateDepartment'),
    deleteDepartment: notImplemented('deleteDepartment')
  };
};
