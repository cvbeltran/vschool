-- Migration: Create staff table
-- Created: 2024
-- Description: Creates staff table for HR/201 file management with minimal required fields for initial creation

-- Create staff table
CREATE TABLE IF NOT EXISTS staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  staff_id VARCHAR(50) UNIQUE,
  first_name TEXT NOT NULL,
  middle_name TEXT,
  last_name TEXT NOT NULL,
  suffix TEXT, -- e.g., "Jr.", "Sr.", "II", "III"
  preferred_name TEXT,
  date_of_birth DATE,
  sex_id UUID REFERENCES taxonomy_items(id),
  civil_status_id UUID REFERENCES taxonomy_items(id),
  nationality TEXT,
  government_id_type_id UUID REFERENCES taxonomy_items(id),
  government_id_number TEXT,
  home_address TEXT,
  permanent_address TEXT,
  mobile_number TEXT,
  email_address TEXT NOT NULL, -- Synced with auth.users.email
  emergency_contact_name TEXT,
  emergency_contact_relationship_id UUID REFERENCES taxonomy_items(id),
  emergency_contact_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_staff_organization_id ON staff(organization_id);
CREATE INDEX IF NOT EXISTS idx_staff_user_id ON staff(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_staff_id ON staff(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_email_address ON staff(email_address);
CREATE INDEX IF NOT EXISTS idx_staff_sex_id ON staff(sex_id);
CREATE INDEX IF NOT EXISTS idx_staff_civil_status_id ON staff(civil_status_id);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_staff_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_staff_updated_at
  BEFORE UPDATE ON staff
  FOR EACH ROW
  EXECUTE FUNCTION update_staff_updated_at();

-- Add comments for documentation
COMMENT ON TABLE staff IS 'Stores staff identity and contact information (HR/201 file)';
COMMENT ON COLUMN staff.organization_id IS 'Foreign key to organizations.id - scopes staff member to organization';
COMMENT ON COLUMN staff.user_id IS 'Foreign key to auth.users.id - links staff to login account';
COMMENT ON COLUMN staff.staff_id IS 'Unique employee ID number assigned by the school';
COMMENT ON COLUMN staff.email_address IS 'Email address - should be synced with auth.users.email';
COMMENT ON COLUMN staff.suffix IS 'Name suffix (e.g., Jr., Sr., II, III)';
