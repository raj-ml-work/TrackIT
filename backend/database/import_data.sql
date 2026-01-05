-- Data import script for populating tables from CSV files
-- This script provides examples of how to import data from the CSV files

-- 1. Import clients data from 01_clients.csv
-- Note: You would typically use a CSV import tool or write a script to process the CSV
-- Here are some sample INSERT statements based on the CSV structure

-- Sample client inserts (first few rows from CSV)
INSERT INTO clients (name) VALUES 
('NXP'), 
('Samsung'), 
('AMD'), 
('Xilinx'), 
('Rambus'), 
('Bench'), 
('Qualcomm'), 
('Blaize'), 
('Google'), 
('Silabs'), 
('Microchip'), 
('Broadcomm'), 
('Intel'), 
('Synopsys'), 
('Aeva'), 
('US-Client'), 
('AHEESA'), 
('CISCO'), 
('CADENCE'), 
('ADEPTCHIPS'), 
('IGNITARIUM')
ON CONFLICT (name) DO NOTHING;

-- 2. Import departments data (extracted from employee official info)
-- These are the divisions found in the employee official info CSV
INSERT INTO departments (name, description) VALUES 
('IT', 'Information Technology Department'),
('Management', 'Management Department'),
('Sales', 'Sales Department'),
('DV', 'Design Verification Department'),
('PD/STA', 'Physical Design/Static Timing Analysis Department'),
('Embedded', 'Embedded Systems Department'),
('RTL/FPGA', 'Register Transfer Level/Field Programmable Gate Array Department'),
('Finance', 'Finance Department'),
('Staffing', 'Staffing Department')
ON CONFLICT (name) DO NOTHING;

-- 3. Import employee personal info data from 02_employee_personal_info.csv
-- Note: This is a sample of the first few employees
-- In a real scenario, you would process the entire CSV file
INSERT INTO employee_personal_info (
  employee_id, first_name, last_name, gender, mobile_number, 
  emergency_contact_name, emergency_contact_number, personal_email, 
  linkedin_url, additional_comments
) VALUES 
('1', 'Babji', 'M', 'Male', '9876543210', 'Temp', '5678901234', 'abc@def.com', 'https://www.linkedin.com/sdfsd', NULL),
('2', 'Bhaskar', 'Kakani', 'M', '9666267105', 'Wife', '9160832508', 'kakanibhaskar@gmail.com', 'https://www.linkedin.com/in/bhaskar-kakani-452ba4ab/', 'FatherInLaw: 9848040877; Venu: 9603034949'),
('3', 'Rajasekharam Naidu', 'Pujala', 'M', '9999868643', 'Spouse', '8088664029', 'raj.ml.work@gmail.com', 'https://www.linkedin.com/in/rajasekharam-naidu-p-74b193249/', 'Father: 919949163365'),
('4', 'Venugopalarao', 'Mulluri', 'M', '9603034949', '', '9618914960', 'venumulluri@gmail.com', 'https://www.linkedin.com/in/venu-mulluri-2a1027252/', '9010699199'),
('5', 'Rajesh', 'Nallapati', 'M', '0126441981', 'Brother', '919849088885', '', 'https://www.linkedin.com/in/rajeshnallapati-rana/', 'Mobile is +60126441981 (Malaysia)')
ON CONFLICT (employee_id) DO NOTHING;

-- 4. Import employee official info data from 03_employee_official_info.csv
-- Note: This is a sample of the first few employees
INSERT INTO employee_official_info (
  employee_id, division, biometric_id, rfid_serial, 
  agreement_signed, start_date, official_dob, official_email
) VALUES 
('1', 'IT', '12335426', '23524356', FALSE, '2024-03-29', '2024-03-29', 'babji.m@bs.com'),
('2', 'Management', '1001', '3968369', FALSE, '2020-02-10', '1985-06-02', 'bhaskar.k@bitsilica.com'),
('3', 'Management', '1048', '3311129', FALSE, '2021-04-01', '1984-05-14', 'raj.p@bitsilica.com'),
('4', 'Management', '3025', '3892132', FALSE, '2022-08-01', '1984-08-22', 'venu.m@bitsilica.com'),
('5', 'Management', '3026', NULL, FALSE, '2023-11-06', '2023-10-16', 'rana@bitsilica.com')
ON CONFLICT (employee_id) DO NOTHING;

-- 5. Import assets data from 06_assets.csv and 07_laptop_assets.csv
-- Note: This is a simplified example - you would need to process the full CSV
-- The actual CSV has complex JSON data that would need to be parsed
INSERT INTO assets (
  name, type, serial_number, purchase_date, status, location, 
  purchase_price, notes, acquisition_date, warranty_expiry_date, 
  assigned_to, manufacturer, dynamic_attributes
) VALUES 
('BS_LAP_001', 'Laptop', '5CD2043JM3', '2021-08-16', 'Assigned', 'Hyderabad', 
 72452.0, '-, Previous Tag: BS_Lap_001', '2021-08-16', '2025-09-24', 
 'bhaskar.k@bitsilica.com', 'DELL', 
 '{"model": "DELL Vostro 5040-1", "processor_type": "i5-11300H", "ram_capacity": 8, "storage_capacity": 512, "screen_size": 14}'),

('BS_LAP_002', 'Laptop', '5CD2043JM2', '2021-08-16', 'Assigned', 'Hyderabad', 
 72452.0, '-, Previous Tag: BS_Lap_002', '2021-08-16', '2025-09-24', 
 'venu.m@bitsilica.com', 'DELL', 
 '{"model": "DELL Vostro 5040-2", "processor_type": "i5-11300H", "ram_capacity": 8, "storage_capacity": 512, "screen_size": 14}');

-- Note: For a complete data import, you would need to:
-- 1. Use a CSV parser to read the files
-- 2. Transform the data to match the database schema
-- 3. Handle relationships between tables (e.g., employee_id references)
-- 4. Process the complex JSON data in the assets CSV
-- 5. Use bulk insert operations for better performance

-- You can use Supabase's CSV import feature or write a Node.js/Python script
-- to process these files and import them efficiently.