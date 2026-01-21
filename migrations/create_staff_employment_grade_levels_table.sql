-- Migration: Create staff_employment_grade_levels junction table
-- Created: 2024
-- Description: Creates junction table for many-to-many relationship between staff_employment and grade_levels

-- Create staff_employment_grade_levels junction table
CREATE TABLE IF NOT EXISTS staff_employment_grade_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_employment_id UUID NOT NULL REFERENCES staff_employment(id) ON DELETE CASCADE,
  grade_level_id UUID NOT NULL REFERENCES taxonomy_items(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(staff_employment_id, grade_level_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_staff_employment_grade_levels_employment_id ON staff_employment_grade_levels(staff_employment_id);
CREATE INDEX IF NOT EXISTS idx_staff_employment_grade_levels_grade_level_id ON staff_employment_grade_levels(grade_level_id);

-- Add comments for documentation
COMMENT ON TABLE staff_employment_grade_levels IS 'Junction table for many-to-many relationship between staff_employment and grade_levels taxonomy';
COMMENT ON COLUMN staff_employment_grade_levels.staff_employment_id IS 'Foreign key to staff_employment.id';
COMMENT ON COLUMN staff_employment_grade_levels.grade_level_id IS 'Foreign key to taxonomy_items.id (taxonomy key: grade_level)';
