-- Migration to add voice_info column to assets table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'assets' AND column_name = 'voice_info'
  ) THEN
    ALTER TABLE assets ADD COLUMN voice_info TEXT;
    RAISE NOTICE 'Added voice_info column to assets table';
  END IF;
END $$;
