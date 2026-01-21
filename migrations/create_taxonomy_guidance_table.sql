-- Migration: Create taxonomy_guidance table
-- Created: 2024
-- Description: Creates taxonomy_guidance table for storing guidance text associated with taxonomy items

-- Create taxonomy_guidance table
CREATE TABLE IF NOT EXISTS taxonomy_guidance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  taxonomy_item_id UUID NOT NULL REFERENCES taxonomy_items(id) ON DELETE CASCADE,
  guidance_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_taxonomy_guidance_taxonomy_item_id ON taxonomy_guidance(taxonomy_item_id);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_taxonomy_guidance_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_taxonomy_guidance_updated_at
  BEFORE UPDATE ON taxonomy_guidance
  FOR EACH ROW
  EXECUTE FUNCTION update_taxonomy_guidance_updated_at();

-- Add comments for documentation
COMMENT ON TABLE taxonomy_guidance IS 'Stores guidance text associated with taxonomy items';
COMMENT ON COLUMN taxonomy_guidance.taxonomy_item_id IS 'Foreign key to taxonomy_items.id';
