-- Migration: Create attendance_summary table
-- Created: 2024
-- Description: Creates attendance_summary table for storing aggregated attendance data by date and batch

-- Create attendance_summary table
CREATE TABLE IF NOT EXISTS attendance_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  batch_id UUID REFERENCES batches(id) ON DELETE CASCADE,
  present_count INTEGER NOT NULL DEFAULT 0,
  absent_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_attendance_summary_date ON attendance_summary(date);
CREATE INDEX IF NOT EXISTS idx_attendance_summary_batch_id ON attendance_summary(batch_id);
CREATE INDEX IF NOT EXISTS idx_attendance_summary_date_batch ON attendance_summary(date, batch_id);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_attendance_summary_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_attendance_summary_updated_at
  BEFORE UPDATE ON attendance_summary
  FOR EACH ROW
  EXECUTE FUNCTION update_attendance_summary_updated_at();

-- Add comments for documentation
COMMENT ON TABLE attendance_summary IS 'Stores aggregated attendance data by date and batch';
COMMENT ON COLUMN attendance_summary.date IS 'Date of attendance record';
COMMENT ON COLUMN attendance_summary.batch_id IS 'Foreign key to batches.id - attendance for a specific batch';
COMMENT ON COLUMN attendance_summary.present_count IS 'Number of students present';
COMMENT ON COLUMN attendance_summary.absent_count IS 'Number of students absent';
