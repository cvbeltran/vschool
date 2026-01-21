-- Migration: Add student completion statuses (PROMOTED and GRADUATED)
-- Created: 2024
-- Description: Adds PROMOTED and GRADUATED status items to the student_status taxonomy

-- Get the taxonomy ID for student_status
DO $$
DECLARE
  v_taxonomy_id UUID;
BEGIN
  SELECT id INTO v_taxonomy_id FROM taxonomies WHERE key = 'student_status';
  
  IF v_taxonomy_id IS NOT NULL THEN
    -- Insert PROMOTED status
    INSERT INTO taxonomy_items (taxonomy_id, code, label, description, sort_order, is_active)
    VALUES
      (v_taxonomy_id, 'PROMOTED', 'Promoted', 'Student successfully passed and is promoted to the next level/grade', 4, true)
    ON CONFLICT (taxonomy_id, code) DO NOTHING;
    
    -- Insert GRADUATED status
    INSERT INTO taxonomy_items (taxonomy_id, code, label, description, sort_order, is_active)
    VALUES
      (v_taxonomy_id, 'GRADUATED', 'Graduated', 'Student completed the final year of their program', 5, true)
    ON CONFLICT (taxonomy_id, code) DO NOTHING;
  END IF;
END $$;

-- Add comments for documentation
COMMENT ON TABLE taxonomy_items IS 'Includes PROMOTED and GRADUATED statuses for tracking student completion';
