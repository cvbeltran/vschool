-- Migration: Add Row Level Security (RLS) policies for Phase 4 Grade Translation & Reporting Layer
-- Created: 2024
-- Description: Creates RLS policies for Phase 4 Grade Translation & Reporting Layer tables
-- Enforces tenant isolation, role-based access control, row ownership, and privacy
-- Super admins can bypass RLS checks and access all data
--
-- HARDENING NOTES:
--   - All SECURITY DEFINER functions set search_path = public, auth
--   - Policies made idempotent with DROP POLICY IF EXISTS
--   - Org isolation enforced via organization_id
--   - School scoping via can_access_school(school_id)
--   - No computation, scoring, or aggregation in policies
--   - Students only see finalized grades/transcripts

-- ============================================================================
-- README: Role Taxonomy, Policy Intent, and Dependencies
-- ============================================================================

-- ROLE TAXONOMY (Canonical Roles for Phase 4):
--   principal: Full CRUD on policies/scales, READ all grades, finalize transcripts
--   admin: Same as principal
--   registrar: READ-ONLY for all Phase 4 data (monitoring)
--   mentor/teacher: CREATE/UPDATE grade entries (manual), cannot finalize
--   student: READ-ONLY own finalized grades/transcripts

-- POLICY INTENT PER TABLE:
--   grade_policies:
--     - SELECT: principal, admin, registrar, mentor/teacher (all org members)
--     - INSERT/UPDATE: principal, admin only
--     - DELETE: Disallow (use archived_at for soft deletes)
--
--   grading_scales:
--     - SELECT: principal, admin, registrar, mentor/teacher (all org members)
--     - INSERT/UPDATE: principal, admin only
--     - DELETE: Disallow (use archived_at for soft deletes)
--
--   student_grades:
--     - SELECT: principal/admin/registrar (all in org/school), teacher (own created), student (own finalized only)
--     - INSERT: teacher/admin (manual entry)
--     - UPDATE: teacher (own created), admin/principal (all)
--     - DELETE: Disallow (use archived_at)
--
--   grade_entries:
--     - SELECT: principal/admin/registrar (all in org/school), teacher (own created), student (read-only via parent grade)
--     - INSERT: teacher/admin (manual entry)
--     - UPDATE: teacher (own created), admin/principal (all)
--     - DELETE: Disallow (use archived_at)
--
--   grade_justifications:
--     - SELECT: principal/admin/registrar (all in org/school), teacher (own created), student (read-only via parent grade)
--     - INSERT: teacher/admin/principal (when creating/confirming/overriding grades)
--     - UPDATE/DELETE: Disallow (append-only)
--
--   transcript_records:
--     - SELECT: principal/admin/registrar (all in org/school), student (own finalized only)
--     - INSERT: admin/principal (from confirmed grades)
--     - UPDATE: admin/principal (finalization)
--     - DELETE: Disallow (use archived_at)
--
--   report_templates:
--     - SELECT: principal, admin, registrar, mentor/teacher (all org members)
--     - INSERT/UPDATE: principal, admin only
--     - DELETE: Disallow (use archived_at for soft deletes)

-- DEPENDENCIES:
--   - Uses helper functions from Phase 2 RLS (is_super_admin, current_profile_id, etc.)
--   - Assumes profile-student linking exists (for current_student_id())
--   - Teachers are identified via is_mentor() (normalizes teacher/faculty -> mentor)

-- ============================================================================
-- Helper Functions (Reuse Phase 2/3 helpers, add Phase 4 specific if needed)
-- ============================================================================

-- Note: All helper functions from Phase 2/3 RLS are assumed to exist:
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
-- Enable Row Level Security on Phase 4 Tables
-- ============================================================================

ALTER TABLE grade_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE grading_scales ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE grade_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE grade_justifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcript_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_templates ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- grade_policies: RLS Policies
-- ============================================================================

-- SELECT: principal, admin, registrar, mentor/teacher (all org members)
DROP POLICY IF EXISTS "grade_policies_select_org_members" ON grade_policies;
CREATE POLICY "grade_policies_select_org_members"
  ON grade_policies FOR SELECT
  USING (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND (archived_at IS NULL)
    AND (is_org_admin() OR is_registrar() OR is_mentor())
  );

-- INSERT: principal, admin only
DROP POLICY IF EXISTS "grade_policies_insert_admin" ON grade_policies;
CREATE POLICY "grade_policies_insert_admin"
  ON grade_policies FOR INSERT
  WITH CHECK (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND is_org_admin()
  );

-- UPDATE: principal, admin only
DROP POLICY IF EXISTS "grade_policies_update_admin" ON grade_policies;
CREATE POLICY "grade_policies_update_admin"
  ON grade_policies FOR UPDATE
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

-- ============================================================================
-- grading_scales: RLS Policies
-- ============================================================================

-- SELECT: principal, admin, registrar, mentor/teacher (all org members)
DROP POLICY IF EXISTS "grading_scales_select_org_members" ON grading_scales;
CREATE POLICY "grading_scales_select_org_members"
  ON grading_scales FOR SELECT
  USING (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (archived_at IS NULL)
    AND (is_org_admin() OR is_registrar() OR is_mentor())
  );

-- INSERT: principal, admin only
DROP POLICY IF EXISTS "grading_scales_insert_admin" ON grading_scales;
CREATE POLICY "grading_scales_insert_admin"
  ON grading_scales FOR INSERT
  WITH CHECK (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND is_org_admin()
  );

-- UPDATE: principal, admin only
DROP POLICY IF EXISTS "grading_scales_update_admin" ON grading_scales;
CREATE POLICY "grading_scales_update_admin"
  ON grading_scales FOR UPDATE
  USING (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND is_org_admin()
  )
  WITH CHECK (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND is_org_admin()
  );

-- ============================================================================
-- promotion_rules: RLS Policies
-- ============================================================================

-- SELECT: principal, admin, registrar, mentor/teacher (all org members)
DROP POLICY IF EXISTS "promotion_rules_select_org_members" ON promotion_rules;
CREATE POLICY "promotion_rules_select_org_members"
  ON promotion_rules FOR SELECT
  USING (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND (archived_at IS NULL)
    AND (is_org_admin() OR is_registrar() OR is_mentor())
  );

-- INSERT: principal, admin only
DROP POLICY IF EXISTS "promotion_rules_insert_admin" ON promotion_rules;
CREATE POLICY "promotion_rules_insert_admin"
  ON promotion_rules FOR INSERT
  WITH CHECK (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND is_org_admin()
  );

-- UPDATE: principal, admin only
DROP POLICY IF EXISTS "promotion_rules_update_admin" ON promotion_rules;
CREATE POLICY "promotion_rules_update_admin"
  ON promotion_rules FOR UPDATE
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

-- ============================================================================
-- student_grades: RLS Policies
-- ============================================================================

-- SELECT: principal/admin/registrar (all in org/school), teacher (own created), student (own finalized only)
DROP POLICY IF EXISTS "student_grades_select_all" ON student_grades;
CREATE POLICY "student_grades_select_all"
  ON student_grades FOR SELECT
  USING (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND (archived_at IS NULL)
    AND (
      is_org_admin() OR is_registrar() OR
      (is_mentor() AND created_by = current_profile_id()) OR
      (is_student() AND student_id = current_student_id() AND status IN ('confirmed', 'overridden'))
    )
  );

-- INSERT: teacher/admin (manual entry)
DROP POLICY IF EXISTS "student_grades_insert_teacher_admin" ON student_grades;
CREATE POLICY "student_grades_insert_teacher_admin"
  ON student_grades FOR INSERT
  WITH CHECK (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND (is_mentor() OR is_org_admin())
    AND created_by = current_profile_id()
  );

-- UPDATE: teacher (own created), admin/principal (all)
DROP POLICY IF EXISTS "student_grades_update_teacher_admin" ON student_grades;
CREATE POLICY "student_grades_update_teacher_admin"
  ON student_grades FOR UPDATE
  USING (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND (
      is_org_admin() OR
      (is_mentor() AND created_by = current_profile_id())
    )
  )
  WITH CHECK (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND (
      is_org_admin() OR
      (is_mentor() AND created_by = current_profile_id())
    )
  );

-- ============================================================================
-- grade_entries: RLS Policies
-- ============================================================================

-- SELECT: principal/admin/registrar (all in org/school), teacher (own created), student (read-only via parent grade)
DROP POLICY IF EXISTS "grade_entries_select_all" ON grade_entries;
CREATE POLICY "grade_entries_select_all"
  ON grade_entries FOR SELECT
  USING (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (archived_at IS NULL)
    AND (
      is_org_admin() OR is_registrar() OR
      (is_mentor() AND created_by = current_profile_id()) OR
      (is_student() AND EXISTS (
        SELECT 1 FROM student_grades
        WHERE id = grade_entries.student_grade_id
          AND student_id = current_student_id()
          AND status IN ('confirmed', 'overridden')
          AND organization_id = current_organization_id()
          AND archived_at IS NULL
      ))
    )
  );

-- INSERT: teacher/admin (manual entry)
DROP POLICY IF EXISTS "grade_entries_insert_teacher_admin" ON grade_entries;
CREATE POLICY "grade_entries_insert_teacher_admin"
  ON grade_entries FOR INSERT
  WITH CHECK (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (is_mentor() OR is_org_admin())
    AND created_by = current_profile_id()
    AND EXISTS (
      SELECT 1 FROM student_grades
      WHERE id = grade_entries.student_grade_id
        AND organization_id = current_organization_id()
    )
  );

-- UPDATE: teacher (own created), admin/principal (all)
DROP POLICY IF EXISTS "grade_entries_update_teacher_admin" ON grade_entries;
CREATE POLICY "grade_entries_update_teacher_admin"
  ON grade_entries FOR UPDATE
  USING (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (
      is_org_admin() OR
      (is_mentor() AND created_by = current_profile_id())
    )
  )
  WITH CHECK (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (
      is_org_admin() OR
      (is_mentor() AND created_by = current_profile_id())
    )
  );

-- ============================================================================
-- grade_justifications: RLS Policies
-- ============================================================================

-- SELECT: principal/admin/registrar (all in org/school), teacher (own created), student (read-only via parent grade)
DROP POLICY IF EXISTS "grade_justifications_select_all" ON grade_justifications;
CREATE POLICY "grade_justifications_select_all"
  ON grade_justifications FOR SELECT
  USING (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (
      is_org_admin() OR is_registrar() OR
      (is_mentor() AND created_by = current_profile_id()) OR
      (is_student() AND EXISTS (
        SELECT 1 FROM student_grades
        WHERE id = grade_justifications.student_grade_id
          AND student_id = current_student_id()
          AND status IN ('confirmed', 'overridden')
          AND organization_id = current_organization_id()
          AND archived_at IS NULL
      ))
    )
  );

-- INSERT: teacher/admin/principal (when creating/confirming/overriding grades)
DROP POLICY IF EXISTS "grade_justifications_insert_teacher_admin" ON grade_justifications;
CREATE POLICY "grade_justifications_insert_teacher_admin"
  ON grade_justifications FOR INSERT
  WITH CHECK (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (is_mentor() OR is_org_admin())
    AND created_by = current_profile_id()
    AND EXISTS (
      SELECT 1 FROM student_grades
      WHERE id = grade_justifications.student_grade_id
        AND organization_id = current_organization_id()
    )
  );

-- UPDATE/DELETE: Disallow (append-only)
-- No UPDATE or DELETE policies - table is append-only

-- ============================================================================
-- transcript_records: RLS Policies
-- ============================================================================

-- SELECT: principal/admin/registrar (all in org/school), student (own finalized only)
DROP POLICY IF EXISTS "transcript_records_select_all" ON transcript_records;
CREATE POLICY "transcript_records_select_all"
  ON transcript_records FOR SELECT
  USING (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND (archived_at IS NULL)
    AND (
      is_org_admin() OR is_registrar() OR
      (is_student() AND student_id = current_student_id() AND transcript_status = 'finalized')
    )
  );

-- INSERT: admin/principal (from confirmed grades)
DROP POLICY IF EXISTS "transcript_records_insert_admin" ON transcript_records;
CREATE POLICY "transcript_records_insert_admin"
  ON transcript_records FOR INSERT
  WITH CHECK (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND is_org_admin()
    AND created_by = current_profile_id()
    AND EXISTS (
      SELECT 1 FROM student_grades
      WHERE id = transcript_records.student_grade_id
        AND status IN ('confirmed', 'overridden')
        AND organization_id = current_organization_id()
    )
  );

-- UPDATE: admin/principal (finalization)
DROP POLICY IF EXISTS "transcript_records_update_admin" ON transcript_records;
CREATE POLICY "transcript_records_update_admin"
  ON transcript_records FOR UPDATE
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

-- ============================================================================
-- report_templates: RLS Policies
-- ============================================================================

-- SELECT: principal, admin, registrar, mentor/teacher (all org members)
DROP POLICY IF EXISTS "report_templates_select_org_members" ON report_templates;
CREATE POLICY "report_templates_select_org_members"
  ON report_templates FOR SELECT
  USING (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND (archived_at IS NULL)
    AND (is_org_admin() OR is_registrar() OR is_mentor())
  );

-- INSERT: principal, admin only
DROP POLICY IF EXISTS "report_templates_insert_admin" ON report_templates;
CREATE POLICY "report_templates_insert_admin"
  ON report_templates FOR INSERT
  WITH CHECK (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND is_org_admin()
  );

-- UPDATE: principal, admin only
DROP POLICY IF EXISTS "report_templates_update_admin" ON report_templates;
CREATE POLICY "report_templates_update_admin"
  ON report_templates FOR UPDATE
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

-- ============================================================================
-- End of Phase 4 RLS Policies
-- ============================================================================
