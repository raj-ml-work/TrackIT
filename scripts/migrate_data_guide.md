# Data Migration Guide

This guide explains how to migrate historical CSV data into the restructured database schema.

## Prerequisites

1. **Database Schema**: Ensure the new schema has been applied (`database/schema.sql`)
2. **CSV Files**: Have the following CSV files ready:
   - `02_employee_personal_info.csv`
   - `03_employee_official_info.csv`
   - `05_employees.csv`
   - `06_assets.csv`
   - `07_laptop_assets.csv`
3. **PostgreSQL Access**: You need direct database access or can use Supabase SQL Editor

## Migration Steps

### Option 1: Using PostgreSQL COPY Command (Recommended for Local/Server)

1. **Place CSV files** in a location accessible by PostgreSQL server
   - For local PostgreSQL: Any directory accessible by postgres user
   - For Supabase: Upload files to a storage bucket or use Supabase Dashboard

2. **Update file paths** in `migrate_data.sql`:
   ```sql
   COPY temp_employee_personal_info FROM '/path/to/02_employee_personal_info.csv' 
   WITH (FORMAT csv, HEADER true, DELIMITER ',');
   ```

3. **Run the migration script** section by section:
   ```bash
   psql -U postgres -d your_database -f scripts/migrate_data.sql
   ```

### Option 2: Using Supabase Dashboard

1. **Upload CSV files** to Supabase Storage (optional, for reference)

2. **Use Supabase SQL Editor**:
   - Open Supabase Dashboard → SQL Editor
   - Copy sections from `migrate_data.sql` one at a time
   - For CSV import, you'll need to:
     - Either use Supabase's import feature (Dashboard → Table Editor → Import)
     - Or manually insert data using INSERT statements

3. **Manual Insert Alternative**:
   - Convert CSV to SQL INSERT statements using a script
   - Or use a tool like `pgAdmin` import feature

### Option 3: Programmatic Migration (Node.js/Python)

For large datasets or automated migrations, consider writing a script:

**Node.js Example:**
```javascript
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const csv = require('csv-parser');

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Read and import CSV
fs.createReadStream('02_employee_personal_info.csv')
  .pipe(csv())
  .on('data', async (row) => {
    const { data, error } = await supabase
      .from('employee_personal_info')
      .insert({
        first_name: row.first_name,
        last_name: row.last_name,
        // ... other fields
      });
  });
```

## Migration Order

**Important**: Follow this exact order to maintain referential integrity:

1. **Locations** (if creating from assets/employees data)
2. **Clients** (if creating from employees data)
3. **Employee Personal Info**
4. **Employee Official Info**
5. **Employees** (links personal/official info)
6. **Assets** (references locations and employees)
7. **Asset Specs** (references assets)

## Data Mapping Notes

### Employee Data
- **Old `id` → New `id`**: The migration creates new UUIDs. If you need to preserve relationships, create a mapping table.
- **Location**: Matched by name (string) to location UUID
- **Client**: Matched by code/name to client UUID

### Asset Data
- **Serial Number**: Used as unique identifier (must be unique)
- **Assigned To**: Matched by:
  1. Employee email (official_email or personal_email)
  2. Employee ID (if provided)
  3. Employee name (fallback)
- **Location**: Matched by name to location UUID
- **Dynamic Attributes**: Converted from JSON string to JSONB

### Asset Specs
- **Asset ID**: Matched from old asset_id to new asset UUID
- **Touchscreen**: Converted from string ('true'/'false') to boolean

## Verification

After migration, run these verification queries:

```sql
-- Check counts
SELECT 
  (SELECT COUNT(*) FROM employees) as employees,
  (SELECT COUNT(*) FROM assets) as assets,
  (SELECT COUNT(*) FROM locations) as locations,
  (SELECT COUNT(*) FROM asset_specs) as asset_specs;

-- Check for missing relationships
SELECT COUNT(*) as assets_without_location 
FROM assets 
WHERE location_id IS NULL AND location IS NOT NULL;

SELECT COUNT(*) as assets_unassigned_but_in_use
FROM assets 
WHERE assigned_to IS NULL AND status = 'In Use';

-- Check for duplicate serial numbers
SELECT serial_number, COUNT(*) 
FROM assets 
GROUP BY serial_number 
HAVING COUNT(*) > 1;
```

## Troubleshooting

### Common Issues

1. **Foreign Key Violations**
   - Ensure locations and clients are created before employees
   - Ensure employees are created before assets

2. **Duplicate Serial Numbers**
   - The schema has a UNIQUE constraint on `serial_number`
   - Handle duplicates before migration (update, merge, or skip)

3. **Missing Employee Assignments**
   - If `assigned_to` email doesn't match, check:
     - Official email vs personal email
     - Case sensitivity
     - Extra whitespace

4. **Date Format Issues**
   - Ensure dates are in ISO format (YYYY-MM-DD)
   - Handle NULL/empty dates appropriately

### Rollback

If migration fails, you can:
1. Drop and recreate tables (if no production data)
2. Delete imported data using the mapping tables
3. Restore from backup

## Post-Migration

1. **Update Application Code**: Ensure App.tsx handlers work with new schema
2. **Test CRUD Operations**: Verify all create/read/update/delete operations
3. **Clean Up Legacy Fields**: After confirming everything works, consider:
   - Removing `location` VARCHAR field (use `location_id` only)
   - Removing `assigned_to` VARCHAR field (use `assigned_to` UUID only)
   - Migrating remaining data from legacy fields

## Next Steps

After successful migration:
1. Update application handlers in `App.tsx` to properly create/update normalized employee data
2. Test all features with migrated data
3. Monitor for any data inconsistencies
4. Consider adding data validation rules


