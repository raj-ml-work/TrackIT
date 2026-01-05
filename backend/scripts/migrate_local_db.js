import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, '..');
const EXPORT_DIR = path.resolve(__dirname, '..', '..', '..', 'data_export');
const DUPLICATES_DIR = path.resolve(ROOT_DIR, 'data');
const DUPLICATES_PATH = path.resolve(DUPLICATES_DIR, 'duplicates_assets.csv');
const MISSING_SERIALS_PATH = path.resolve(DUPLICATES_DIR, 'missing_serial_assets.csv');

let apiBaseUrl = '';
let apiAccessToken = null;

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

function normalizeLocation(value) {
  const raw = (value || '').trim();
  if (!raw || raw === '-') {
    return 'Others';
  }
  const key = raw.toLowerCase();
  const mapping = {
    dwaraka: 'Dwaraka',
    raheja: 'Raheja',
    unispace: 'Unispace',
    singapore: 'Singapore',
    'sim lim towers': 'Penang',
    penang: 'Penang',
    malaysia: 'Penang',
    california: 'California',
    'hochi man city': 'Hochi Man City',
    others: 'Others',
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
    malaysia: 'Penang',
    usa: 'California',
    vietnam: 'Hochi Man City',
    office: 'Others',
    delhi: 'Others'
  };
  return mapping[key] || 'Others';
}

function normalizeDepartment(value) {
  const raw = (value || '').trim();
  if (!raw) {
    return null;
  }
  const key = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
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
    informationtechnology: 'IT',
    staffing: 'Staffing',
    hr: 'HR',
    humanresources: 'HR',
    delivery: 'Delivery',
    finance: 'Finance',
    financeaccounts: 'Finance',
    accounts: 'Finance',
    sales: 'Sales',
    salesmarketing: 'Sales',
    semicon: 'Semicon'
  };

  return mapping[key] || 'Other';
}

function normalizeGender(value) {
  const raw = (value || '').trim();
  if (!raw) {
    return null;
  }
  const key = raw.toLowerCase();
  if (['m', 'male'].includes(key)) {
    return 'Male';
  }
  if (['f', 'female'].includes(key)) {
    return 'Female';
  }
  if (['o', 'other', 'nonbinary', 'non-binary', 'nb'].includes(key)) {
    return 'Other';
  }
  return 'Other';
}

function normalizeAssetStatus(value, unknownStatuses) {
  const raw = (value || '').trim();
  if (!raw) {
    return 'Available';
  }
  const key = raw.toLowerCase();
  if (key.includes('maint') || key.includes('repair')) {
    return 'Maintenance';
  }
  if (key.includes('retired') || key.includes('dispose') || key.includes('scrap') || key.includes('decom')) {
    return 'Retired';
  }
  if (
    key.includes('assigned') ||
    key.includes('allocate') ||
    key.includes('issued') ||
    key.includes('in use') ||
    key === 'inuse'
  ) {
    return 'Assigned';
  }
  if (key.includes('shared')) {
    return 'Shared Resource';
  }
  if (key.includes('available') || key.includes('in stock') || key.includes('stock') || key.includes('free')) {
    return 'Available';
  }
  if (unknownStatuses) {
    unknownStatuses.add(raw);
  }
  return 'Available';
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

function normalizeAssetType(type, unknownTypes) {
  const raw = String(type || '').trim();
  if (!raw) {
    return 'Other';
  }
  const key = raw.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  const mapping = new Map([
    ['router', 'Network devices'],
    ['routers', 'Network devices'],
    ['switch', 'Network devices'],
    ['switches', 'Network devices'],
    ['mouse', 'Accessory'],
    ['keyboard', 'Accessory'],
    ['ram', 'Storage'],
    ['cctv', 'Other'],
    ['cctv set', 'Other'],
    ['biometric', 'Other'],
    ['android tab', 'Mobile'],
    ['iphone', 'Mobile'],
    ['earphone', 'Headphone'],
    ['earphones', 'Headphone'],
    ['hdmi', 'Other'],
    ['lan_card', 'Other'],
    ['lan card', 'Other'],
    ['laptop battery', 'Other'],
    ['refrigerator', 'Other'],
    ['ssd', 'Storage'],
    ['spike guard', 'Other'],
    ['ups', 'Other'],
    ['usb_drive', 'Storage'],
    ['usb drive', 'Storage'],
    ['testing_tool', 'Other'],
    ['testing tool', 'Other'],
    ['spikeguard', 'Other'],
    ['spikegaurd', 'Other'],
    ['smps', 'Other'],
    ['headphone', 'Headphone'],
    ['headphones', 'Headphone'],
    ['laptop charger', 'Other'],
    ['usb hub', 'Other']
  ]);
  if (mapping.has(key)) {
    return mapping.get(key);
  }
  if (key.includes('hard disk') || key.includes('harddisk') || key.includes('hdd')) {
    return 'Storage';
  }
  if (['accessory', 'accessories'].includes(key)) {
    return 'Accessory';
  }
  if (['mobile', 'mobile phone', 'phone', 'smartphone', 'tablet'].includes(key)) {
    return 'Mobile';
  }
  if (['projector', 'projectors'].includes(key)) {
    return 'Projector';
  }
  if (['tv', 'television'].includes(key)) {
    return 'TV';
  }
  if (['printer', 'printers'].includes(key)) {
    return 'Printer';
  }
  if (['switch', 'switches', 'router', 'routers', 'network device', 'network devices'].includes(key)) {
    return 'Network devices';
  }
  if (key === 'desktop' || key === 'desktops') {
    return 'Desktop';
  }
  if (key === 'laptop' || key === 'laptops') {
    return 'Laptop';
  }
  if (key === 'monitor' || key === 'monitors') {
    return 'Monitor';
  }
  const knownTypes = new Set([
    'laptop',
    'desktop',
    'monitor',
    'printer',
    'accessory',
    'mobile',
    'projector',
    'tv',
    'network devices',
    'storage',
    'other',
    'headphone'
  ]);
  if (!knownTypes.has(key) && unknownTypes) {
    unknownTypes.add(raw);
  }
  return 'Other';
}

function generateSerial(existingSerials, assetTag) {
  const tag = String(assetTag || 'UNKNOWN').trim().replace(/\s+/g, '');
  let candidate = '';
  do {
    candidate = `AUTO-${tag}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  } while (existingSerials.has(candidate));
  existingSerials.add(candidate);
  return candidate;
}

function buildCsvMigrationNote(payload) {
  return `CSV Migration Data: ${JSON.stringify(payload)}`;
}

async function apiFetchJson(pathname, options = {}) {
  if (!apiBaseUrl) {
    throw new Error('VITE_API_URL is not configured.');
  }

  const headers = new Headers(options.headers || {});
  if (apiAccessToken) {
    headers.set('Authorization', `Bearer ${apiAccessToken}`);
  }
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${apiBaseUrl}${pathname}`, {
    ...options,
    headers,
    credentials: 'include'
  });

  if (!response.ok) {
    let message = 'Request failed.';
    try {
      const data = await response.json();
      message = data?.error || message;
    } catch {
      // Ignore JSON parse errors.
    }
    throw new Error(message);
  }

  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function apiLogin() {
  const adminEmail = process.env.DEFAULT_ADMIN_EMAIL || 'admin@trackit.com';
  const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123';
  const response = await apiFetchJson('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: adminEmail, password: adminPassword })
  });

  apiAccessToken = response.accessToken;
  return response.user;
}

async function deleteAllApi(currentUser) {
  const assets = await apiFetchJson('/assets');
  for (const asset of assets || []) {
    await apiFetchJson(`/assets/${asset.id}`, { method: 'DELETE' });
  }

  const employees = await apiFetchJson('/employees');
  for (const employee of employees || []) {
    await apiFetchJson(`/employees/${employee.id}`, { method: 'DELETE' });
  }

  const departments = await apiFetchJson('/departments');
  for (const department of departments || []) {
    await apiFetchJson(`/departments/${department.id}`, { method: 'DELETE' });
  }

  const locations = await apiFetchJson('/locations');
  for (const location of locations || []) {
    await apiFetchJson(`/locations/${location.id}`, { method: 'DELETE' });
  }

  const users = await apiFetchJson('/users');
  for (const user of users || []) {
    if (currentUser && user.id === currentUser.id) {
      continue;
    }
    await apiFetchJson(`/users/${user.id}`, { method: 'DELETE' });
  }
}

function buildLaptopSpecs(row) {
  if (!row) {
    return null;
  }
  const isTouchscreen = ['true', '1', 'yes'].includes(String(row.is_touchscreen || '').toLowerCase());
  const specs = {
    processorType: row.processor_type?.trim() || undefined,
    ramCapacity: row.ram_capacity?.trim() || undefined,
    storageCapacity: row.storage_capacity?.trim() || undefined,
    screenSize: row.screen_size?.trim() || undefined,
    isTouchscreen,
    model: row.model?.trim() || undefined
  };

  const hasValue = Object.values(specs).some((value) => value !== undefined);
  return hasValue ? specs : null;
}

async function migrateViaApi({
  personalInfoRows,
  officialInfoRows,
  employeeRows,
  assetRows,
  laptopRows
}) {
  if (!apiBaseUrl) {
    throw new Error('VITE_API_URL is not configured.');
  }

  const currentUser = await apiLogin();

  console.log('[reset] clearing existing data (except admin user)');
  await deleteAllApi(currentUser);

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
    { name: 'Penang', city: 'Penang', country: 'Malaysia' },
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
    { name: 'Sales', description: 'Sales' },
    { name: 'Other', description: 'Other' }
  ];

  console.log('[load] inserting departments');
  for (const department of canonicalDepartments) {
    await apiFetchJson('/departments', {
      method: 'POST',
      body: JSON.stringify({ name: department.name, description: department.description })
    });
  }

  console.log('[load] inserting locations');
  const locationIdByName = new Map();
  for (const location of canonicalLocations) {
    const created = await apiFetchJson('/locations', {
      method: 'POST',
      body: JSON.stringify({ name: location.name, city: location.city })
    });
    locationIdByName.set(location.name, created.id);
  }

  const personalInfoById = new Map(personalInfoRows.map((row) => [row.id, row]));
  const officialInfoById = new Map(officialInfoRows.map((row) => [row.id, row]));

  console.log('[load] inserting employees');
  const employeeIdByEmployeeId = new Map();
  const employeeIdByEmail = new Map();
  for (const row of employeeRows) {
    const personalRow = personalInfoById.get(row.personal_info_id) || null;
    const officialRow = officialInfoById.get(row.official_info_id) || null;
    const migrationNote = buildCsvMigrationNote({
      personal_info: personalRow,
      employee: row,
      official_info: officialRow
    });
    const personalInfo = {
      firstName: personalRow?.first_name?.trim() || '',
      lastName: personalRow?.last_name?.trim() || undefined,
      gender: normalizeGender(personalRow?.gender),
      mobileNumber: truncate(personalRow?.mobile_number, 20) || undefined,
      emergencyContactName: personalRow?.emergency_contact_name?.trim() || undefined,
      emergencyContactNumber: truncate(personalRow?.emergency_contact_number, 20) || undefined,
      personalEmail: personalRow?.personal_email?.trim() || undefined,
      linkedinUrl: personalRow?.linkedin_url?.trim() || undefined,
      additionalComments: appendNote(personalRow?.additional_comments?.trim() || null, migrationNote) || undefined
    };
    const mappedDepartment = normalizeDepartment(officialRow?.division);
    const agreement = String(officialRow?.agreement_signed || '').toLowerCase();
    const officialInfo = {
      division: mappedDepartment || undefined,
      biometricId: officialRow?.biometric_id?.trim() || undefined,
      rfidSerial: officialRow?.rfid_serial?.trim() || undefined,
      agreementSigned: ['true', '1', 'yes'].includes(agreement),
      startDate: officialRow?.start_date?.trim() || undefined,
      officialDob: officialRow?.official_dob?.trim() || undefined,
      officialEmail: officialRow?.official_email?.trim() || undefined
    };
    const locationName = normalizeLocation(row.location);
    const locationId = locationIdByName.get(locationName) || undefined;
    const payload = {
      employeeId: row.employee_id?.trim(),
      status: 'Active',
      locationId,
      personalInfo,
      officialInfo
    };
    const created = await apiFetchJson('/employees', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    employeeIdByEmployeeId.set(created.employeeId, created.id);

    const emails = [
      personalRow?.personal_email?.trim(),
      officialRow?.official_email?.trim()
    ].filter(Boolean);
    emails.forEach((email) => {
      if (!employeeIdByEmail.has(email)) {
        employeeIdByEmail.set(email, created.id);
      }
    });
  }

  console.log('[load] de-duplicating assets');
  const assetHeader = Object.keys(assetRows[0] || {});
  const existingSerials = new Set();
  const seenSerials = new Set();
  const dedupedAssets = [];
  const duplicateAssets = [];
  const missingSerialAssets = [];
  for (const row of assetRows) {
    const rawSerial = (row.serial_number || '').trim();
    if (rawSerial && rawSerial !== '-') {
      existingSerials.add(rawSerial);
    }
  }
  for (const row of assetRows) {
    if ((row.name || '').trim() === 'BS_HYD_0072') {
      row.serial_number = '5RHX193';
    }

    const assetTag = (row.name || row.id || 'UNKNOWN').trim();
    let serial = (row.serial_number || '').trim();
    if (serial === '-') {
      serial = '';
    }

    if (!serial) {
      missingSerialAssets.push({ ...row });
      serial = generateSerial(existingSerials, assetTag);
      row.serial_number = serial;
      seenSerials.add(serial);
      dedupedAssets.push(row);
      continue;
    }
    if (serial) {
      if (seenSerials.has(serial)) {
        duplicateAssets.push(row);
        continue;
      }
      seenSerials.add(serial);
    }
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

  if (missingSerialAssets.length > 0) {
    fs.mkdirSync(DUPLICATES_DIR, { recursive: true });
    const lines = [];
    lines.push(assetHeader.join(','));
    for (const row of missingSerialAssets) {
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
    fs.writeFileSync(MISSING_SERIALS_PATH, `${lines.join('\n')}\n`, 'utf8');
    console.log(`[load] wrote ${missingSerialAssets.length} assets missing serials to ${MISSING_SERIALS_PATH}`);
  }

  const laptopSpecsByAssetId = new Map();
  for (const row of laptopRows) {
    const specs = buildLaptopSpecs(row);
    if (row.asset_id && specs) {
      laptopSpecsByAssetId.set(row.asset_id, specs);
    }
  }

  console.log('[load] inserting assets');
  const unknownAssetTypes = new Set();
  const unknownAssetStatuses = new Set();
  for (const row of dedupedAssets) {
    const locationName = normalizeLocation(row.location);
    const locationId = locationIdByName.get(locationName) || undefined;
    const originalLocation = row.location?.trim();
    const migrationNote = buildCsvMigrationNote({ asset: row });
    const notes = appendNote(
      appendNote(row.notes?.trim() || null, originalLocation ? `Original location: ${originalLocation}` : null),
      migrationNote
    );
    const assignedEmail = row.assigned_to?.trim();
    const assignedEmployeeId = row.employee_id?.trim();
    const employeeId =
      (assignedEmail && employeeIdByEmail.get(assignedEmail)) ||
      (assignedEmployeeId && employeeIdByEmployeeId.get(assignedEmployeeId)) ||
      undefined;
    const baseSpecs = safeJsonParse(row.dynamic_attributes?.trim());
    const laptopSpecs = row.id ? laptopSpecsByAssetId.get(row.id) : null;
    const mergedSpecs = {
      ...(baseSpecs && typeof baseSpecs === 'object' ? baseSpecs : {}),
      ...(laptopSpecs || {})
    };
    const hasSpecs = Object.keys(mergedSpecs).length > 0;

    const normalizedType = normalizeAssetType(row.type, unknownAssetTypes);
    const normalizedStatus = normalizeAssetStatus(row.status, unknownAssetStatuses);
    const serial = row.serial_number?.trim();
    const payload = {
      name: row.name?.trim() || 'Unknown',
      type: normalizedType,
      status: normalizedStatus,
      serialNumber: serial && serial !== '-' ? serial : undefined,
      assignedTo: row.assigned_to?.trim() || undefined,
      assignedToId: employeeId,
      employeeId,
      purchaseDate: row.purchase_date?.trim() || '',
      warrantyExpiry: row.warranty_expiry_date?.trim() || '',
      cost: row.purchase_price ? Number(row.purchase_price) : 0,
      location: locationName,
      locationId,
      notes: notes || undefined,
      specs: hasSpecs ? mergedSpecs : undefined,
      acquisitionDate: row.acquisition_date?.trim() || undefined,
      manufacturer: row.manufacturer?.trim() || undefined
    };

    const created = await apiFetchJson('/assets', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    await apiFetchJson(`/assets/${created.id}/comments`, {
      method: 'POST',
      body: JSON.stringify({
        authorName: 'System',
        authorId: null,
        message: buildCsvMigrationNote({ asset: row }),
        type: 'System'
      })
    });
  }
  if (unknownAssetTypes.size > 0) {
    console.warn(`[load] unmapped asset types: ${Array.from(unknownAssetTypes).sort().join(', ')}`);
  }
  if (unknownAssetStatuses.size > 0) {
    console.warn(`[load] unmapped asset statuses: ${Array.from(unknownAssetStatuses).sort().join(', ')}`);
  }

  console.log('[done] migration complete');
}

async function main() {
  loadEnv(path.resolve(ROOT_DIR, '.env'));
  loadEnv(path.resolve(__dirname, '.env'));
  loadEnv(path.resolve(ROOT_DIR, 'server', '.env'));
  apiBaseUrl = process.env.VITE_API_URL || '';

  if (!apiBaseUrl) {
    throw new Error('VITE_API_URL is not configured.');
  }

  console.log('[load] reading CSV exports');
  const personalInfoRows = readCsv(path.resolve(EXPORT_DIR, '02_employee_personal_info.csv'));
  const officialInfoRows = readCsv(path.resolve(EXPORT_DIR, '03_employee_official_info.csv'));
  const employeeRows = readCsv(path.resolve(EXPORT_DIR, '05_employees.csv'));
  const assetRows = readCsv(path.resolve(EXPORT_DIR, '06_assets.csv'));
  const laptopRows = readCsv(path.resolve(EXPORT_DIR, '07_laptop_assets.csv'));

  await migrateViaApi({
    personalInfoRows,
    officialInfoRows,
    employeeRows,
    assetRows,
    laptopRows
  });
}

main().catch((error) => {
  console.error(`Migration failed: ${error.message}`);
  process.exit(1);
});
