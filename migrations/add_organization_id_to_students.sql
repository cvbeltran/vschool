-- Migration: Add organization_id to students table
-- Created: 2024
-- Description: Adds organization_id column to students table for multi-tenant isolation

-- Add organization_id column
ALTER TABLE students
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_students_organization_id ON students(organization_id);

-- Add comment
COMMENT ON COLUMN students.organization_id IS 'Foreign key to organizations.id - scopes student to organization';
