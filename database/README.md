# Database Setup Guide

This directory contains SQL scripts for setting up the Supabase database for the Inventory Management System.

## Table Creation Scripts

### Individual Table Scripts
- [`create_departments_table.sql`](database/create_departments_table.sql) - Creates the departments table
- [`create_clients_table.sql`](database/create_clients_table.sql) - Creates the clients table
- [`create_employee_personal_info_table.sql`](database/create_employee_personal_info_table.sql) - Creates the employee personal info table
- [`create_employee_official_info_table.sql`](database/create_employee_official_info_table.sql) - Creates the employee official info table

### Comprehensive Script
- [`create_all_tables.sql`](database/create_all_tables.sql) - Creates all tables with proper dependencies and RLS policies

## Data Import Script
- [`import_data.sql`](database/import_data.sql) - Sample data import script with examples

## Setup Instructions

### 1. Create Tables

You can either run the comprehensive script or individual scripts:

**Option A: Run comprehensive script (recommended)**
```bash
psql -h your-supabase-host -U postgres -d postgres -f create_all_tables.sql
```

**Option B: Run individual scripts**
```bash
psql -h your-supabase-host -U postgres -d postgres -f create_departments_table.sql
psql -h your-supabase-host -U postgres -d postgres -f create_clients_table.sql
psql -h your-supabase-host -U postgres -d postgres -f create_employee_personal_info_table.sql
psql -h your-supabase-host -U postgres -d postgres -f create_employee_official_info_table.sql
```

### 2. Import Data

For data import, you have several options:

**Option A: Use Supabase Dashboard CSV Import**
1. Go to your Supabase project dashboard
2. Navigate to the Table Editor
3. Click on each table and use the "Import from CSV" feature
4. Map the CSV columns to the database columns

**Option B: Use the sample import script**
```bash
psql -h your-supabase-host -U postgres -d postgres -f import_data.sql
```

**Option C: Write a custom import script**
For large datasets, it's recommended to write a Node.js or Python script to:
- Parse the CSV files
- Transform the data
- Handle relationships between tables
- Use bulk insert operations

### 3. Verify Setup

After running the scripts, verify the tables were created correctly:
```sql
-- Check tables exist
\dt

-- Check table structure
\d+ departments
\d+ clients
\d+ employee_personal_info
\d+ employee_official_info
\d+ assets

-- Check data was imported
SELECT COUNT(*) FROM departments;
SELECT COUNT(*) FROM clients;
SELECT COUNT(*) FROM employee_personal_info;
SELECT COUNT(*) FROM employee_official_info;
SELECT COUNT(*) FROM assets;
```

## Table Relationships

The database schema includes the following relationships:

1. **employee_official_info** references **employee_personal_info** via `employee_id`
2. Future enhancements may include:
   - **employees** table referencing **departments** via `division`
   - **employees** table referencing **clients** via `client_id`
   - **assets** table referencing **employees** via `assigned_to`

## Row Level Security

All tables have Row Level Security (RLS) enabled with a policy that allows full access to authenticated users. You may want to adjust these policies based on your specific security requirements.

## Performance Optimization

The comprehensive script includes indexes for better query performance:
- Index on `employee_personal_info.employee_id`
- Index on `employee_official_info.employee_id`
- Index on `assets.serial_number`
- Index on `assets.status`
- Index on `assets.location`

## Notes

- The scripts use UUID for primary keys with `uuid_generate_v4()`
- All tables have `created_at` and `updated_at` timestamps
- Triggers automatically update the `updated_at` timestamp on row updates
- The schema is designed to match the structure of the provided CSV files
