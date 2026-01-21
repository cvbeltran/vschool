-- Migration: Create taxonomies for staff management
-- Created: 2024
-- Description: Creates all required taxonomies for staff HR/201 file management

-- Insert taxonomies
INSERT INTO taxonomies (key, name, description, is_active, is_system)
VALUES 
  ('civil_status', 'Civil Status', 'Civil status options (Single, Married, Divorced, etc.)', true, true),
  ('government_id_type', 'Government ID Type', 'Types of government-issued identification', true, true),
  ('emergency_contact_relationship', 'Emergency Contact Relationship', 'Relationship to emergency contact', true, true),
  ('employment_status', 'Employment Status', 'Current employment status (Active, On Leave, etc.)', true, true),
  ('position_title', 'Position Title', 'Staff position titles (Principal, Teacher, Registrar, etc.)', true, true),
  ('department', 'Department', 'School departments (Math, Science, English, etc.)', true, true),
  ('subject_area', 'Subject Area', 'Subject areas taught (Mathematics, Science, English, etc.)', true, true),
  ('grade_level', 'Grade Level', 'Grade levels (Grade 1, Grade 2, etc.)', true, true),
  ('contract_type', 'Contract Type', 'Employment contract types (Permanent, Contractual, etc.)', true, true),
  ('pay_schedule', 'Pay Schedule', 'Payment schedule frequency (Monthly, Bi-weekly, etc.)', true, true),
  ('education_level', 'Education Level', 'Highest education level (Bachelor''s, Master''s, etc.)', true, true),
  ('eligibility_type', 'Eligibility Type', 'Professional eligibility types (LET, CS Professional, etc.)', true, true)
ON CONFLICT (key) DO NOTHING;

-- Insert taxonomy items for each taxonomy
DO $$ 
DECLARE 
  v_taxonomy_id UUID;
BEGIN
  -- Civil Status
  SELECT id INTO v_taxonomy_id FROM taxonomies WHERE key = 'civil_status';
  IF v_taxonomy_id IS NOT NULL THEN
    INSERT INTO taxonomy_items (taxonomy_id, code, label, description, sort_order, is_active)
    VALUES
      (v_taxonomy_id, 'SINGLE', 'Single', 'Single/unmarried', 1, true),
      (v_taxonomy_id, 'MARRIED', 'Married', 'Married', 2, true),
      (v_taxonomy_id, 'DIVORCED', 'Divorced', 'Divorced', 3, true),
      (v_taxonomy_id, 'WIDOWED', 'Widowed', 'Widowed', 4, true),
      (v_taxonomy_id, 'SEPARATED', 'Separated', 'Legally separated', 5, true)
    ON CONFLICT (taxonomy_id, code) DO NOTHING;
  END IF;

  -- Government ID Type
  SELECT id INTO v_taxonomy_id FROM taxonomies WHERE key = 'government_id_type';
  IF v_taxonomy_id IS NOT NULL THEN
    INSERT INTO taxonomy_items (taxonomy_id, code, label, description, sort_order, is_active)
    VALUES
      (v_taxonomy_id, 'PASSPORT', 'Passport', 'Philippine Passport', 1, true),
      (v_taxonomy_id, 'DRIVERS_LICENSE', 'Driver''s License', 'Driver''s License', 2, true),
      (v_taxonomy_id, 'POSTAL_ID', 'Postal ID', 'Postal ID', 3, true),
      (v_taxonomy_id, 'PHILHEALTH_ID', 'PhilHealth ID', 'PhilHealth ID', 4, true),
      (v_taxonomy_id, 'SSS_ID', 'SSS ID', 'Social Security System ID', 5, true),
      (v_taxonomy_id, 'TIN_ID', 'TIN ID', 'Tax Identification Number ID', 6, true),
      (v_taxonomy_id, 'VOTERS_ID', 'Voter''s ID', 'Voter''s Identification Card', 7, true),
      (v_taxonomy_id, 'PRC_ID', 'PRC ID', 'Professional Regulation Commission ID', 8, true)
    ON CONFLICT (taxonomy_id, code) DO NOTHING;
  END IF;

  -- Emergency Contact Relationship
  SELECT id INTO v_taxonomy_id FROM taxonomies WHERE key = 'emergency_contact_relationship';
  IF v_taxonomy_id IS NOT NULL THEN
    INSERT INTO taxonomy_items (taxonomy_id, code, label, description, sort_order, is_active)
    VALUES
      (v_taxonomy_id, 'SPOUSE', 'Spouse', 'Spouse', 1, true),
      (v_taxonomy_id, 'PARENT', 'Parent', 'Parent', 2, true),
      (v_taxonomy_id, 'SIBLING', 'Sibling', 'Brother or Sister', 3, true),
      (v_taxonomy_id, 'CHILD', 'Child', 'Son or Daughter', 4, true),
      (v_taxonomy_id, 'RELATIVE', 'Relative', 'Other relative', 5, true),
      (v_taxonomy_id, 'FRIEND', 'Friend', 'Friend', 6, true),
      (v_taxonomy_id, 'OTHER', 'Other', 'Other relationship', 7, true)
    ON CONFLICT (taxonomy_id, code) DO NOTHING;
  END IF;

  -- Employment Status
  SELECT id INTO v_taxonomy_id FROM taxonomies WHERE key = 'employment_status';
  IF v_taxonomy_id IS NOT NULL THEN
    INSERT INTO taxonomy_items (taxonomy_id, code, label, description, sort_order, is_active)
    VALUES
      (v_taxonomy_id, 'ACTIVE', 'Active', 'Currently active employment', 1, true),
      (v_taxonomy_id, 'ON_LEAVE', 'On Leave', 'On leave of absence', 2, true),
      (v_taxonomy_id, 'SUSPENDED', 'Suspended', 'Suspended from work', 3, true),
      (v_taxonomy_id, 'RESIGNED', 'Resigned', 'Resigned from position', 4, true),
      (v_taxonomy_id, 'TERMINATED', 'Terminated', 'Terminated from employment', 5, true),
      (v_taxonomy_id, 'RETIRED', 'Retired', 'Retired from service', 6, true)
    ON CONFLICT (taxonomy_id, code) DO NOTHING;
  END IF;

  -- Position Title (syncs with auth role)
  SELECT id INTO v_taxonomy_id FROM taxonomies WHERE key = 'position_title';
  IF v_taxonomy_id IS NOT NULL THEN
    INSERT INTO taxonomy_items (taxonomy_id, code, label, description, sort_order, is_active)
    VALUES
      (v_taxonomy_id, 'PRINCIPAL', 'Principal', 'School Principal', 1, true),
      (v_taxonomy_id, 'ADMIN', 'Administrator', 'School Administrator', 2, true),
      (v_taxonomy_id, 'REGISTRAR', 'Registrar', 'School Registrar', 3, true),
      (v_taxonomy_id, 'TEACHER', 'Teacher', 'Teacher', 4, true),
      (v_taxonomy_id, 'VICE_PRINCIPAL', 'Vice Principal', 'Vice Principal', 5, true),
      (v_taxonomy_id, 'COORDINATOR', 'Coordinator', 'Subject/Level Coordinator', 6, true),
      (v_taxonomy_id, 'GUIDANCE_COUNSELOR', 'Guidance Counselor', 'Guidance Counselor', 7, true),
      (v_taxonomy_id, 'LIBRARIAN', 'Librarian', 'School Librarian', 8, true),
      (v_taxonomy_id, 'NURSE', 'Nurse', 'School Nurse', 9, true),
      (v_taxonomy_id, 'SECRETARY', 'Secretary', 'School Secretary', 10, true),
      (v_taxonomy_id, 'ACCOUNTANT', 'Accountant', 'School Accountant', 11, true),
      (v_taxonomy_id, 'MAINTENANCE', 'Maintenance', 'Maintenance Staff', 12, true),
      (v_taxonomy_id, 'SECURITY', 'Security', 'Security Personnel', 13, true)
    ON CONFLICT (taxonomy_id, code) DO NOTHING;
  END IF;

  -- Department
  SELECT id INTO v_taxonomy_id FROM taxonomies WHERE key = 'department';
  IF v_taxonomy_id IS NOT NULL THEN
    INSERT INTO taxonomy_items (taxonomy_id, code, label, description, sort_order, is_active)
    VALUES
      (v_taxonomy_id, 'MATH', 'Mathematics', 'Mathematics Department', 1, true),
      (v_taxonomy_id, 'SCIENCE', 'Science', 'Science Department', 2, true),
      (v_taxonomy_id, 'ENGLISH', 'English', 'English Department', 3, true),
      (v_taxonomy_id, 'FILIPINO', 'Filipino', 'Filipino Department', 4, true),
      (v_taxonomy_id, 'SOCIAL_STUDIES', 'Social Studies', 'Social Studies Department', 5, true),
      (v_taxonomy_id, 'PE', 'Physical Education', 'Physical Education Department', 6, true),
      (v_taxonomy_id, 'ARTS', 'Arts', 'Arts Department', 7, true),
      (v_taxonomy_id, 'MUSIC', 'Music', 'Music Department', 8, true),
      (v_taxonomy_id, 'TECHNOLOGY', 'Technology', 'Technology Department', 9, true),
      (v_taxonomy_id, 'ADMINISTRATION', 'Administration', 'Administration Department', 10, true)
    ON CONFLICT (taxonomy_id, code) DO NOTHING;
  END IF;

  -- Subject Area
  SELECT id INTO v_taxonomy_id FROM taxonomies WHERE key = 'subject_area';
  IF v_taxonomy_id IS NOT NULL THEN
    INSERT INTO taxonomy_items (taxonomy_id, code, label, description, sort_order, is_active)
    VALUES
      (v_taxonomy_id, 'MATH', 'Mathematics', 'Mathematics', 1, true),
      (v_taxonomy_id, 'SCIENCE', 'Science', 'Science', 2, true),
      (v_taxonomy_id, 'ENGLISH', 'English', 'English Language', 3, true),
      (v_taxonomy_id, 'FILIPINO', 'Filipino', 'Filipino Language', 4, true),
      (v_taxonomy_id, 'SOCIAL_STUDIES', 'Social Studies', 'Social Studies', 5, true),
      (v_taxonomy_id, 'PE', 'Physical Education', 'Physical Education', 6, true),
      (v_taxonomy_id, 'ARTS', 'Arts', 'Arts', 7, true),
      (v_taxonomy_id, 'MUSIC', 'Music', 'Music', 8, true),
      (v_taxonomy_id, 'TECHNOLOGY', 'Technology', 'Technology/ICT', 9, true),
      (v_taxonomy_id, 'VALUES_EDUCATION', 'Values Education', 'Values Education', 10, true)
    ON CONFLICT (taxonomy_id, code) DO NOTHING;
  END IF;

  -- Grade Level
  SELECT id INTO v_taxonomy_id FROM taxonomies WHERE key = 'grade_level';
  IF v_taxonomy_id IS NOT NULL THEN
    INSERT INTO taxonomy_items (taxonomy_id, code, label, description, sort_order, is_active)
    VALUES
      (v_taxonomy_id, 'KINDER', 'Kindergarten', 'Kindergarten', 1, true),
      (v_taxonomy_id, 'GRADE_1', 'Grade 1', 'Grade 1', 2, true),
      (v_taxonomy_id, 'GRADE_2', 'Grade 2', 'Grade 2', 3, true),
      (v_taxonomy_id, 'GRADE_3', 'Grade 3', 'Grade 3', 4, true),
      (v_taxonomy_id, 'GRADE_4', 'Grade 4', 'Grade 4', 5, true),
      (v_taxonomy_id, 'GRADE_5', 'Grade 5', 'Grade 5', 6, true),
      (v_taxonomy_id, 'GRADE_6', 'Grade 6', 'Grade 6', 7, true),
      (v_taxonomy_id, 'GRADE_7', 'Grade 7', 'Grade 7', 8, true),
      (v_taxonomy_id, 'GRADE_8', 'Grade 8', 'Grade 8', 9, true),
      (v_taxonomy_id, 'GRADE_9', 'Grade 9', 'Grade 9', 10, true),
      (v_taxonomy_id, 'GRADE_10', 'Grade 10', 'Grade 10', 11, true),
      (v_taxonomy_id, 'GRADE_11', 'Grade 11', 'Grade 11', 12, true),
      (v_taxonomy_id, 'GRADE_12', 'Grade 12', 'Grade 12', 13, true)
    ON CONFLICT (taxonomy_id, code) DO NOTHING;
  END IF;

  -- Contract Type
  SELECT id INTO v_taxonomy_id FROM taxonomies WHERE key = 'contract_type';
  IF v_taxonomy_id IS NOT NULL THEN
    INSERT INTO taxonomy_items (taxonomy_id, code, label, description, sort_order, is_active)
    VALUES
      (v_taxonomy_id, 'PERMANENT', 'Permanent', 'Permanent employment', 1, true),
      (v_taxonomy_id, 'CONTRACTUAL', 'Contractual', 'Contractual employment', 2, true),
      (v_taxonomy_id, 'PART_TIME', 'Part-time', 'Part-time employment', 3, true),
      (v_taxonomy_id, 'PROBATIONARY', 'Probationary', 'Probationary period', 4, true),
      (v_taxonomy_id, 'SUBSTITUTE', 'Substitute', 'Substitute teacher', 5, true)
    ON CONFLICT (taxonomy_id, code) DO NOTHING;
  END IF;

  -- Pay Schedule
  SELECT id INTO v_taxonomy_id FROM taxonomies WHERE key = 'pay_schedule';
  IF v_taxonomy_id IS NOT NULL THEN
    INSERT INTO taxonomy_items (taxonomy_id, code, label, description, sort_order, is_active)
    VALUES
      (v_taxonomy_id, 'MONTHLY', 'Monthly', 'Monthly payment', 1, true),
      (v_taxonomy_id, 'BI_WEEKLY', 'Bi-weekly', 'Bi-weekly payment', 2, true),
      (v_taxonomy_id, 'WEEKLY', 'Weekly', 'Weekly payment', 3, true),
      (v_taxonomy_id, 'SEMI_MONTHLY', 'Semi-monthly', 'Semi-monthly payment', 4, true)
    ON CONFLICT (taxonomy_id, code) DO NOTHING;
  END IF;

  -- Education Level
  SELECT id INTO v_taxonomy_id FROM taxonomies WHERE key = 'education_level';
  IF v_taxonomy_id IS NOT NULL THEN
    INSERT INTO taxonomy_items (taxonomy_id, code, label, description, sort_order, is_active)
    VALUES
      (v_taxonomy_id, 'HIGH_SCHOOL', 'High School', 'High School Graduate', 1, true),
      (v_taxonomy_id, 'VOCATIONAL', 'Vocational', 'Vocational/Trade School', 2, true),
      (v_taxonomy_id, 'ASSOCIATES', 'Associate''s Degree', 'Associate''s Degree', 3, true),
      (v_taxonomy_id, 'BACHELORS', 'Bachelor''s Degree', 'Bachelor''s Degree', 4, true),
      (v_taxonomy_id, 'MASTERS', 'Master''s Degree', 'Master''s Degree', 5, true),
      (v_taxonomy_id, 'DOCTORATE', 'Doctorate', 'Doctorate Degree', 6, true),
      (v_taxonomy_id, 'POST_DOCTORATE', 'Post-Doctorate', 'Post-Doctorate', 7, true)
    ON CONFLICT (taxonomy_id, code) DO NOTHING;
  END IF;

  -- Eligibility Type
  SELECT id INTO v_taxonomy_id FROM taxonomies WHERE key = 'eligibility_type';
  IF v_taxonomy_id IS NOT NULL THEN
    INSERT INTO taxonomy_items (taxonomy_id, code, label, description, sort_order, is_active)
    VALUES
      (v_taxonomy_id, 'LET', 'LET', 'Licensure Examination for Teachers', 1, true),
      (v_taxonomy_id, 'CS_PROFESSIONAL', 'CS Professional', 'Civil Service Professional', 2, true),
      (v_taxonomy_id, 'CS_SUBPROFESSIONAL', 'CS Subprofessional', 'Civil Service Subprofessional', 3, true),
      (v_taxonomy_id, 'BAR', 'Bar', 'Bar Examination', 4, true),
      (v_taxonomy_id, 'BOARD', 'Board', 'Board Examination', 5, true),
      (v_taxonomy_id, 'NONE', 'None', 'No eligibility', 6, true)
    ON CONFLICT (taxonomy_id, code) DO NOTHING;
  END IF;
END $$;
