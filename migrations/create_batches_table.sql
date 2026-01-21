-- Migration: Create batches table
-- Created: 2024
-- Description: Creates batches table for managing student batches

-- Create batches table
CREATE TABLE IF NOT EXISTS batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT,
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_batches_organization_id ON batches(organization_id);
CREATE INDEX IF NOT EXISTS idx_batches_status ON batches(status);
CREATE INDEX IF NOT EXISTS idx_batches_start_date ON batches(start_date);
CREATE INDEX IF NOT EXISTS idx_batches_end_date ON batches(end_date);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_batches_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_batches_updated_at
  BEFORE UPDATE ON batches
  FOR EACH ROW
  EXECUTE FUNCTION update_batches_updated_at();

-- Add comments for documentation
COMMENT ON TABLE batches IS 'Stores student batches';
COMMENT ON COLUMN batches.organization_id IS 'Foreign key to organizations.id - scopes batch to organization';
COMMENT ON COLUMN batches.status IS 'Batch status';
COMMENT ON COLUMN batches.start_date IS 'Batch start date';
COMMENT ON COLUMN batches.end_date IS 'Batch end date';
