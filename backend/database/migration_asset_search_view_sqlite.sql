-- SQLite-compatible search view for asset search functionality
-- This replaces the PostgreSQL-specific asset_search_view for SQLite databases

-- Drop existing view if it exists (for PostgreSQL compatibility)
DROP VIEW IF EXISTS asset_search_view;

-- Create SQLite-compatible search view
CREATE VIEW asset_search_view AS
SELECT
  a.id AS asset_id,
  a.created_at,
  a.status,
  a.type AS asset_type,
  LOWER(
    COALESCE(a.name, '') || ' ' ||
    COALESCE(a.serial_number, '') || ' ' ||
    COALESCE(a.type, '') || ' ' ||
    COALESCE(a.status, '') || ' ' ||
    COALESCE(l.name, '') || ' ' ||
    COALESCE(es.brand, '') || ' ' ||
    COALESCE(es.model, '') || ' ' ||
    COALESCE(es.os_details, '') || ' ' ||
    COALESCE(json_extract(a.specs, '$.brand'), '') || ' ' ||
    COALESCE(json_extract(a.specs, '$.model'), '') || ' ' ||
    COALESCE(json_extract(a.specs, '$.osDetails'), '') || ' ' ||
    COALESCE(json_extract(a.specs, '$.os'), '') || ' ' ||
    COALESCE(pi.first_name, '') || ' ' ||
    COALESCE(pi.last_name, '') || ' ' ||
    COALESCE(e.employee_id, '')
  ) AS search_text
FROM assets a
LEFT JOIN asset_specs es ON es.asset_id = a.id
LEFT JOIN locations l ON l.id = a.location_id
LEFT JOIN employees e ON e.id = a.employee_id
LEFT JOIN employee_personal_info pi ON pi.id = e.personal_info_id;

-- Create index on the search view for better performance
CREATE INDEX IF NOT EXISTS idx_asset_search_view_search_text ON asset_search_view(search_text);
CREATE INDEX IF NOT EXISTS idx_asset_search_view_asset_type ON asset_search_view(asset_type);
CREATE INDEX IF NOT EXISTS idx_asset_search_view_created_at ON asset_search_view(created_at DESC);
