-- Migration: Add organization_id to student_guardians table
-- Created: 2024
-- Description: Adds organization_id column to student_guardians table for multi-tenant isolation

-- Add organization_id column
ALTER TABLE student_guardians
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_student_guardians_organization_id ON student_guardians(organization_id);

-- Add comment
COMMENT ON COLUMN student_guardians.organization_id IS 'Foreign key to organizations.id - scopes student-guardian relationship to organization';
