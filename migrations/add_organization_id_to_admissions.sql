-- Migration: Add organization_id to admissions table
-- Created: 2024
-- Description: Adds organization_id column to admissions table for multi-tenant isolation

-- Add organization_id column
ALTER TABLE admissions
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_admissions_organization_id ON admissions(organization_id);

-- Add comment
COMMENT ON COLUMN admissions.organization_id IS 'Foreign key to organizations.id - scopes admission to organization';
