-- Migration: Create programs table
-- Created: 2024
-- Description: Creates programs table for managing academic programs within schools

-- Create programs table
CREATE TABLE IF NOT EXISTS programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT,
  sort_order INTEGER,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_programs_organization_id ON programs(organization_id);
CREATE INDEX IF NOT EXISTS idx_programs_school_id ON programs(school_id);
CREATE INDEX IF NOT EXISTS idx_programs_code ON programs(code);
CREATE INDEX IF NOT EXISTS idx_programs_is_active ON programs(is_active);
CREATE INDEX IF NOT EXISTS idx_programs_sort_order ON programs(sort_order);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_programs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_programs_updated_at
  BEFORE UPDATE ON programs
  FOR EACH ROW
  EXECUTE FUNCTION update_programs_updated_at();

-- Add comments for documentation
COMMENT ON TABLE programs IS 'Stores academic programs within schools';
COMMENT ON COLUMN programs.organization_id IS 'Foreign key to organizations.id - scopes program to organization';
COMMENT ON COLUMN programs.school_id IS 'Foreign key to schools.id - program belongs to a school';
COMMENT ON COLUMN programs.type IS 'Program type (e.g., ACADEMY, COLLEGE, CLC)';
COMMENT ON COLUMN programs.sort_order IS 'Custom sort order for displaying programs';
