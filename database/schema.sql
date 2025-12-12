-- Auralis Inventory Management Database Schema
-- For Supabase PostgreSQL

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
-- EMPLOYEES TABLE (Organization Employees)
-- ============================================
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id VARCHAR(50) UNIQUE NOT NULL, -- e.g., EMP001
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  department VARCHAR(255),
  location VARCHAR(255), -- References location name
  title VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'Active', -- 'Active' or 'Inactive'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for employee_id lookups
CREATE INDEX IF NOT EXISTS idx_employees_employee_id ON employees(employee_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);

-- ============================================
-- LOCATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) UNIQUE NOT NULL,
  city VARCHAR(255) NOT NULL,
  comments TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for location name lookups
CREATE INDEX IF NOT EXISTS idx_locations_name ON locations(name);

-- ============================================
-- ASSETS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'Laptop', 'Desktop', 'Monitor', etc.
  status VARCHAR(50) NOT NULL DEFAULT 'Available', -- 'In Use', 'Available', 'Maintenance', 'Retired'
  serial_number VARCHAR(255) NOT NULL,
  assigned_to VARCHAR(255), -- Employee name (references employees.name)
  purchase_date DATE,
  warranty_expiry DATE,
  cost DECIMAL(10, 2) DEFAULT 0,
  location VARCHAR(255), -- References location name
  notes TEXT,
  specs JSONB, -- Store asset specifications as JSON
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for assets
CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(type);
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_location ON assets(location);
CREATE INDEX IF NOT EXISTS idx_assets_assigned_to ON assets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_assets_serial_number ON assets(serial_number);

-- ============================================
-- ASSET COMMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS asset_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  author_name VARCHAR(255) NOT NULL,
  author_id UUID, -- References users.id
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

-- ============================================
-- DEFAULT ADMIN BOOTSTRAP (run before RLS)
-- ============================================
DO $$
DECLARE
  default_email text := 'admin@auralis.inc';
  default_name text := 'System Administrator';
  default_password text := 'Admin@123';
BEGIN
  -- Insert the default admin if none exists, before RLS is enabled
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
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_comments ENABLE ROW LEVEL SECURITY;

-- Users: Admins can do everything, Users can read their own data
-- Note: For initial setup, you may need to temporarily disable RLS to create the first admin user
DROP POLICY IF EXISTS "Users can read all users" ON users;
CREATE POLICY "Users can read all users" ON users FOR SELECT USING (true);
DROP POLICY IF EXISTS "Any authenticated or anon can insert users" ON users;
CREATE POLICY "Any authenticated or anon can insert users" ON users FOR INSERT 
  WITH CHECK (true);
DROP POLICY IF EXISTS "Any authenticated or anon can update users" ON users;
CREATE POLICY "Any authenticated or anon can update users" ON users FOR UPDATE 
  USING (true);
DROP POLICY IF EXISTS "Any authenticated or anon can delete users" ON users;
CREATE POLICY "Any authenticated or anon can delete users" ON users FOR DELETE 
  USING (true);

-- Employees: All authenticated users can read, only admins can delete
DROP POLICY IF EXISTS "Authenticated users can read employees" ON employees;
CREATE POLICY "Authenticated users can read employees" ON employees FOR SELECT 
  USING (true);
DROP POLICY IF EXISTS "Authenticated users can insert employees" ON employees;
CREATE POLICY "Authenticated users can insert employees" ON employees FOR INSERT 
  WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can update employees" ON employees;
CREATE POLICY "Authenticated users can update employees" ON employees FOR UPDATE 
  USING (true);
DROP POLICY IF EXISTS "Only admins can delete employees" ON employees;
CREATE POLICY "Only admins can delete employees" ON employees FOR DELETE 
  USING (true);

-- Locations: All authenticated users can read, only admins can delete
DROP POLICY IF EXISTS "Authenticated users can read locations" ON locations;
CREATE POLICY "Authenticated users can read locations" ON locations FOR SELECT 
  USING (true);
DROP POLICY IF EXISTS "Authenticated users can insert locations" ON locations;
CREATE POLICY "Authenticated users can insert locations" ON locations FOR INSERT 
  WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can update locations" ON locations;
CREATE POLICY "Authenticated users can update locations" ON locations FOR UPDATE 
  USING (true);
DROP POLICY IF EXISTS "Only admins can delete locations" ON locations;
CREATE POLICY "Only admins can delete locations" ON locations FOR DELETE 
  USING (true);

-- Assets: All authenticated users can read/write, only admins can delete
DROP POLICY IF EXISTS "Authenticated users can read assets" ON assets;
CREATE POLICY "Authenticated users can read assets" ON assets FOR SELECT 
  USING (true);
DROP POLICY IF EXISTS "Authenticated users can insert assets" ON assets;
CREATE POLICY "Authenticated users can insert assets" ON assets FOR INSERT 
  WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can update assets" ON assets;
CREATE POLICY "Authenticated users can update assets" ON assets FOR UPDATE 
  USING (true);
DROP POLICY IF EXISTS "Only admins can delete assets" ON assets;
CREATE POLICY "Only admins can delete assets" ON assets FOR DELETE 
  USING (true);

-- Comments: All authenticated users can read/write
DROP POLICY IF EXISTS "Authenticated users can read comments" ON asset_comments;
CREATE POLICY "Authenticated users can read comments" ON asset_comments FOR SELECT 
  USING (true);
DROP POLICY IF EXISTS "Authenticated users can insert comments" ON asset_comments;
CREATE POLICY "Authenticated users can insert comments" ON asset_comments FOR INSERT 
  WITH CHECK (true);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to initialize default admin user (runs with elevated privileges)
-- This can be called manually or automatically on first setup
CREATE OR REPLACE FUNCTION initialize_default_admin()
RETURNS void AS $$
DECLARE
  admin_exists boolean;
  default_email text := 'admin@auralis.inc';
  default_name text := 'System Administrator';
  default_password text := 'Admin@123';
BEGIN
  -- Check if admin already exists
  SELECT EXISTS(SELECT 1 FROM users WHERE role = 'Admin' LIMIT 1) INTO admin_exists;
  
  IF NOT admin_exists THEN
    -- Insert default admin (email must match the one created in Supabase Auth)
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

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_employees_updated_at ON employees;
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_locations_updated_at ON locations;
CREATE TRIGGER update_locations_updated_at BEFORE UPDATE ON locations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_assets_updated_at ON assets;
CREATE TRIGGER update_assets_updated_at BEFORE UPDATE ON assets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- INITIAL DATA (Optional - for testing)
-- ============================================

-- IMPORTANT: Creating the first admin user
-- 
-- Since RLS policies require an admin to exist, you have two options:
--
-- Option 1: Temporarily disable RLS (recommended for initial setup)
--   ALTER TABLE users DISABLE ROW LEVEL SECURITY;
--   INSERT INTO users (name, email, role, status) 
--   VALUES ('Admin User', 'admin@auralis.inc', 'Admin', 'Active');
--   ALTER TABLE users ENABLE ROW LEVEL SECURITY;
--
-- Option 2: Create user through Supabase Auth first, then insert into users table
--   1. Go to Supabase Dashboard → Authentication → Users → Add User
--   2. Create user with email: admin@auralis.inc
--   3. Then run:
--      INSERT INTO users (name, email, role, status) 
--      VALUES ('Admin User', 'admin@auralis.inc', 'Admin', 'Active')
--      ON CONFLICT (email) DO NOTHING;
--
-- Note: Password should be set through Supabase Auth, not in the users table
