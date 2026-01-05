-- Create a lightweight view to support global employee search
CREATE OR REPLACE VIEW employee_search_view AS
SELECT
  e.id AS employee_id,
  e.created_at,
  e.status,
  LOWER(
    COALESCE(e.employee_id, '') || ' ' ||
    COALESCE(e.name, '') || ' ' ||
    COALESCE(pi.first_name, '') || ' ' ||
    COALESCE(pi.last_name, '') || ' ' ||
    COALESCE(pi.personal_email, '') || ' ' ||
    COALESCE(oi.official_email, '') || ' ' ||
    COALESCE(oi.division, '')
  ) AS search_text
FROM employees e
LEFT JOIN employee_personal_info pi ON pi.id = e.personal_info_id
LEFT JOIN employee_official_info oi ON oi.id = e.official_info_id;
