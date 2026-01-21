-- Migration: Add organization_id to profiles table
-- Created: 2024
-- Description: Adds organization_id column to profiles table to link users to organizations

-- Add organization_id column
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE RESTRICT;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON profiles(organization_id);

-- Add comment
COMMENT ON COLUMN profiles.organization_id IS 'Foreign key to organizations.id - links user to their organization';
