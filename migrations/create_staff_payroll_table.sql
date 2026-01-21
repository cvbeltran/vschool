-- Migration: Create staff_payroll table
-- Created: 2024
-- Description: Creates staff_payroll table for government IDs and banking information

-- Create staff_payroll table
CREATE TABLE IF NOT EXISTS staff_payroll (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID UNIQUE NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  tin_number TEXT, -- Tax Identification Number
  sss_number TEXT, -- Social Security System
  philhealth_number TEXT, -- PhilHealth
  pagibig_number TEXT, -- Pag-IBIG Fund
  bank_name TEXT,
  bank_account_number TEXT,
  bank_account_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_staff_payroll_staff_id ON staff_payroll(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_payroll_tin_number ON staff_payroll(tin_number) WHERE tin_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_staff_payroll_sss_number ON staff_payroll(sss_number) WHERE sss_number IS NOT NULL;

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_staff_payroll_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_staff_payroll_updated_at
  BEFORE UPDATE ON staff_payroll
  FOR EACH ROW
  EXECUTE FUNCTION update_staff_payroll_updated_at();

-- Add comments for documentation
COMMENT ON TABLE staff_payroll IS 'Stores government IDs and banking information for payroll processing';
COMMENT ON COLUMN staff_payroll.staff_id IS 'Foreign key to staff.id - one-to-one relationship';
COMMENT ON COLUMN staff_payroll.tin_number IS 'Tax Identification Number';
COMMENT ON COLUMN staff_payroll.sss_number IS 'Social Security System number';
COMMENT ON COLUMN staff_payroll.philhealth_number IS 'PhilHealth number';
COMMENT ON COLUMN staff_payroll.pagibig_number IS 'Pag-IBIG Fund number';
