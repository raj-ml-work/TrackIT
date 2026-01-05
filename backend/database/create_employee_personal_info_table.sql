-- Create employee_personal_info table based on the CSV data structure
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

-- Create trigger to update the updated_at timestamp
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

-- Enable Row Level Security
ALTER TABLE employee_personal_info ENABLE ROW LEVEL SECURITY;

-- Create policies for Row Level Security
CREATE POLICY "Allow full access to authenticated users" ON employee_personal_info
  FOR ALL USING (auth.uid() IS NOT NULL);