-- Migration: Add organization_id to programs table
-- Created: 2024
-- Description: Adds organization_id column to programs table for multi-tenant isolation

-- Add organization_id column
ALTER TABLE programs
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_programs_organization_id ON programs(organization_id);

-- Add comment
COMMENT ON COLUMN programs.organization_id IS 'Foreign key to organizations.id - scopes program to organization';
