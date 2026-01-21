-- Migration: Create guardians table and student_guardians junction table
-- Created: 2024
-- Description: Creates a dedicated guardians table and establishes many-to-many relationship with students

-- Create guardians table
CREATE TABLE IF NOT EXISTS guardians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create student_guardians junction table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS student_guardians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  guardian_id UUID NOT NULL REFERENCES guardians(id) ON DELETE CASCADE,
  relationship_id UUID REFERENCES taxonomy_items(id),
  is_primary BOOLEAN DEFAULT FALSE,
  consent_flags JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, guardian_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_guardians_organization_id ON guardians(organization_id);
CREATE INDEX IF NOT EXISTS idx_student_guardians_student_id ON student_guardians(student_id);
CREATE INDEX IF NOT EXISTS idx_student_guardians_guardian_id ON student_guardians(guardian_id);
CREATE INDEX IF NOT EXISTS idx_student_guardians_relationship_id ON student_guardians(relationship_id);
CREATE INDEX IF NOT EXISTS idx_guardians_email ON guardians(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_guardians_phone ON guardians(phone) WHERE phone IS NOT NULL;

-- Add updated_at trigger for guardians table
CREATE OR REPLACE FUNCTION update_guardians_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_guardians_updated_at
  BEFORE UPDATE ON guardians
  FOR EACH ROW
  EXECUTE FUNCTION update_guardians_updated_at();

-- Add updated_at trigger for student_guardians table
CREATE OR REPLACE FUNCTION update_student_guardians_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_student_guardians_updated_at
  BEFORE UPDATE ON student_guardians
  FOR EACH ROW
  EXECUTE FUNCTION update_student_guardians_updated_at();

-- Add comments for documentation
COMMENT ON TABLE guardians IS 'Stores guardian/parent information';
COMMENT ON COLUMN guardians.organization_id IS 'Foreign key to organizations.id - scopes guardian to organization';
COMMENT ON TABLE student_guardians IS 'Junction table linking students to guardians with relationship information';
COMMENT ON COLUMN student_guardians.is_primary IS 'Indicates if this is the primary guardian for the student';
COMMENT ON COLUMN student_guardians.relationship_id IS 'FK to taxonomy_items.id (taxonomy key: guardian_relationship)';
