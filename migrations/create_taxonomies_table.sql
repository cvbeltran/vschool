-- Migration: Create taxonomies table
-- Created: 2024
-- Description: Creates taxonomies table for managing taxonomy definitions (e.g., sex, student_status, economic_status)

-- Create taxonomies table
CREATE TABLE IF NOT EXISTS taxonomies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_taxonomies_key ON taxonomies(key);
CREATE INDEX IF NOT EXISTS idx_taxonomies_is_active ON taxonomies(is_active);
CREATE INDEX IF NOT EXISTS idx_taxonomies_is_system ON taxonomies(is_system);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_taxonomies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_taxonomies_updated_at
  BEFORE UPDATE ON taxonomies
  FOR EACH ROW
  EXECUTE FUNCTION update_taxonomies_updated_at();

-- Add comments for documentation
COMMENT ON TABLE taxonomies IS 'Stores taxonomy definitions (e.g., sex, student_status, economic_status)';
COMMENT ON COLUMN taxonomies.key IS 'Unique lowercase identifier (e.g., "sex", "student_status")';
COMMENT ON COLUMN taxonomies.name IS 'Display name for the taxonomy';
COMMENT ON COLUMN taxonomies.is_system IS 'Whether this is a system taxonomy that cannot be deleted';
