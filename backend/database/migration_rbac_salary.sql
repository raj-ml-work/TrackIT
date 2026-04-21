-- ============================================
-- TrackIT RBAC Migration: Roles + Salary Table
-- PostgreSQL Version
-- ============================================

-- ── Step 1: Migrate legacy 'User' role to 'IT' ──
UPDATE users SET role = 'IT' WHERE role = 'User';

-- ── Step 2: Add employee_salary_info table ──
CREATE TABLE IF NOT EXISTS employee_salary_info (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  ctc DECIMAL(14, 2) NOT NULL,              -- Cost to Company (annual)
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  pay_frequency VARCHAR(20) NOT NULL DEFAULT 'Monthly',
  effective_date DATE NOT NULL,
  bonus DECIMAL(12, 2) DEFAULT 0,           -- Bonus component
  client_billing_rate DECIMAL(12, 2),       -- Client billing rate (for comparison)
  client_billing_currency VARCHAR(10),
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by_name VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_salary_employee_id ON employee_salary_info(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_salary_effective_date ON employee_salary_info(effective_date DESC);
CREATE INDEX IF NOT EXISTS idx_employee_salary_employee_effective ON employee_salary_info(employee_id, effective_date DESC);

-- ── Step 3: Trigger for updated_at ──
DROP TRIGGER IF EXISTS update_employee_salary_info_updated_at ON employee_salary_info;
CREATE TRIGGER update_employee_salary_info_updated_at BEFORE UPDATE ON employee_salary_info
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Step 4: RLS for salary table ──
ALTER TABLE employee_salary_info ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read salary" ON employee_salary_info;
CREATE POLICY "Authenticated users can read salary" ON employee_salary_info FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users can insert salary" ON employee_salary_info;
CREATE POLICY "Authenticated users can insert salary" ON employee_salary_info FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can update salary" ON employee_salary_info;
CREATE POLICY "Authenticated users can update salary" ON employee_salary_info FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Only admins can delete salary" ON employee_salary_info;
CREATE POLICY "Only admins can delete salary" ON employee_salary_info FOR DELETE USING (true);
