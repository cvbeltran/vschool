-- =========================================
-- Migration: Guardians & Student Guardians
-- =========================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================
-- Guardians table
-- =========================================
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_guardians_organization_id
  ON guardians(organization_id);

CREATE INDEX IF NOT EXISTS idx_guardians_email
  ON guardians(email)
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_guardians_phone
  ON guardians(phone)
  WHERE phone IS NOT NULL;

-- =========================================
-- Student ↔ Guardian junction table
-- =========================================
CREATE TABLE IF NOT EXISTS student_guardians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  organization_id UUID NOT NULL
    REFERENCES organizations(id) ON DELETE CASCADE,

  student_id UUID NOT NULL
    REFERENCES students(id) ON DELETE CASCADE,

  guardian_id UUID NOT NULL
    REFERENCES guardians(id) ON DELETE CASCADE,

  relationship_id UUID
    REFERENCES taxonomy_items(id),

  is_primary BOOLEAN DEFAULT FALSE,
  consent_flags JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (student_id, guardian_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_student_guardians_org_id
  ON student_guardians(organization_id);

CREATE INDEX IF NOT EXISTS idx_student_guardians_student_id
  ON student_guardians(student_id);

CREATE INDEX IF NOT EXISTS idx_student_guardians_guardian_id
  ON student_guardians(guardian_id);

CREATE INDEX IF NOT EXISTS idx_student_guardians_relationship_id
  ON student_guardians(relationship_id);

-- =========================================
-- updated_at triggers
-- =========================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Guardians trigger
DROP TRIGGER IF EXISTS trg_guardians_updated_at ON guardians;
CREATE TRIGGER trg_guardians_updated_at
BEFORE UPDATE ON guardians
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Student guardians trigger
DROP TRIGGER IF EXISTS trg_student_guardians_updated_at ON student_guardians;
CREATE TRIGGER trg_student_guardians_updated_at
BEFORE UPDATE ON student_guardians
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- =========================================
-- Row Level Security (Supabase-friendly)
-- =========================================
ALTER TABLE guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_guardians ENABLE ROW LEVEL SECURITY;

-- Example policies (adjust to your auth model)

-- Guardians
CREATE POLICY "guardians_select"
ON guardians
FOR SELECT
USING (true);

CREATE POLICY "guardians_insert"
ON guardians
FOR INSERT
WITH CHECK (true);

CREATE POLICY "guardians_update"
ON guardians
FOR UPDATE
USING (true);

-- Student guardians
CREATE POLICY "student_guardians_select"
ON student_guardians
FOR SELECT
USING (true);

CREATE POLICY "student_guardians_insert"
ON student_guardians
FOR INSERT
WITH CHECK (true);

CREATE POLICY "student_guardians_update"
ON student_guardians
FOR UPDATE
USING (true);

-- =========================================
-- Documentation
-- =========================================
COMMENT ON TABLE guardians IS 'Stores guardian / parent information';
COMMENT ON COLUMN guardians.organization_id IS 'Scopes guardian to an organization';

COMMENT ON TABLE student_guardians IS
'Junction table linking students to guardians';

COMMENT ON COLUMN student_guardians.organization_id IS
'Organization scope for student-guardian relationship';

COMMENT ON COLUMN student_guardians.is_primary IS
'Indicates if this guardian is the primary guardian';

COMMENT ON COLUMN student_guardians.relationship_id IS
'FK to taxonomy_items.id (taxonomy key: guardian_relationship)';
