-- Create a lightweight view to support global asset search
CREATE OR REPLACE VIEW asset_search_view AS
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
    COALESCE(a.specs->>'brand', '') || ' ' ||
    COALESCE(a.specs->>'model', '') || ' ' ||
    COALESCE(pi.first_name, '') || ' ' ||
    COALESCE(pi.last_name, '') || ' ' ||
    COALESCE(e.employee_id, '')
  ) AS search_text
FROM assets a
LEFT JOIN asset_specs es ON es.asset_id = a.id
LEFT JOIN locations l ON l.id = a.location_id
LEFT JOIN employees e ON e.id = a.employee_id
LEFT JOIN employee_personal_info pi ON pi.id = e.personal_info_id;
