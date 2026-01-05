-- Migration Script: Add new columns to existing tables
-- Run this if you get errors about missing columns (client_id, location_id, etc.)

-- ============================================
-- Add country column to locations table
-- ============================================
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'locations' 
      AND column_name = 'country'
  ) THEN
    ALTER TABLE locations ADD COLUMN country VARCHAR(100) DEFAULT 'India';
    RAISE NOTICE 'Added country column to locations table';
  ELSE
    RAISE NOTICE 'Country column already exists in locations table';
  END IF;
END $$;

-- ============================================
-- Add new columns to employees table
-- ============================================
DO $$ 
BEGIN
  -- Add client_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'client_id'
  ) THEN
    ALTER TABLE employees ADD COLUMN client_id UUID REFERENCES clients(id) ON DELETE SET NULL;
    RAISE NOTICE 'Added client_id column to employees table';
  END IF;
  
  -- Add location_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'location_id'
  ) THEN
    ALTER TABLE employees ADD COLUMN location_id UUID REFERENCES locations(id) ON DELETE SET NULL;
    RAISE NOTICE 'Added location_id column to employees table';
  END IF;
  
  -- Add personal_info_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'personal_info_id'
  ) THEN
    ALTER TABLE employees ADD COLUMN personal_info_id UUID REFERENCES employee_personal_info(id) ON DELETE CASCADE;
    RAISE NOTICE 'Added personal_info_id column to employees table';
  END IF;
  
  -- Add official_info_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'official_info_id'
  ) THEN
    ALTER TABLE employees ADD COLUMN official_info_id UUID REFERENCES employee_official_info(id) ON DELETE CASCADE;
    RAISE NOTICE 'Added official_info_id column to employees table';
  END IF;
END $$;

-- ============================================
-- Add new columns to assets table
-- ============================================
DO $$ 
BEGIN
  -- Add assigned_to_uuid column (new UUID field for employee assignment)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'assets' AND column_name = 'assigned_to_uuid'
  ) THEN
    ALTER TABLE assets ADD COLUMN assigned_to_uuid UUID REFERENCES employees(id) ON DELETE SET NULL;
    RAISE NOTICE 'Added assigned_to_uuid column to assets table';
  END IF;
  
  -- Add employee_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'assets' AND column_name = 'employee_id'
  ) THEN
    ALTER TABLE assets ADD COLUMN employee_id UUID REFERENCES employees(id) ON DELETE SET NULL;
    RAISE NOTICE 'Added employee_id column to assets table';
  END IF;
  
  -- Add acquisition_date column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'assets' AND column_name = 'acquisition_date'
  ) THEN
    ALTER TABLE assets ADD COLUMN acquisition_date DATE;
    RAISE NOTICE 'Added acquisition_date column to assets table';
  END IF;
  
  -- Add location_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'assets' AND column_name = 'location_id'
  ) THEN
    ALTER TABLE assets ADD COLUMN location_id UUID REFERENCES locations(id) ON DELETE SET NULL;
    RAISE NOTICE 'Added location_id column to assets table';
  END IF;
  
  -- Add manufacturer column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'assets' AND column_name = 'manufacturer'
  ) THEN
    ALTER TABLE assets ADD COLUMN manufacturer VARCHAR(255);
    RAISE NOTICE 'Added manufacturer column to assets table';
  END IF;
  
  -- Add previous_tag column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'assets' AND column_name = 'previous_tag'
  ) THEN
    ALTER TABLE assets ADD COLUMN previous_tag VARCHAR(255);
    RAISE NOTICE 'Added previous_tag column to assets table';
  END IF;
  
  -- Add unique constraint to serial_number if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'assets_serial_number_key'
  ) THEN
    BEGIN
      ALTER TABLE assets ADD CONSTRAINT assets_serial_number_key UNIQUE (serial_number);
      RAISE NOTICE 'Added unique constraint to serial_number';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not add unique constraint to serial_number (may already exist)';
    END;
  END IF;
END $$;

-- ============================================
-- Create indexes for new columns
-- ============================================
CREATE INDEX IF NOT EXISTS idx_locations_country ON locations(country);
CREATE INDEX IF NOT EXISTS idx_employees_client_id ON employees(client_id);
CREATE INDEX IF NOT EXISTS idx_employees_location_id ON employees(location_id);
CREATE INDEX IF NOT EXISTS idx_employees_personal_info_id ON employees(personal_info_id);
CREATE INDEX IF NOT EXISTS idx_employees_official_info_id ON employees(official_info_id);
CREATE INDEX IF NOT EXISTS idx_assets_location_id ON assets(location_id);
CREATE INDEX IF NOT EXISTS idx_assets_assigned_to_uuid ON assets(assigned_to_uuid);
CREATE INDEX IF NOT EXISTS idx_assets_employee_id ON assets(employee_id);
CREATE INDEX IF NOT EXISTS idx_assets_manufacturer ON assets(manufacturer);
CREATE INDEX IF NOT EXISTS idx_assets_type_status ON assets(type, status);
CREATE INDEX IF NOT EXISTS idx_assets_status_location ON assets(status, location_id);


