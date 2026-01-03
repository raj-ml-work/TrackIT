import { Pool } from 'pg';
import { hashPasswordSha256 } from '../utils/password.js';
import { mapUserRow } from '../utils/user.js';

const ensureUsersTable = async (pool) => {
  const result = await pool.query("SELECT to_regclass('public.users') AS table_name");
  const tableName = result?.rows?.[0]?.table_name;
  if (!tableName) {
    throw new Error('Postgres schema missing. Run database/schema.sql before starting the server.');
  }
};

const ensureDefaultAdmin = async (pool, config) => {
  const result = await pool.query('SELECT COUNT(*) AS count FROM users');
  const count = Number(result?.rows?.[0]?.count || 0);
  if (count > 0) return;

  const hashedPassword = hashPasswordSha256(config.defaults.adminPassword);
  await pool.query(
    `INSERT INTO users (name, email, password_hash, role, status)
     VALUES ($1, $2, $3, $4, $5)`,
    ['System Administrator', config.defaults.adminEmail.toLowerCase(), hashedPassword, 'Admin', 'Active']
  );
};

const notImplemented = (name) => {
  return async () => {
    throw new Error(`Postgres provider: ${name} not implemented yet`);
  };
};

export const createPostgresProvider = async (config) => {
  if (!config.pgUrl) {
    throw new Error('PG_URL is required when DB_PROVIDER=postgres');
  }

  const pool = new Pool({
    connectionString: config.pgUrl
  });

  await ensureUsersTable(pool);
  await ensureDefaultAdmin(pool, config);

  const getUserByEmail = async (email) => {
    const result = await pool.query(
      'SELECT * FROM users WHERE lower(email) = lower($1) LIMIT 1',
      [email.trim()]
    );
    const row = result.rows[0];
    return row ? mapUserRow(row) : null;
  };

  const getUserById = async (id) => {
    const result = await pool.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [id]);
    const row = result.rows[0];
    return row ? mapUserRow(row) : null;
  };

  const updateLastLogin = async (userId) => {
    await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [userId]);
  };

  const getUsers = async () => {
    const result = await pool.query('SELECT * FROM users ORDER BY created_at DESC');
    return result.rows.map(mapUserRow);
  };

  const createUser = async (user, password, currentUser) => {
    if (!currentUser || currentUser.role !== 'Admin') {
      throw new Error('Permission denied: admin access required');
    }

    const hashedPassword = hashPasswordSha256(password);
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [user.name, user.email.toLowerCase(), hashedPassword, user.role, user.status]
    );

    return mapUserRow(result.rows[0]);
  };

  const updateUser = async (user, currentUser) => {
    if (!currentUser || currentUser.role !== 'Admin') {
      throw new Error('Permission denied: admin access required');
    }

    const result = await pool.query(
      `UPDATE users
       SET name = $1, email = $2, role = $3, status = $4
       WHERE id = $5
       RETURNING *`,
      [user.name, user.email.toLowerCase(), user.role, user.status, user.id]
    );

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    return mapUserRow(result.rows[0]);
  };

  const deleteUser = async (userId, currentUser) => {
    if (!currentUser || currentUser.role !== 'Admin') {
      throw new Error('Permission denied: admin access required');
    }

    const result = await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    if (result.rowCount === 0) {
      throw new Error('User not found');
    }
  };

  const generateTemporaryPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*()_+';
    let password = '';
    const pick = (set) => set[Math.floor(Math.random() * set.length)];

    password += pick('ABCDEFGHJKLMNPQRSTUVWXYZ');
    password += pick('abcdefghijkmnpqrstuvwxyz');
    password += pick('23456789');
    password += pick('!@#$%^&*()_+');
    while (password.length < 12) {
      password += pick(chars);
    }

    return password.split('').sort(() => Math.random() - 0.5).join('');
  };

  const resetUserPassword = async (userId, currentUser, passwordOption) => {
    if (!currentUser || currentUser.role !== 'Admin') {
      throw new Error('Permission denied: admin access required');
    }

    if (currentUser.id === userId) {
      throw new Error('Admins cannot reset their own password. Please ask another admin for assistance.');
    }

    const target = await getUserById(userId);
    if (!target) {
      throw new Error('User not found');
    }

    const passwordToSet = passwordOption || generateTemporaryPassword();
    await updateUserPassword(userId, passwordToSet);
    return passwordToSet;
  };

  const updateUserPassword = async (userId, newPassword) => {
    const hashedPassword = hashPasswordSha256(newPassword);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [
      hashedPassword,
      userId
    ]);
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
    getLocations: notImplemented('getLocations'),
    getLocationById: notImplemented('getLocationById'),
    getLocationByName: notImplemented('getLocationByName'),
    createLocation: notImplemented('createLocation'),
    updateLocation: notImplemented('updateLocation'),
    deleteLocation: notImplemented('deleteLocation'),

    // Users
    getUsers,
    getUserById,
    getUserByEmail,
    createUser,
    updateUser,
    updateUserPassword,
    resetUserPassword,
    deleteUser,
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
