-- Comprehensive SQL script to create all required tables for the inventory management system
-- Based on the data analysis from CSV files

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create departments table
CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create trigger for departments updated_at
CREATE OR REPLACE FUNCTION update_departments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_departments_updated_at_trigger
BEFORE UPDATE ON departments
FOR EACH ROW
EXECUTE FUNCTION update_departments_updated_at();

-- 2. Create clients table
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create trigger for clients updated_at
CREATE OR REPLACE FUNCTION update_clients_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_clients_updated_at_trigger
BEFORE UPDATE ON clients
FOR EACH ROW
EXECUTE FUNCTION update_clients_updated_at();

-- 3. Create employee_personal_info table
CREATE TABLE IF NOT EXISTS employee_personal_info (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id VARCHAR(50) UNIQUE NOT NULL,
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255),
  gender VARCHAR(10),
  mobile_number VARCHAR(20),
  emergency_contact_name VARCHAR(255),
  emergency_contact_number VARCHAR(20),
  personal_email VARCHAR(255),
  linkedin_url TEXT,
  additional_comments TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create trigger for employee_personal_info updated_at
CREATE OR REPLACE FUNCTION update_employee_personal_info_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_employee_personal_info_updated_at_trigger
BEFORE UPDATE ON employee_personal_info
FOR EACH ROW
EXECUTE FUNCTION update_employee_personal_info_updated_at();

-- 4. Create employee_official_info table (depends on employee_personal_info)
CREATE TABLE IF NOT EXISTS employee_official_info (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id VARCHAR(50) UNIQUE NOT NULL REFERENCES employee_personal_info(employee_id),
  division VARCHAR(255),
  biometric_id VARCHAR(50),
  rfid_serial VARCHAR(50),
  agreement_signed BOOLEAN DEFAULT FALSE,
  start_date DATE,
  official_dob DATE,
  official_email VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create trigger for employee_official_info updated_at
CREATE OR REPLACE FUNCTION update_employee_official_info_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_employee_official_info_updated_at_trigger
BEFORE UPDATE ON employee_official_info
FOR EACH ROW
EXECUTE FUNCTION update_employee_official_info_updated_at();

-- 5. Create assets table (enhanced for CSV data)
CREATE TABLE IF NOT EXISTS assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255),
  type VARCHAR(100) NOT NULL,
  serial_number VARCHAR(100) UNIQUE,
  purchase_date DATE,
  status VARCHAR(50) DEFAULT 'Available',
  location VARCHAR(100),
  purchase_price DECIMAL(12, 2),
  notes TEXT,
  acquisition_date DATE,
  warranty_expiry_date DATE,
  assigned_to VARCHAR(255),
  manufacturer VARCHAR(100),
  dynamic_attributes JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create trigger for assets updated_at
CREATE OR REPLACE FUNCTION update_assets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_assets_updated_at_trigger
BEFORE UPDATE ON assets
FOR EACH ROW
EXECUTE FUNCTION update_assets_updated_at();

-- Enable Row Level Security for all tables
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_personal_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_official_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for all tables
-- Departments: All authenticated users can read, Power Users and Admins can insert/update, only Admins can delete
CREATE POLICY "Authenticated users can read departments" ON departments FOR SELECT
  USING (true);
CREATE POLICY "Authenticated users can insert departments" ON departments FOR INSERT
  WITH CHECK (current_setting('app.current_user_role') IN ('Admin', 'Power User'));
CREATE POLICY "Authenticated users can update departments" ON departments FOR UPDATE
  USING (current_setting('app.current_user_role') IN ('Admin', 'Power User'));
CREATE POLICY "Only admins can delete departments" ON departments FOR DELETE
  USING (current_setting('app.current_user_role') = 'Admin');

-- Clients: All authenticated users can read, Power Users and Admins can insert/update, only Admins can delete
CREATE POLICY "Authenticated users can read clients" ON clients FOR SELECT
  USING (true);
CREATE POLICY "Authenticated users can insert clients" ON clients FOR INSERT
  WITH CHECK (current_setting('app.current_user_role') IN ('Admin', 'Power User'));
CREATE POLICY "Authenticated users can update clients" ON clients FOR UPDATE
  USING (current_setting('app.current_user_role') IN ('Admin', 'Power User'));
CREATE POLICY "Only admins can delete clients" ON clients FOR DELETE
  USING (current_setting('app.current_user_role') = 'Admin');

-- Employee Personal Info: All authenticated users can read, Power Users and Admins can insert/update, only Admins can delete
CREATE POLICY "Authenticated users can read employee personal info" ON employee_personal_info FOR SELECT
  USING (true);
CREATE POLICY "Authenticated users can insert employee personal info" ON employee_personal_info FOR INSERT
  WITH CHECK (current_setting('app.current_user_role') IN ('Admin', 'Power User'));
CREATE POLICY "Authenticated users can update employee personal info" ON employee_personal_info FOR UPDATE
  USING (current_setting('app.current_user_role') IN ('Admin', 'Power User'));
CREATE POLICY "Only admins can delete employee personal info" ON employee_personal_info FOR DELETE
  USING (current_setting('app.current_user_role') = 'Admin');

-- Employee Official Info: All authenticated users can read, Power Users and Admins can insert/update, only Admins can delete
CREATE POLICY "Authenticated users can read employee official info" ON employee_official_info FOR SELECT
  USING (true);
CREATE POLICY "Authenticated users can insert employee official info" ON employee_official_info FOR INSERT
  WITH CHECK (current_setting('app.current_user_role') IN ('Admin', 'Power User'));
CREATE POLICY "Authenticated users can update employee official info" ON employee_official_info FOR UPDATE
  USING (current_setting('app.current_user_role') IN ('Admin', 'Power User'));
CREATE POLICY "Only admins can delete employee official info" ON employee_official_info FOR DELETE
  USING (current_setting('app.current_user_role') = 'Admin');

-- Assets: All authenticated users can read, Power Users and Admins can insert/update, only Admins can delete
CREATE POLICY "Authenticated users can read assets" ON assets FOR SELECT
  USING (true);
CREATE POLICY "Authenticated users can insert assets" ON assets FOR INSERT
  WITH CHECK (current_setting('app.current_user_role') IN ('Admin', 'Power User'));
CREATE POLICY "Authenticated users can update assets" ON assets FOR UPDATE
  USING (current_setting('app.current_user_role') IN ('Admin', 'Power User'));
CREATE POLICY "Only admins can delete assets" ON assets FOR DELETE
  USING (current_setting('app.current_user_role') = 'Admin');

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_employee_personal_info_employee_id ON employee_personal_info(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_official_info_employee_id ON employee_official_info(employee_id);
CREATE INDEX IF NOT EXISTS idx_assets_serial_number ON assets(serial_number);
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_location ON assets(location);