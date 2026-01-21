-- Migration: Create school_year_status taxonomy
-- Created: 2024
-- Description: Creates taxonomy for school year statuses (Planning, Active, Inactive)

-- Insert taxonomy record
INSERT INTO taxonomies (key, name, description, is_active, is_system)
VALUES (
  'school_year_status',
  'School Year Status',
  'Status of academic school years (Planning, Active, Inactive)',
  true,
  true
)
ON CONFLICT (key) DO NOTHING;

-- Get the taxonomy ID
DO $$
DECLARE
  v_taxonomy_id UUID;
BEGIN
  SELECT id INTO v_taxonomy_id FROM taxonomies WHERE key = 'school_year_status';
  
  IF v_taxonomy_id IS NOT NULL THEN
    -- Insert taxonomy items
    INSERT INTO taxonomy_items (taxonomy_id, code, label, description, sort_order, is_active)
    VALUES
      (v_taxonomy_id, 'PLANNING', 'Planning', 'School year is in planning phase', 1, true),
      (v_taxonomy_id, 'ACTIVE', 'Active', 'School year is currently active', 2, true),
      (v_taxonomy_id, 'INACTIVE', 'Inactive', 'School year is inactive', 3, true)
    ON CONFLICT (taxonomy_id, code) DO NOTHING;
  END IF;
END $$;
