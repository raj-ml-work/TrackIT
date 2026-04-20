import { randomUUID } from 'crypto';
import { promises as fsp } from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { Pool } from 'pg';
import { config } from '../src/config.js';

const MAX_EMPLOYEE_PHOTO_BYTES = 2 * 1024 * 1024;
const EMPLOYEE_PHOTO_DATA_URL_PATTERN = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/i;

const PHOTO_EXTENSION_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
  'image/svg+xml': 'svg'
};

const parseArgs = (argv) => {
  const options = {
    apply: false,
    limit: null,
    employeeId: null,
    verbose: false
  };

  for (const arg of argv) {
    if (arg === '--apply') {
      options.apply = true;
      continue;
    }
    if (arg === '--verbose') {
      options.verbose = true;
      continue;
    }
    if (arg.startsWith('--limit=')) {
      const value = Number(arg.slice('--limit='.length));
      if (!Number.isInteger(value) || value <= 0) {
        throw new Error(`Invalid --limit value: ${arg}`);
      }
      options.limit = value;
      continue;
    }
    if (arg.startsWith('--employee-id=')) {
      const value = arg.slice('--employee-id='.length).trim();
      if (!value) {
        throw new Error('Invalid --employee-id value: empty');
      }
      options.employeeId = value;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
};

const decodeBase64ByteLength = (encoded) => {
  const compact = encoded.replace(/\s+/g, '');
  if (!compact || compact.length % 4 !== 0) {
    return -1;
  }

  const padding = compact.endsWith('==') ? 2 : compact.endsWith('=') ? 1 : 0;
  return Math.floor((compact.length * 3) / 4) - padding;
};

const sanitizePathSegment = (value) => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || 'employee';
};

const isPathInside = (parentPath, childPath) => {
  const relative = path.relative(parentPath, childPath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
};

const getPhotoExtensionFromMimeType = (mimeType) => {
  const normalized = String(mimeType || '').toLowerCase();
  if (PHOTO_EXTENSION_BY_MIME[normalized]) {
    return PHOTO_EXTENSION_BY_MIME[normalized];
  }

  const slashIndex = normalized.indexOf('/');
  if (slashIndex < 0) return 'png';
  const subtype = normalized.slice(slashIndex + 1).replace(/[^a-z0-9.+-]+/g, '');
  return subtype || 'png';
};

const parsePhotoDataUrl = (photoUrl) => {
  if (typeof photoUrl !== 'string') {
    throw new Error('Photo value is not a string.');
  }

  const dataUrlMatch = photoUrl.trim().match(EMPLOYEE_PHOTO_DATA_URL_PATTERN);
  if (!dataUrlMatch) {
    throw new Error('Photo value is not a valid image data URL.');
  }

  const mimeType = dataUrlMatch[1].toLowerCase();
  const encodedBody = dataUrlMatch[2].replace(/\s+/g, '');
  const byteLength = decodeBase64ByteLength(encodedBody);
  if (byteLength <= 0) {
    throw new Error('Photo data URL base64 payload is invalid.');
  }
  if (byteLength > MAX_EMPLOYEE_PHOTO_BYTES) {
    throw new Error('Photo data URL exceeds 2MB limit.');
  }

  return {
    mimeType,
    byteLength,
    buffer: Buffer.from(encodedBody, 'base64')
  };
};

const savePhotoBufferToLocalStorage = async (photoBuffer, mimeType, employeeFolderKey) => {
  const employeeFolder = sanitizePathSegment(employeeFolderKey);
  const targetDir = path.resolve(config.employeePhotoUploadDir, employeeFolder);
  if (!isPathInside(config.employeePhotoUploadDir, targetDir)) {
    throw new Error('Invalid employee photo storage directory.');
  }

  await fsp.mkdir(targetDir, { recursive: true });
  const fileExtension = getPhotoExtensionFromMimeType(mimeType);
  const fileName = `${Date.now()}-${randomUUID()}.${fileExtension}`;
  const absolutePath = path.resolve(targetDir, fileName);
  if (!isPathInside(config.employeePhotoUploadDir, absolutePath)) {
    throw new Error('Invalid employee photo storage file path.');
  }

  await fsp.writeFile(absolutePath, photoBuffer);
  return {
    photoUrl: `/uploads/employee_photos/${employeeFolder}/${fileName}`,
    absolutePath
  };
};

const getSqliteColumnNames = (db, tableName) => {
  const columns = db.prepare(`PRAGMA table_info('${tableName}')`).all();
  return new Set(columns.map((column) => String(column.name || '')));
};

const fetchSqliteRows = (db, options, canJoinEmployees) => {
  const clauses = [
    "personal.photo_url IS NOT NULL",
    "trim(personal.photo_url) <> ''",
    "lower(personal.photo_url) LIKE 'data:image/%'"
  ];
  const params = {};
  const selectEmployeeId = canJoinEmployees ? 'employee.employee_id AS employee_id' : 'NULL AS employee_id';
  const fromClause = canJoinEmployees
    ? `
      FROM employee_personal_info AS personal
      LEFT JOIN employees AS employee
        ON employee.personal_info_id = personal.id
    `
    : `
      FROM employee_personal_info AS personal
    `;

  if (options.employeeId && canJoinEmployees) {
    clauses.push('employee.employee_id = @employeeId');
    params.employeeId = options.employeeId;
  }

  let query = `
    SELECT personal.id AS personal_info_id,
           personal.photo_url AS photo_url,
           ${selectEmployeeId}
      ${fromClause}
     WHERE ${clauses.join(' AND ')}
     ORDER BY personal.updated_at DESC, personal.id
  `;
  if (options.limit) {
    query += ' LIMIT @limit';
    params.limit = options.limit;
  }

  return db.prepare(query).all(params);
};

const getPostgresColumnNames = async (pool, tableName) => {
  const result = await pool.query(
    `
      SELECT column_name
        FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = $1
    `,
    [tableName]
  );
  return new Set((result.rows || []).map((row) => String(row.column_name || '')));
};

const fetchPostgresRows = async (pool, options, canJoinEmployees) => {
  const values = [];
  const clauses = [
    'personal.photo_url IS NOT NULL',
    "btrim(personal.photo_url) <> ''",
    "lower(personal.photo_url) LIKE 'data:image/%'"
  ];
  const selectEmployeeId = canJoinEmployees ? 'employee.employee_id AS employee_id' : 'NULL AS employee_id';
  const fromClause = canJoinEmployees
    ? `
      FROM employee_personal_info AS personal
      LEFT JOIN employees AS employee
        ON employee.personal_info_id = personal.id
    `
    : `
      FROM employee_personal_info AS personal
    `;

  if (options.employeeId && canJoinEmployees) {
    values.push(options.employeeId);
    clauses.push(`employee.employee_id = $${values.length}`);
  }

  let query = `
    SELECT personal.id AS personal_info_id,
           personal.photo_url AS photo_url,
           ${selectEmployeeId}
      ${fromClause}
     WHERE ${clauses.join(' AND ')}
     ORDER BY personal.updated_at DESC, personal.id
  `;
  if (options.limit) {
    values.push(options.limit);
    query += ` LIMIT $${values.length}`;
  }

  const result = await pool.query(query, values);
  return result.rows || [];
};

const updateSqlitePhotoUrl = (db, personalInfoId, photoUrl) => {
  db.prepare(`
    UPDATE employee_personal_info
       SET photo_url = @photoUrl,
           updated_at = CURRENT_TIMESTAMP
     WHERE id = @id
  `).run({
    id: personalInfoId,
    photoUrl
  });
};

const updatePostgresPhotoUrl = async (pool, personalInfoId, photoUrl) => {
  await pool.query(
    `
      UPDATE employee_personal_info
         SET photo_url = $2,
             updated_at = NOW()
       WHERE id = $1
    `,
    [personalInfoId, photoUrl]
  );
};

const createInitialSummary = (options) => ({
  dbProvider: config.dbProvider,
  applyMode: options.apply,
  candidateRows: 0,
  migratedRows: 0,
  skippedRows: 0,
  failedRows: 0,
  totalMigratedBytes: 0,
  notes: []
});

const processRows = async (rows, options, updatePhotoUrl) => {
  const summary = createInitialSummary(options);
  summary.candidateRows = rows.length;

  for (const row of rows) {
    const personalInfoId = row.personal_info_id || row.personalInfoId;
    const employeeId = row.employee_id || row.employeeId || personalInfoId || 'employee';

    try {
      const parsedPhoto = parsePhotoDataUrl(row.photo_url || row.photoUrl);

      if (!options.apply) {
        summary.migratedRows += 1;
        summary.totalMigratedBytes += parsedPhoto.byteLength;
        if (options.verbose) {
          console.log(
            `[dry-run] personal_info_id=${personalInfoId} employee_id=${employeeId}`
            + ` bytes=${parsedPhoto.byteLength}`
          );
        }
        continue;
      }

      const savedPhoto = await savePhotoBufferToLocalStorage(
        parsedPhoto.buffer,
        parsedPhoto.mimeType,
        employeeId
      );

      try {
        await updatePhotoUrl(personalInfoId, savedPhoto.photoUrl);
      } catch (error) {
        await fsp.unlink(savedPhoto.absolutePath).catch(() => undefined);
        throw error;
      }

      summary.migratedRows += 1;
      summary.totalMigratedBytes += parsedPhoto.byteLength;
      if (options.verbose) {
        console.log(
          `[migrated] personal_info_id=${personalInfoId} employee_id=${employeeId}`
          + ` -> ${savedPhoto.photoUrl}`
        );
      }
    } catch (error) {
      summary.failedRows += 1;
      console.error(
        `[failed] personal_info_id=${personalInfoId} employee_id=${employeeId}: ${error.message}`
      );
    }
  }

  summary.skippedRows = summary.candidateRows - summary.migratedRows - summary.failedRows;
  return summary;
};

const runSqliteMigration = async (options) => {
  const db = new Database(config.sqlitePath);
  try {
    const personalColumns = getSqliteColumnNames(db, 'employee_personal_info');
    if (!personalColumns.has('photo_url')) {
      const summary = createInitialSummary(options);
      summary.notes.push('Skipping migration: employee_personal_info.photo_url column is not available.');
      return summary;
    }

    const employeeColumns = getSqliteColumnNames(db, 'employees');
    const canJoinEmployees = employeeColumns.has('personal_info_id') && employeeColumns.has('employee_id');
    if (options.employeeId && !canJoinEmployees) {
      const summary = createInitialSummary(options);
      summary.notes.push('Skipping migration: --employee-id filter requires employees.employee_id mapping.');
      return summary;
    }

    const rows = fetchSqliteRows(db, options, canJoinEmployees);
    if (options.apply) {
      await fsp.mkdir(config.employeePhotoUploadDir, { recursive: true });
    }
    return processRows(rows, options, (personalInfoId, photoUrl) =>
      Promise.resolve(updateSqlitePhotoUrl(db, personalInfoId, photoUrl))
    );
  } finally {
    db.close();
  }
};

const runPostgresMigration = async (options) => {
  if (!config.pgUrl) {
    throw new Error('PG_URL is required when DB_PROVIDER=postgres');
  }

  const pool = new Pool({
    connectionString: config.pgUrl
  });

  try {
    const personalColumns = await getPostgresColumnNames(pool, 'employee_personal_info');
    if (!personalColumns.has('photo_url')) {
      const summary = createInitialSummary(options);
      summary.notes.push('Skipping migration: employee_personal_info.photo_url column is not available.');
      return summary;
    }

    const employeeColumns = await getPostgresColumnNames(pool, 'employees');
    const canJoinEmployees = employeeColumns.has('personal_info_id') && employeeColumns.has('employee_id');
    if (options.employeeId && !canJoinEmployees) {
      const summary = createInitialSummary(options);
      summary.notes.push('Skipping migration: --employee-id filter requires employees.employee_id mapping.');
      return summary;
    }

    const rows = await fetchPostgresRows(pool, options, canJoinEmployees);
    if (options.apply) {
      await fsp.mkdir(config.employeePhotoUploadDir, { recursive: true });
    }
    return processRows(rows, options, (personalInfoId, photoUrl) =>
      updatePostgresPhotoUrl(pool, personalInfoId, photoUrl)
    );
  } finally {
    await pool.end();
  }
};

const run = async (options) => {
  if (config.dbProvider === 'sqlite') {
    return runSqliteMigration(options);
  }
  if (config.dbProvider === 'postgres') {
    return runPostgresMigration(options);
  }
  throw new Error(`Unsupported DB_PROVIDER: ${config.dbProvider}`);
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  const summary = await run(options);
  console.log('[migrate_employee_photo_data_urls] completed');
  console.log(`- DB provider: ${summary.dbProvider}`);
  console.log(`- Apply mode: ${summary.applyMode ? 'apply' : 'dry-run'}`);
  console.log(`- Candidate rows: ${summary.candidateRows}`);
  console.log(`- Migrated rows: ${summary.migratedRows}`);
  console.log(`- Failed rows: ${summary.failedRows}`);
  console.log(`- Skipped rows: ${summary.skippedRows}`);
  console.log(`- Total bytes migrated: ${summary.totalMigratedBytes}`);
  for (const note of summary.notes || []) {
    console.log(`- Note: ${note}`);
  }
};

main().catch((error) => {
  console.error('[migrate_employee_photo_data_urls] failed:', error);
  process.exit(1);
});
