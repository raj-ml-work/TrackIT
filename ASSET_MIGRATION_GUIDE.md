# Asset Tag Migration Guide

This guide provides instructions on how to migrate existing asset IDs to the new standard "Asset Tag" format and import additional data (voice info and comments) from the provided CSV file.

## Overview

The migration script `backend/scripts/migrate_asset_tags.js` performs the following actions:
1.  **Schema Update**: Adds a `voice_info` column to the `assets` table.
2.  **ID Mapping**: Updates the `name` field of an asset from the "Current Asset ID" to the "New Generic ID (Asset Tag)".
3.  **Data Import**: Imports "Voice Information" into the `voice_info` column.
4.  **Comments**: Adds details from specific CSV columns as system notes in the `asset_comments` table.

## CSV File Requirements

The script expects a CSV file with the following column mapping:
- **Column B (index 1)**: Asset Tag (New Generic ID)
- **Column C (index 2)**: Current Asset ID (Used to find the existing record)
- **Column D (index 3)**: AdminLogin Password (Imported as a comment)
- **Column E (index 4)**: OS Details (Imported to the `asset_specs` table)
- **Column F (index 5)**: BitLocker Code (Imported as a comment)
- **Column G (index 6)**: Voice Information (Optional, if separate from OS)
- **Column T (index 19)**: Detail 2 (Imported as a comment)

> [!IMPORTANT]
> Ensure the CSV file is saved with UTF-8 encoding and uses commas as delimiters. Quoted fields containing commas are supported.

## Prerequisites

1.  **Backup**: Always backup your database before running a migration.
    - For SQLite: Copy `backend/data/inventory.db` to a safe location.
    - For PostgreSQL: Use `pg_dump`.
2.  **Environment Variables**: Ensure your `.env` file in the `backend` directory is correctly configured for your database provider (SQLite or PostgreSQL).

## How to Run the Migration

### 1. Preparation
Place your CSV file in a reachable directory (e.g., `backend/data/asset_mapping.csv`).

### 2. Run the Script
Navigate to the `backend` directory and execute the script using Node.js:

```bash
cd backend
node scripts/migrate_asset_tags.js ./data/your_csv_file.csv
```

### 3. Dry Run (Highly Recommended)
Run with the `--dry-run` flag to see exactly which assets will be updated and which will be skipped:

```bash
node scripts/migrate_asset_tags.js ./data/your_csv_file.csv --dry-run
```

The dry run will output:
- `[DRY-RUN] Would update: OLD_TAG -> NEW_TAG`
- Confirmation if Admin Password or BitLocker Code was detected for that row.
- Warnings for any skipped rows (with line numbers).

## Verification

After the script completes, verify the changes in the database:

1.  **Check Asset Names and Voice Info**:
    ```sql
    SELECT name, voice_info FROM assets LIMIT 10;
    ```
2.  **Check Captured Comments (Admin Pass / BitLocker)**:
    ```sql
    SELECT a.name, c.message 
    FROM asset_comments c 
    JOIN assets a ON c.asset_id = a.id 
    WHERE c.author_name = 'System Migration' 
    LIMIT 10;
    ```

## Troubleshooting

-   **"Asset not found in database"**: The "Current Asset ID" in Column C did not match any `name` in the `assets` table. The script will log the line number.
-   **"Insufficient columns"**: The row doesn't have enough columns to reach the "Current Asset ID" (Column C).
-   **"Duplicate column name"**: This warning can be ignored; it just means the `voice_info` column already exists.

---

*Note: This script was developed for the transition from location-based IDs to a centralized asset tag system.*
