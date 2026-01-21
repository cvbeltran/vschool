-- Migration: Add organization_id to sections table
-- Created: 2024
-- Description: Adds organization_id column to sections table for multi-tenant isolation

-- Add organization_id column
ALTER TABLE sections
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_sections_organization_id ON sections(organization_id);

-- Add comment
COMMENT ON COLUMN sections.organization_id IS 'Foreign key to organizations.id - scopes section to organization';
