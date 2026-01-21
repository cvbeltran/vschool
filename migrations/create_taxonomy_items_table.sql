-- Migration: Create taxonomy_items table
-- Created: 2024
-- Description: Creates taxonomy_items table for storing individual taxonomy items (e.g., MALE, FEMALE for sex taxonomy)

-- Create taxonomy_items table
CREATE TABLE IF NOT EXISTS taxonomy_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  taxonomy_id UUID NOT NULL REFERENCES taxonomies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(taxonomy_id, code)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_taxonomy_items_taxonomy_id ON taxonomy_items(taxonomy_id);
CREATE INDEX IF NOT EXISTS idx_taxonomy_items_code ON taxonomy_items(code);
CREATE INDEX IF NOT EXISTS idx_taxonomy_items_is_active ON taxonomy_items(is_active);
CREATE INDEX IF NOT EXISTS idx_taxonomy_items_sort_order ON taxonomy_items(sort_order);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_taxonomy_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_taxonomy_items_updated_at
  BEFORE UPDATE ON taxonomy_items
  FOR EACH ROW
  EXECUTE FUNCTION update_taxonomy_items_updated_at();

-- Add comments for documentation
COMMENT ON TABLE taxonomy_items IS 'Stores individual taxonomy items (e.g., MALE, FEMALE for sex taxonomy)';
COMMENT ON COLUMN taxonomy_items.taxonomy_id IS 'Foreign key to taxonomies.id';
COMMENT ON COLUMN taxonomy_items.code IS 'Unique code within taxonomy (e.g., "MALE", "FEMALE", "ACTIVE")';
COMMENT ON COLUMN taxonomy_items.label IS 'Display label for the taxonomy item';
COMMENT ON COLUMN taxonomy_items.sort_order IS 'Custom sort order for displaying items';
