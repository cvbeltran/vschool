-- Migration: Create staff_employment table
-- Created: 2024
-- Description: Creates staff_employment table for employment details, education, license, and experience

-- Create staff_employment table
CREATE TABLE IF NOT EXISTS staff_employment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  employment_status_id UUID REFERENCES taxonomy_items(id),
  position_title_id UUID REFERENCES taxonomy_items(id), -- Syncs with profiles.role
  department_id UUID REFERENCES taxonomy_items(id),
  subject_area_id UUID REFERENCES taxonomy_items(id),
  employment_start_date DATE NOT NULL,
  employment_end_date DATE, -- NULL = ongoing employment
  contract_type_id UUID REFERENCES taxonomy_items(id),
  salary_rate DECIMAL(10,2),
  pay_schedule_id UUID REFERENCES taxonomy_items(id),
  work_schedule JSONB, -- {"days": ["Monday", "Tuesday"], "start_time": "08:00", "end_time": "17:00", "hours_per_week": 40}
  highest_education_level_id UUID REFERENCES taxonomy_items(id),
  degree_title TEXT,
  major_specialization TEXT,
  school_graduated TEXT,
  year_graduated INTEGER,
  prc_license_number TEXT,
  prc_license_issue_date DATE,
  prc_license_expiry_date DATE,
  eligibility_type_id UUID REFERENCES taxonomy_items(id),
  total_years_teaching DECIMAL(4,1), -- e.g., 5.5 years
  is_active BOOLEAN DEFAULT TRUE, -- Flag for active employment
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_staff_employment_staff_id ON staff_employment(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_employment_school_id ON staff_employment(school_id);
CREATE INDEX IF NOT EXISTS idx_staff_employment_is_active ON staff_employment(is_active);
CREATE INDEX IF NOT EXISTS idx_staff_employment_position_title_id ON staff_employment(position_title_id);
CREATE INDEX IF NOT EXISTS idx_staff_employment_department_id ON staff_employment(department_id);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_staff_employment_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_staff_employment_updated_at
  BEFORE UPDATE ON staff_employment
  FOR EACH ROW
  EXECUTE FUNCTION update_staff_employment_updated_at();

-- Add comments for documentation
COMMENT ON TABLE staff_employment IS 'Stores employment details, education, license, and experience. Supports multiple current employments per staff member';
COMMENT ON COLUMN staff_employment.staff_id IS 'Foreign key to staff.id';
COMMENT ON COLUMN staff_employment.school_id IS 'Foreign key to schools.id - multi-tenant support';
COMMENT ON COLUMN staff_employment.position_title_id IS 'Position title (Principal, Teacher, etc.) - should sync with profiles.role';
COMMENT ON COLUMN staff_employment.work_schedule IS 'JSONB format: {"days": ["Monday", "Tuesday"], "start_time": "08:00", "end_time": "17:00", "hours_per_week": 40}';
COMMENT ON COLUMN staff_employment.is_active IS 'Flag indicating if this is an active employment record';
