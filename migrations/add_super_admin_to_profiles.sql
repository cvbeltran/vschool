-- Migration: Add is_super_admin to profiles table
-- Created: 2024
-- Description: Adds is_super_admin field to profiles table to support super admin users who can access all organizations

-- Add is_super_admin column
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT FALSE;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_profiles_is_super_admin ON profiles(is_super_admin) WHERE is_super_admin = TRUE;

-- Add comment
COMMENT ON COLUMN profiles.is_super_admin IS 'Whether this user is a super admin who can access all organizations (bypasses RLS)';
