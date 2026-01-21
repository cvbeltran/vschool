-- Migration: Create students table
-- Created: 2024
-- Description: Creates students table for managing student records with comprehensive demographic and contact information

-- Create students table
CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  admission_id UUID REFERENCES admissions(id) ON DELETE SET NULL,
  batch_id UUID REFERENCES batches(id) ON DELETE SET NULL,
  
  -- Identity fields
  legal_first_name TEXT,
  legal_last_name TEXT,
  preferred_name TEXT,
  date_of_birth DATE,
  sex_id UUID REFERENCES taxonomy_items(id) ON DELETE SET NULL,
  nationality TEXT,
  student_number VARCHAR(50),
  student_lrn VARCHAR(12),
  status UUID REFERENCES taxonomy_items(id) ON DELETE SET NULL,
  
  -- Contact fields
  primary_email TEXT,
  phone TEXT,
  address TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  
  -- Guardian fields (legacy - for backward compatibility)
  guardian_name TEXT,
  guardian_relationship_id UUID REFERENCES taxonomy_items(id) ON DELETE SET NULL,
  guardian_email TEXT,
  guardian_phone TEXT,
  consent_flags JSONB,
  
  -- Demographics fields
  economic_status_id UUID REFERENCES taxonomy_items(id) ON DELETE SET NULL,
  primary_language_id UUID REFERENCES taxonomy_items(id) ON DELETE SET NULL,
  special_needs_flag BOOLEAN DEFAULT FALSE,
  
  -- Education context fields
  previous_school TEXT,
  entry_type UUID REFERENCES taxonomy_items(id) ON DELETE SET NULL,
  notes TEXT,
  
  -- Legacy fields (for backward compatibility)
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  
  -- System fields
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_students_organization_id ON students(organization_id);
CREATE INDEX IF NOT EXISTS idx_students_admission_id ON students(admission_id);
CREATE INDEX IF NOT EXISTS idx_students_batch_id ON students(batch_id);
CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);
CREATE INDEX IF NOT EXISTS idx_students_sex_id ON students(sex_id);
CREATE INDEX IF NOT EXISTS idx_students_student_number ON students(student_number) WHERE student_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_students_student_lrn ON students(student_lrn) WHERE student_lrn IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_students_primary_email ON students(primary_email) WHERE primary_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_students_email ON students(email) WHERE email IS NOT NULL;

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_students_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_students_updated_at
  BEFORE UPDATE ON students
  FOR EACH ROW
  EXECUTE FUNCTION update_students_updated_at();

-- Add comments for documentation
COMMENT ON TABLE students IS 'Stores student records with comprehensive demographic and contact information';
COMMENT ON COLUMN students.organization_id IS 'Foreign key to organizations.id - scopes student to organization';
COMMENT ON COLUMN students.admission_id IS 'Foreign key to admissions.id - links student to admission record (1:1 traceability)';
COMMENT ON COLUMN students.batch_id IS 'Foreign key to batches.id - student batch assignment';
COMMENT ON COLUMN students.student_number IS 'Unique identifier assigned by the school to the student';
COMMENT ON COLUMN students.student_lrn IS '12-digit Learner Reference Number (LRN) assigned by DepEd';
COMMENT ON COLUMN students.status IS 'Foreign key to taxonomy_items.id (taxonomy key: student_status)';
COMMENT ON COLUMN students.sex_id IS 'Foreign key to taxonomy_items.id (taxonomy key: sex)';
COMMENT ON COLUMN students.guardian_relationship_id IS 'Foreign key to taxonomy_items.id (taxonomy key: guardian_relationship) - legacy field';
COMMENT ON COLUMN students.economic_status_id IS 'Foreign key to taxonomy_items.id (taxonomy key: economic_status)';
COMMENT ON COLUMN students.primary_language_id IS 'Foreign key to taxonomy_items.id (taxonomy key: language)';
COMMENT ON COLUMN students.entry_type IS 'Foreign key to taxonomy_items.id (taxonomy key: entry_type)';
