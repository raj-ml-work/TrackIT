import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, '..');
const EXPORT_DIR = path.resolve(__dirname, '..', '..', 'data_export');
const DUPLICATES_DIR = path.resolve(ROOT_DIR, 'data');
const DUPLICATES_PATH = path.resolve(DUPLICATES_DIR, 'duplicates_assets.csv');

const ZERO_UUID = '00000000-0000-0000-0000-000000000000';

function loadEnv(envPath) {
  if (!fs.existsSync(envPath)) {
    return;
  }
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const idx = trimmed.indexOf('=');
    if (idx === -1) {
      continue;
    }
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function parseCsv(content) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    const next = content[i + 1];
    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ',') {
      row.push(field);
      field = '';
      continue;
    }
    if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }
    if (char === '\r') {
      continue;
    }
    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  if (rows.length === 0) {
    return [];
  }

  const header = rows[0].map((value) => value.trim());
  return rows.slice(1).map((values) => {
    const rowObj = {};
    header.forEach((key, idx) => {
      rowObj[key] = values[idx] ?? '';
    });
    return rowObj;
  });
}

function readCsv(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`CSV file not found: ${filePath}`);
  }
  const content = fs.readFileSync(filePath, 'utf8');
  return parseCsv(content);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function normalizeLocation(value) {
  const raw = (value || '').trim();
  if (!raw || raw === '-') {
    return 'Others';
  }
  const key = raw.toLowerCase();
  const mapping = {
    bangalore: 'Unispace',
    bengaluru: 'Unispace',
    benguluru: 'Unispace',
    springboard: 'Unispace',
    hyderabad: 'Raheja',
    hyderabd: 'Raheja',
    raheja: 'Raheja',
    trendz: 'Raheja',
    dwaraka: 'Dwaraka',
    dwarka: 'Dwaraka',
    singapore: 'Singapore',
    malaysia: 'Sim lim Towers',
    usa: 'California',
    vietnam: 'Hochi Man City',
    office: 'Others',
    delhi: 'Others'
  };
  return mapping[key] || raw;
}

function normalizeDepartment(value) {
  const raw = (value || '').trim();
  if (!raw) {
    return null;
  }
  const key = raw.toLowerCase().replace(/\s+/g, '');
  if (
    key.includes('dv') ||
    key.includes('dft') ||
    key.includes('psv') ||
    key.includes('rtl') ||
    key.includes('fpga') ||
    key.includes('pd') ||
    key.includes('sta')
  ) {
    return 'Semicon';
  }

  const mapping = {
    embedded: 'Embedded',
    management: 'Management',
    it: 'IT',
    staffing: 'Staffing',
    hr: 'HR',
    delivery: 'Delivery',
    finance: 'Finance',
    sales: 'Sales',
    semicon: 'Semicon'
  };

  return mapping[key] || raw;
}

function appendNote(existing, note) {
  if (!note) {
    return existing || null;
  }
  if (!existing) {
    return note;
  }
  if (existing.includes(note)) {
    return existing;
  }
  return `${existing} | ${note}`;
}

function truncate(value, max) {
  if (!value) {
    return null;
  }
  const trimmed = String(value).trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

function safeJsonParse(value) {
  if (!value) {
    return null;
  }
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

async function deleteAll(supabase, table) {
  const { error } = await supabase.from(table).delete().neq('id', ZERO_UUID);
  if (error) {
    console.warn(`[reset] skip ${table}: ${error.message}`);
  } else {
    console.log(`[reset] cleared ${table}`);
  }
}

async function insertBatch(supabase, table, rows, batchSize = 200) {
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from(table).insert(batch);
    if (error) {
      throw new Error(`Insert failed for ${table}: ${error.message}`);
    }
  }
}

async function hasEmployeesDepartmentColumn(supabase) {
  const { error } = await supabase.from('employees').select('department').limit(1);
  if (!error) {
    return true;
  }
  if (error.message && error.message.toLowerCase().includes('department')) {
    return false;
  }
  throw error;
}

function buildCsvMigrationNote(payload) {
  return `CSV Migration Data: ${JSON.stringify(payload)}`;
}

async function main() {
  loadEnv(path.resolve(ROOT_DIR, '.env'));
  loadEnv(path.resolve(__dirname, '.env'));

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey =
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing VITE_SUPABASE_URL or service role key in environment.');
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  console.log('[reset] clearing existing data (except admin user)');
  await deleteAll(supabase, 'asset_comments');
  await deleteAll(supabase, 'asset_history');
  await deleteAll(supabase, 'asset_specs');
  await deleteAll(supabase, 'assets');
  await deleteAll(supabase, 'employees');
  await deleteAll(supabase, 'employee_official_info');
  await deleteAll(supabase, 'employee_personal_info');
  await deleteAll(supabase, 'locations');
  await deleteAll(supabase, 'departments');
  await deleteAll(supabase, 'users');

  const adminUser = {
    name: 'System Administrator',
    email: 'admin@trackit.com',
    role: 'Admin',
    status: 'Active',
    password_hash: sha256('admin123')
  };
  const { error: adminError } = await supabase.from('users').insert([adminUser]);
  if (adminError) {
    throw new Error(`Failed to create default admin: ${adminError.message}`);
  }

  console.log('[load] reading CSV exports');
  const personalInfoRows = readCsv(path.resolve(EXPORT_DIR, '02_employee_personal_info.csv'));
  const officialInfoRows = readCsv(path.resolve(EXPORT_DIR, '03_employee_official_info.csv'));
  const employeeRows = readCsv(path.resolve(EXPORT_DIR, '05_employees.csv'));
  const assetRows = readCsv(path.resolve(EXPORT_DIR, '06_assets.csv'));
  const laptopRows = readCsv(path.resolve(EXPORT_DIR, '07_laptop_assets.csv'));

  const locationSources = new Map();
  function trackLocation(raw) {
    const canonical = normalizeLocation(raw);
    if (!locationSources.has(canonical)) {
      locationSources.set(canonical, new Set());
    }
    if (raw) {
      locationSources.get(canonical).add(raw.trim());
    }
  }

  employeeRows.forEach((row) => trackLocation(row.location));
  assetRows.forEach((row) => trackLocation(row.location));

  const canonicalLocations = [
    { name: 'Dwaraka', city: 'Hyderabad', country: 'India' },
    { name: 'Raheja', city: 'Hyderabad', country: 'India' },
    { name: 'Unispace', city: 'Bengaluru', country: 'India' },
    { name: 'Singapore', city: 'Singapore', country: 'Singapore' },
    { name: 'Sim lim Towers', city: 'Penang', country: 'Malaysia' },
    { name: 'California', city: 'California', country: 'USA' },
    { name: 'Hochi Man City', city: 'Ho Chi Minh City', country: 'Vietnam' },
    { name: 'Others', city: 'Other Locations', country: 'India' }
  ];

  const canonicalDepartments = [
    { name: 'Semicon', description: 'Semiconductor design and verification' },
    { name: 'Embedded', description: 'Embedded systems' },
    { name: 'Management', description: 'Management' },
    { name: 'IT', description: 'Information Technology' },
    { name: 'Staffing', description: 'Staffing' },
    { name: 'HR', description: 'Human Resources' },
    { name: 'Delivery', description: 'Delivery' },
    { name: 'Finance', description: 'Finance' },
    { name: 'Sales', description: 'Sales' }
  ];

  console.log('[load] inserting departments');
  await insertBatch(supabase, 'departments', canonicalDepartments);

  const locationInsertRows = canonicalLocations.map((location) => {
    const sources = locationSources.get(location.name);
    const sourceList = sources ? Array.from(sources).sort((a, b) => a.localeCompare(b)) : [];
    const comments = sourceList.length > 0 ? `Source locations: ${sourceList.join(', ')}` : null;
    return { ...location, comments };
  });

  console.log('[load] inserting locations');
  await insertBatch(supabase, 'locations', locationInsertRows);
  const { data: locationData, error: locationError } = await supabase
    .from('locations')
    .select('id,name');
  if (locationError) {
    throw new Error(`Failed to fetch locations: ${locationError.message}`);
  }
  const locationIdByName = new Map(locationData.map((row) => [row.name, row.id]));

  const employeeByPersonalId = new Map(employeeRows.map((row) => [row.personal_info_id, row]));
  const officialById = new Map(officialInfoRows.map((row) => [row.id, row]));

  console.log('[load] inserting employee personal info');
  const personalInfoIdMap = new Map();
  for (const row of personalInfoRows) {
    const employeeRow = employeeByPersonalId.get(row.id) || null;
    const officialRow = employeeRow ? officialById.get(employeeRow.official_info_id) || null : null;
    const migrationNote = buildCsvMigrationNote({
      personal_info: row,
      employee: employeeRow,
      official_info: officialRow
    });
    const insertRow = {
      first_name: row.first_name?.trim() || '',
      last_name: row.last_name?.trim() || null,
      gender: row.gender?.trim() || null,
      mobile_number: truncate(row.mobile_number, 20),
      emergency_contact_name: row.emergency_contact_name?.trim() || null,
      emergency_contact_number: truncate(row.emergency_contact_number, 20),
      personal_email: row.personal_email?.trim() || null,
      linkedin_url: row.linkedin_url?.trim() || null,
      additional_comments: appendNote(row.additional_comments?.trim() || null, migrationNote)
    };
    const { data, error } = await supabase.from('employee_personal_info').insert([insertRow]).select('id');
    if (error) {
      throw new Error(`Failed to insert employee personal info: ${error.message}`);
    }
    personalInfoIdMap.set(row.id, data[0].id);
  }

  const officialInfoById = new Map(officialInfoRows.map((row) => [row.id, row]));

  console.log('[load] inserting employee official info');
  const officialInfoIdMap = new Map();
  for (const row of officialInfoRows) {
    const mappedDepartment = normalizeDepartment(row.division);
    const agreement = String(row.agreement_signed || '').toLowerCase();
    const insertRow = {
      division: mappedDepartment,
      biometric_id: row.biometric_id?.trim() || null,
      rfid_serial: row.rfid_serial?.trim() || null,
      agreement_signed: ['true', '1', 'yes'].includes(agreement),
      start_date: row.start_date?.trim() || null,
      official_dob: row.official_dob?.trim() || null,
      official_email: row.official_email?.trim() || null
    };
    const { data, error } = await supabase.from('employee_official_info').insert([insertRow]).select('id');
    if (error) {
      throw new Error(`Failed to insert employee official info: ${error.message}`);
    }
    officialInfoIdMap.set(row.id, data[0].id);
  }

  console.log('[load] inserting employees');
  let includeDepartmentInEmployees = false;
  try {
    includeDepartmentInEmployees = await hasEmployeesDepartmentColumn(supabase);
  } catch (error) {
    console.warn(`[load] unable to detect employees.department column: ${error.message}`);
  }
  const employeesToInsert = employeeRows.map((row) => {
    const locationName = normalizeLocation(row.location);
    const locationId = locationIdByName.get(locationName) || null;
    const personalInfoId = personalInfoIdMap.get(row.personal_info_id) || null;
    const officialInfoId = officialInfoIdMap.get(row.official_info_id) || null;
    const personalInfo = personalInfoRows.find((p) => p.id === row.personal_info_id);
    const officialInfo = officialInfoById.get(row.official_info_id);
    const department = normalizeDepartment(officialInfo?.division);
    const name = personalInfo
      ? `${personalInfo.first_name || ''} ${personalInfo.last_name || ''}`.trim()
      : null;
    const baseRow = {
      employee_id: row.employee_id?.trim(),
      name: name || null,
      status: 'Active',
      location_id: locationId,
      personal_info_id: personalInfoId,
      official_info_id: officialInfoId
    };
    if (includeDepartmentInEmployees) {
      return { ...baseRow, department: department || null };
    }
    return baseRow;
  });
  await insertBatch(supabase, 'employees', employeesToInsert);
  const { data: employeeData, error: employeeError } = await supabase
    .from('employees')
    .select('id,employee_id,personal_info_id,official_info_id');
  if (employeeError) {
    throw new Error(`Failed to fetch employees: ${employeeError.message}`);
  }
  const employeeIdByEmployeeId = new Map(employeeData.map((row) => [row.employee_id, row.id]));
  const employeeIdByEmail = new Map();
  for (const emp of employeeData) {
    const personalRow = personalInfoRows.find((p) => personalInfoIdMap.get(p.id) === emp.personal_info_id);
    const officialRow = officialInfoRows.find((o) => officialInfoIdMap.get(o.id) === emp.official_info_id);
    const emails = [
      personalRow?.personal_email?.trim(),
      officialRow?.official_email?.trim()
    ].filter(Boolean);
    emails.forEach((email) => {
      if (!employeeIdByEmail.has(email)) {
        employeeIdByEmail.set(email, emp.id);
      }
    });
  }

  console.log('[load] de-duplicating assets');
  const assetHeader = Object.keys(assetRows[0] || {});
  const seenSerials = new Set();
  const dedupedAssets = [];
  const duplicateAssets = [];
  for (const row of assetRows) {
    const serial = (row.serial_number || '').trim();
    if (!serial) {
      continue;
    }
    if (seenSerials.has(serial)) {
      duplicateAssets.push(row);
      continue;
    }
    seenSerials.add(serial);
    dedupedAssets.push(row);
  }

  if (duplicateAssets.length > 0) {
    fs.mkdirSync(DUPLICATES_DIR, { recursive: true });
    const lines = [];
    lines.push(assetHeader.join(','));
    for (const row of duplicateAssets) {
      const line = assetHeader.map((key) => {
        const value = row[key] ?? '';
        const escaped = String(value).replace(/\"/g, '""');
        if (escaped.includes(',') || escaped.includes('\n') || escaped.includes('\r')) {
          return `"${escaped}"`;
        }
        return escaped;
      });
      lines.push(line.join(','));
    }
    fs.writeFileSync(DUPLICATES_PATH, `${lines.join('\n')}\n`, 'utf8');
    console.log(`[load] wrote ${duplicateAssets.length} duplicate assets to ${DUPLICATES_PATH}`);
  }

  console.log('[load] inserting assets');
  const assetInsertRows = dedupedAssets.map((row) => {
    const locationName = normalizeLocation(row.location);
    const locationId = locationIdByName.get(locationName) || null;
    const originalLocation = row.location?.trim();
    const notes = appendNote(row.notes?.trim() || null, originalLocation ? `Original location: ${originalLocation}` : null);
    return {
      name: row.name?.trim() || 'Unknown',
      type: row.type?.trim() || 'Other',
      status: row.status?.trim() || 'Available',
      serial_number: row.serial_number?.trim(),
      assigned_to: row.assigned_to?.trim() || null,
      purchase_date: row.purchase_date?.trim() || null,
      warranty_expiry: row.warranty_expiry_date?.trim() || null,
      cost: row.purchase_price ? Number(row.purchase_price) : 0,
      location: row.location?.trim() || null,
      notes,
      specs: safeJsonParse(row.dynamic_attributes?.trim()),
      acquisition_date: row.acquisition_date?.trim() || null,
      location_id: locationId,
      manufacturer: row.manufacturer?.trim() || null
    };
  });
  await insertBatch(supabase, 'assets', assetInsertRows);
  const { data: assetData, error: assetError } = await supabase
    .from('assets')
    .select('id,serial_number');
  if (assetError) {
    throw new Error(`Failed to fetch assets: ${assetError.message}`);
  }
  const assetIdBySerial = new Map(assetData.map((row) => [row.serial_number, row.id]));

  console.log('[load] inserting asset comments');
  const assetCommentRows = [];
  for (const row of dedupedAssets) {
    const serial = row.serial_number?.trim();
    const assetId = assetIdBySerial.get(serial);
    if (!assetId) {
      continue;
    }
    assetCommentRows.push({
      asset_id: assetId,
      author_name: 'System',
      author_id: null,
      message: buildCsvMigrationNote({ asset: row }),
      type: 'System'
    });
  }
  if (assetCommentRows.length > 0) {
    await insertBatch(supabase, 'asset_comments', assetCommentRows);
  }

  console.log('[load] updating asset assignments');
  for (const row of dedupedAssets) {
    const serial = row.serial_number?.trim();
    const assetId = assetIdBySerial.get(serial);
    if (!assetId) {
      continue;
    }
    const assignedEmail = row.assigned_to?.trim();
    const assignedEmployeeId = row.employee_id?.trim();
    const employeeId =
      (assignedEmail && employeeIdByEmail.get(assignedEmail)) ||
      (assignedEmployeeId && employeeIdByEmployeeId.get(assignedEmployeeId)) ||
      null;
    if (!employeeId) {
      continue;
    }
    const { error } = await supabase
      .from('assets')
      .update({ assigned_to_uuid: employeeId, employee_id: employeeId })
      .eq('id', assetId);
    if (error) {
      throw new Error(`Failed to update asset assignment: ${error.message}`);
    }
  }

  console.log('[load] inserting asset specs (laptops)');
  const assetIdByLegacyId = new Map();
  for (const row of dedupedAssets) {
    const serial = row.serial_number?.trim();
    const assetId = assetIdBySerial.get(serial);
    if (assetId && row.id) {
      assetIdByLegacyId.set(row.id, assetId);
    }
  }

  const assetSpecsRows = laptopRows.map((row) => {
    const assetId = assetIdByLegacyId.get(row.asset_id);
    if (!assetId) {
      return null;
    }
    const isTouchscreen = ['true', '1', 'yes'].includes(String(row.is_touchscreen || '').toLowerCase());
    return {
      asset_id: assetId,
      asset_type: 'Laptop',
      processor_type: row.processor_type?.trim() || null,
      ram_capacity: row.ram_capacity?.trim() || null,
      storage_capacity: row.storage_capacity?.trim() || null,
      screen_size: row.screen_size?.trim() || null,
      is_touchscreen: isTouchscreen,
      model: row.model?.trim() || null
    };
  }).filter(Boolean);
  if (assetSpecsRows.length > 0) {
    await insertBatch(supabase, 'asset_specs', assetSpecsRows);
  }

  console.log('[done] migration complete');
}

main().catch((error) => {
  console.error(`Migration failed: ${error.message}`);
  process.exit(1);
});
