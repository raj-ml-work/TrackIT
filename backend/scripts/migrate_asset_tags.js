
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import sqlite3 from 'better-sqlite3';
import pg from 'pg';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Column mapping based on user description:
const COL_NEW_TAG = 1;      // B
const COL_OLD_TAG = 2;      // C
const COL_ADMIN_PASS = 3;   // D
const COL_OS_DETAILS = 4;   // E
const COL_BITLOCKER = 5;    // F
const COL_VOICE_INFO = 6;   // G
const COL_DETAIL_T = 19;    // T

/**
 * Simple robust CSV parser that handles quoted fields
 */
function parseCSVLine(line) {
  const result = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += char;
    }
  }
  result.push(cur.trim());
  return result.map(val => val.replace(/^"|"$/g, ''));
}

async function migrate() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const csvPath = args.find(arg => !arg.startsWith('--'));

  if (!csvPath) {
    console.error('Usage: node migrate_asset_tags.js <path_to_csv> [--dry-run]');
    process.exit(1);
  }

  if (!fs.existsSync(csvPath)) {
    console.error(`File not found: ${csvPath}`);
    process.exit(1);
  }

  if (isDryRun) {
    console.log('*** DRY RUN MODE - No changes will be saved ***\n');
  }

  const content = fs.readFileSync(csvPath, 'utf8');
  const lines = content.split('\n');
  
  console.log(`Processing ${lines.length - 1} records...`);

  const dbProvider = process.env.DB_PROVIDER || 'sqlite';
  let db;

    if (dbProvider === 'sqlite') {
    const dbPath = process.env.SQLITE_PATH || path.resolve(__dirname, '..', 'data', 'inventory.db');
    db = new sqlite3(dbPath);
    console.log(`Connected to SQLite: ${dbPath}`);
    
    // Ensure columns exist
    if (!isDryRun) {
      try {
        db.prepare('ALTER TABLE asset_specs ADD COLUMN os_details TEXT').run();
        console.log('Added os_details column to asset_specs table');
      } catch (e) {
        if (!e.message.includes('duplicate column name')) {
          console.warn('Note:', e.message);
        }
      }
      try {
        db.prepare('ALTER TABLE assets ADD COLUMN voice_info TEXT').run();
        console.log('Added voice_info column to assets table');
      } catch (e) {
        if (!e.message.includes('duplicate column name')) {
          console.warn('Note:', e.message);
        }
      }
    }
  } else {
    const { Client } = pg;
    const pgUrl = process.env.PG_URL || process.env.DATABASE_URL;
    db = new Client({ connectionString: pgUrl });
    await db.connect();
    console.log('Connected to PostgreSQL');

    // Ensure os_details column exists
    if (!isDryRun) {
      await db.query(`
        DO $$ 
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'asset_specs' AND column_name = 'os_details'
          ) THEN
            ALTER TABLE asset_specs ADD COLUMN os_details TEXT;
          END IF;

          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'assets' AND column_name = 'voice_info'
          ) THEN
            ALTER TABLE assets ADD COLUMN voice_info TEXT;
          END IF;
        END $$;
      `);
    }
  }

  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = parseCSVLine(line);
    
    if (cols.length <= COL_OLD_TAG) {
      console.warn(`[Line ${i+1}] Skipped: Insufficient columns (${cols.length})`);
      skippedCount++;
      continue;
    }

    const newTag = cols[COL_NEW_TAG];
    const oldTag = cols[COL_OLD_TAG];
    const adminPass = cols[COL_ADMIN_PASS] || '';
    const osDetails = cols[COL_OS_DETAILS] || '';
    const bitlocker = cols[COL_BITLOCKER] || '';
    const voiceInfo = COL_VOICE_INFO >= 0 ? cols[COL_VOICE_INFO] : '';
    const detailT = cols[COL_DETAIL_T] || '';

    if (!oldTag || !newTag) {
      console.warn(`[Line ${i+1}] Skipped: Missing Old Tag (${oldTag}) or New Tag (${newTag})`);
      skippedCount++;
      continue;
    }

    try {
      if (dbProvider === 'sqlite') {
        // Try finding by old tag first, then by new tag (in case it was already renamed)
        let asset = db.prepare('SELECT id, type, name FROM assets WHERE name = ?').get(oldTag);
        let alreadyRenamed = false;

        if (!asset) {
          asset = db.prepare('SELECT id, type, name FROM assets WHERE name = ?').get(newTag);
          if (asset) alreadyRenamed = true;
        }

        if (asset) {
          if (!isDryRun) {
            const runTransaction = db.transaction(() => {
              // Update asset name and voice_info if it's not already renamed
              if (!alreadyRenamed) {
                db.prepare('UPDATE assets SET name = ?, voice_info = ? WHERE id = ?').run(newTag, voiceInfo || null, asset.id);
              } else if (voiceInfo) {
                // If already renamed, still update voice_info if provided
                db.prepare('UPDATE assets SET voice_info = ? WHERE id = ?').run(voiceInfo, asset.id);
              }
              
              // Update or Insert asset specs (OS details)
              const spec = db.prepare('SELECT id FROM asset_specs WHERE asset_id = ?').get(asset.id);
              if (spec) {
                db.prepare('UPDATE asset_specs SET os_details = ? WHERE id = ?').run(osDetails, spec.id);
              } else {
                db.prepare('INSERT INTO asset_specs (asset_id, asset_type, os_details) VALUES (?, ?, ?)')
                  .run(asset.id, asset.type, osDetails);
              }
              
              if (adminPass) {
                db.prepare('INSERT INTO asset_comments (asset_id, message, author_name, type) VALUES (?, ?, ?, ?)')
                  .run(asset.id, `AdminLogin Password: ${adminPass}`, 'System Migration', 'Note');
              }
              if (bitlocker) {
                db.prepare('INSERT INTO asset_comments (asset_id, message, author_name, type) VALUES (?, ?, ?, ?)')
                  .run(asset.id, `BitLocker Code: ${bitlocker}`, 'System Migration', 'Note');
              }
              if (detailT) {
                db.prepare('INSERT INTO asset_comments (asset_id, message, author_name, type) VALUES (?, ?, ?, ?)')
                  .run(asset.id, `Detail from Column T: ${detailT}`, 'System Migration', 'Note');
              }
            });
            runTransaction();
          } else {
            if (alreadyRenamed) {
              console.log(`[DRY-RUN] Already renamed, would update specs for: ${newTag}`);
            } else {
              console.log(`[DRY-RUN] Would update: ${oldTag} -> ${newTag}`);
            }
            if (osDetails) console.log(`          - OS Details: ${osDetails}`);
            if (adminPass) console.log(`          - Comment: Admin Password captured`);
            if (bitlocker) console.log(`          - Comment: BitLocker Code captured`);
          }
          updatedCount++;
        } else {
          console.warn(`[Line ${i+1}] Asset not found in database (checked both ${oldTag} and ${newTag})`);
          skippedCount++;
        }
      } else {
        // PostgreSQL logic
        let res = await db.query('SELECT id, type, name FROM assets WHERE name = $1', [oldTag]);
        let alreadyRenamed = false;

        if (res.rows.length === 0) {
          res = await db.query('SELECT id, type, name FROM assets WHERE name = $1', [newTag]);
          if (res.rows.length > 0) alreadyRenamed = true;
        }

        if (res.rows.length > 0) {
          const assetId = res.rows[0].id;
          const assetType = res.rows[0].type;
          if (!isDryRun) {
            await db.query('BEGIN');
            try {
              // Update asset name and voice_info
              if (!alreadyRenamed) {
                await db.query('UPDATE assets SET name = $1, voice_info = $2 WHERE id = $3', [newTag, voiceInfo || null, assetId]);
              } else if (voiceInfo) {
                // If already renamed, still update voice_info if provided
                await db.query('UPDATE assets SET voice_info = $1 WHERE id = $2', [voiceInfo, assetId]);
              }
              
              // Update or Insert asset specs (OS details)
              const specRes = await db.query('SELECT id FROM asset_specs WHERE asset_id = $1', [assetId]);
              if (specRes.rows.length > 0) {
                await db.query('UPDATE asset_specs SET os_details = $1 WHERE id = $2', [osDetails, specRes.rows[0].id]);
              } else {
                await db.query('INSERT INTO asset_specs (asset_id, asset_type, os_details) VALUES ($1, $2, $3)', 
                  [assetId, assetType, osDetails]);
              }
              
              if (adminPass) {
                await db.query('INSERT INTO asset_comments (asset_id, message, author_name, type) VALUES ($1, $2, $3, $4)', 
                  [assetId, `AdminLogin Password: ${adminPass}`, 'System Migration', 'Note']);
              }
              if (bitlocker) {
                await db.query('INSERT INTO asset_comments (asset_id, message, author_name, type) VALUES ($1, $2, $3, $4)', 
                  [assetId, `BitLocker Code: ${bitlocker}`, 'System Migration', 'Note']);
              }
              if (detailT) {
                await db.query('INSERT INTO asset_comments (asset_id, message, author_name, type) VALUES ($1, $2, $3, $4)', 
                  [assetId, `Detail from Column T: ${detailT}`, 'System Migration', 'Note']);
              }
              await db.query('COMMIT');
            } catch (err) {
              await db.query('ROLLBACK');
              throw err;
            }
          } else {
            if (alreadyRenamed) {
              console.log(`[DRY-RUN] Already renamed, would update specs for: ${newTag}`);
            } else {
              console.log(`[DRY-RUN] Would update: ${oldTag} -> ${newTag}`);
            }
            if (osDetails) console.log(`          - OS Details: ${osDetails}`);
            if (adminPass) console.log(`          - Comment: Admin Password captured`);
            if (bitlocker) console.log(`          - Comment: BitLocker Code captured`);
          }
          updatedCount++;
        } else {
          console.warn(`[Line ${i+1}] Asset not found in database (checked both ${oldTag} and ${newTag})`);
          skippedCount++;
        }
      }
    } catch (err) {
      console.error(`[Line ${i+1}] Error processing ${oldTag}:`, err.message);
      errorCount++;
    }
  }

  console.log(`\nMigration complete!`);
  console.log(`Updated: ${updatedCount}`);
  console.log(`Skipped: ${skippedCount}`);
  console.log(`Errors: ${errorCount}`);

  if (dbProvider === 'sqlite') {
    db.close();
  } else {
    await db.end();
  }
}

migrate().catch(console.error);
