-- TrackIT Inventory Management Database Schema for SQLite
-- Adapted from PostgreSQL schema for local SQLite database

-- ============================================
-- USERS TABLE (System Users - Admins/IT Staff)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT, -- For custom auth
  role TEXT NOT NULL DEFAULT 'User', -- 'Admin' or 'User'
  status TEXT NOT NULL DEFAULT 'Active', -- 'Active' or 'Inactive'
  last_login DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- CLIENTS TABLE (New - for client management)
-- ============================================
CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'Active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_clients_code ON clients(code);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);

-- ============================================
-- LOCATIONS TABLE (Enhanced with country)
-- ============================================
CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  name TEXT UNIQUE NOT NULL,
  city TEXT NOT NULL,
  country TEXT DEFAULT 'India',
  comments TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for location name lookups
CREATE INDEX IF NOT EXISTS idx_locations_name ON locations(name);
CREATE INDEX IF NOT EXISTS idx_locations_country ON locations(country);

-- ============================================
-- EMPLOYEE PERSONAL INFO TABLE (New - Normalized)
-- ============================================
CREATE TABLE IF NOT EXISTS employee_personal_info (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  first_name TEXT NOT NULL,
  last_name TEXT,
  gender TEXT,
  mobile_number TEXT,
  emergency_contact_name TEXT,
  emergency_contact_number TEXT,
  personal_email TEXT,
  linkedin_url TEXT,
  additional_comments TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_employee_personal_info_email ON employee_personal_info(personal_email);

-- ============================================
-- EMPLOYEE OFFICIAL INFO TABLE (New - Normalized)
-- ============================================
CREATE TABLE IF NOT EXISTS employee_official_info (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  division TEXT,
  biometric_id TEXT,
  rfid_serial TEXT,
  agreement_signed BOOLEAN DEFAULT 0,
  start_date DATE,
  official_dob DATE,
  official_email TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_employee_official_info_email ON employee_official_info(official_email);
CREATE INDEX IF NOT EXISTS idx_employee_official_info_biometric ON employee_official_info(biometric_id);
CREATE INDEX IF NOT EXISTS idx_employee_official_info_division ON employee_official_info(division);

-- ============================================
-- EMPLOYEES TABLE (Restructured with Foreign Keys)
-- ============================================
CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  employee_id TEXT UNIQUE NOT NULL, -- e.g., BS0001, EMP001
  name TEXT, -- Legacy: kept for backward compatibility (can be derived from personal_info)
  status TEXT NOT NULL DEFAULT 'Active', -- 'Active' or 'Inactive'
  client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
  location_id TEXT REFERENCES locations(id) ON DELETE SET NULL,
  personal_info_id TEXT REFERENCES employee_personal_info(id) ON DELETE CASCADE,
  official_info_id TEXT REFERENCES employee_official_info(id) ON DELETE CASCADE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for employees
CREATE INDEX IF NOT EXISTS idx_employees_employee_id ON employees(employee_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);
CREATE INDEX IF NOT EXISTS idx_employees_client_id ON employees(client_id);
CREATE INDEX IF NOT EXISTS idx_employees_location_id ON employees(location_id);
CREATE INDEX IF NOT EXISTS idx_employees_personal_info_id ON employees(personal_info_id);
CREATE INDEX IF NOT EXISTS idx_employees_official_info_id ON employees(official_info_id);

-- ============================================
-- ASSETS TABLE (Enhanced with Foreign Keys)
-- ============================================
CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'Laptop', 'Desktop', 'Monitor', etc.
  status TEXT NOT NULL DEFAULT 'Available', -- 'In Use', 'Available', 'Maintenance', 'Retired'
  serial_number TEXT NOT NULL UNIQUE,
  assigned_to TEXT, -- Legacy: employee name (for backward compatibility)
  assigned_to_uuid TEXT, -- UUID foreign key
  employee_id TEXT REFERENCES employees(id) ON DELETE SET NULL, -- Primary UUID foreign key for employee assignment
  purchase_date DATE,
  acquisition_date DATE,
  warranty_expiry DATE,
  cost DECIMAL(10, 2) DEFAULT 0,
  location TEXT, -- Legacy: location name (for backward compatibility)
  location_id TEXT REFERENCES locations(id) ON DELETE SET NULL, -- UUID foreign key
  manufacturer TEXT,
  previous_tag TEXT,
  notes TEXT,
  specs TEXT, -- Store flexible asset specifications as JSON
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for assets (optimized for common queries)
CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(type);
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_location ON assets(location);
CREATE INDEX IF NOT EXISTS idx_assets_serial_number ON assets(serial_number);
CREATE INDEX IF NOT EXISTS idx_assets_location_id ON assets(location_id);
CREATE INDEX IF NOT EXISTS idx_assets_assigned_to_uuid ON assets(assigned_to_uuid);
CREATE INDEX IF NOT EXISTS idx_assets_employee_id ON assets(employee_id);
CREATE INDEX IF NOT EXISTS idx_assets_manufacturer ON assets(manufacturer);
CREATE INDEX IF NOT EXISTS idx_assets_type_status ON assets(type, status);
CREATE INDEX IF NOT EXISTS idx_assets_status_location ON assets(status, location_id);

-- ============================================
-- ASSET SPECS TABLE (New - Normalized Specs)
-- ============================================
CREATE TABLE IF NOT EXISTS asset_specs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL,
  brand TEXT,
  model TEXT,
  processor_type TEXT,
  ram_capacity TEXT, -- e.g., "16GB", "32GB"
  storage_capacity TEXT, -- e.g., "512GB SSD"
  screen_size TEXT, -- e.g., "15 inch", "27 inch"
  is_touchscreen BOOLEAN DEFAULT 0,
  printer_type TEXT, -- 'Color' or 'Monochrome' for printers
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_asset_specs_asset_id ON asset_specs(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_specs_asset_type ON asset_specs(asset_type);

-- ============================================
-- ASSET HISTORY TABLE (New - Audit Trail)
-- ============================================
CREATE TABLE IF NOT EXISTS asset_history (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  changed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_asset_history_asset_id ON asset_history(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_history_changed_at ON asset_history(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_asset_history_asset_changed ON asset_history(asset_id, changed_at DESC);

-- ============================================
-- ASSET COMMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS asset_comments (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  author_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'Note', -- 'Note' or 'System'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for comments
CREATE INDEX IF NOT EXISTS idx_asset_comments_asset_id ON asset_comments(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_comments_created_at ON asset_comments(created_at DESC);

-- ============================================
-- DEFAULT ADMIN BOOTSTRAP
-- ============================================
INSERT OR IGNORE INTO users (name, email, role, status, password_hash)
VALUES (
  'System Administrator',
  'admin@trackit.com',
  'Admin',
  'Active',
  lower(hex(randomblob(32))) -- Simple hash placeholder, should be replaced with proper hashing
);

-- ============================================
-- TRIGGERS for updated_at
-- ============================================

-- Trigger for users
CREATE TRIGGER IF NOT EXISTS update_users_updated_at
  AFTER UPDATE ON users
  FOR EACH ROW
  WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Trigger for clients
CREATE TRIGGER IF NOT EXISTS update_clients_updated_at
  AFTER UPDATE ON clients
  FOR EACH ROW
  WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE clients SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Trigger for locations
CREATE TRIGGER IF NOT EXISTS update_locations_updated_at
  AFTER UPDATE ON locations
  FOR EACH ROW
  WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE locations SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Trigger for employee_personal_info
CREATE TRIGGER IF NOT EXISTS update_employee_personal_info_updated_at
  AFTER UPDATE ON employee_personal_info
  FOR EACH ROW
  WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE employee_personal_info SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Trigger for employee_official_info
CREATE TRIGGER IF NOT EXISTS update_employee_official_info_updated_at
  AFTER UPDATE ON employee_official_info
  FOR EACH ROW
  WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE employee_official_info SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Trigger for employees
CREATE TRIGGER IF NOT EXISTS update_employees_updated_at
  AFTER UPDATE ON employees
  FOR EACH ROW
  WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE employees SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Trigger for assets
CREATE TRIGGER IF NOT EXISTS update_assets_updated_at
  AFTER UPDATE ON assets
  FOR EACH ROW
  WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE assets SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Trigger for asset_specs
CREATE TRIGGER IF NOT EXISTS update_asset_specs_updated_at
  AFTER UPDATE ON asset_specs
  FOR EACH ROW
  WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE asset_specs SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Trigger for asset history logging
CREATE TRIGGER IF NOT EXISTS log_asset_changes
  AFTER UPDATE ON assets
  FOR EACH ROW
BEGIN
  -- Log status changes
  INSERT INTO asset_history (asset_id, field_name, old_value, new_value)
  SELECT NEW.id, 'status', OLD.status, NEW.status
  WHERE OLD.status != NEW.status;

  -- Log assignment changes
  INSERT INTO asset_history (asset_id, field_name, old_value, new_value)
  SELECT NEW.id, 'assigned_to',
    CASE WHEN OLD.assigned_to IS NULL THEN 'Unassigned' ELSE OLD.assigned_to END,
    CASE WHEN NEW.assigned_to IS NULL THEN 'Unassigned' ELSE NEW.assigned_to END
  WHERE OLD.assigned_to != NEW.assigned_to;

  -- Log location changes
  INSERT INTO asset_history (asset_id, field_name, old_value, new_value)
  SELECT NEW.id, 'location_id',
    CASE WHEN OLD.location_id IS NULL THEN 'None' ELSE OLD.location_id END,
    CASE WHEN NEW.location_id IS NULL THEN 'None' ELSE NEW.location_id END
  WHERE OLD.location_id != NEW.location_id;
END;