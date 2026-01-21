-- Migration: Add organization_id to staff table
-- Created: 2024
-- Description: Adds organization_id column to staff table for multi-tenant isolation

-- Add organization_id column
ALTER TABLE staff
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_staff_organization_id ON staff(organization_id);

-- Add comment
COMMENT ON COLUMN staff.organization_id IS 'Foreign key to organizations.id - scopes staff member to organization';
