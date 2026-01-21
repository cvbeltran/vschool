-- Migration: Create organization_taxonomy_items table
-- Created: 2024
-- Description: Creates junction table linking organizations to custom taxonomy items for shared templates + organization-specific customization

-- Create organization_taxonomy_items table
CREATE TABLE IF NOT EXISTS organization_taxonomy_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  taxonomy_item_id UUID NOT NULL REFERENCES taxonomy_items(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one organization can only link to a taxonomy item once
  UNIQUE(organization_id, taxonomy_item_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_org_taxonomy_items_org_id ON organization_taxonomy_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_taxonomy_items_taxonomy_item_id ON organization_taxonomy_items(taxonomy_item_id);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_organization_taxonomy_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_organization_taxonomy_items_updated_at
  BEFORE UPDATE ON organization_taxonomy_items
  FOR EACH ROW
  EXECUTE FUNCTION update_organization_taxonomy_items_updated_at();

-- Add comments for documentation
COMMENT ON TABLE organization_taxonomy_items IS 'Junction table linking organizations to custom taxonomy items. Allows organizations to use shared taxonomy templates plus add their own custom taxonomy items.';
COMMENT ON COLUMN organization_taxonomy_items.organization_id IS 'Foreign key to organizations.id';
COMMENT ON COLUMN organization_taxonomy_items.taxonomy_item_id IS 'Foreign key to taxonomy_items.id - the custom taxonomy item for this organization';
