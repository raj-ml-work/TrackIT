-- Migration Script: Fix employees table name column
-- Run this if you get "null value in column name" error

-- Make name column nullable if it exists as NOT NULL
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'employees' 
      AND column_name = 'name' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE employees ALTER COLUMN name DROP NOT NULL;
    RAISE NOTICE 'Made name column nullable in employees table';
  ELSE
    -- Add name column if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'name'
    ) THEN
      ALTER TABLE employees ADD COLUMN name VARCHAR(255);
      RAISE NOTICE 'Added name column to employees table';
    ELSE
      RAISE NOTICE 'Name column already exists and is nullable';
    END IF;
  END IF;
END $$;


