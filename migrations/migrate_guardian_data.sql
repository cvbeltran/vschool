-- Migration: Migrate existing guardian data from students table to guardians table
-- Created: 2024
-- Description: Migrates guardian information from students table to the new guardians and student_guardians tables
-- Note: Email is used as the primary identifier for duplicate detection. Guardians with the same email
-- are considered the same person, regardless of name or phone differences.

-- Step 1: Insert unique guardians from students table into guardians table
-- Group by name, email, and phone to identify unique guardians
-- Priority: Email is the primary identifier for duplicate detection
INSERT INTO guardians (name, email, phone, created_at)
SELECT DISTINCT
  guardian_name AS name,
  guardian_email AS email,
  guardian_phone AS phone,
  MIN(created_at) AS created_at
FROM students
WHERE guardian_name IS NOT NULL
  AND guardian_name != ''
GROUP BY guardian_name, guardian_email, guardian_phone
ON CONFLICT DO NOTHING;

-- Step 2: Create student_guardian relationships
-- Link students to their guardians using the student_guardians junction table
INSERT INTO student_guardians (student_id, guardian_id, relationship_id, is_primary, consent_flags, created_at)
SELECT 
  s.id AS student_id,
  g.id AS guardian_id,
  s.guardian_relationship_id AS relationship_id,
  TRUE AS is_primary, -- Mark as primary since these are the existing guardian records
  s.consent_flags AS consent_flags,
  s.created_at AS created_at
FROM students s
INNER JOIN guardians g ON 
  g.name = s.guardian_name
  AND (g.email = s.guardian_email OR (g.email IS NULL AND s.guardian_email IS NULL))
  AND (g.phone = s.guardian_phone OR (g.phone IS NULL AND s.guardian_phone IS NULL))
WHERE s.guardian_name IS NOT NULL
  AND s.guardian_name != ''
ON CONFLICT (student_id, guardian_id) DO NOTHING;

-- Note: After this migration, the guardian columns in the students table can be kept for backward compatibility
-- or removed in a future migration once all code has been updated to use the new structure.
