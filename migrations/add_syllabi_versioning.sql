-- Migration: Add versioning fields to syllabi table
-- Purpose: Support revision/versioning workflow for published syllabi
-- Date: 2024

-- Add versioning fields to syllabi table
ALTER TABLE syllabi
  ADD COLUMN IF NOT EXISTS version_number INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parent_syllabus_id UUID REFERENCES syllabi(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS published_by UUID REFERENCES profiles(id);

-- Add index for parent_syllabus_id (for finding revisions)
CREATE INDEX IF NOT EXISTS idx_syllabi_parent_syllabus_id ON syllabi(parent_syllabus_id) WHERE parent_syllabus_id IS NOT NULL;

-- Add index for version_number (for version history queries)
CREATE INDEX IF NOT EXISTS idx_syllabi_version_number ON syllabi(version_number);

-- Comments
COMMENT ON COLUMN syllabi.version_number IS 'Version number for revision tracking. Incremented when creating new revision.';
COMMENT ON COLUMN syllabi.parent_syllabus_id IS 'Reference to parent syllabus if this is a revision. NULL for original syllabus.';
COMMENT ON COLUMN syllabi.published_at IS 'Timestamp when syllabus was published. NULL for draft syllabi.';
COMMENT ON COLUMN syllabi.published_by IS 'User who published the syllabus. NULL for draft syllabi.';
