-- Migration: Add organization_id to schools table
-- Created: 2024
-- Description: Adds organization_id column to schools table for multi-tenant isolation

-- Add organization_id column
ALTER TABLE schools
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_schools_organization_id ON schools(organization_id);

-- Add comment
COMMENT ON COLUMN schools.organization_id IS 'Foreign key to organizations.id - scopes school to organization';
