-- Migration: Create profiles table
-- Created: 2024
-- Description: Creates profiles table for user profiles linked to auth.users with organization and role information

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE RESTRICT,
  role TEXT NOT NULL,
  is_super_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_is_super_admin ON profiles(is_super_admin) WHERE is_super_admin = TRUE;

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_profiles_updated_at();

-- Add comments for documentation
COMMENT ON TABLE profiles IS 'Stores user profiles linked to auth.users with organization and role information';
COMMENT ON COLUMN profiles.id IS 'Foreign key to auth.users.id - one profile per user';
COMMENT ON COLUMN profiles.organization_id IS 'Foreign key to organizations.id - links user to their organization';
COMMENT ON COLUMN profiles.role IS 'User role: principal, admin, registrar, or teacher';
COMMENT ON COLUMN profiles.is_super_admin IS 'Whether this user is a super admin who can access all organizations';
