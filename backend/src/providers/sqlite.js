import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import { hashPasswordSha256 } from '../utils/password.js';
import { mapUserRow } from '../utils/user.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const loadSchema = () => {
  const schemaPath = path.resolve(__dirname, '..', '..', 'database', 'schema_sqlite.sql');
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

const ensureAssetTables = (db) => {
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('assets','asset_specs','asset_history','asset_comments')")
    .all()
    .map(row => row.name);

  const missing = (name) => !tables.includes(name);

  if (missing('assets')) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS assets (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Available',
        serial_number TEXT NOT NULL UNIQUE,
        assigned_to TEXT,
        assigned_to_uuid TEXT,
        employee_id TEXT REFERENCES employees(id) ON DELETE SET NULL,
        purchase_date DATE,
        acquisition_date DATE,
        warranty_expiry DATE,
        cost DECIMAL(10, 2) DEFAULT 0,
        location TEXT,
        location_id TEXT REFERENCES locations(id) ON DELETE SET NULL,
        manufacturer TEXT,
        previous_tag TEXT,
        notes TEXT,
        specs TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  if (missing('asset_specs')) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS asset_specs (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
        asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
        asset_type TEXT NOT NULL,
        brand TEXT,
        model TEXT,
        processor_type TEXT,
        ram_capacity TEXT,
        storage_capacity TEXT,
        os_details TEXT,
        screen_size TEXT,
        is_touchscreen BOOLEAN DEFAULT 0,
        printer_type TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  if (missing('asset_history')) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS asset_history (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
        asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
        field_name TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT,
        changed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        changed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  if (missing('asset_comments')) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS asset_comments (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
        asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
        author_name TEXT NOT NULL,
        author_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        message TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'Note',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }
};

const ensureAssetSpecsColumns = (db) => {
  const table = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='asset_specs'")
    .get();

  if (!table) return;

  const columns = db.prepare("PRAGMA table_info('asset_specs')").all();
  const columnNames = new Set(columns.map((column) => column.name));

  if (!columnNames.has('os_details')) {
    db.exec('ALTER TABLE asset_specs ADD COLUMN os_details TEXT');
  }
};

const ensureEmployeePersonalInfoColumns = (db) => {
  const table = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='employee_personal_info'")
    .get();

  if (!table) return;

  const columns = db.prepare("PRAGMA table_info('employee_personal_info')").all();
  const columnNames = new Set(columns.map((column) => column.name));

  if (!columnNames.has('photo_url')) {
    db.exec('ALTER TABLE employee_personal_info ADD COLUMN photo_url TEXT');
  }
};

const ensureEmployeeOfficialInfoColumns = (db) => {
  const columns = db.prepare("PRAGMA table_info('employee_official_info')").all();
  const columnNames = new Set(columns.map((column) => column.name));

  const addColumnIfMissing = (name, definition) => {
    if (columnNames.has(name)) return;
    db.exec(`ALTER TABLE employee_official_info ADD COLUMN ${name} ${definition}`);
    columnNames.add(name);
  };

  addColumnIfMissing('assignment_type', 'TEXT');
  addColumnIfMissing('client_name', 'TEXT');
  addColumnIfMissing('client_location', 'TEXT');
  addColumnIfMissing('manager_name', 'TEXT');
  addColumnIfMissing('director_name', 'TEXT');
  addColumnIfMissing('project_description', 'TEXT');
  addColumnIfMissing('client_work_notes', 'TEXT');
  addColumnIfMissing('assignment_date', 'DATE');

  db.exec('CREATE INDEX IF NOT EXISTS idx_employee_official_info_assignment_type ON employee_official_info(assignment_type)');
};

const ensureEmployeeEngagementHistoryTable = (db) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS employee_engagement_history (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
      employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      assignment_type TEXT NOT NULL,
      client_name TEXT,
      client_location TEXT,
      manager_name TEXT,
      director_name TEXT,
      project_description TEXT,
      client_work_notes TEXT,
      assignment_date DATE,
      transition_type TEXT NOT NULL,
      transition_summary TEXT NOT NULL,
      transition_note TEXT,
      performance_summary TEXT,
      changed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      changed_by_name TEXT,
      changed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const columns = db.prepare("PRAGMA table_info('employee_engagement_history')").all();
  const columnNames = new Set(columns.map((column) => column.name));
  if (!columnNames.has('transition_note')) {
    db.exec('ALTER TABLE employee_engagement_history ADD COLUMN transition_note TEXT');
  }
  if (!columnNames.has('performance_summary')) {
    db.exec('ALTER TABLE employee_engagement_history ADD COLUMN performance_summary TEXT');
  }

  db.exec('CREATE INDEX IF NOT EXISTS idx_employee_engagement_history_employee_id ON employee_engagement_history(employee_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_employee_engagement_history_changed_at ON employee_engagement_history(changed_at DESC)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_employee_engagement_history_employee_changed ON employee_engagement_history(employee_id, changed_at DESC)');
};

const ensureEmployeeFeedbackHistoryTable = (db) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS employee_feedback_history (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
      employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      feedback_category TEXT NOT NULL DEFAULT 'General',
      feedback_date DATE,
      feedback_text TEXT NOT NULL,
      source_assignment_type TEXT,
      source_client_name TEXT,
      source_project_description TEXT,
      entry_type TEXT NOT NULL DEFAULT 'Periodic Feedback',
      created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_by_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const columns = db.prepare("PRAGMA table_info('employee_feedback_history')").all();
  const columnNames = new Set(columns.map((column) => column.name));

  const addColumnIfMissing = (name, definition) => {
    if (columnNames.has(name)) return;
    db.exec(`ALTER TABLE employee_feedback_history ADD COLUMN ${name} ${definition}`);
    columnNames.add(name);
  };

  addColumnIfMissing('feedback_category', "TEXT NOT NULL DEFAULT 'General'");
  addColumnIfMissing('feedback_date', 'DATE');
  addColumnIfMissing('feedback_text', 'TEXT');
  addColumnIfMissing('source_assignment_type', 'TEXT');
  addColumnIfMissing('source_client_name', 'TEXT');
  addColumnIfMissing('source_project_description', 'TEXT');
  addColumnIfMissing('entry_type', "TEXT NOT NULL DEFAULT 'Periodic Feedback'");
  addColumnIfMissing('created_by', 'TEXT');
  addColumnIfMissing('created_by_name', 'TEXT');
  addColumnIfMissing('created_at', 'DATETIME');

  db.exec('CREATE INDEX IF NOT EXISTS idx_employee_feedback_history_employee_id ON employee_feedback_history(employee_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_employee_feedback_history_created_at ON employee_feedback_history(created_at DESC)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_employee_feedback_history_employee_created ON employee_feedback_history(employee_id, created_at DESC)');
};

const ensureDefaultAdmin = (db, config) => {
  const adminEmail = config.defaults.adminEmail.trim().toLowerCase();
  const adminPassword = config.defaults.adminPassword.trim();
  const existing = db.prepare(
    "SELECT COUNT(*) as count FROM users WHERE role = 'Admin' OR lower(email) = ?"
  ).get(adminEmail);
  if (existing?.count > 0) return;

  const hashedPassword = hashPasswordSha256(adminPassword);
  db.prepare(
    `INSERT INTO users (name, email, password_hash, role, status)
     VALUES (?, ?, ?, ?, ?)`
  ).run('System Administrator', adminEmail, hashedPassword, 'Admin', 'Active');
};

const notImplemented = (name) => {
  return async () => {
    throw new Error(`SQLite provider: ${name} not implemented yet`);
  };
};

const EMPLOYEE_FEEDBACK_CATEGORIES = new Set([
  'General',
  'Client Engagement',
  'Bench Performance'
]);

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

const normalizeEmployeeEngagementSnapshot = (officialInfo = {}) => ({
  assignmentType: officialInfo?.assignmentType || 'Bench',
  clientName: officialInfo?.clientName || undefined,
  clientLocation: officialInfo?.clientLocation || undefined,
  managerName: officialInfo?.managerName || undefined,
  directorName: officialInfo?.directorName || undefined,
  projectDescription: officialInfo?.projectDescription || undefined,
  clientWorkNotes: officialInfo?.clientWorkNotes || undefined,
  assignmentDate: normalizeDateOutput(officialInfo?.assignmentDate) || undefined
});

const employeeEngagementSnapshotsDiffer = (previous, next) => {
  const fields = [
    'assignmentType',
    'clientName',
    'clientLocation',
    'managerName',
    'directorName',
    'projectDescription',
    'clientWorkNotes',
    'assignmentDate'
  ];

  return fields.some((field) => (previous?.[field] || '') !== (next?.[field] || ''));
};

const shouldRecordEmployeeEngagementHistory = (previous, next) => {
  if (!employeeEngagementSnapshotsDiffer(previous, next)) {
    return false;
  }

  return Boolean(
    (previous?.assignmentType && previous.assignmentType !== 'Bench')
    || previous?.clientName
    || previous?.clientLocation
    || previous?.managerName
    || previous?.directorName
    || previous?.projectDescription
    || previous?.clientWorkNotes
    || previous?.assignmentDate
  );
};

const formatEmployeeEngagementLabel = (snapshot) => {
  const assignmentType = snapshot?.assignmentType || 'Bench';
  if (assignmentType === 'Bench') {
    return 'Bench';
  }

  return snapshot?.clientName
    ? `${assignmentType} at ${snapshot.clientName}`
    : assignmentType;
};

const buildEmployeeEngagementTransition = (previous, next) => {
  const previousLabel = formatEmployeeEngagementLabel(previous);
  const nextLabel = formatEmployeeEngagementLabel(next);

  if (next?.assignmentType === 'Bench') {
    return {
      transitionType: 'Moved To Bench',
      transitionSummary: `Moved from ${previousLabel} to Bench`
    };
  }

  if ((previous?.assignmentType || 'Bench') === 'Bench') {
    return {
      transitionType: 'Assigned',
      transitionSummary: `Assigned from Bench to ${nextLabel}`
    };
  }

  const primaryIdentityChanged =
    previous?.assignmentType !== next?.assignmentType
    || previous?.clientName !== next?.clientName
    || previous?.clientLocation !== next?.clientLocation;

  if (primaryIdentityChanged) {
    return {
      transitionType: 'Reassigned',
      transitionSummary: `Reassigned from ${previousLabel} to ${nextLabel}`
    };
  }

  return {
    transitionType: 'Engagement Updated',
    transitionSummary: `Updated engagement details for ${previousLabel}`
  };
};

const normalizeTransitionMeta = (transitionMeta = {}) => {
  const note = typeof transitionMeta?.transitionNote === 'string' ? transitionMeta.transitionNote.trim() : '';
  const performance = typeof transitionMeta?.performanceSummary === 'string' ? transitionMeta.performanceSummary.trim() : '';
  return {
    transitionNote: note || undefined,
    performanceSummary: performance || undefined
  };
};

const normalizeEmployeeAssignmentType = (assignmentType) => {
  const normalized = typeof assignmentType === 'string'
    ? assignmentType.trim().toLowerCase()
    : '';

  if (!normalized) return 'bench';
  if (normalized === 'bench') return 'bench';
  if (normalized === 'support') return 'support';
  if (normalized === 'client billable' || normalized === 'billable' || normalized === 'client_billable') {
    return 'client billable';
  }

  return normalized;
};

const normalizeEmployeeFeedbackCategory = (category) => {
  const normalized = typeof category === 'string' ? category.trim() : '';
  if (!normalized) return 'General';
  if (EMPLOYEE_FEEDBACK_CATEGORIES.has(normalized)) {
    return normalized;
  }
  throw new Error('Feedback category must be one of: General, Client Engagement, Bench Performance.');
};

const isClientToBenchTransition = (previous, next) => (
  normalizeEmployeeAssignmentType(previous?.assignmentType) === 'client billable'
  && normalizeEmployeeAssignmentType(next?.assignmentType) === 'bench'
);

const buildClientReturnFeedbackText = (previousSnapshot, transitionMeta = {}) => {
  const lines = [
    `Returned from ${formatEmployeeEngagementLabel(previousSnapshot)} to Bench.`,
    previousSnapshot.assignmentDate ? `Onboarding Date: ${previousSnapshot.assignmentDate}` : null,
    previousSnapshot.managerName ? `Manager Name: ${previousSnapshot.managerName}` : null,
    previousSnapshot.directorName ? `Director Name: ${previousSnapshot.directorName}` : null,
    previousSnapshot.clientName ? `Client Name: ${previousSnapshot.clientName}` : null,
    previousSnapshot.clientLocation ? `Client Location: ${previousSnapshot.clientLocation}` : null,
    previousSnapshot.projectDescription ? `Project Details: ${previousSnapshot.projectDescription}` : null,
    previousSnapshot.clientWorkNotes ? `Client Work Notes: ${previousSnapshot.clientWorkNotes}` : null,
    transitionMeta.transitionNote ? `Transition Note: ${transitionMeta.transitionNote}` : null,
    transitionMeta.performanceSummary ? `Performance Summary: ${transitionMeta.performanceSummary}` : null
  ].filter(Boolean);

  return lines.join('\n');
};

const hasEmployeeEngagementContext = (snapshot) => (
  normalizeEmployeeAssignmentType(snapshot?.assignmentType) !== 'bench'
  || Boolean(snapshot?.clientName)
  || Boolean(snapshot?.clientLocation)
  || Boolean(snapshot?.managerName)
  || Boolean(snapshot?.directorName)
  || Boolean(snapshot?.projectDescription)
  || Boolean(snapshot?.clientWorkNotes)
);

const validateEmployeeEngagementTransition = (previousOfficialInfo, nextOfficialInfo, transitionMeta) => {
  const previousSnapshot = normalizeEmployeeEngagementSnapshot(previousOfficialInfo);
  const nextSnapshot = normalizeEmployeeEngagementSnapshot(nextOfficialInfo);

  if (!employeeEngagementSnapshotsDiffer(previousSnapshot, nextSnapshot)) {
    return;
  }

  if (normalizeEmployeeAssignmentType(nextSnapshot.assignmentType) !== 'bench') {
    return;
  }

  if (normalizeEmployeeAssignmentType(previousSnapshot.assignmentType) === 'bench') {
    return;
  }

  const normalizedTransitionMeta = normalizeTransitionMeta(transitionMeta);
  if (!normalizedTransitionMeta.transitionNote) {
    throw new Error('Transition note is required when moving an employee to Bench.');
  }
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
      photoUrl: row.personal_photo_url || undefined,
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
      officialEmail: row.official_official_email || undefined,
      assignmentType: row.official_assignment_type || undefined,
      clientName: row.official_client_name || undefined,
      clientLocation: row.official_client_location || undefined,
      managerName: row.official_manager_name || undefined,
      directorName: row.official_director_name || undefined,
      projectDescription: row.official_project_description || undefined,
      clientWorkNotes: row.official_client_work_notes || undefined,
      assignmentDate: row.official_assignment_date || undefined
    } : undefined
  };
};

const mapEmployeeEngagementHistoryRow = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    employeeId: row.employee_id,
    assignmentType: row.assignment_type || 'Bench',
    clientName: row.client_name || undefined,
    clientLocation: row.client_location || undefined,
    managerName: row.manager_name || undefined,
    directorName: row.director_name || undefined,
    projectDescription: row.project_description || undefined,
    clientWorkNotes: row.client_work_notes || undefined,
    assignmentDate: normalizeDateOutput(row.assignment_date) || undefined,
    transitionType: row.transition_type,
    transitionSummary: row.transition_summary,
    transitionNote: row.transition_note || undefined,
    performanceSummary: row.performance_summary || undefined,
    changedBy: row.changed_by || undefined,
    changedByName: row.changed_by_name || undefined,
    changedAt: row.changed_at
  };
};

const mapEmployeeFeedbackRow = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    employeeId: row.employee_id,
    feedbackCategory: row.feedback_category || 'General',
    sentiment: row.sentiment || undefined,
    feedbackDate: normalizeDateOutput(row.feedback_date) || undefined,
    feedbackText: row.feedback_text,
    sourceAssignmentType: row.source_assignment_type || undefined,
    sourceClientName: row.source_client_name || undefined,
    sourceProjectDescription: row.source_project_description || undefined,
    entryType: row.entry_type || 'Periodic Feedback',
    createdBy: row.created_by || undefined,
    createdByName: row.created_by_name || undefined,
    createdAt: row.created_at
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
  ensureAssetTables(db);
  ensureAssetSpecsColumns(db);
  ensureEmployeePersonalInfoColumns(db);
  ensureEmployeeOfficialInfoColumns(db);
  ensureEmployeeEngagementHistoryTable(db);
  ensureEmployeeFeedbackHistoryTable(db);
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

  const updateUser = async (user, currentUser) => {
    if (!currentUser || currentUser.role !== 'Admin') {
      throw new Error('Permission denied: admin access required');
    }

    const result = db
      .prepare('UPDATE users SET name = ?, email = ?, role = ?, status = ? WHERE id = ?')
      .run(user.name, user.email.toLowerCase(), user.role, user.status, user.id);

    if (result.changes === 0) {
      throw new Error('User not found');
    }

    return getUserById(user.id);
  };

  const deleteUser = async (userId, currentUser) => {
    if (!currentUser || currentUser.role !== 'Admin') {
      throw new Error('Permission denied: admin access required');
    }

    const result = db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    if (result.changes === 0) {
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
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashedPassword, userId);
  };

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
           personal.photo_url AS personal_photo_url,
           personal.additional_comments AS personal_additional_comments,
           official.id AS official_id,
           official.division AS official_division,
           official.biometric_id AS official_biometric_id,
           official.rfid_serial AS official_rfid_serial,
           official.agreement_signed AS official_agreement_signed,
           official.start_date AS official_start_date,
           official.official_dob AS official_official_dob,
           official.official_email AS official_official_email,
           official.assignment_type AS official_assignment_type,
           official.client_name AS official_client_name,
           official.client_location AS official_client_location,
           official.manager_name AS official_manager_name,
           official.director_name AS official_director_name,
           official.project_description AS official_project_description,
           official.client_work_notes AS official_client_work_notes,
           official.assignment_date AS official_assignment_date,
           locations.name AS location_name
      FROM employees
      LEFT JOIN employee_personal_info AS personal
        ON personal.id = employees.personal_info_id
      LEFT JOIN employee_official_info AS official
        ON official.id = employees.official_info_id
      LEFT JOIN locations
        ON locations.id = employees.location_id
  `;

  const getEmployeeEngagementHistory = async (employeeId) => {
    const rows = db.prepare(`
      SELECT *
        FROM employee_engagement_history
       WHERE employee_id = ?
       ORDER BY changed_at DESC
    `).all(employeeId);

    return rows.map(mapEmployeeEngagementHistoryRow);
  };

  const getEmployeeFeedbackHistory = async (employeeId) => {
    const existing = db.prepare('SELECT id FROM employees WHERE id = ? LIMIT 1').get(employeeId);
    if (!existing) {
      throw new Error('Employee not found');
    }

    const rows = db.prepare(`
      SELECT *
        FROM employee_feedback_history
       WHERE employee_id = ?
       ORDER BY created_at DESC
    `).all(employeeId);

    return rows.map(mapEmployeeFeedbackRow);
  };

  const addEmployeeFeedback = async (employeeId, feedback, currentUser) => {
    if (!employeeId) {
      throw new Error('Employee id is required');
    }

    const existingEmployee = db
      .prepare('SELECT id FROM employees WHERE id = ? LIMIT 1')
      .get(employeeId);
    if (!existingEmployee) {
      throw new Error('Employee not found');
    }

    const feedbackText = typeof feedback?.feedbackText === 'string'
      ? feedback.feedbackText.trim()
      : '';
    if (!feedbackText) {
      throw new Error('Feedback text is required.');
    }

    const feedbackCategory = normalizeEmployeeFeedbackCategory(feedback?.feedbackCategory);
    const sentiment = typeof feedback?.sentiment === 'string' ? feedback.sentiment.trim() : null;
    const feedbackDate = normalizeDateInput(feedback?.feedbackDate);
    const sourceAssignmentType = typeof feedback?.sourceAssignmentType === 'string'
      ? feedback.sourceAssignmentType.trim() || null
      : null;
    const sourceClientName = typeof feedback?.sourceClientName === 'string'
      ? feedback.sourceClientName.trim() || null
      : null;
    const sourceProjectDescription = typeof feedback?.sourceProjectDescription === 'string'
      ? feedback.sourceProjectDescription.trim() || null
      : null;
    const entryType = typeof feedback?.entryType === 'string' && feedback.entryType.trim()
      ? feedback.entryType.trim()
      : 'Periodic Feedback';

    const info = db.prepare(`
      INSERT INTO employee_feedback_history (
        employee_id,
        feedback_category,
        sentiment,
        feedback_date,
        feedback_text,
        source_assignment_type,
        source_client_name,
        source_project_description,
        entry_type,
        created_by,
        created_by_name,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      employeeId,
      feedbackCategory,
      sentiment,
      feedbackDate,
      feedbackText,
      sourceAssignmentType,
      sourceClientName,
      sourceProjectDescription,
      entryType,
      currentUser?.id || null,
      currentUser?.name || null,
      new Date().toISOString()
    );

    const inserted = db
      .prepare('SELECT * FROM employee_feedback_history WHERE rowid = ?')
      .get(info.lastInsertRowid);
    return mapEmployeeFeedbackRow(inserted);
  };

  const recordEmployeeEngagementHistory = async (employeeId, previousOfficialInfo, nextOfficialInfo, currentUser, transitionMeta) => {
    const previousSnapshot = normalizeEmployeeEngagementSnapshot(previousOfficialInfo);
    const nextSnapshot = normalizeEmployeeEngagementSnapshot(nextOfficialInfo);

    if (!shouldRecordEmployeeEngagementHistory(previousSnapshot, nextSnapshot)) {
      return;
    }

    const transition = buildEmployeeEngagementTransition(previousSnapshot, nextSnapshot);
    const normalizedTransitionMeta = normalizeTransitionMeta(transitionMeta);

    db.prepare(`
      INSERT INTO employee_engagement_history (
        employee_id,
        assignment_type,
        client_name,
        client_location,
        manager_name,
        director_name,
        project_description,
        client_work_notes,
        assignment_date,
        transition_type,
        transition_summary,
        transition_note,
        performance_summary,
        changed_by,
        changed_by_name,
        changed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      employeeId,
      previousSnapshot.assignmentType || 'Bench',
      previousSnapshot.clientName || null,
      previousSnapshot.clientLocation || null,
      previousSnapshot.managerName || null,
      previousSnapshot.directorName || null,
      previousSnapshot.projectDescription || null,
      previousSnapshot.clientWorkNotes || null,
      normalizeDateInput(previousSnapshot.assignmentDate),
      transition.transitionType,
      transition.transitionSummary,
      normalizedTransitionMeta.transitionNote || null,
      normalizedTransitionMeta.performanceSummary || null,
      currentUser?.id || null,
      currentUser?.name || null,
      new Date().toISOString()
    );

    if (isClientToBenchTransition(previousSnapshot, nextSnapshot)) {
      await addEmployeeFeedback(
        employeeId,
        {
          feedbackCategory: 'Client Engagement',
          feedbackDate: normalizeDateInput(transitionMeta?.feedbackDate) || normalizeDateInput(new Date().toISOString()),
          feedbackText: buildClientReturnFeedbackText(previousSnapshot, normalizedTransitionMeta),
          sourceAssignmentType: previousSnapshot.assignmentType || null,
          sourceClientName: previousSnapshot.clientName || null,
          sourceProjectDescription: previousSnapshot.projectDescription || null,
          entryType: 'Client Return Snapshot'
        },
        currentUser
      );
    }
  };

  const getEmployeeById = async (id) => {
    const row = db
      .prepare(`${employeeSelect} WHERE employees.id = ? LIMIT 1`)
      .get(id);
    const employee = mapEmployeeRow(row);
    if (!employee) return null;
    employee.engagementHistory = await getEmployeeEngagementHistory(employee.id);
    employee.feedbackHistory = await getEmployeeFeedbackHistory(employee.id);
    return employee;
  };

  const getEmployeeByEmployeeId = async (employeeId) => {
    const row = db
      .prepare(`${employeeSelect} WHERE employees.employee_id = ? LIMIT 1`)
      .get(employeeId.trim().toUpperCase());
    const employee = mapEmployeeRow(row);
    if (!employee) return null;
    employee.engagementHistory = await getEmployeeEngagementHistory(employee.id);
    employee.feedbackHistory = await getEmployeeFeedbackHistory(employee.id);
    return employee;
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
        photo_url,
        additional_comments
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      personalInfo.firstName.trim(),
      personalInfo.lastName || null,
      personalInfo.gender || null,
      personalInfo.mobileNumber || null,
      personalInfo.emergencyContactName || null,
      personalInfo.emergencyContactNumber || null,
      personalInfo.personalEmail || null,
      personalInfo.linkedinUrl || null,
      personalInfo.photoUrl || null,
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
             photo_url = ?,
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
      personalInfo.photoUrl || null,
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
        official_email,
        assignment_type,
        client_name,
        client_location,
        manager_name,
        director_name,
        project_description,
        client_work_notes,
        assignment_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      officialInfo?.division || null,
      officialInfo?.biometricId || null,
      officialInfo?.rfidSerial || null,
      officialInfo?.agreementSigned ? 1 : 0,
      officialInfo?.startDate || null,
      officialInfo?.officialDob || null,
      officialInfo?.officialEmail || null,
      officialInfo?.assignmentType || null,
      officialInfo?.clientName || null,
      officialInfo?.clientLocation || null,
      officialInfo?.managerName || null,
      officialInfo?.directorName || null,
      officialInfo?.projectDescription || null,
      officialInfo?.clientWorkNotes || null,
      officialInfo?.assignmentDate || null
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
             official_email = ?,
             assignment_type = ?,
             client_name = ?,
             client_location = ?,
             manager_name = ?,
             director_name = ?,
             project_description = ?,
             client_work_notes = ?,
             assignment_date = ?
       WHERE id = ?
    `).run(
      officialInfo?.division || null,
      officialInfo?.biometricId || null,
      officialInfo?.rfidSerial || null,
      officialInfo?.agreementSigned ? 1 : 0,
      officialInfo?.startDate || null,
      officialInfo?.officialDob || null,
      officialInfo?.officialEmail || null,
      officialInfo?.assignmentType || null,
      officialInfo?.clientName || null,
      officialInfo?.clientLocation || null,
      officialInfo?.managerName || null,
      officialInfo?.directorName || null,
      officialInfo?.projectDescription || null,
      officialInfo?.clientWorkNotes || null,
      officialInfo?.assignmentDate || null,
      id
    );
    return id;
  };

  const getAssets = async () => {
    const rows = db.prepare(`
      ${assetSelect}
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
    if (query.status && query.status !== 'All') {
      filters.push('assets.status = @status');
      params.status = query.status;
    }
    if (query.locationId && query.locationId !== 'All') {
      filters.push('assets.location_id = @locationId');
      params.locationId = query.locationId;
    }

    if (query.search) {
      filters.push('(lower(assets.name) LIKE @search OR lower(assets.serial_number) LIKE @search OR lower(assets.specs) LIKE @search)');
      params.search = `%${query.search.trim().toLowerCase()}%`;
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const totalRow = db
      .prepare(`SELECT COUNT(*) as count FROM assets ${whereClause}`)
      .get(params);
    const rows = db.prepare(`
      ${assetSelect}
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

  const getAssetById = async (id) => {
    const row = db
      .prepare(`${assetSelect} WHERE assets.id = ? LIMIT 1`)
      .get(id);
    return mapAssetRow(row);
  };

  const checkSerialNumberExists = async (serialNumber, excludeAssetId) => {
    if (!serialNumber) return false;
    if (excludeAssetId) {
      const row = db
        .prepare('SELECT id FROM assets WHERE serial_number = ? AND id != ? LIMIT 1')
        .get(serialNumber.trim(), excludeAssetId);
      return !!row;
    }
    const row = db
      .prepare('SELECT id FROM assets WHERE serial_number = ? LIMIT 1')
      .get(serialNumber.trim());
    return !!row;
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

    const specs = asset.specs ? JSON.stringify(asset.specs) : null;
    const assignedEmployeeId = asset.assignedToId || asset.employeeId || null;

    db.prepare(`
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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
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
    );

    const row = db
      .prepare('SELECT id FROM assets WHERE serial_number = ? LIMIT 1')
      .get(asset.serialNumber.trim());
    
    if (row && asset.specs) {
      upsertAssetSpecs(row.id, asset.type, asset.specs);
    }
    
    return row ? await getAssetById(row.id) : null;
  };

  const upsertAssetSpecs = (assetId, assetType, specs) => {
    const existing = db.prepare('SELECT id FROM asset_specs WHERE asset_id = ?').get(assetId);
    
    const data = {
      asset_id: assetId,
      asset_type: assetType,
      brand: specs.brand || null,
      model: specs.model || null,
      processor_type: specs.processorType || specs.cpu || null,
      ram_capacity: specs.ramCapacity || specs.ram || null,
      storage_capacity: specs.storageCapacity || specs.storage || null,
      os_details: specs.osDetails || specs.os || null,
      screen_size: specs.screenSize || null,
      is_touchscreen: specs.isTouchscreen ? 1 : 0,
      printer_type: specs.printerType || null
    };

    if (existing) {
      db.prepare(`
        UPDATE asset_specs
           SET asset_type = ?,
               brand = ?,
               model = ?,
               processor_type = ?,
               ram_capacity = ?,
               storage_capacity = ?,
               os_details = ?,
               screen_size = ?,
               is_touchscreen = ?,
               printer_type = ?,
               updated_at = CURRENT_TIMESTAMP
         WHERE id = ?
      `).run(
        data.asset_type,
        data.brand,
        data.model,
        data.processor_type,
        data.ram_capacity,
        data.storage_capacity,
        data.os_details,
        data.screen_size,
        data.is_touchscreen,
        data.printer_type,
        existing.id
      );
    } else {
      db.prepare(`
        INSERT INTO asset_specs (
          asset_id,
          asset_type,
          brand,
          model,
          processor_type,
          ram_capacity,
          storage_capacity,
          os_details,
          screen_size,
          is_touchscreen,
          printer_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        data.asset_id,
        data.asset_type,
        data.brand,
        data.model,
        data.processor_type,
        data.ram_capacity,
        data.storage_capacity,
        data.os_details,
        data.screen_size,
        data.is_touchscreen,
        data.printer_type
      );
    }
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

    const specs = asset.specs ? JSON.stringify(asset.specs) : null;
    const assignedEmployeeId = asset.assignedToId || asset.employeeId || null;

    db.prepare(`
      UPDATE assets
         SET name = ?,
             type = ?,
             status = ?,
             serial_number = ?,
             assigned_to = ?,
             assigned_to_uuid = ?,
             employee_id = ?,
             purchase_date = ?,
             acquisition_date = ?,
             warranty_expiry = ?,
             cost = ?,
             location = ?,
             location_id = ?,
             manufacturer = ?,
             previous_tag = ?,
             notes = ?,
             specs = ?
       WHERE id = ?
    `).run(
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
    );

    if (asset.specs) {
      upsertAssetSpecs(asset.id, asset.type, asset.specs);
    }

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

    db.prepare('DELETE FROM asset_comments WHERE asset_id = ?').run(id);
    db.prepare('DELETE FROM asset_history WHERE asset_id = ?').run(id);
    db.prepare('DELETE FROM asset_specs WHERE asset_id = ?').run(id);
    db.prepare('DELETE FROM assets WHERE id = ?').run(id);
  };

  const getAssetComments = async (assetId) => {
    const rows = db.prepare(`
      SELECT id, asset_id, author_name, author_id, message, type, created_at
        FROM asset_comments
       WHERE asset_id = ?
       ORDER BY created_at DESC
    `).all(assetId);
    return rows.map(row => ({
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

    const info = db.prepare(`
      INSERT INTO asset_comments (
        asset_id,
        author_name,
        author_id,
        message,
        type,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      comment.assetId,
      comment.authorName,
      comment.authorId || null,
      comment.message,
      comment.type || 'Note',
      comment.createdAt || new Date().toISOString()
    );

    const row = db
      .prepare('SELECT id, asset_id, author_name, author_id, message, type, created_at FROM asset_comments WHERE rowid = ?')
      .get(info.lastInsertRowid);
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

    if (query.department && query.department !== 'All' && query.department !== 'all') {
      filters.push('lower(ifnull(official.division, \'\')) = @department');
      params.department = query.department.trim().toLowerCase();
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

  const createEmployee = async (employee, currentUser) => {
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

  const updateEmployee = async (employee, currentUser) => {
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

    const nextOfficialInfo = employee.officialInfo
      ? { ...(existing.officialInfo || {}), ...employee.officialInfo }
      : existing.officialInfo;

    validateEmployeeEngagementTransition(
      existing.officialInfo,
      nextOfficialInfo,
      employee.engagementTransition
    );

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

    await recordEmployeeEngagementHistory(
      employee.id,
      existing.officialInfo,
      nextOfficialInfo,
      currentUser,
      employee.engagementTransition
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
    getEmployeeFeedbackHistory,
    addEmployeeFeedback,
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
