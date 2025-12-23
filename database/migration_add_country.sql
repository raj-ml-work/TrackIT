-- Migration Script: Add country column to locations table
-- Run this if you get an error about country column not existing

-- Add country column if it doesn't exist
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

-- Create index on country column if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_locations_country ON locations(country);


