-- Migration: Add school_year_id to admissions table
-- Created: 2024
-- Description: Adds school_year_id column to link admissions to school years

-- Add school_year_id column
ALTER TABLE admissions
ADD COLUMN IF NOT EXISTS school_year_id UUID REFERENCES school_years(id);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_admissions_school_year_id ON admissions(school_year_id);

-- Add comment for documentation
COMMENT ON COLUMN admissions.school_year_id IS 'FK to school_years.id - links admission to the academic school year';
