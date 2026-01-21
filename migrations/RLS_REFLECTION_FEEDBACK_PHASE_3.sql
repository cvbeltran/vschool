-- Migration: Add Row Level Security (RLS) policies for Phase 3 Reflection & Feedback System
-- Created: 2024
-- Description: Creates RLS policies for Phase 3 Reflection & Feedback tables
-- Enforces tenant isolation, role-based access control, row ownership, and privacy
-- Super admins can bypass RLS checks and access all data
--
-- HARDENING NOTES:
--   - All SECURITY DEFINER functions set search_path = public, auth
--   - Policies made idempotent with DROP POLICY IF EXISTS
--   - Org isolation enforced via organization_id
--   - School scoping via can_access_school(school_id)
--   - No computation, scoring, or aggregation in policies
--   - Anonymization handled via VIEW (Option A) - see v_student_feedback_teacher_view below

-- ============================================================================
-- README: Role Taxonomy, Policy Intent, and Dependencies
-- ============================================================================

-- ROLE TAXONOMY (Canonical Roles for Phase 3):
--   principal: Full CRUD on prompts/dimensions, READ all reflections/feedback
--   admin: Same as principal
--   registrar: READ-ONLY for all Phase 3 data (monitoring)
--   mentor/teacher: CREATE/UPDATE own reflections, READ aligned student feedback
--   student: CREATE/UPDATE own feedback, READ own feedback history

-- POLICY INTENT PER TABLE:
--   reflection_prompts:
--     - SELECT: principal, admin, registrar, mentor/teacher (all org members)
--     - INSERT/UPDATE: principal, admin only
--     - DELETE: Disallow (use archived_at for soft deletes)
--
--   feedback_dimensions:
--     - SELECT: principal, admin, registrar, mentor/teacher, student (students need to see dimensions to submit feedback)
--     - INSERT/UPDATE: principal, admin only
--     - DELETE: Disallow (use archived_at for soft deletes)
--
--   teacher_reflections:
--     - SELECT: principal/admin/registrar (all in org/school), teacher (own only)
--     - INSERT: teacher for self only (teacher_id and created_by must equal current_profile_id())
--     - UPDATE: teacher (own only), admin/principal (all)
--     - DELETE: Disallow (use archived_at)
--
--   student_feedback:
--     - SELECT: principal/admin/registrar (all in org/school), student (own only),
--               teacher (completed feedback where teacher_id = current_profile_id())
--     - INSERT: student for self only (student_id = current_student_id(), created_by = current_profile_id())
--     - UPDATE: student (own only)
--     - DELETE: Disallow (use archived_at)

-- DEPENDENCIES:
--   - Uses helper functions from Phase 2 RLS (is_super_admin, current_profile_id, etc.)
--   - Assumes profile-student linking exists (for current_student_id())
--   - Teachers are identified via is_mentor() (normalizes teacher/faculty -> mentor)

-- ============================================================================
-- Helper Functions (Reuse Phase 2 helpers, add Phase 3 specific if needed)
-- ============================================================================

-- Note: All helper functions from Phase 2 RLS are assumed to exist:
--   - is_super_admin(user_id)
--   - current_profile_id()
--   - current_organization_id()
--   - current_user_role()
--   - current_school_id()
--   - current_student_id()
--   - is_org_admin()
--   - is_registrar()
--   - is_mentor() (normalizes teacher/faculty -> mentor)
--   - is_student()
--   - can_access_school(school_id_param)

-- ============================================================================
-- Enable Row Level Security on Phase 3 Tables
-- ============================================================================

ALTER TABLE reflection_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_dimensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_reflections ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_feedback ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- reflection_prompts: RLS Policies
-- ============================================================================

-- SELECT: principal, admin, registrar, mentor/teacher (all org members)
DROP POLICY IF EXISTS "reflection_prompts_select_org_members" ON reflection_prompts;
CREATE POLICY "reflection_prompts_select_org_members"
  ON reflection_prompts FOR SELECT
  USING (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND (archived_at IS NULL)
    AND (is_org_admin() OR is_registrar() OR is_mentor())
  );

-- INSERT: principal, admin only
DROP POLICY IF EXISTS "reflection_prompts_insert_admin" ON reflection_prompts;
CREATE POLICY "reflection_prompts_insert_admin"
  ON reflection_prompts FOR INSERT
  WITH CHECK (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND is_org_admin()
  );

-- UPDATE: principal, admin only
DROP POLICY IF EXISTS "reflection_prompts_update_admin" ON reflection_prompts;
CREATE POLICY "reflection_prompts_update_admin"
  ON reflection_prompts FOR UPDATE
  USING (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND is_org_admin()
  )
  WITH CHECK (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND is_org_admin()
  );

-- DELETE: Disallow (use archived_at)
-- No DELETE policy - hard deletes are forbidden

-- ============================================================================
-- feedback_dimensions: RLS Policies
-- ============================================================================

-- SELECT: principal, admin, registrar, mentor/teacher, student (students need to see dimensions to submit feedback)
DROP POLICY IF EXISTS "feedback_dimensions_select_org_members" ON feedback_dimensions;
CREATE POLICY "feedback_dimensions_select_org_members"
  ON feedback_dimensions FOR SELECT
  USING (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND (archived_at IS NULL)
    AND (is_org_admin() OR is_registrar() OR is_mentor() OR is_student())
  );

-- INSERT: principal, admin only
DROP POLICY IF EXISTS "feedback_dimensions_insert_admin" ON feedback_dimensions;
CREATE POLICY "feedback_dimensions_insert_admin"
  ON feedback_dimensions FOR INSERT
  WITH CHECK (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND is_org_admin()
  );

-- UPDATE: principal, admin only
DROP POLICY IF EXISTS "feedback_dimensions_update_admin" ON feedback_dimensions;
CREATE POLICY "feedback_dimensions_update_admin"
  ON feedback_dimensions FOR UPDATE
  USING (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND is_org_admin()
  )
  WITH CHECK (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND is_org_admin()
  );

-- DELETE: Disallow (use archived_at)
-- No DELETE policy - hard deletes are forbidden

-- ============================================================================
-- teacher_reflections: RLS Policies
-- ============================================================================

-- SELECT: Multi-role access
-- principal/admin/registrar: All within org (and school if applicable)
-- teacher: Own reflections only (teacher_id = current_profile_id())
DROP POLICY IF EXISTS "teacher_reflections_select_multi_role" ON teacher_reflections;
CREATE POLICY "teacher_reflections_select_multi_role"
  ON teacher_reflections FOR SELECT
  USING (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND (archived_at IS NULL)
    AND (
      -- Org admins and registrars see all
      (is_org_admin() OR is_registrar()) OR
      -- Teachers see own reflections only
      (is_mentor() AND teacher_id = current_profile_id())
    )
  );

-- INSERT: teacher for self only
-- Enforce: teacher_id and created_by must equal current_profile_id()
DROP POLICY IF EXISTS "teacher_reflections_insert_teacher_self" ON teacher_reflections;
CREATE POLICY "teacher_reflections_insert_teacher_self"
  ON teacher_reflections FOR INSERT
  WITH CHECK (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND (
      is_org_admin() OR
      (is_mentor() AND teacher_id = current_profile_id())
    )
    AND created_by = current_profile_id()
  );

-- UPDATE: teacher (own only), admin/principal (all)
DROP POLICY IF EXISTS "teacher_reflections_update_teacher_admin" ON teacher_reflections;
CREATE POLICY "teacher_reflections_update_teacher_admin"
  ON teacher_reflections FOR UPDATE
  USING (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND (
      is_org_admin() OR
      (is_mentor() AND teacher_id = current_profile_id())
    )
  )
  WITH CHECK (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND (
      is_org_admin() OR
      (is_mentor() AND teacher_id = current_profile_id())
    )
  );

-- DELETE: Disallow (use archived_at)
-- No DELETE policy - hard deletes are forbidden

-- ============================================================================
-- student_feedback: RLS Policies
-- ============================================================================

-- SELECT: Multi-role access
-- principal/admin/registrar: All within org (and school if applicable)
-- student: Own feedback only (student_id = current_student_id())
-- teacher: Completed feedback where teacher_id = current_profile_id()
DROP POLICY IF EXISTS "student_feedback_select_multi_role" ON student_feedback;
CREATE POLICY "student_feedback_select_multi_role"
  ON student_feedback FOR SELECT
  USING (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND (archived_at IS NULL)
    AND (
      -- Org admins and registrars see all
      (is_org_admin() OR is_registrar()) OR
      -- Students see own feedback only
      (is_student() AND student_id = current_student_id()) OR
      -- Teachers see completed feedback where they are the teacher being given feedback about
      (is_mentor() AND teacher_id = current_profile_id() AND status = 'completed')
    )
  );

-- INSERT: student for self only
-- Enforce: student_id = current_student_id() and created_by = current_profile_id()
DROP POLICY IF EXISTS "student_feedback_insert_student_self" ON student_feedback;
CREATE POLICY "student_feedback_insert_student_self"
  ON student_feedback FOR INSERT
  WITH CHECK (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND is_student()
    AND student_id = current_student_id()
    AND created_by = current_profile_id()
  );

-- UPDATE: student (own only)
DROP POLICY IF EXISTS "student_feedback_update_student_self" ON student_feedback;
CREATE POLICY "student_feedback_update_student_self"
  ON student_feedback FOR UPDATE
  USING (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND is_student()
    AND student_id = current_student_id()
  )
  WITH CHECK (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND is_student()
    AND student_id = current_student_id()
  );

-- DELETE: Disallow (use archived_at)
-- No DELETE policy - hard deletes are forbidden

-- ============================================================================
-- Anonymization: VIEW for Teacher Consumption (Option A)
-- ============================================================================

-- Create a VIEW that omits student_id when is_anonymous=true
-- This allows teachers to see feedback aligned to their reflections without
-- seeing student identity when anonymization is requested
-- Hardened: Only shows completed feedback for the current teacher
DROP VIEW IF EXISTS v_student_feedback_teacher_view;
CREATE VIEW v_student_feedback_teacher_view AS
SELECT
  id,
  organization_id,
  school_id,
  -- Hide student_id when is_anonymous = TRUE
  CASE WHEN is_anonymous THEN NULL ELSE student_id END AS student_id,
  teacher_id,
  experience_id,
  experience_type,
  school_year_id,
  quarter,
  feedback_dimension_id,
  feedback_text,
  provided_at,
  status,
  is_anonymous,
  created_at,
  updated_at,
  created_by,
  updated_by,
  archived_at
FROM student_feedback
WHERE archived_at IS NULL
  AND teacher_id = current_profile_id()
  AND status = 'completed';

-- Grant SELECT on view to mentors/teachers
-- Note: RLS policies on underlying table will still apply
GRANT SELECT ON v_student_feedback_teacher_view TO authenticated;

-- Comment on view
COMMENT ON VIEW v_student_feedback_teacher_view IS 'Teacher view of student feedback with anonymization. Hardened: Only shows completed feedback where teacher_id = current_profile_id(). student_id is NULL when is_anonymous = TRUE. RLS policies on underlying student_feedback table still apply.';

-- ============================================================================
-- Manual Validation Queries
-- ============================================================================

-- Test 1: Verify RLS is enabled on all Phase 3 tables
-- Expected: All should return 't' (true)
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('reflection_prompts', 'feedback_dimensions', 'teacher_reflections', 'student_feedback');

-- Test 2: Verify policies exist
-- Expected: Should return policy names for each table
-- SELECT schemaname, tablename, policyname FROM pg_policies WHERE tablename IN ('reflection_prompts', 'feedback_dimensions', 'teacher_reflections', 'student_feedback') ORDER BY tablename, policyname;

-- Test 3: Verify view exists
-- Expected: Should return view name
-- SELECT viewname FROM pg_views WHERE schemaname = 'public' AND viewname = 'v_student_feedback_teacher_view';

-- Test 4: Test teacher reflection SELECT (as teacher)
-- Expected: Should only see own reflections
-- SET ROLE authenticated;
-- SET request.jwt.claims = '{"sub": "<teacher_profile_id>"}';
-- SELECT COUNT(*) FROM teacher_reflections;
-- RESET ROLE;

-- Test 5: Test teacher reflection INSERT (as teacher)
-- Expected: Should succeed if teacher_id = current_profile_id()
-- Expected: Should fail if teacher_id != current_profile_id()
-- SET ROLE authenticated;
-- SET request.jwt.claims = '{"sub": "<teacher_profile_id>"}';
-- INSERT INTO teacher_reflections (organization_id, teacher_id, reflection_text, created_by) VALUES ('<org_id>', '<teacher_profile_id>', 'Test reflection', '<teacher_profile_id>');
-- RESET ROLE;

-- Test 6: Test student feedback SELECT (as teacher)
-- Expected: Should only see completed feedback where teacher_id = current_profile_id()
-- SET ROLE authenticated;
-- SET request.jwt.claims = '{"sub": "<teacher_profile_id>"}';
-- SELECT COUNT(*) FROM student_feedback WHERE teacher_id = '<teacher_profile_id>' AND status = 'completed';
-- RESET ROLE;

-- Test 7: Test student feedback INSERT (as student)
-- Expected: Should succeed if student_id = current_student_id()
-- Expected: Should fail if student_id != current_student_id()
-- SET ROLE authenticated;
-- SET request.jwt.claims = '{"sub": "<student_profile_id>"}';
-- INSERT INTO student_feedback (organization_id, student_id, quarter, feedback_dimension_id, feedback_text, created_by) VALUES ('<org_id>', '<student_id>', 'Q1', '<dimension_id>', 'Test feedback', '<student_profile_id>');
-- RESET ROLE;

-- Test 8: Test anonymization view
-- Expected: student_id should be NULL for anonymous feedback, visible for non-anonymous
-- SELECT id, student_id, is_anonymous FROM v_student_feedback_teacher_view WHERE teacher_id = '<teacher_profile_id>';

-- ============================================================================
-- End of Phase 3 RLS Policies
-- ============================================================================
