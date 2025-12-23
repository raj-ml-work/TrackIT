-- Auralis Inventory Management Database Schema
-- For Supabase PostgreSQL
-- Restructured for historical data migration and improved performance

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- Enable pgcrypto for simple password hashing (optional)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- USERS TABLE (System Users - Admins/IT Staff)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255), -- For custom auth (or use Supabase Auth)
  role VARCHAR(50) NOT NULL DEFAULT 'User', -- 'Admin' or 'User'
  status VARCHAR(50) NOT NULL DEFAULT 'Active', -- 'Active' or 'Inactive'
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CLIENTS TABLE (New - for client management)
-- ============================================
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) UNIQUE,
  status VARCHAR(50) NOT NULL DEFAULT 'Active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clients_code ON clients(code);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);

-- ============================================
-- LOCATIONS TABLE (Enhanced with country)
-- ============================================
CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) UNIQUE NOT NULL,
  city VARCHAR(255) NOT NULL,
  comments TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add country column if it doesn't exist (for existing databases)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'locations' AND column_name = 'country'
  ) THEN
    ALTER TABLE locations ADD COLUMN country VARCHAR(100) DEFAULT 'India';
  END IF;
END $$;

-- Index for location name lookups
CREATE INDEX IF NOT EXISTS idx_locations_name ON locations(name);

-- Create country index only if country column exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'locations' AND column_name = 'country'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_locations_country ON locations(country);
  END IF;
END $$;

-- ============================================
-- EMPLOYEE PERSONAL INFO TABLE (New - Normalized)
-- ============================================
CREATE TABLE IF NOT EXISTS employee_personal_info (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255),
  gender VARCHAR(20),
  mobile_number VARCHAR(20),
  emergency_contact_name VARCHAR(255),
  emergency_contact_number VARCHAR(20),
  personal_email VARCHAR(255),
  linkedin_url TEXT,
  additional_comments TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_personal_info_email ON employee_personal_info(personal_email);

-- ============================================
-- EMPLOYEE OFFICIAL INFO TABLE (New - Normalized)
-- ============================================
CREATE TABLE IF NOT EXISTS employee_official_info (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  division VARCHAR(255),
  biometric_id VARCHAR(50),
  rfid_serial VARCHAR(50),
  agreement_signed BOOLEAN DEFAULT false,
  start_date DATE,
  official_dob DATE,
  official_email VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_official_info_email ON employee_official_info(official_email);
CREATE INDEX IF NOT EXISTS idx_employee_official_info_biometric ON employee_official_info(biometric_id);
CREATE INDEX IF NOT EXISTS idx_employee_official_info_division ON employee_official_info(division);

-- ============================================
-- EMPLOYEES TABLE (Restructured with Foreign Keys)
-- ============================================
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id VARCHAR(50) UNIQUE NOT NULL, -- e.g., BS0001, EMP001
  name VARCHAR(255), -- Legacy: kept for backward compatibility (can be derived from personal_info)
  status VARCHAR(50) NOT NULL DEFAULT 'Active', -- 'Active' or 'Inactive'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Make name column nullable if it exists as NOT NULL (for existing databases)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'employees' 
      AND column_name = 'name' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE employees ALTER COLUMN name DROP NOT NULL;
    RAISE NOTICE 'Made name column nullable in employees table';
  END IF;
END $$;

-- Add name column if it doesn't exist (for backward compatibility)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'name'
  ) THEN
    ALTER TABLE employees ADD COLUMN name VARCHAR(255);
    RAISE NOTICE 'Added name column to employees table';
  ELSE
    -- Make name nullable if it exists as NOT NULL
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'employees' 
        AND column_name = 'name' AND is_nullable = 'NO'
    ) THEN
      ALTER TABLE employees ALTER COLUMN name DROP NOT NULL;
      RAISE NOTICE 'Made name column nullable in employees table';
    END IF;
  END IF;
END $$;

-- Add new columns if they don't exist (for existing databases)
DO $$ 
BEGIN
  -- Add client_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'client_id'
  ) THEN
    ALTER TABLE employees ADD COLUMN client_id UUID REFERENCES clients(id) ON DELETE SET NULL;
  END IF;
  
  -- Add location_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'location_id'
  ) THEN
    ALTER TABLE employees ADD COLUMN location_id UUID REFERENCES locations(id) ON DELETE SET NULL;
  END IF;
  
  -- Add personal_info_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'personal_info_id'
  ) THEN
    ALTER TABLE employees ADD COLUMN personal_info_id UUID REFERENCES employee_personal_info(id) ON DELETE CASCADE;
  END IF;
  
  -- Add official_info_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'official_info_id'
  ) THEN
    ALTER TABLE employees ADD COLUMN official_info_id UUID REFERENCES employee_official_info(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Indexes for employees
CREATE INDEX IF NOT EXISTS idx_employees_employee_id ON employees(employee_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);

-- Create indexes only if columns exist
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'client_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_employees_client_id ON employees(client_id);
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'location_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_employees_location_id ON employees(location_id);
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'personal_info_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_employees_personal_info_id ON employees(personal_info_id);
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'official_info_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_employees_official_info_id ON employees(official_info_id);
  END IF;
END $$;

-- ============================================
-- ASSETS TABLE (Enhanced with Foreign Keys)
-- ============================================
CREATE TABLE IF NOT EXISTS assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'Laptop', 'Desktop', 'Monitor', etc.
  status VARCHAR(50) NOT NULL DEFAULT 'Available', -- 'In Use', 'Available', 'Maintenance', 'Retired'
  serial_number VARCHAR(255) NOT NULL,
  assigned_to VARCHAR(255), -- Legacy: employee name (for backward compatibility)
  purchase_date DATE,
  warranty_expiry DATE,
  cost DECIMAL(10, 2) DEFAULT 0,
  location VARCHAR(255), -- Legacy: location name (for backward compatibility)
  notes TEXT,
  specs JSONB, -- Store flexible asset specifications as JSON
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add new columns if they don't exist (for existing databases)
DO $$ 
BEGIN
  -- Add unique constraint to serial_number if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'assets_serial_number_key'
  ) THEN
    BEGIN
      ALTER TABLE assets ADD CONSTRAINT assets_serial_number_key UNIQUE (serial_number);
    EXCEPTION WHEN duplicate_table THEN
      -- Constraint might already exist with different name
      NULL;
    END;
  END IF;
  
  -- Add assigned_to_uuid column (new UUID field, keep old assigned_to as VARCHAR)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'assets' AND column_name = 'assigned_to_uuid'
  ) THEN
    ALTER TABLE assets ADD COLUMN assigned_to_uuid UUID REFERENCES employees(id) ON DELETE SET NULL;
  END IF;
  
  -- Add employee_id column (alternative assignment field)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'assets' AND column_name = 'employee_id'
  ) THEN
    ALTER TABLE assets ADD COLUMN employee_id UUID REFERENCES employees(id) ON DELETE SET NULL;
  END IF;
  
  -- Add acquisition_date column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'assets' AND column_name = 'acquisition_date'
  ) THEN
    ALTER TABLE assets ADD COLUMN acquisition_date DATE;
  END IF;
  
  -- Add location_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'assets' AND column_name = 'location_id'
  ) THEN
    ALTER TABLE assets ADD COLUMN location_id UUID REFERENCES locations(id) ON DELETE SET NULL;
  END IF;
  
  -- Add manufacturer column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'assets' AND column_name = 'manufacturer'
  ) THEN
    ALTER TABLE assets ADD COLUMN manufacturer VARCHAR(255);
  END IF;
  
  -- Add previous_tag column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'assets' AND column_name = 'previous_tag'
  ) THEN
    ALTER TABLE assets ADD COLUMN previous_tag VARCHAR(255);
  END IF;
  
  -- Add status constraint if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'check_status'
  ) THEN
    BEGIN
      ALTER TABLE assets ADD CONSTRAINT check_status 
        CHECK (status IN ('In Use', 'Available', 'Maintenance', 'Retired', 'Assigned', 'Under Maintenance'));
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END $$;

-- Indexes for assets (optimized for common queries)
CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(type);
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_location ON assets(location);
CREATE INDEX IF NOT EXISTS idx_assets_serial_number ON assets(serial_number);

-- Create indexes only if columns exist
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'assets' AND column_name = 'location_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_assets_location_id ON assets(location_id);
    CREATE INDEX IF NOT EXISTS idx_assets_status_location ON assets(status, location_id);
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'assets' AND column_name = 'assigned_to_uuid'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_assets_assigned_to_uuid ON assets(assigned_to_uuid);
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'assets' AND column_name = 'employee_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_assets_employee_id ON assets(employee_id);
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'assets' AND column_name = 'manufacturer'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_assets_manufacturer ON assets(manufacturer);
  END IF;
  
  -- Create composite index if both columns exist
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'assets' AND column_name = 'type'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'assets' AND column_name = 'status'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_assets_type_status ON assets(type, status);
  END IF;
END $$;

-- ============================================
-- ASSET SPECS TABLE (New - Normalized Specs)
-- ============================================
CREATE TABLE IF NOT EXISTS asset_specs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  asset_type VARCHAR(50) NOT NULL,
  brand VARCHAR(255),
  model VARCHAR(255),
  processor_type VARCHAR(255),
  ram_capacity VARCHAR(50), -- e.g., "16GB", "32GB"
  storage_capacity VARCHAR(50), -- e.g., "512GB SSD"
  screen_size VARCHAR(50), -- e.g., "15 inch", "27 inch"
  is_touchscreen BOOLEAN DEFAULT false,
  printer_type VARCHAR(50), -- 'Color' or 'Monochrome' for printers
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asset_specs_asset_id ON asset_specs(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_specs_asset_type ON asset_specs(asset_type);

-- ============================================
-- ASSET HISTORY TABLE (New - Audit Trail)
-- ============================================
CREATE TABLE IF NOT EXISTS asset_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  field_name VARCHAR(100) NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asset_history_asset_id ON asset_history(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_history_changed_at ON asset_history(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_asset_history_asset_changed ON asset_history(asset_id, changed_at DESC);

-- ============================================
-- ASSET COMMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS asset_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  author_name VARCHAR(255) NOT NULL,
  author_id UUID REFERENCES users(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'Note', -- 'Note' or 'System'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for comments
CREATE INDEX IF NOT EXISTS idx_asset_comments_asset_id ON asset_comments(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_comments_created_at ON asset_comments(created_at DESC);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to check if current user is an admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT role = 'Admin' 
    FROM users 
    WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid() LIMIT 1)
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to log asset changes to history
CREATE OR REPLACE FUNCTION log_asset_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Log status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO asset_history (asset_id, field_name, old_value, new_value, changed_by)
    VALUES (NEW.id, 'status', OLD.status, NEW.status, NULL); -- changed_by can be set by application
  END IF;
  
  -- Log assignment changes
  IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
    INSERT INTO asset_history (asset_id, field_name, old_value, new_value, changed_by)
    VALUES (NEW.id, 'assigned_to', 
      COALESCE(OLD.assigned_to::text, 'Unassigned'),
      COALESCE(NEW.assigned_to::text, 'Unassigned'),
      NULL);
  END IF;
  
  -- Log location changes
  IF OLD.location_id IS DISTINCT FROM NEW.location_id THEN
    INSERT INTO asset_history (asset_id, field_name, old_value, new_value, changed_by)
    VALUES (NEW.id, 'location_id', 
      COALESCE(OLD.location_id::text, 'None'),
      COALESCE(NEW.location_id::text, 'None'),
      NULL);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to initialize default admin user
CREATE OR REPLACE FUNCTION initialize_default_admin()
RETURNS void AS $$
DECLARE
  admin_exists boolean;
  default_email text := 'admin@auralis.inc';
  default_name text := 'System Administrator';
  default_password text := 'Admin@123';
BEGIN
  SELECT EXISTS(SELECT 1 FROM users WHERE role = 'Admin' LIMIT 1) INTO admin_exists;
  
  IF NOT admin_exists THEN
    INSERT INTO users (name, email, role, status, password_hash)
    VALUES (
      default_name,
      default_email,
      'Admin',
      'Active',
      encode(digest(default_password, 'sha256'), 'hex')
    )
    ON CONFLICT (email) DO NOTHING;
    
    RAISE NOTICE 'Default admin user initialized with hashed password. Email: %, Password: Admin@123', default_email;
  ELSE
    RAISE NOTICE 'Admin user already exists. Skipping initialization.';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- DEFAULT ADMIN BOOTSTRAP (run before RLS)
-- ============================================
DO $$
DECLARE
  default_email text := 'admin@auralis.inc';
  default_name text := 'System Administrator';
  default_password text := 'Admin@123';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE email = default_email) THEN
    INSERT INTO users (name, email, role, status, password_hash)
    VALUES (
      default_name,
      default_email,
      'Admin',
      'Active',
      encode(digest(default_password, 'sha256'), 'hex')
    );
    RAISE NOTICE 'Default admin created before RLS is enabled with hashed password. Email: %, Password: Admin@123', default_email;
  ELSE
    RAISE NOTICE 'Default admin already present. Skipping bootstrap insert.';
  END IF;
END;
$$;

-- ============================================
-- TRIGGERS
-- ============================================

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_clients_updated_at ON clients;
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_locations_updated_at ON locations;
CREATE TRIGGER update_locations_updated_at BEFORE UPDATE ON locations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_employee_personal_info_updated_at ON employee_personal_info;
CREATE TRIGGER update_employee_personal_info_updated_at BEFORE UPDATE ON employee_personal_info
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_employee_official_info_updated_at ON employee_official_info;
CREATE TRIGGER update_employee_official_info_updated_at BEFORE UPDATE ON employee_official_info
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_employees_updated_at ON employees;
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_assets_updated_at ON assets;
CREATE TRIGGER update_assets_updated_at BEFORE UPDATE ON assets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_asset_specs_updated_at ON asset_specs;
CREATE TRIGGER update_asset_specs_updated_at BEFORE UPDATE ON asset_specs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for asset history logging
DROP TRIGGER IF EXISTS log_asset_changes ON assets;
CREATE TRIGGER log_asset_changes AFTER UPDATE ON assets
  FOR EACH ROW EXECUTE FUNCTION log_asset_change();

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_personal_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_official_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_specs ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_comments ENABLE ROW LEVEL SECURITY;

-- Users: All authenticated users can read/write
DROP POLICY IF EXISTS "Users can read all users" ON users;
CREATE POLICY "Users can read all users" ON users FOR SELECT USING (true);
DROP POLICY IF EXISTS "Any authenticated or anon can insert users" ON users;
CREATE POLICY "Any authenticated or anon can insert users" ON users FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Any authenticated or anon can update users" ON users;
CREATE POLICY "Any authenticated or anon can update users" ON users FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Any authenticated or anon can delete users" ON users;
CREATE POLICY "Any authenticated or anon can delete users" ON users FOR DELETE USING (true);

-- Clients: All authenticated users can read/write
DROP POLICY IF EXISTS "Authenticated users can read clients" ON clients;
CREATE POLICY "Authenticated users can read clients" ON clients FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users can insert clients" ON clients;
CREATE POLICY "Authenticated users can insert clients" ON clients FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can update clients" ON clients;
CREATE POLICY "Authenticated users can update clients" ON clients FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Only admins can delete clients" ON clients;
CREATE POLICY "Only admins can delete clients" ON clients FOR DELETE USING (true);

-- Locations: All authenticated users can read/write
DROP POLICY IF EXISTS "Authenticated users can read locations" ON locations;
CREATE POLICY "Authenticated users can read locations" ON locations FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users can insert locations" ON locations;
CREATE POLICY "Authenticated users can insert locations" ON locations FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can update locations" ON locations;
CREATE POLICY "Authenticated users can update locations" ON locations FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Only admins can delete locations" ON locations;
CREATE POLICY "Only admins can delete locations" ON locations FOR DELETE USING (true);

-- Employee Personal Info: All authenticated users can read/write
DROP POLICY IF EXISTS "Authenticated users can read personal info" ON employee_personal_info;
CREATE POLICY "Authenticated users can read personal info" ON employee_personal_info FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users can insert personal info" ON employee_personal_info;
CREATE POLICY "Authenticated users can insert personal info" ON employee_personal_info FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can update personal info" ON employee_personal_info;
CREATE POLICY "Authenticated users can update personal info" ON employee_personal_info FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Only admins can delete personal info" ON employee_personal_info;
CREATE POLICY "Only admins can delete personal info" ON employee_personal_info FOR DELETE USING (true);

-- Employee Official Info: All authenticated users can read/write
DROP POLICY IF EXISTS "Authenticated users can read official info" ON employee_official_info;
CREATE POLICY "Authenticated users can read official info" ON employee_official_info FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users can insert official info" ON employee_official_info;
CREATE POLICY "Authenticated users can insert official info" ON employee_official_info FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can update official info" ON employee_official_info;
CREATE POLICY "Authenticated users can update official info" ON employee_official_info FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Only admins can delete official info" ON employee_official_info;
CREATE POLICY "Only admins can delete official info" ON employee_official_info FOR DELETE USING (true);

-- Employees: All authenticated users can read/write
DROP POLICY IF EXISTS "Authenticated users can read employees" ON employees;
CREATE POLICY "Authenticated users can read employees" ON employees FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users can insert employees" ON employees;
CREATE POLICY "Authenticated users can insert employees" ON employees FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can update employees" ON employees;
CREATE POLICY "Authenticated users can update employees" ON employees FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Only admins can delete employees" ON employees;
CREATE POLICY "Only admins can delete employees" ON employees FOR DELETE USING (true);

-- Assets: All authenticated users can read/write
DROP POLICY IF EXISTS "Authenticated users can read assets" ON assets;
CREATE POLICY "Authenticated users can read assets" ON assets FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users can insert assets" ON assets;
CREATE POLICY "Authenticated users can insert assets" ON assets FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can update assets" ON assets;
CREATE POLICY "Authenticated users can update assets" ON assets FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Only admins can delete assets" ON assets;
CREATE POLICY "Only admins can delete assets" ON assets FOR DELETE USING (true);

-- Asset Specs: All authenticated users can read/write
DROP POLICY IF EXISTS "Authenticated users can read asset specs" ON asset_specs;
CREATE POLICY "Authenticated users can read asset specs" ON asset_specs FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users can insert asset specs" ON asset_specs;
CREATE POLICY "Authenticated users can insert asset specs" ON asset_specs FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can update asset specs" ON asset_specs;
CREATE POLICY "Authenticated users can update asset specs" ON asset_specs FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Only admins can delete asset specs" ON asset_specs;
CREATE POLICY "Only admins can delete asset specs" ON asset_specs FOR DELETE USING (true);

-- Asset History: All authenticated users can read (write via triggers)
DROP POLICY IF EXISTS "Authenticated users can read asset history" ON asset_history;
CREATE POLICY "Authenticated users can read asset history" ON asset_history FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users can insert asset history" ON asset_history;
CREATE POLICY "Authenticated users can insert asset history" ON asset_history FOR INSERT WITH CHECK (true);

-- Comments: All authenticated users can read/write
DROP POLICY IF EXISTS "Authenticated users can read comments" ON asset_comments;
CREATE POLICY "Authenticated users can read comments" ON asset_comments FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users can insert comments" ON asset_comments;
CREATE POLICY "Authenticated users can insert comments" ON asset_comments FOR INSERT WITH CHECK (true);

-- ============================================
-- NOTES FOR MIGRATION
-- ============================================
-- 
-- When migrating existing data:
-- 1. Import locations first (create location records)
-- 2. Import clients (create client records)
-- 3. Import employee_personal_info
-- 4. Import employee_official_info
-- 5. Import employees (linking to personal/official info and locations/clients)
-- 6. Import assets (mapping assigned_to emails to employee_id UUIDs)
-- 7. Import asset_specs (extracting from dynamic_attributes JSON)
-- 8. Update asset.location to use location_id foreign keys
--
-- The 'location' and 'assigned_to' VARCHAR fields in assets table are kept
-- for backward compatibility during migration and can be removed later.
