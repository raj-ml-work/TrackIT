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

const ensureDepartmentsTable = (db) => {
  const table = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='departments'")
    .get();

  if (table) return;

  db.exec(`
    CREATE TABLE IF NOT EXISTS departments (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
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

const parseJsonSafe = (value) => {
  if (!value) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
};

const mapAssetRow = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    status: row.status,
    serialNumber: row.serial_number,
    assignedTo: row.assigned_to || undefined,
    assignedToId: row.assigned_to_uuid || undefined,
    employeeId: row.employee_id || undefined,
    purchaseDate: row.purchase_date || '',
    acquisitionDate: row.acquisition_date || undefined,
    warrantyExpiry: row.warranty_expiry || '',
    cost: Number(row.cost || 0),
    location: row.location_name || row.location || '',
    locationId: row.location_id || undefined,
    manufacturer: row.manufacturer || undefined,
    previousTag: row.previous_tag || undefined,
    notes: row.notes || undefined,
    specs: parseJsonSafe(row.specs)
  };
};

const mapEmployeeRow = (row) => {
  if (!row) return null;
  const firstName = row.personal_first_name || '';
  const lastName = row.personal_last_name || '';
  const fullName = `${firstName} ${lastName}`.trim();

  return {
    id: row.id,
    employeeId: row.employee_id,
    clientId: row.client_id || undefined,
    locationId: row.location_id || undefined,
    personalInfoId: row.personal_info_id || undefined,
    officialInfoId: row.official_info_id || undefined,
    status: row.status,
    name: fullName || row.name || undefined,
    email: row.official_official_email || row.personal_personal_email || undefined,
    department: row.official_division || undefined,
    location: row.location_name || undefined,
    title: row.official_division || undefined,
    personalInfo: row.personal_id ? {
      id: row.personal_id,
      firstName: row.personal_first_name,
      lastName: row.personal_last_name,
      gender: row.personal_gender || undefined,
      mobileNumber: row.personal_mobile_number || undefined,
      emergencyContactName: row.personal_emergency_contact_name || undefined,
      emergencyContactNumber: row.personal_emergency_contact_number || undefined,
      personalEmail: row.personal_personal_email || undefined,
      linkedinUrl: row.personal_linkedin_url || undefined,
      additionalComments: row.personal_additional_comments || undefined
    } : undefined,
    officialInfo: row.official_id ? {
      id: row.official_id,
      division: row.official_division || undefined,
      biometricId: row.official_biometric_id || undefined,
      rfidSerial: row.official_rfid_serial || undefined,
      agreementSigned: Boolean(row.official_agreement_signed),
      startDate: row.official_start_date || undefined,
      officialDob: row.official_official_dob || undefined,
      officialEmail: row.official_official_email || undefined
    } : undefined
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
  ensureDepartmentsTable(db);
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

  const employeeSelect = `
    SELECT employees.*,
           personal.id AS personal_id,
           personal.first_name AS personal_first_name,
           personal.last_name AS personal_last_name,
           personal.gender AS personal_gender,
           personal.mobile_number AS personal_mobile_number,
           personal.emergency_contact_name AS personal_emergency_contact_name,
           personal.emergency_contact_number AS personal_emergency_contact_number,
           personal.personal_email AS personal_personal_email,
           personal.linkedin_url AS personal_linkedin_url,
           personal.additional_comments AS personal_additional_comments,
           official.id AS official_id,
           official.division AS official_division,
           official.biometric_id AS official_biometric_id,
           official.rfid_serial AS official_rfid_serial,
           official.agreement_signed AS official_agreement_signed,
           official.start_date AS official_start_date,
           official.official_dob AS official_official_dob,
           official.official_email AS official_official_email,
           locations.name AS location_name
      FROM employees
      LEFT JOIN employee_personal_info AS personal
        ON personal.id = employees.personal_info_id
      LEFT JOIN employee_official_info AS official
        ON official.id = employees.official_info_id
      LEFT JOIN locations
        ON locations.id = employees.location_id
  `;

  const getEmployeeById = async (id) => {
    const row = db
      .prepare(`${employeeSelect} WHERE employees.id = ? LIMIT 1`)
      .get(id);
    return mapEmployeeRow(row);
  };

  const getEmployeeByEmployeeId = async (employeeId) => {
    const row = db
      .prepare(`${employeeSelect} WHERE employees.employee_id = ? LIMIT 1`)
      .get(employeeId.trim().toUpperCase());
    return mapEmployeeRow(row);
  };

  const createPersonalInfo = (personalInfo) => {
    if (!personalInfo?.firstName) {
      throw new Error('Employee first name is required');
    }

    const info = db.prepare(`
      INSERT INTO employee_personal_info (
        first_name,
        last_name,
        gender,
        mobile_number,
        emergency_contact_name,
        emergency_contact_number,
        personal_email,
        linkedin_url,
        additional_comments
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      personalInfo.firstName.trim(),
      personalInfo.lastName || null,
      personalInfo.gender || null,
      personalInfo.mobileNumber || null,
      personalInfo.emergencyContactName || null,
      personalInfo.emergencyContactNumber || null,
      personalInfo.personalEmail || null,
      personalInfo.linkedinUrl || null,
      personalInfo.additionalComments || null
    );

    return db
      .prepare('SELECT id FROM employee_personal_info WHERE rowid = ?')
      .get(info.lastInsertRowid)?.id;
  };

  const updatePersonalInfo = (id, personalInfo) => {
    if (!id) return null;
    db.prepare(`
      UPDATE employee_personal_info
         SET first_name = ?,
             last_name = ?,
             gender = ?,
             mobile_number = ?,
             emergency_contact_name = ?,
             emergency_contact_number = ?,
             personal_email = ?,
             linkedin_url = ?,
             additional_comments = ?
       WHERE id = ?
    `).run(
      personalInfo.firstName?.trim() || null,
      personalInfo.lastName || null,
      personalInfo.gender || null,
      personalInfo.mobileNumber || null,
      personalInfo.emergencyContactName || null,
      personalInfo.emergencyContactNumber || null,
      personalInfo.personalEmail || null,
      personalInfo.linkedinUrl || null,
      personalInfo.additionalComments || null,
      id
    );
    return id;
  };

  const createOfficialInfo = (officialInfo) => {
    const info = db.prepare(`
      INSERT INTO employee_official_info (
        division,
        biometric_id,
        rfid_serial,
        agreement_signed,
        start_date,
        official_dob,
        official_email
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      officialInfo?.division || null,
      officialInfo?.biometricId || null,
      officialInfo?.rfidSerial || null,
      officialInfo?.agreementSigned ? 1 : 0,
      officialInfo?.startDate || null,
      officialInfo?.officialDob || null,
      officialInfo?.officialEmail || null
    );

    return db
      .prepare('SELECT id FROM employee_official_info WHERE rowid = ?')
      .get(info.lastInsertRowid)?.id;
  };

  const updateOfficialInfo = (id, officialInfo) => {
    if (!id) return null;
    db.prepare(`
      UPDATE employee_official_info
         SET division = ?,
             biometric_id = ?,
             rfid_serial = ?,
             agreement_signed = ?,
             start_date = ?,
             official_dob = ?,
             official_email = ?
       WHERE id = ?
    `).run(
      officialInfo?.division || null,
      officialInfo?.biometricId || null,
      officialInfo?.rfidSerial || null,
      officialInfo?.agreementSigned ? 1 : 0,
      officialInfo?.startDate || null,
      officialInfo?.officialDob || null,
      officialInfo?.officialEmail || null,
      id
    );
    return id;
  };

  const getAssets = async () => {
    const rows = db.prepare(`
      SELECT assets.*, locations.name AS location_name
      FROM assets
      LEFT JOIN locations ON locations.id = assets.location_id
      ORDER BY assets.created_at DESC
    `).all();
    return rows.map(mapAssetRow);
  };

  const getAssetsPage = async (query) => {
    const page = Math.max(1, Number(query.page || 1));
    const pageSize = Math.max(1, Math.min(Number(query.pageSize || 20), 100));
    const offset = (page - 1) * pageSize;
    const params = {};
    const filters = [];

    if (query.type && query.type !== 'All') {
      filters.push('assets.type = @type');
      params.type = query.type;
    }

    if (query.search) {
      filters.push('(lower(assets.name) LIKE @search OR lower(assets.serial_number) LIKE @search)');
      params.search = `%${query.search.trim().toLowerCase()}%`;
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const totalRow = db
      .prepare(`SELECT COUNT(*) as count FROM assets ${whereClause}`)
      .get(params);
    const rows = db.prepare(`
      SELECT assets.*, locations.name AS location_name
      FROM assets
      LEFT JOIN locations ON locations.id = assets.location_id
      ${whereClause}
      ORDER BY assets.created_at DESC
      LIMIT @limit OFFSET @offset
    `).all({ ...params, limit: pageSize, offset });

    return {
      data: rows.map(mapAssetRow),
      total: Number(totalRow?.count || 0),
      page,
      pageSize
    };
  };

  const getEmployees = async () => {
    const rows = db.prepare(`
      ${employeeSelect}
      ORDER BY employees.created_at DESC
    `).all();
    return rows.map(mapEmployeeRow);
  };

  const getEmployeesPage = async (query) => {
    const page = Math.max(1, Number(query.page || 1));
    const pageSize = Math.max(1, Math.min(Number(query.pageSize || 20), 100));
    const offset = (page - 1) * pageSize;
    const params = {};
    const filters = [];

    if (query.status && query.status !== 'All') {
      filters.push('employees.status = @status');
      params.status = query.status;
    }

    if (query.search) {
      filters.push(`
        (
          lower(employees.employee_id) LIKE @search OR
          lower(personal.first_name || ' ' || ifnull(personal.last_name, '')) LIKE @search OR
          lower(ifnull(official.official_email, '')) LIKE @search OR
          lower(ifnull(personal.personal_email, '')) LIKE @search
        )
      `);
      params.search = `%${query.search.trim().toLowerCase()}%`;
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const totalRow = db.prepare(`
      SELECT COUNT(*) as count
      FROM employees
      LEFT JOIN employee_personal_info AS personal
        ON personal.id = employees.personal_info_id
      LEFT JOIN employee_official_info AS official
        ON official.id = employees.official_info_id
      ${whereClause}
    `).get(params);

    const rows = db.prepare(`
      ${employeeSelect}
      ${whereClause}
      ORDER BY employees.created_at DESC
      LIMIT @limit OFFSET @offset
    `).all({ ...params, limit: pageSize, offset });

    return {
      data: rows.map(mapEmployeeRow),
      total: Number(totalRow?.count || 0),
      page,
      pageSize
    };
  };

  const createEmployee = async (employee) => {
    const employeeId = employee.employeeId?.trim().toUpperCase();
    if (!employeeId) {
      throw new Error('Employee ID is required');
    }

    const existing = await getEmployeeByEmployeeId(employeeId);
    if (existing) {
      throw new Error(`Employee ID "${employeeId}" already exists`);
    }

    const personalInfoId = createPersonalInfo(employee.personalInfo);
    const officialInfoId = createOfficialInfo(employee.officialInfo);
    const name = employee.personalInfo
      ? `${employee.personalInfo.firstName || ''} ${employee.personalInfo.lastName || ''}`.trim()
      : employee.name || employeeId;

    db.prepare(`
      INSERT INTO employees (
        employee_id,
        name,
        status,
        client_id,
        location_id,
        personal_info_id,
        official_info_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      employeeId,
      name,
      employee.status || 'Active',
      employee.clientId || null,
      employee.locationId || null,
      personalInfoId,
      officialInfoId
    );

    return await getEmployeeByEmployeeId(employeeId);
  };

  const updateEmployee = async (employee) => {
    if (!employee?.id) {
      throw new Error('Employee id is required');
    }

    const existing = await getEmployeeById(employee.id);
    if (!existing) {
      throw new Error('Employee not found');
    }

    const employeeId = employee.employeeId?.trim().toUpperCase();
    if (!employeeId) {
      throw new Error('Employee ID is required');
    }

    const duplicate = db
      .prepare('SELECT id FROM employees WHERE employee_id = ? AND id != ? LIMIT 1')
      .get(employeeId, employee.id);
    if (duplicate) {
      throw new Error(`Employee ID "${employeeId}" already exists`);
    }

    let personalInfoId = existing.personalInfoId;
    if (employee.personalInfo) {
      if (personalInfoId) {
        updatePersonalInfo(personalInfoId, employee.personalInfo);
      } else {
        personalInfoId = createPersonalInfo(employee.personalInfo);
      }
    }

    let officialInfoId = existing.officialInfoId;
    if (employee.officialInfo) {
      if (officialInfoId) {
        updateOfficialInfo(officialInfoId, employee.officialInfo);
      } else {
        officialInfoId = createOfficialInfo(employee.officialInfo);
      }
    }

    const name = employee.personalInfo
      ? `${employee.personalInfo.firstName || ''} ${employee.personalInfo.lastName || ''}`.trim()
      : existing.name || employeeId;

    db.prepare(`
      UPDATE employees
         SET employee_id = ?,
             name = ?,
             status = ?,
             client_id = ?,
             location_id = ?,
             personal_info_id = ?,
             official_info_id = ?
       WHERE id = ?
    `).run(
      employeeId,
      name,
      employee.status || existing.status,
      employee.clientId || null,
      employee.locationId || null,
      personalInfoId || null,
      officialInfoId || null,
      employee.id
    );

    return await getEmployeeById(employee.id);
  };

  const deleteEmployee = async (id) => {
    if (!id) {
      throw new Error('Employee id is required');
    }

    const existing = await getEmployeeById(id);
    if (!existing) {
      throw new Error('Employee not found');
    }

    db.prepare('DELETE FROM employees WHERE id = ?').run(id);

    if (existing.personalInfoId) {
      db.prepare('DELETE FROM employee_personal_info WHERE id = ?').run(existing.personalInfoId);
    }
    if (existing.officialInfoId) {
      db.prepare('DELETE FROM employee_official_info WHERE id = ?').run(existing.officialInfoId);
    }
  };

  const mapDepartmentRow = (row) => {
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      description: row.description || null
    };
  };

  const getDepartments = async () => {
    const rows = db.prepare('SELECT id, name, description FROM departments ORDER BY name ASC').all();
    return rows.map(mapDepartmentRow);
  };

  const getDepartmentById = async (id) => {
    const row = db
      .prepare('SELECT id, name, description FROM departments WHERE id = ? LIMIT 1')
      .get(id);
    return mapDepartmentRow(row);
  };

  const getDepartmentByName = async (name) => {
    const row = db
      .prepare('SELECT id, name, description FROM departments WHERE lower(name) = lower(?) LIMIT 1')
      .get(name.trim());
    return mapDepartmentRow(row);
  };

  const createDepartment = async (department) => {
    const trimmedName = department.name?.trim();
    if (!trimmedName) {
      throw new Error('Department name is required');
    }

    const existing = await getDepartmentByName(trimmedName);
    if (existing) {
      throw new Error(`Department "${trimmedName}" already exists`);
    }

    const description = department.description?.trim() || null;
    const info = db
      .prepare('INSERT INTO departments (name, description) VALUES (?, ?)')
      .run(trimmedName, description);
    const created = db
      .prepare('SELECT id, name, description FROM departments WHERE rowid = ?')
      .get(info.lastInsertRowid);
    return mapDepartmentRow(created);
  };

  const updateDepartment = async (department) => {
    if (!department?.id) {
      throw new Error('Department id is required');
    }

    const trimmedName = department.name?.trim();
    if (!trimmedName) {
      throw new Error('Department name is required');
    }

    const existing = await getDepartmentById(department.id);
    if (!existing) {
      throw new Error('Department not found');
    }

    const duplicate = db
      .prepare('SELECT id FROM departments WHERE lower(name) = lower(?) AND id != ? LIMIT 1')
      .get(trimmedName, department.id);
    if (duplicate) {
      throw new Error(`Department "${trimmedName}" already exists`);
    }

    const description = department.description?.trim() || null;
    db.prepare('UPDATE departments SET name = ?, description = ? WHERE id = ?')
      .run(trimmedName, description, department.id);
    return await getDepartmentById(department.id);
  };

  const deleteDepartment = async (id) => {
    if (!id) {
      throw new Error('Department id is required');
    }
    db.prepare('DELETE FROM departments WHERE id = ?').run(id);
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
    getAssets,
    getAssetsPage,
    getAssetById: notImplemented('getAssetById'),
    createAsset: notImplemented('createAsset'),
    updateAsset: notImplemented('updateAsset'),
    deleteAsset: notImplemented('deleteAsset'),
    getAssetComments: notImplemented('getAssetComments'),
    addAssetComment: notImplemented('addAssetComment'),
    checkSerialNumberExists: notImplemented('checkSerialNumberExists'),

    // Employees
    getEmployees,
    getEmployeesPage,
    getEmployeeById,
    getEmployeeByEmployeeId,
    createEmployee,
    updateEmployee,
    deleteEmployee,

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
    getDepartments,
    getDepartmentById,
    getDepartmentByName,
    createDepartment,
    updateDepartment,
    deleteDepartment
  };
};
