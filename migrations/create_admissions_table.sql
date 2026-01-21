-- Migration: Create admissions table
-- Created: 2024
-- Description: Creates admissions table for managing admission applications

-- Create admissions table
CREATE TABLE IF NOT EXISTS admissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  section_id UUID REFERENCES sections(id) ON DELETE SET NULL,
  school_year_id UUID REFERENCES school_years(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_admissions_organization_id ON admissions(organization_id);
CREATE INDEX IF NOT EXISTS idx_admissions_school_id ON admissions(school_id);
CREATE INDEX IF NOT EXISTS idx_admissions_program_id ON admissions(program_id);
CREATE INDEX IF NOT EXISTS idx_admissions_section_id ON admissions(section_id);
CREATE INDEX IF NOT EXISTS idx_admissions_school_year_id ON admissions(school_year_id);
CREATE INDEX IF NOT EXISTS idx_admissions_status ON admissions(status);
CREATE INDEX IF NOT EXISTS idx_admissions_email ON admissions(email) WHERE email IS NOT NULL;

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_admissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_admissions_updated_at
  BEFORE UPDATE ON admissions
  FOR EACH ROW
  EXECUTE FUNCTION update_admissions_updated_at();

-- Add comments for documentation
COMMENT ON TABLE admissions IS 'Stores admission applications';
COMMENT ON COLUMN admissions.organization_id IS 'Foreign key to organizations.id - scopes admission to organization';
COMMENT ON COLUMN admissions.school_id IS 'Foreign key to schools.id - admission is for a specific school';
COMMENT ON COLUMN admissions.program_id IS 'Foreign key to programs.id - admission is for a specific program';
COMMENT ON COLUMN admissions.section_id IS 'Foreign key to sections.id - admission may be for a specific section';
COMMENT ON COLUMN admissions.school_year_id IS 'Foreign key to school_years.id - admission is for a specific school year';
COMMENT ON COLUMN admissions.status IS 'Admission status (e.g., pending, accepted, rejected, enrolled)';
