-- Create employee_official_info table based on the CSV data structure
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

-- Create trigger to update the updated_at timestamp
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

-- Enable Row Level Security
ALTER TABLE employee_official_info ENABLE ROW LEVEL SECURITY;

-- Create policies for Row Level Security
CREATE POLICY "Allow full access to authenticated users" ON employee_official_info
  FOR ALL USING (auth.uid() IS NOT NULL);