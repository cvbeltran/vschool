-- Migration: Add student_number and student_lrn columns to students table
-- Created: 2024
-- Description: Adds student_number and student_lrn (Learner Reference Number) fields to the students table

-- Add student_number column (nullable, can be unique if needed)
ALTER TABLE students
ADD COLUMN IF NOT EXISTS student_number VARCHAR(50) NULL;

-- Add student_lrn column (12-digit Learner Reference Number, nullable)
ALTER TABLE students
ADD COLUMN IF NOT EXISTS student_lrn VARCHAR(12) NULL;

-- Optional: Add unique constraint on student_number if it should be unique
-- Uncomment the following line if student_number should be unique:
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_students_student_number_unique ON students(student_number) WHERE student_number IS NOT NULL;

-- Optional: Add unique constraint on student_lrn if it should be unique
-- Uncomment the following line if student_lrn should be unique:
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_students_student_lrn_unique ON students(student_lrn) WHERE student_lrn IS NOT NULL;

-- Optional: Add check constraint to ensure LRN is exactly 12 digits (if numeric)
-- Uncomment the following if LRN should be exactly 12 digits:
-- ALTER TABLE students
-- ADD CONSTRAINT chk_student_lrn_format CHECK (student_lrn IS NULL OR LENGTH(student_lrn) = 12);

-- Add comments for documentation
COMMENT ON COLUMN students.student_number IS 'Unique identifier assigned by the school to the student';
COMMENT ON COLUMN students.student_lrn IS '12-digit Learner Reference Number (LRN) assigned by DepEd';
