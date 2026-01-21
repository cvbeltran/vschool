-- Migration: Create school_years table
-- Created: 2024
-- Description: Creates school_years table for managing academic school years with status taxonomy

-- Create school_years table
CREATE TABLE IF NOT EXISTS school_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  year_label VARCHAR(20) NOT NULL,
  status_id UUID NOT NULL REFERENCES taxonomy_items(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_end_after_start CHECK (end_date > start_date)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_school_years_status_id ON school_years(status_id);
CREATE INDEX IF NOT EXISTS idx_school_years_start_date ON school_years(start_date);
CREATE INDEX IF NOT EXISTS idx_school_years_end_date ON school_years(end_date);
CREATE INDEX IF NOT EXISTS idx_school_years_year_label ON school_years(year_label);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_school_years_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_school_years_updated_at
  BEFORE UPDATE ON school_years
  FOR EACH ROW
  EXECUTE FUNCTION update_school_years_updated_at();

-- Add comments for documentation
COMMENT ON TABLE school_years IS 'Stores academic school years with start/end dates and status';
COMMENT ON COLUMN school_years.year_label IS 'Auto-generated label combining start and end year (e.g., "2026-2027")';
COMMENT ON COLUMN school_years.status_id IS 'FK to taxonomy_items.id (taxonomy key: school_year_status)';
