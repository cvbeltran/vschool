-- Migration: Create staff_compliance table
-- Created: 2024
-- Description: Creates staff_compliance table for compliance documents with expiry dates

-- Create staff_compliance table
CREATE TABLE IF NOT EXISTS staff_compliance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID UNIQUE NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  medical_clearance_date DATE,
  medical_clearance_expiry_date DATE,
  medical_clearance_status TEXT, -- "VALID", "EXPIRED", "PENDING" (or use taxonomy)
  nbi_clearance_date DATE,
  nbi_clearance_expiry_date DATE,
  nbi_clearance_status TEXT,
  police_clearance_date DATE,
  police_clearance_expiry_date DATE,
  police_clearance_status TEXT,
  barangay_clearance_date DATE,
  barangay_clearance_expiry_date DATE,
  barangay_clearance_status TEXT,
  drug_test_date DATE,
  drug_test_expiry_date DATE, -- If applicable
  drug_test_result TEXT, -- "PASSED", "FAILED", "PENDING" (or use taxonomy)
  data_privacy_consent BOOLEAN DEFAULT FALSE,
  data_privacy_consent_date DATE,
  code_of_conduct_acknowledged BOOLEAN DEFAULT FALSE,
  code_of_conduct_acknowledged_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_staff_compliance_staff_id ON staff_compliance(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_compliance_medical_expiry ON staff_compliance(medical_clearance_expiry_date) WHERE medical_clearance_expiry_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_staff_compliance_nbi_expiry ON staff_compliance(nbi_clearance_expiry_date) WHERE nbi_clearance_expiry_date IS NOT NULL;

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_staff_compliance_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_staff_compliance_updated_at
  BEFORE UPDATE ON staff_compliance
  FOR EACH ROW
  EXECUTE FUNCTION update_staff_compliance_updated_at();

-- Add comments for documentation
COMMENT ON TABLE staff_compliance IS 'Stores compliance documents and clearances with expiry dates for staff members';
COMMENT ON COLUMN staff_compliance.staff_id IS 'Foreign key to staff.id - one-to-one relationship';
COMMENT ON COLUMN staff_compliance.medical_clearance_status IS 'Status of medical clearance: VALID, EXPIRED, PENDING';
COMMENT ON COLUMN staff_compliance.drug_test_result IS 'Result of drug test: PASSED, FAILED, PENDING';
