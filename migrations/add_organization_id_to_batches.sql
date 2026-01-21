-- Migration: Add organization_id to batches table
-- Created: 2024
-- Description: Adds organization_id column to batches table for multi-tenant isolation

-- Add organization_id column
ALTER TABLE batches
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_batches_organization_id ON batches(organization_id);

-- Add comment
COMMENT ON COLUMN batches.organization_id IS 'Foreign key to organizations.id - scopes batch to organization';
