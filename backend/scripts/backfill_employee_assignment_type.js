import Database from 'better-sqlite3';
import { Pool } from 'pg';
import { config } from '../src/config.js';

const BACKFILL_VALUE = 'Bench';
const options = {
  dryRun: process.argv.slice(2).includes('--dry-run')
};

const runSqliteBackfill = () => {
  const db = new Database(config.sqlitePath);
  try {
    const columns = db.prepare("PRAGMA table_info('employee_official_info')").all();
    const columnNames = new Set(columns.map((column) => String(column.name || '')));
    if (!columnNames.has('assignment_type')) {
      return {
        updatedRows: 0,
        remainingRows: 0,
        notes: ['Skipping backfill: employee_official_info.assignment_type column is not available.']
      };
    }

    let updatedRows = 0;
    if (!options.dryRun) {
      const update = db.prepare(`
        UPDATE employee_official_info
           SET assignment_type = @value
         WHERE assignment_type IS NULL
            OR trim(assignment_type) = ''
      `).run({ value: BACKFILL_VALUE });
      updatedRows = update.changes || 0;
    }

    const remaining = db.prepare(`
      SELECT COUNT(*) AS count
        FROM employee_official_info
       WHERE assignment_type IS NULL
          OR trim(assignment_type) = ''
    `).get();

    return {
      updatedRows,
      remainingRows: Number(remaining?.count || 0),
      notes: []
    };
  } finally {
    db.close();
  }
};

const runPostgresBackfill = async () => {
  if (!config.pgUrl) {
    throw new Error('PG_URL is required when DB_PROVIDER=postgres');
  }

  const pool = new Pool({
    connectionString: config.pgUrl
  });

  try {
    const columnsResult = await pool.query(
      `
        SELECT column_name
          FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'employee_official_info'
      `
    );
    const columnNames = new Set((columnsResult.rows || []).map((row) => String(row.column_name || '')));
    if (!columnNames.has('assignment_type')) {
      return {
        updatedRows: 0,
        remainingRows: 0,
        notes: ['Skipping backfill: employee_official_info.assignment_type column is not available.']
      };
    }

    let updatedRows = 0;
    if (!options.dryRun) {
      const updateResult = await pool.query(
        `
        UPDATE employee_official_info
           SET assignment_type = $1
         WHERE assignment_type IS NULL
            OR btrim(assignment_type) = ''
        `,
        [BACKFILL_VALUE]
      );
      updatedRows = Number(updateResult.rowCount || 0);
    }

    const remainingResult = await pool.query(
      `
      SELECT COUNT(*)::INT AS count
        FROM employee_official_info
       WHERE assignment_type IS NULL
          OR btrim(assignment_type) = ''
      `
    );

    return {
      updatedRows,
      remainingRows: Number(remainingResult.rows?.[0]?.count || 0),
      notes: []
    };
  } finally {
    await pool.end();
  }
};

const run = async () => {
  if (config.dbProvider === 'sqlite') {
    return runSqliteBackfill();
  }
  if (config.dbProvider === 'postgres') {
    return runPostgresBackfill();
  }
  throw new Error(`Unsupported DB_PROVIDER: ${config.dbProvider}`);
};

run()
  .then((result) => {
    console.log('[backfill_employee_assignment_type] completed');
    console.log(`- DB provider: ${config.dbProvider}`);
    console.log(`- Mode: ${options.dryRun ? 'dry-run' : 'apply'}`);
    console.log(`- Updated rows: ${result.updatedRows}`);
    console.log(`- Remaining blank rows: ${result.remainingRows}`);
    for (const note of result.notes || []) {
      console.log(`- Note: ${note}`);
    }
  })
  .catch((error) => {
    console.error('[backfill_employee_assignment_type] failed:', error);
    process.exit(1);
  });
