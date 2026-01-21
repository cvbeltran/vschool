-- Migration: Create sections table
-- Created: 2024
-- Description: Creates sections table for managing class sections within programs

-- Create sections table
CREATE TABLE IF NOT EXISTS sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_sections_organization_id ON sections(organization_id);
CREATE INDEX IF NOT EXISTS idx_sections_school_id ON sections(school_id);
CREATE INDEX IF NOT EXISTS idx_sections_program_id ON sections(program_id);
CREATE INDEX IF NOT EXISTS idx_sections_code ON sections(code);
CREATE INDEX IF NOT EXISTS idx_sections_is_active ON sections(is_active);
CREATE INDEX IF NOT EXISTS idx_sections_sort_order ON sections(sort_order);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_sections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_sections_updated_at
  BEFORE UPDATE ON sections
  FOR EACH ROW
  EXECUTE FUNCTION update_sections_updated_at();

-- Add comments for documentation
COMMENT ON TABLE sections IS 'Stores class sections within programs';
COMMENT ON COLUMN sections.organization_id IS 'Foreign key to organizations.id - scopes section to organization';
COMMENT ON COLUMN sections.school_id IS 'Foreign key to schools.id - section belongs to a school';
COMMENT ON COLUMN sections.program_id IS 'Foreign key to programs.id - section belongs to a program';
COMMENT ON COLUMN sections.sort_order IS 'Custom sort order for displaying sections';
