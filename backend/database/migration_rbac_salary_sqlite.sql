-- ============================================
-- TrackIT RBAC Migration: Roles + Salary Table
-- SQLite Version
-- ============================================

-- ── Step 1: Migrate legacy 'User' role to 'IT' ──
UPDATE users SET role = 'IT' WHERE role = 'User';

-- ── Step 2: Add employee_salary_info table ──
CREATE TABLE IF NOT EXISTS employee_salary_info (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  ctc REAL NOT NULL,                         -- Cost to Company (annual)
  currency TEXT NOT NULL DEFAULT 'INR',
  pay_frequency TEXT NOT NULL DEFAULT 'Monthly',
  effective_date TEXT NOT NULL,              -- ISO date string
  bonus REAL DEFAULT 0,                     -- Bonus component
  client_billing_rate REAL,                 -- Client billing rate (for comparison)
  client_billing_currency TEXT,
  notes TEXT,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_by_name TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_employee_salary_employee_id ON employee_salary_info(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_salary_effective_date ON employee_salary_info(effective_date DESC);
CREATE INDEX IF NOT EXISTS idx_employee_salary_employee_effective ON employee_salary_info(employee_id, effective_date DESC);
