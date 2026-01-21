-- Migration: Create schools table
-- Created: 2024
-- Description: Creates schools table for managing school entities within organizations

-- Create schools table
CREATE TABLE IF NOT EXISTS schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT,
  location TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_schools_organization_id ON schools(organization_id);
CREATE INDEX IF NOT EXISTS idx_schools_code ON schools(code);
CREATE INDEX IF NOT EXISTS idx_schools_is_active ON schools(is_active);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_schools_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_schools_updated_at
  BEFORE UPDATE ON schools
  FOR EACH ROW
  EXECUTE FUNCTION update_schools_updated_at();

-- Add comments for documentation
COMMENT ON TABLE schools IS 'Stores school entities within organizations';
COMMENT ON COLUMN schools.organization_id IS 'Foreign key to organizations.id - scopes school to organization';
COMMENT ON COLUMN schools.code IS 'School code identifier';
COMMENT ON COLUMN schools.is_active IS 'Whether the school is currently active';
