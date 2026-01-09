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
  const adminEmail = config.defaults.adminEmail.trim().toLowerCase();
  const adminPassword = config.defaults.adminPassword.trim();
  const result = await pool.query(
    "SELECT COUNT(*) AS count FROM users WHERE role = 'Admin' OR lower(email) = lower($1)",
    [adminEmail]
  );
  const count = Number(result?.rows?.[0]?.count || 0);
  if (count > 0) return;

  const hashedPassword = hashPasswordSha256(adminPassword);
  await pool.query(
    `INSERT INTO users (name, email, password_hash, role, status)
     VALUES ($1, $2, $3, $4, $5)`,
    ['System Administrator', adminEmail, hashedPassword, 'Admin', 'Active']
  );
};

const parseJsonSafe = (value) => {
  if (!value) return undefined;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
};

const mapLocationRow = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    city: row.city
  };
};

const mapDepartmentRow = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description || null
  };
};

const pad2 = (value) => value.toString().padStart(2, '0');

const normalizeDateOutput = (value) => {
  if (value == null) return '';
  const trimmed = String(value).trim();
  if (!trimmed) return '';

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const ymdMatch = trimmed.match(/^(\d{4})[\/.](\d{1,2})[\/.](\d{1,2})/);
  if (ymdMatch) return `${ymdMatch[1]}-${pad2(ymdMatch[2])}-${pad2(ymdMatch[3])}`;

  const mdyMatch = trimmed.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})/);
  if (mdyMatch) return `${mdyMatch[3]}-${pad2(mdyMatch[1])}-${pad2(mdyMatch[2])}`;

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return '';
};

const normalizeDateInput = (value) => {
  const normalized = normalizeDateOutput(value);
  return normalized || null;
};

const mapAssetRow = (row) => {
  if (!row) return null;
  const assignedName = row.assigned_first_name
    ? `${row.assigned_first_name || ''} ${row.assigned_last_name || ''}`.trim()
    : undefined;
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    status: row.status,
    serialNumber: row.serial_number,
    assignedTo: assignedName || row.assigned_to || undefined,
    assignedToId: row.assigned_to_uuid || undefined,
    employeeId: row.employee_id || undefined,
    purchaseDate: normalizeDateOutput(row.purchase_date),
    acquisitionDate: row.acquisition_date || undefined,
    warrantyExpiry: normalizeDateOutput(row.warranty_expiry),
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

export const createPostgresProvider = async (config) => {
  if (!config.pgUrl) {
    throw new Error('PG_URL is required when DB_PROVIDER=postgres');
  }

  const pool = new Pool({
    connectionString: config.pgUrl
  });

  await ensureUsersTable(pool);
  await ensureDefaultAdmin(pool, config);

  const assetSelect = `
    SELECT assets.*,
           locations.name AS location_name,
           personal.first_name AS assigned_first_name,
           personal.last_name AS assigned_last_name
      FROM assets
      LEFT JOIN locations
        ON locations.id = assets.location_id
      LEFT JOIN employees
        ON employees.id = assets.employee_id
      LEFT JOIN employee_personal_info AS personal
        ON personal.id = employees.personal_info_id
  `;

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

  const getAssets = async () => {
    const result = await pool.query(`
      ${assetSelect}
      ORDER BY assets.created_at DESC
    `);
    return result.rows.map(mapAssetRow);
  };

  const getAssetsPage = async (query) => {
    const page = Math.max(1, Number(query.page || 1));
    const pageSize = Math.max(1, Math.min(Number(query.pageSize || 20), 100));
    const offset = (page - 1) * pageSize;
    const filters = [];
    const values = [];

    if (query.type && query.type !== 'All') {
      values.push(query.type);
      filters.push(`assets.type = $${values.length}`);
    }
    if (query.status && query.status !== 'All') {
      values.push(query.status);
      filters.push(`assets.status = $${values.length}`);
    }

    if (query.search) {
      values.push(`%${query.search.trim().toLowerCase()}%`);
      const ref = `$${values.length}`;
      filters.push(`(LOWER(assets.name) LIKE ${ref} OR LOWER(assets.serial_number) LIKE ${ref})`);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const countResult = await pool.query(
      `SELECT COUNT(*) as count FROM assets ${whereClause}`,
      values
    );
    const total = Number(countResult.rows?.[0]?.count || 0);
    const dataResult = await pool.query(
      `
      ${assetSelect}
      ${whereClause}
      ORDER BY assets.created_at DESC
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}
    `,
      [...values, pageSize, offset]
    );

    return {
      data: dataResult.rows.map(mapAssetRow),
      total,
      page,
      pageSize
    };
  };

  const getAssetById = async (id) => {
    const result = await pool.query(`${assetSelect} WHERE assets.id = $1 LIMIT 1`, [id]);
    return mapAssetRow(result.rows[0]);
  };

  const checkSerialNumberExists = async (serialNumber, excludeAssetId) => {
    if (!serialNumber) return false;
    if (excludeAssetId) {
      const result = await pool.query(
        'SELECT id FROM assets WHERE serial_number = $1 AND id != $2 LIMIT 1',
        [serialNumber.trim(), excludeAssetId]
      );
      return result.rows.length > 0;
    }
    const result = await pool.query(
      'SELECT id FROM assets WHERE serial_number = $1 LIMIT 1',
      [serialNumber.trim()]
    );
    return result.rows.length > 0;
  };

  const createAsset = async (asset) => {
    if (!asset?.name) {
      throw new Error('Asset name is required');
    }
    if (!asset?.type) {
      throw new Error('Asset type is required');
    }
    if (!asset?.serialNumber) {
      throw new Error('Serial number is required');
    }

    const serialExists = await checkSerialNumberExists(asset.serialNumber);
    if (serialExists) {
      throw new Error(`Serial number "${asset.serialNumber}" already exists`);
    }

    const specs = asset.specs || null;
    const assignedEmployeeId = asset.assignedToId || asset.employeeId || null;

    const result = await pool.query(
      `
      INSERT INTO assets (
        name,
        type,
        status,
        serial_number,
        assigned_to,
        assigned_to_uuid,
        employee_id,
        purchase_date,
        acquisition_date,
        warranty_expiry,
        cost,
        location,
        location_id,
        manufacturer,
        previous_tag,
        notes,
        specs
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING id
    `,
      [
        asset.name,
        asset.type,
        asset.status || 'Available',
        asset.serialNumber.trim(),
        asset.assignedTo || null,
        assignedEmployeeId,
        assignedEmployeeId,
        normalizeDateInput(asset.purchaseDate),
        normalizeDateInput(asset.acquisitionDate),
        normalizeDateInput(asset.warrantyExpiry),
        asset.cost || 0,
        asset.location || null,
        asset.locationId || null,
        asset.manufacturer || null,
        asset.previousTag || null,
        asset.notes || null,
        specs
      ]
    );

    const createdId = result.rows?.[0]?.id;
    return createdId ? await getAssetById(createdId) : null;
  };

  const updateAsset = async (asset) => {
    if (!asset?.id) {
      throw new Error('Asset id is required');
    }
    if (!asset?.name) {
      throw new Error('Asset name is required');
    }
    if (!asset?.type) {
      throw new Error('Asset type is required');
    }
    if (!asset?.serialNumber) {
      throw new Error('Serial number is required');
    }

    const existing = await getAssetById(asset.id);
    if (!existing) {
      throw new Error('Asset not found');
    }

    const serialExists = await checkSerialNumberExists(asset.serialNumber, asset.id);
    if (serialExists) {
      throw new Error(`Serial number "${asset.serialNumber}" already exists`);
    }

    const specs = asset.specs || null;
    const assignedEmployeeId = asset.assignedToId || asset.employeeId || null;

    await pool.query(
      `
      UPDATE assets
         SET name = $1,
             type = $2,
             status = $3,
             serial_number = $4,
             assigned_to = $5,
             assigned_to_uuid = $6,
             employee_id = $7,
             purchase_date = $8,
             acquisition_date = $9,
             warranty_expiry = $10,
             cost = $11,
             location = $12,
             location_id = $13,
             manufacturer = $14,
             previous_tag = $15,
             notes = $16,
             specs = $17
       WHERE id = $18
    `,
      [
        asset.name,
        asset.type,
        asset.status || existing.status,
        asset.serialNumber.trim(),
        asset.assignedTo || null,
        assignedEmployeeId,
        assignedEmployeeId,
        normalizeDateInput(asset.purchaseDate),
        normalizeDateInput(asset.acquisitionDate),
        normalizeDateInput(asset.warrantyExpiry),
        asset.cost || 0,
        asset.location || null,
        asset.locationId || null,
        asset.manufacturer || null,
        asset.previousTag || null,
        asset.notes || null,
        specs,
        asset.id
      ]
    );

    return await getAssetById(asset.id);
  };

  const deleteAsset = async (id) => {
    if (!id) {
      throw new Error('Asset id is required');
    }

    const existing = await getAssetById(id);
    if (!existing) {
      throw new Error('Asset not found');
    }

    await pool.query('DELETE FROM asset_comments WHERE asset_id = $1', [id]);
    await pool.query('DELETE FROM asset_history WHERE asset_id = $1', [id]);
    await pool.query('DELETE FROM asset_specs WHERE asset_id = $1', [id]);
    await pool.query('DELETE FROM assets WHERE id = $1', [id]);
  };

  const getAssetComments = async (assetId) => {
    const result = await pool.query(
      `
      SELECT id, asset_id, author_name, author_id, message, type, created_at
        FROM asset_comments
       WHERE asset_id = $1
       ORDER BY created_at DESC
    `,
      [assetId]
    );

    return result.rows.map(row => ({
      id: row.id,
      assetId: row.asset_id,
      authorName: row.author_name,
      authorId: row.author_id || undefined,
      message: row.message,
      type: row.type,
      createdAt: row.created_at
    }));
  };

  const addAssetComment = async (comment) => {
    if (!comment?.assetId) {
      throw new Error('Asset id is required for comment');
    }
    if (!comment?.authorName) {
      throw new Error('Author name is required');
    }
    if (!comment?.message) {
      throw new Error('Comment message is required');
    }

    const result = await pool.query(
      `
      INSERT INTO asset_comments (
        asset_id,
        author_name,
        author_id,
        message,
        type,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, asset_id, author_name, author_id, message, type, created_at
    `,
      [
        comment.assetId,
        comment.authorName,
        comment.authorId || null,
        comment.message,
        comment.type || 'Note',
        comment.createdAt || new Date().toISOString()
      ]
    );

    const row = result.rows[0];
    return row
      ? {
          id: row.id,
          assetId: row.asset_id,
          authorName: row.author_name,
          authorId: row.author_id || undefined,
          message: row.message,
          type: row.type,
          createdAt: row.created_at
        }
      : null;
  };

  const getEmployeeById = async (id) => {
    const result = await pool.query(`${employeeSelect} WHERE employees.id = $1 LIMIT 1`, [id]);
    return mapEmployeeRow(result.rows[0]);
  };

  const getEmployeeByEmployeeId = async (employeeId) => {
    const result = await pool.query(
      `${employeeSelect} WHERE employees.employee_id = $1 LIMIT 1`,
      [employeeId.trim().toUpperCase()]
    );
    return mapEmployeeRow(result.rows[0]);
  };

  const createPersonalInfo = async (personalInfo) => {
    if (!personalInfo?.firstName) {
      throw new Error('Employee first name is required');
    }

    const result = await pool.query(
      `
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
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `,
      [
        personalInfo.firstName || null,
        personalInfo.lastName || null,
        personalInfo.gender || null,
        personalInfo.mobileNumber || null,
        personalInfo.emergencyContactName || null,
        personalInfo.emergencyContactNumber || null,
        personalInfo.personalEmail || null,
        personalInfo.linkedinUrl || null,
        personalInfo.additionalComments || null
      ]
    );

    return result.rows?.[0]?.id || null;
  };

  const updatePersonalInfo = async (id, personalInfo) => {
    if (!id) return null;
    await pool.query(
      `
      UPDATE employee_personal_info
         SET first_name = $1,
             last_name = $2,
             gender = $3,
             mobile_number = $4,
             emergency_contact_name = $5,
             emergency_contact_number = $6,
             personal_email = $7,
             linkedin_url = $8,
             additional_comments = $9
       WHERE id = $10
    `,
      [
        personalInfo?.firstName || null,
        personalInfo?.lastName || null,
        personalInfo?.gender || null,
        personalInfo?.mobileNumber || null,
        personalInfo?.emergencyContactName || null,
        personalInfo?.emergencyContactNumber || null,
        personalInfo?.personalEmail || null,
        personalInfo?.linkedinUrl || null,
        personalInfo?.additionalComments || null,
        id
      ]
    );
    return id;
  };

  const createOfficialInfo = async (officialInfo) => {
    const result = await pool.query(
      `
      INSERT INTO employee_official_info (
        division,
        biometric_id,
        rfid_serial,
        agreement_signed,
        start_date,
        official_dob,
        official_email
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `,
      [
        officialInfo?.division || null,
        officialInfo?.biometricId || null,
        officialInfo?.rfidSerial || null,
        officialInfo?.agreementSigned ? true : false,
        officialInfo?.startDate || null,
        officialInfo?.officialDob || null,
        officialInfo?.officialEmail || null
      ]
    );
    return result.rows?.[0]?.id || null;
  };

  const updateOfficialInfo = async (id, officialInfo) => {
    if (!id) return null;
    await pool.query(
      `
      UPDATE employee_official_info
         SET division = $1,
             biometric_id = $2,
             rfid_serial = $3,
             agreement_signed = $4,
             start_date = $5,
             official_dob = $6,
             official_email = $7
       WHERE id = $8
    `,
      [
        officialInfo?.division || null,
        officialInfo?.biometricId || null,
        officialInfo?.rfidSerial || null,
        officialInfo?.agreementSigned ? true : false,
        officialInfo?.startDate || null,
        officialInfo?.officialDob || null,
        officialInfo?.officialEmail || null,
        id
      ]
    );
    return id;
  };

  const getEmployees = async () => {
    const result = await pool.query(`
      ${employeeSelect}
      ORDER BY employees.created_at DESC
    `);
    return result.rows.map(mapEmployeeRow);
  };

  const getEmployeesPage = async (query) => {
    const page = Math.max(1, Number(query.page || 1));
    const pageSize = Math.max(1, Math.min(Number(query.pageSize || 20), 100));
    const offset = (page - 1) * pageSize;
    const filters = [];
    const values = [];

    if (query.status && query.status !== 'All') {
      values.push(query.status);
      filters.push(`employees.status = $${values.length}`);
    }

    if (query.search) {
      values.push(`%${query.search.trim().toLowerCase()}%`);
      const ref = `$${values.length}`;
      filters.push(`
        (
          LOWER(employees.employee_id) LIKE ${ref} OR
          LOWER(COALESCE(personal.first_name, '') || ' ' || COALESCE(personal.last_name, '')) LIKE ${ref} OR
          LOWER(COALESCE(official.official_email, '')) LIKE ${ref} OR
          LOWER(COALESCE(personal.personal_email, '')) LIKE ${ref}
        )
      `);
    }

    if (query.department && query.department !== 'All' && query.department !== 'all') {
      values.push(query.department.trim().toLowerCase());
      filters.push(`LOWER(COALESCE(official.division, '')) = $${values.length}`);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const countResult = await pool.query(
      `
      SELECT COUNT(*) as count
      FROM employees
      LEFT JOIN employee_personal_info AS personal
        ON personal.id = employees.personal_info_id
      LEFT JOIN employee_official_info AS official
        ON official.id = employees.official_info_id
      ${whereClause}
    `,
      values
    );
    const total = Number(countResult.rows?.[0]?.count || 0);

    const result = await pool.query(
      `
      ${employeeSelect}
      ${whereClause}
      ORDER BY employees.created_at DESC
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}
    `,
      [...values, pageSize, offset]
    );

    return {
      data: result.rows.map(mapEmployeeRow),
      total,
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

    const personalInfoId = await createPersonalInfo(employee.personalInfo);
    const officialInfoId = await createOfficialInfo(employee.officialInfo);
    const name = employee.personalInfo
      ? `${employee.personalInfo.firstName || ''} ${employee.personalInfo.lastName || ''}`.trim()
      : employee.name || employeeId;

    await pool.query(
      `
      INSERT INTO employees (
        employee_id,
        name,
        status,
        client_id,
        location_id,
        personal_info_id,
        official_info_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `,
      [
        employeeId,
        name,
        employee.status || 'Active',
        employee.clientId || null,
        employee.locationId || null,
        personalInfoId,
        officialInfoId
      ]
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

    const duplicate = await pool.query(
      'SELECT id FROM employees WHERE employee_id = $1 AND id != $2 LIMIT 1',
      [employeeId, employee.id]
    );
    if (duplicate.rows.length > 0) {
      throw new Error(`Employee ID "${employeeId}" already exists`);
    }

    let personalInfoId = existing.personalInfoId;
    if (employee.personalInfo) {
      if (personalInfoId) {
        await updatePersonalInfo(personalInfoId, employee.personalInfo);
      } else {
        personalInfoId = await createPersonalInfo(employee.personalInfo);
      }
    }

    let officialInfoId = existing.officialInfoId;
    if (employee.officialInfo) {
      if (officialInfoId) {
        await updateOfficialInfo(officialInfoId, employee.officialInfo);
      } else {
        officialInfoId = await createOfficialInfo(employee.officialInfo);
      }
    }

    const name = employee.personalInfo
      ? `${employee.personalInfo.firstName || ''} ${employee.personalInfo.lastName || ''}`.trim()
      : existing.name || employeeId;

    await pool.query(
      `
      UPDATE employees
         SET employee_id = $1,
             name = $2,
             status = $3,
             client_id = $4,
             location_id = $5,
             personal_info_id = $6,
             official_info_id = $7
       WHERE id = $8
    `,
      [
        employeeId,
        name,
        employee.status || existing.status,
        employee.clientId || null,
        employee.locationId || null,
        personalInfoId || null,
        officialInfoId || null,
        employee.id
      ]
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

    await pool.query('DELETE FROM employees WHERE id = $1', [id]);

    if (existing.personalInfoId) {
      await pool.query('DELETE FROM employee_personal_info WHERE id = $1', [existing.personalInfoId]);
    }
    if (existing.officialInfoId) {
      await pool.query('DELETE FROM employee_official_info WHERE id = $1', [existing.officialInfoId]);
    }
  };

  const getLocations = async () => {
    const result = await pool.query('SELECT id, name, city FROM locations ORDER BY name ASC');
    return result.rows.map(mapLocationRow);
  };

  const getLocationById = async (id) => {
    const result = await pool.query(
      'SELECT id, name, city FROM locations WHERE id = $1 LIMIT 1',
      [id]
    );
    return mapLocationRow(result.rows[0]);
  };

  const getLocationByName = async (name) => {
    const result = await pool.query(
      'SELECT id, name, city FROM locations WHERE lower(name) = lower($1) LIMIT 1',
      [name.trim()]
    );
    return mapLocationRow(result.rows[0]);
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

    const result = await pool.query(
      'INSERT INTO locations (name, city) VALUES ($1, $2) RETURNING id, name, city',
      [trimmedName, trimmedCity]
    );
    return mapLocationRow(result.rows[0]);
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

    const duplicate = await pool.query(
      'SELECT id FROM locations WHERE lower(name) = lower($1) AND id != $2 LIMIT 1',
      [trimmedName, location.id]
    );
    if (duplicate.rows.length > 0) {
      throw new Error(`Location "${trimmedName}" already exists`);
    }

    const result = await pool.query(
      'UPDATE locations SET name = $1, city = $2 WHERE id = $3 RETURNING id, name, city',
      [trimmedName, trimmedCity, location.id]
    );
    return mapLocationRow(result.rows[0]);
  };

  const deleteLocation = async (id) => {
    if (!id) {
      throw new Error('Location id is required');
    }
    await pool.query('DELETE FROM locations WHERE id = $1', [id]);
  };

  const getDepartments = async () => {
    const result = await pool.query('SELECT id, name, description FROM departments ORDER BY name ASC');
    return result.rows.map(mapDepartmentRow);
  };

  const getDepartmentById = async (id) => {
    const result = await pool.query(
      'SELECT id, name, description FROM departments WHERE id = $1 LIMIT 1',
      [id]
    );
    return mapDepartmentRow(result.rows[0]);
  };

  const getDepartmentByName = async (name) => {
    const result = await pool.query(
      'SELECT id, name, description FROM departments WHERE lower(name) = lower($1) LIMIT 1',
      [name.trim()]
    );
    return mapDepartmentRow(result.rows[0]);
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
    const result = await pool.query(
      'INSERT INTO departments (name, description) VALUES ($1, $2) RETURNING id, name, description',
      [trimmedName, description]
    );
    return mapDepartmentRow(result.rows[0]);
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

    const duplicate = await pool.query(
      'SELECT id FROM departments WHERE lower(name) = lower($1) AND id != $2 LIMIT 1',
      [trimmedName, department.id]
    );
    if (duplicate.rows.length > 0) {
      throw new Error(`Department "${trimmedName}" already exists`);
    }

    const description = department.description?.trim() || null;
    const result = await pool.query(
      'UPDATE departments SET name = $1, description = $2 WHERE id = $3 RETURNING id, name, description',
      [trimmedName, description, department.id]
    );
    return mapDepartmentRow(result.rows[0]);
  };

  const deleteDepartment = async (id) => {
    if (!id) {
      throw new Error('Department id is required');
    }
    await pool.query('DELETE FROM departments WHERE id = $1', [id]);
  };

  return {
    // Assets
    getAssets,
    getAssetsPage,
    getAssetById,
    createAsset,
    updateAsset,
    deleteAsset,
    getAssetComments,
    addAssetComment,
    checkSerialNumberExists,

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
    updateUser,
    updateUserPassword,
    resetUserPassword,
    deleteUser,
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
