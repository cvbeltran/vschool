-- Migration: Create staff_employment_history table
-- Created: 2024
-- Description: Creates staff_employment_history table for previous employment records

-- Create staff_employment_history table
CREATE TABLE IF NOT EXISTS staff_employment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  previous_employer TEXT NOT NULL,
  previous_position TEXT NOT NULL,
  employment_start_date DATE NOT NULL,
  employment_end_date DATE NOT NULL,
  reason_for_leaving TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_staff_employment_history_staff_id ON staff_employment_history(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_employment_history_employment_dates ON staff_employment_history(employment_start_date, employment_end_date);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_staff_employment_history_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_staff_employment_history_updated_at
  BEFORE UPDATE ON staff_employment_history
  FOR EACH ROW
  EXECUTE FUNCTION update_staff_employment_history_updated_at();

-- Add comments for documentation
COMMENT ON TABLE staff_employment_history IS 'Stores historical employment records for staff members';
COMMENT ON COLUMN staff_employment_history.staff_id IS 'Foreign key to staff.id';
COMMENT ON COLUMN staff_employment_history.previous_employer IS 'Name of previous employer';
COMMENT ON COLUMN staff_employment_history.previous_position IS 'Position held at previous employer';
