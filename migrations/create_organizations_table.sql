-- Migration: Create organizations table
-- Created: 2024
-- Description: Creates organizations table for multi-tenant system with basic info and settings fields

-- Create organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Basic info (required at sign-up)
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  contact_number TEXT,
  registered_business_address TEXT NOT NULL,
  
  -- Settings (editable later in organization settings)
  website TEXT,
  logo_url TEXT,
  tax_id TEXT,
  registration_number TEXT,
  phone TEXT,
  fax TEXT,
  description TEXT,
  timezone TEXT DEFAULT 'UTC',
  currency TEXT DEFAULT 'USD',
  
  -- System fields
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT org_email_unique UNIQUE(email)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_organizations_email ON organizations(email);
CREATE INDEX IF NOT EXISTS idx_organizations_name ON organizations(name);
CREATE INDEX IF NOT EXISTS idx_organizations_is_active ON organizations(is_active);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_organizations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_organizations_updated_at();

-- Add comments for documentation
COMMENT ON TABLE organizations IS 'Stores organization information for multi-tenant system';
COMMENT ON COLUMN organizations.name IS 'Organization name';
COMMENT ON COLUMN organizations.email IS 'Organization contact email (unique)';
COMMENT ON COLUMN organizations.registered_business_address IS 'Registered business address';
COMMENT ON COLUMN organizations.is_active IS 'Whether the organization is active';
