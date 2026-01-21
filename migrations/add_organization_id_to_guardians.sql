-- Migration: Add organization_id to guardians table
-- Created: 2024
-- Description: Adds organization_id column to guardians table for multi-tenant isolation

-- Add organization_id column
ALTER TABLE guardians
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_guardians_organization_id ON guardians(organization_id);

-- Add comment
COMMENT ON COLUMN guardians.organization_id IS 'Foreign key to organizations.id - scopes guardian to organization';
