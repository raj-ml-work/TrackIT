-- Data Migration Script for Historical CSV Data
-- This script imports data from CSV exports into the restructured schema
--
-- Prerequisites:
-- 1. CSV files should be placed in a location accessible by PostgreSQL
-- 2. Run this script after the new schema.sql has been applied
-- 3. Adjust file paths as needed for your environment
--
-- Note: This script uses PostgreSQL COPY command which requires:
-- - CSV files to be accessible by the PostgreSQL server
-- - Proper permissions on the files
-- - CSV files to match the expected format

-- ============================================
-- STEP 1: Import Employee Personal Info
-- ============================================
-- Assumes CSV file: 02_employee_personal_info.csv
-- Columns: id, first_name, last_name, gender, mobile_number, emergency_contact_name, 
--          emergency_contact_number, personal_email, linkedin_url, additional_comments

-- Create temporary table for import
CREATE TEMP TABLE temp_employee_personal_info (
  id VARCHAR(255),
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  gender VARCHAR(20),
  mobile_number VARCHAR(20),
  emergency_contact_name VARCHAR(255),
  emergency_contact_number VARCHAR(20),
  personal_email VARCHAR(255),
  linkedin_url TEXT,
  additional_comments TEXT
);

-- Import CSV (adjust path as needed)
-- COPY temp_employee_personal_info FROM '/path/to/02_employee_personal_info.csv' 
-- WITH (FORMAT csv, HEADER true, DELIMITER ',');

-- Insert into actual table (mapping old IDs to new UUIDs)
CREATE TEMP TABLE personal_info_id_mapping (
  old_id VARCHAR(255),
  new_id UUID
);

INSERT INTO employee_personal_info (
  first_name, last_name, gender, mobile_number, 
  emergency_contact_name, emergency_contact_number, 
  personal_email, linkedin_url, additional_comments
)
SELECT 
  first_name, last_name, gender, mobile_number,
  emergency_contact_name, emergency_contact_number,
  personal_email, linkedin_url, additional_comments
FROM temp_employee_personal_info
ON CONFLICT DO NOTHING
RETURNING id, first_name || ' ' || COALESCE(last_name, '') as lookup;

-- Map old IDs to new UUIDs (this is a simplified version - adjust based on your CSV structure)
-- In practice, you may need to match by name or other unique identifier

-- ============================================
-- STEP 2: Import Employee Official Info
-- ============================================
-- Assumes CSV file: 03_employee_official_info.csv
-- Columns: id, division, biometric_id, rfid_serial, agreement_signed, 
--          start_date, official_dob, official_email

CREATE TEMP TABLE temp_employee_official_info (
  id VARCHAR(255),
  division VARCHAR(255),
  biometric_id VARCHAR(50),
  rfid_serial VARCHAR(50),
  agreement_signed VARCHAR(10), -- 'true'/'false' or '1'/'0'
  start_date DATE,
  official_dob DATE,
  official_email VARCHAR(255)
);

-- COPY temp_employee_official_info FROM '/path/to/03_employee_official_info.csv' 
-- WITH (FORMAT csv, HEADER true, DELIMITER ',');

CREATE TEMP TABLE official_info_id_mapping (
  old_id VARCHAR(255),
  new_id UUID
);

INSERT INTO employee_official_info (
  division, biometric_id, rfid_serial, agreement_signed,
  start_date, official_dob, official_email
)
SELECT 
  division, biometric_id, rfid_serial,
  CASE 
    WHEN LOWER(agreement_signed) IN ('true', '1', 'yes') THEN true
    ELSE false
  END,
  start_date, official_dob, official_email
FROM temp_employee_official_info
ON CONFLICT DO NOTHING
RETURNING id, official_email as lookup;

-- ============================================
-- STEP 3: Import Locations (if not already imported)
-- ============================================
-- Extract unique locations from assets CSV and create location records
-- This should be done before importing assets

-- ============================================
-- STEP 4: Import Clients (if needed)
-- ============================================
-- Extract unique client_ids from employees CSV and create client records

-- ============================================
-- STEP 5: Import Employees
-- ============================================
-- Assumes CSV file: 05_employees.csv
-- Columns: id, employee_id, client_id, location, personal_info_id, official_info_id

CREATE TEMP TABLE temp_employees (
  id VARCHAR(255),
  employee_id VARCHAR(50),
  client_id VARCHAR(255),
  location VARCHAR(255), -- Location name, not ID
  personal_info_id VARCHAR(255), -- Old ID, needs mapping
  official_info_id VARCHAR(255)  -- Old ID, needs mapping
);

-- COPY temp_employees FROM '/path/to/05_employees.csv' 
-- WITH (FORMAT csv, HEADER true, DELIMITER ',');

-- First, create location records for any missing locations
INSERT INTO locations (name, city, country)
SELECT DISTINCT 
  location,
  'Unknown' as city, -- Adjust based on your data
  'India' as country  -- Adjust based on your data
FROM temp_employees
WHERE location IS NOT NULL AND location != ''
ON CONFLICT (name) DO NOTHING;

-- Create client records if needed
INSERT INTO clients (name, code, status)
SELECT DISTINCT 
  client_id as name,
  client_id as code,
  'Active' as status
FROM temp_employees
WHERE client_id IS NOT NULL AND client_id != ''
ON CONFLICT (code) DO NOTHING;

-- Now insert employees with proper foreign key mappings
INSERT INTO employees (
  employee_id, client_id, location_id, 
  personal_info_id, official_info_id, status
)
SELECT 
  e.employee_id,
  c.id as client_id,
  l.id as location_id,
  pi_mapping.new_id as personal_info_id,
  oi_mapping.new_id as official_info_id,
  'Active' as status
FROM temp_employees e
LEFT JOIN clients c ON c.code = e.client_id
LEFT JOIN locations l ON l.name = e.location
LEFT JOIN personal_info_id_mapping pi_mapping ON pi_mapping.old_id = e.personal_info_id
LEFT JOIN official_info_id_mapping oi_mapping ON oi_mapping.old_id = e.official_info_id
WHERE e.employee_id IS NOT NULL AND e.employee_id != ''
ON CONFLICT (employee_id) DO NOTHING;

-- ============================================
-- STEP 6: Import Assets
-- ============================================
-- Assumes CSV file: 06_assets.csv
-- Columns: id, name, type, serial_number, purchase_date, status, location, 
--          purchase_price, notes, acquisition_date, warranty_expiry_date, 
--          assigned_to (email), dynamic_attributes (JSON), manufacturer, employee_id

CREATE TEMP TABLE temp_assets (
  id VARCHAR(255),
  name VARCHAR(255),
  type VARCHAR(50),
  serial_number VARCHAR(255),
  purchase_date DATE,
  status VARCHAR(50),
  location VARCHAR(255), -- Location name
  purchase_price DECIMAL(10, 2),
  notes TEXT,
  acquisition_date DATE,
  warranty_expiry_date DATE,
  assigned_to VARCHAR(255), -- Employee email or name
  dynamic_attributes TEXT, -- JSON string
  manufacturer VARCHAR(255),
  employee_id VARCHAR(255) -- Old employee ID, needs mapping
);

-- COPY temp_assets FROM '/path/to/06_assets.csv' 
-- WITH (FORMAT csv, HEADER true, DELIMITER ',');

-- Create location records for any missing locations from assets
INSERT INTO locations (name, city, country)
SELECT DISTINCT 
  location,
  'Unknown' as city,
  'India' as country
FROM temp_assets
WHERE location IS NOT NULL AND location != ''
ON CONFLICT (name) DO NOTHING;

-- Insert assets
INSERT INTO assets (
  name, type, status, serial_number,
  purchase_date, acquisition_date, warranty_expiry,
  cost, location_id, location, -- Keep both for migration
  manufacturer, notes, specs,
  assigned_to, employee_id -- Will be updated below
)
SELECT 
  a.name,
  a.type,
  COALESCE(a.status, 'Available') as status,
  a.serial_number,
  a.purchase_date,
  a.acquisition_date,
  a.warranty_expiry_date,
  COALESCE(a.purchase_price, 0) as cost,
  l.id as location_id,
  a.location, -- Keep for backward compatibility
  a.manufacturer,
  a.notes,
  CASE 
    WHEN a.dynamic_attributes IS NOT NULL AND a.dynamic_attributes != '' 
    THEN a.dynamic_attributes::jsonb
    ELSE NULL
  END as specs,
  NULL as assigned_to, -- Will be set below
  NULL as employee_id  -- Will be set below
FROM temp_assets a
LEFT JOIN locations l ON l.name = a.location
WHERE a.serial_number IS NOT NULL AND a.serial_number != ''
ON CONFLICT (serial_number) DO UPDATE
SET 
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  status = EXCLUDED.status,
  location_id = EXCLUDED.location_id,
  location = EXCLUDED.location,
  manufacturer = EXCLUDED.manufacturer,
  notes = EXCLUDED.notes,
  specs = EXCLUDED.specs;

-- Update asset assignments based on employee email or employee_id
-- Match by official_email or personal_email
UPDATE assets a
SET 
  assigned_to = e.id,
  employee_id = e.id
FROM temp_assets ta
LEFT JOIN employees e ON (
  e.id IN (
    SELECT emp.id 
    FROM employees emp
    JOIN employee_official_info oi ON oi.id = emp.official_info_id
    JOIN employee_personal_info pi ON pi.id = emp.personal_info_id
    WHERE oi.official_email = ta.assigned_to 
       OR pi.personal_email = ta.assigned_to
       OR emp.employee_id = ta.employee_id
    LIMIT 1
  )
)
WHERE a.serial_number = ta.serial_number
  AND ta.assigned_to IS NOT NULL 
  AND ta.assigned_to != '';

-- ============================================
-- STEP 7: Import Asset Specs (Laptop Assets)
-- ============================================
-- Assumes CSV file: 07_laptop_assets.csv
-- Columns: id, asset_id, processor_type, ram_capacity, storage_capacity, 
--          is_touchscreen, screen_size, model

CREATE TEMP TABLE temp_laptop_assets (
  id VARCHAR(255),
  asset_id VARCHAR(255), -- Old asset ID, needs mapping
  processor_type VARCHAR(255),
  ram_capacity VARCHAR(50),
  storage_capacity VARCHAR(50),
  is_touchscreen VARCHAR(10), -- 'true'/'false'
  screen_size VARCHAR(50),
  model VARCHAR(255)
);

-- COPY temp_laptop_assets FROM '/path/to/07_laptop_assets.csv' 
-- WITH (FORMAT csv, HEADER true, DELIMITER ',');

-- Create a mapping from old asset IDs to new UUIDs (by serial number or name)
-- This assumes you can match old asset_id to new asset by some unique field
-- Adjust based on your data structure

INSERT INTO asset_specs (
  asset_id, asset_type, processor_type, ram_capacity,
  storage_capacity, screen_size, is_touchscreen, model
)
SELECT 
  a.id as asset_id, -- New UUID
  'Laptop' as asset_type,
  la.processor_type,
  la.ram_capacity,
  la.storage_capacity,
  la.screen_size,
  CASE 
    WHEN LOWER(la.is_touchscreen) IN ('true', '1', 'yes') THEN true
    ELSE false
  END as is_touchscreen,
  la.model
FROM temp_laptop_assets la
-- Join to assets table - you may need to adjust this join based on your data
-- This example assumes you can match by some identifier
INNER JOIN assets a ON a.serial_number IN (
  SELECT serial_number FROM temp_assets WHERE id = la.asset_id
)
ON CONFLICT DO NOTHING;

-- ============================================
-- CLEANUP
-- ============================================
-- Drop temporary tables
DROP TABLE IF EXISTS temp_employee_personal_info;
DROP TABLE IF EXISTS temp_employee_official_info;
DROP TABLE IF EXISTS temp_employees;
DROP TABLE IF EXISTS temp_assets;
DROP TABLE IF EXISTS temp_laptop_assets;
DROP TABLE IF EXISTS personal_info_id_mapping;
DROP TABLE IF EXISTS official_info_id_mapping;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these to verify the migration:

-- SELECT COUNT(*) as total_employees FROM employees;
-- SELECT COUNT(*) as total_assets FROM assets;
-- SELECT COUNT(*) as total_locations FROM locations;
-- SELECT COUNT(*) as assets_with_assignments FROM assets WHERE assigned_to IS NOT NULL;
-- SELECT COUNT(*) as assets_with_specs FROM asset_specs;

-- Check for any data issues:
-- SELECT * FROM assets WHERE location_id IS NULL AND location IS NOT NULL;
-- SELECT * FROM assets WHERE assigned_to IS NULL AND status = 'Shared Resource';


