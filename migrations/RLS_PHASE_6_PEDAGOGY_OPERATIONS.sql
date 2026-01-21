-- Migration: Add Row Level Security (RLS) policies for Phase 6 Pedagogy Operations
-- Created: 2024
-- Description: Creates RLS policies for Phase 6 tables (Syllabus, Lesson Logs, Monitoring, Attendance, Portfolio, Industry Assessment)
-- Enforces tenant isolation, role-based access control, row ownership, and privacy
-- Super admins can bypass RLS checks and access all data
--
-- HARDENING NOTES:
--   - All SECURITY DEFINER functions set search_path = public, auth
--   - Policies made idempotent with DROP POLICY IF EXISTS
--   - Org isolation enforced via organization_id
--   - School scoping via can_access_school(school_id)
--   - No computation, scoring, or aggregation in policies
--   - Uses existing helper functions from Phase 2/3 RLS (is_mentor() normalizes teacher/faculty -> mentor)

-- ============================================================================
-- README: Role Taxonomy, Policy Intent, and Dependencies
-- ============================================================================

-- ROLE TAXONOMY (Canonical Roles for Phase 6):
--   principal: Full CRUD on all Phase 6 tables (config + monitoring)
--   admin: Same as principal
--   registrar: READ-ONLY for monitoring, syllabus/logs/attendance (monitoring visibility)
--   mentor/teacher: CREATE/UPDATE own syllabus (if lead), own lesson logs, own attendance, own progress reflections
--   student: CREATE/UPDATE own portfolio artifacts, READ own attendance and lesson log evidence (if visibility allows)
--   guardian: READ-only linked learners' portfolio artifacts and attendance (if visibility allows)

-- POLICY INTENT PER TABLE:
--   Syllabus Tables:
--     syllabus_templates, syllabi:
--       - SELECT: principal, admin, registrar, mentor/teacher (within org/school)
--       - INSERT/UPDATE: mentor/teacher (if lead or contributor with edit permission), principal/admin (all)
--       - DELETE: Disallow (use archived_at)
--
--     syllabus_contributors:
--       - SELECT: Same visibility as parent syllabus
--       - INSERT/UPDATE: If user can UPDATE parent syllabus
--       - DELETE: Disallow (use archived_at)
--
--     syllabus_weeks, syllabus_week_competency_links:
--       - SELECT: Same visibility as parent syllabus
--       - INSERT/UPDATE: If user can UPDATE parent syllabus
--       - DELETE: Disallow (use archived_at)
--
--   Weekly Lesson Logs:
--     weekly_lesson_logs:
--       - SELECT: principal/admin/registrar (all within org), mentor/teacher (own + syllabi they can access)
--       - INSERT: mentor/teacher only (within org/school)
--       - UPDATE: mentor/teacher (own only), principal/admin (all)
--       - DELETE: Disallow (use archived_at)
--
--     weekly_lesson_log_items, weekly_lesson_log_learner_verifications, weekly_lesson_log_attachments, weekly_lesson_log_experience_links:
--       - SELECT: If user can SELECT parent lesson log
--       - INSERT/UPDATE: If user can UPDATE parent lesson log
--       - DELETE: Disallow (use archived_at)
--
--   Monitoring:
--     progress_reflections:
--       - SELECT: principal/admin/registrar (all within org), mentor/teacher (own only)
--       - INSERT: mentor/teacher only (own only)
--       - UPDATE: mentor/teacher (own only), principal/admin (all)
--       - DELETE: Disallow (use archived_at)
--
--   Attendance:
--     attendance_sessions:
--       - SELECT: principal/admin/registrar (all within org), mentor/teacher (own + sessions they can access)
--       - INSERT: mentor/teacher only (within org/school)
--       - UPDATE: mentor/teacher (own only), principal/admin (all)
--       - DELETE: Disallow (use archived_at)
--
--     attendance_records:
--       - SELECT: principal/admin/registrar (all within org), mentor/teacher (sessions they own), student (own only), guardian (linked learners only)
--       - INSERT: mentor/teacher only (for sessions they own)
--       - UPDATE: mentor/teacher (sessions they own), principal/admin (all)
--       - DELETE: Disallow (use archived_at)
--
--     teacher_attendance:
--       - SELECT: principal/admin/registrar (all within org), mentor/teacher (own only)
--       - INSERT: mentor/teacher only (own only)
--       - UPDATE: mentor/teacher (own only), principal/admin (all)
--       - DELETE: Disallow (use archived_at)
--
--   Portfolio:
--     portfolio_artifacts:
--       - SELECT: principal/admin (all within org), mentor/teacher (if visibility allows), student (own only), guardian (linked learners only)
--       - INSERT: student only (own only)
--       - UPDATE: student (own only), principal/admin (all)
--       - DELETE: Disallow (use archived_at)
--
--     portfolio_artifact_tags, portfolio_artifact_links:
--       - SELECT: If user can SELECT parent artifact
--       - INSERT/UPDATE: If user can UPDATE parent artifact
--       - DELETE: Disallow (use archived_at)
--
--   Industry Assessment (Optional):
--     industry_assessments:
--       - SELECT: principal/admin/registrar (all within org), coordinator (own only)
--       - INSERT: coordinator only (within org/school)
--       - UPDATE: coordinator (own only), principal/admin (all)
--       - DELETE: Disallow (use archived_at)

-- DEPENDENCIES:
--   - Uses helper functions from Phase 2/3 RLS (assumed to exist):
--     * is_super_admin(user_id)
--     * current_profile_id()
--     * current_organization_id()
--     * current_user_role()
--     * current_school_id()
--     * current_student_id()
--     * is_org_admin()
--     * is_registrar()
--     * is_mentor() (normalizes teacher/faculty -> mentor)
--     * is_student()
--     * is_guardian()
--     * can_access_school(school_id_param)
--     * guardian_can_view_student(student_id_param)

-- ============================================================================
-- Enable Row Level Security on Phase 6 Tables
-- ============================================================================

ALTER TABLE syllabus_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE syllabi ENABLE ROW LEVEL SECURITY;
ALTER TABLE syllabus_contributors ENABLE ROW LEVEL SECURITY;
ALTER TABLE syllabus_weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE syllabus_week_competency_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_lesson_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_lesson_log_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_lesson_log_learner_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_lesson_log_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_lesson_log_experience_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress_reflections ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_artifact_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_artifact_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE industry_assessments ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Helper Functions (Phase 6 Specific)
-- ============================================================================

-- Check if current user is a lead teacher or contributor with edit permission for a syllabus
CREATE OR REPLACE FUNCTION can_edit_syllabus(syllabus_id_param UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Super admin can edit all
  IF is_super_admin(current_profile_id()) THEN
    RETURN TRUE;
  END IF;
  
  -- Org admins can edit all
  IF is_org_admin() THEN
    RETURN TRUE;
  END IF;
  
  -- Check if user is lead teacher or contributor with edit permission
  RETURN EXISTS (
    SELECT 1 FROM syllabus_contributors
    WHERE syllabus_id = syllabus_id_param
      AND teacher_id = current_profile_id()
      AND archived_at IS NULL
      AND (
        role = 'lead' OR
        (role = 'contributor' AND permissions = 'edit')
      )
  ) OR EXISTS (
    SELECT 1 FROM syllabi
    WHERE id = syllabus_id_param
      AND created_by = current_profile_id()
  );
END;
$$;

-- Check if current user can access a lesson log (own or syllabus they can access)
CREATE OR REPLACE FUNCTION can_access_lesson_log(lesson_log_id_param UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Super admin can access all
  IF is_super_admin(current_profile_id()) THEN
    RETURN TRUE;
  END IF;
  
  -- Org admins and registrars can access all
  IF is_org_admin() OR is_registrar() THEN
    RETURN TRUE;
  END IF;
  
  -- Teachers can access own lesson logs or logs linked to syllabi they can access
  IF is_mentor() THEN
    RETURN EXISTS (
      SELECT 1 FROM weekly_lesson_logs
      WHERE id = lesson_log_id_param
        AND (
          teacher_id = current_profile_id() OR
          (syllabus_id IS NOT NULL AND can_edit_syllabus(syllabus_id))
        )
    );
  END IF;
  
  RETURN FALSE;
END;
$$;

-- ============================================================================
-- Syllabus Tables: RLS Policies
-- ============================================================================

-- ============================================================================
-- syllabus_templates
-- ============================================================================

-- SELECT: principal, admin, registrar, mentor/teacher (within org/school)
DROP POLICY IF EXISTS "syllabus_templates_select_org_members" ON syllabus_templates;
CREATE POLICY "syllabus_templates_select_org_members"
  ON syllabus_templates FOR SELECT
  USING (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND (archived_at IS NULL)
    AND (
      is_org_admin() OR
      is_registrar() OR
      is_mentor()
    )
  );

-- INSERT: mentor/teacher (if lead), principal/admin (all)
DROP POLICY IF EXISTS "syllabus_templates_insert_teacher_admin" ON syllabus_templates;
CREATE POLICY "syllabus_templates_insert_teacher_admin"
  ON syllabus_templates FOR INSERT
  WITH CHECK (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND (is_org_admin() OR is_mentor())
    AND created_by = current_profile_id()
  );

-- UPDATE: mentor/teacher (if lead or contributor with edit permission), principal/admin (all)
DROP POLICY IF EXISTS "syllabus_templates_update_teacher_admin" ON syllabus_templates;
CREATE POLICY "syllabus_templates_update_teacher_admin"
  ON syllabus_templates FOR UPDATE
  USING (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND (
      is_org_admin() OR
      (is_mentor() AND (
        created_by = current_profile_id() OR
        EXISTS (
          SELECT 1 FROM syllabus_contributors
          WHERE syllabus_id = syllabus_templates.id
            AND teacher_id = current_profile_id()
            AND archived_at IS NULL
            AND (
              role = 'lead' OR
              (role = 'contributor' AND permissions = 'edit')
            )
        )
      ))
    )
  )
  WITH CHECK (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND (
      is_org_admin() OR
      (is_mentor() AND (
        created_by = current_profile_id() OR
        EXISTS (
          SELECT 1 FROM syllabus_contributors
          WHERE syllabus_id = syllabus_templates.id
            AND teacher_id = current_profile_id()
            AND archived_at IS NULL
            AND (
              role = 'lead' OR
              (role = 'contributor' AND permissions = 'edit')
            )
        )
      ))
    )
  );

-- ============================================================================
-- syllabi
-- ============================================================================

-- SELECT: principal, admin, registrar, mentor/teacher (within org/school)
DROP POLICY IF EXISTS "syllabi_select_org_members" ON syllabi;
CREATE POLICY "syllabi_select_org_members"
  ON syllabi FOR SELECT
  USING (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND (archived_at IS NULL)
    AND (
      is_org_admin() OR
      is_registrar() OR
      is_mentor()
    )
  );

-- INSERT: mentor/teacher (if lead), principal/admin (all)
DROP POLICY IF EXISTS "syllabi_insert_teacher_admin" ON syllabi;
CREATE POLICY "syllabi_insert_teacher_admin"
  ON syllabi FOR INSERT
  WITH CHECK (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND (is_org_admin() OR is_mentor())
    AND created_by = current_profile_id()
  );

-- UPDATE: mentor/teacher (if lead or contributor with edit permission), principal/admin (all)
DROP POLICY IF EXISTS "syllabi_update_teacher_admin" ON syllabi;
CREATE POLICY "syllabi_update_teacher_admin"
  ON syllabi FOR UPDATE
  USING (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND (
      is_org_admin() OR
      can_edit_syllabus(syllabi.id)
    )
  )
  WITH CHECK (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND (
      is_org_admin() OR
      can_edit_syllabus(syllabi.id)
    )
  );

-- ============================================================================
-- syllabus_contributors
-- ============================================================================

-- SELECT: Same visibility as parent syllabus
DROP POLICY IF EXISTS "syllabus_contributors_select" ON syllabus_contributors;
CREATE POLICY "syllabus_contributors_select"
  ON syllabus_contributors FOR SELECT
  USING (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (archived_at IS NULL)
    AND EXISTS (
      SELECT 1 FROM syllabi
      WHERE syllabi.id = syllabus_contributors.syllabus_id
        AND (syllabi.archived_at IS NULL)
        AND (syllabi.school_id IS NULL OR can_access_school(syllabi.school_id))
        AND (
          is_org_admin() OR
          is_registrar() OR
          is_mentor()
        )
    )
  );

-- INSERT: If user can UPDATE parent syllabus
DROP POLICY IF EXISTS "syllabus_contributors_insert" ON syllabus_contributors;
CREATE POLICY "syllabus_contributors_insert"
  ON syllabus_contributors FOR INSERT
  WITH CHECK (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND EXISTS (
      SELECT 1 FROM syllabi
      WHERE syllabi.id = syllabus_contributors.syllabus_id
        AND (syllabi.organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
        AND (syllabi.school_id IS NULL OR can_access_school(syllabi.school_id))
        AND (
          is_org_admin() OR
          can_edit_syllabus(syllabi.id)
        )
    )
    AND created_by = current_profile_id()
  );

-- UPDATE: If user can UPDATE parent syllabus
DROP POLICY IF EXISTS "syllabus_contributors_update" ON syllabus_contributors;
CREATE POLICY "syllabus_contributors_update"
  ON syllabus_contributors FOR UPDATE
  USING (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND EXISTS (
      SELECT 1 FROM syllabi
      WHERE syllabi.id = syllabus_contributors.syllabus_id
        AND (syllabi.organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
        AND (syllabi.school_id IS NULL OR can_access_school(syllabi.school_id))
        AND (
          is_org_admin() OR
          can_edit_syllabus(syllabi.id)
        )
    )
  )
  WITH CHECK (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND EXISTS (
      SELECT 1 FROM syllabi
      WHERE syllabi.id = syllabus_contributors.syllabus_id
        AND (syllabi.organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
        AND (syllabi.school_id IS NULL OR can_access_school(syllabi.school_id))
        AND (
          is_org_admin() OR
          can_edit_syllabus(syllabi.id)
        )
    )
  );

-- ============================================================================
-- syllabus_weeks
-- ============================================================================

-- SELECT: Same visibility as parent syllabus
DROP POLICY IF EXISTS "syllabus_weeks_select" ON syllabus_weeks;
CREATE POLICY "syllabus_weeks_select"
  ON syllabus_weeks FOR SELECT
  USING (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (archived_at IS NULL)
    AND EXISTS (
      SELECT 1 FROM syllabi
      WHERE syllabi.id = syllabus_weeks.syllabus_id
        AND (syllabi.archived_at IS NULL)
        AND (syllabi.school_id IS NULL OR can_access_school(syllabi.school_id))
        AND (
          is_org_admin() OR
          is_registrar() OR
          is_mentor()
        )
    )
  );

-- INSERT: If user can UPDATE parent syllabus
DROP POLICY IF EXISTS "syllabus_weeks_insert" ON syllabus_weeks;
CREATE POLICY "syllabus_weeks_insert"
  ON syllabus_weeks FOR INSERT
  WITH CHECK (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND EXISTS (
      SELECT 1 FROM syllabi
      WHERE syllabi.id = syllabus_weeks.syllabus_id
        AND (syllabi.organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
        AND (syllabi.school_id IS NULL OR can_access_school(syllabi.school_id))
        AND (
          is_org_admin() OR
          can_edit_syllabus(syllabi.id)
        )
    )
    AND created_by = current_profile_id()
  );

-- UPDATE: If user can UPDATE parent syllabus
DROP POLICY IF EXISTS "syllabus_weeks_update" ON syllabus_weeks;
CREATE POLICY "syllabus_weeks_update"
  ON syllabus_weeks FOR UPDATE
  USING (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND EXISTS (
      SELECT 1 FROM syllabi
      WHERE syllabi.id = syllabus_weeks.syllabus_id
        AND (syllabi.organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
        AND (syllabi.school_id IS NULL OR can_access_school(syllabi.school_id))
        AND (
          is_org_admin() OR
          can_edit_syllabus(syllabi.id)
        )
    )
  )
  WITH CHECK (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND EXISTS (
      SELECT 1 FROM syllabi
      WHERE syllabi.id = syllabus_weeks.syllabus_id
        AND (syllabi.organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
        AND (syllabi.school_id IS NULL OR can_access_school(syllabi.school_id))
        AND (
          is_org_admin() OR
          can_edit_syllabus(syllabi.id)
        )
    )
  );

-- ============================================================================
-- syllabus_week_competency_links
-- ============================================================================

-- SELECT: Same visibility as parent syllabus week
DROP POLICY IF EXISTS "syllabus_week_competency_links_select" ON syllabus_week_competency_links;
CREATE POLICY "syllabus_week_competency_links_select"
  ON syllabus_week_competency_links FOR SELECT
  USING (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (archived_at IS NULL)
    AND EXISTS (
      SELECT 1 FROM syllabus_weeks
      JOIN syllabi ON syllabi.id = syllabus_weeks.syllabus_id
      WHERE syllabus_weeks.id = syllabus_week_competency_links.syllabus_week_id
        AND (syllabus_weeks.archived_at IS NULL)
        AND (syllabi.school_id IS NULL OR can_access_school(syllabi.school_id))
        AND (
          is_org_admin() OR
          is_registrar() OR
          is_mentor()
        )
    )
  );

-- INSERT: If user can UPDATE parent syllabus
DROP POLICY IF EXISTS "syllabus_week_competency_links_insert" ON syllabus_week_competency_links;
CREATE POLICY "syllabus_week_competency_links_insert"
  ON syllabus_week_competency_links FOR INSERT
  WITH CHECK (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND EXISTS (
      SELECT 1 FROM syllabus_weeks
      JOIN syllabi ON syllabi.id = syllabus_weeks.syllabus_id
      WHERE syllabus_weeks.id = syllabus_week_competency_links.syllabus_week_id
        AND (syllabi.organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
        AND (syllabi.school_id IS NULL OR can_access_school(syllabi.school_id))
        AND (
          is_org_admin() OR
          can_edit_syllabus(syllabi.id)
        )
    )
    AND created_by = current_profile_id()
  );

-- UPDATE: If user can UPDATE parent syllabus
DROP POLICY IF EXISTS "syllabus_week_competency_links_update" ON syllabus_week_competency_links;
CREATE POLICY "syllabus_week_competency_links_update"
  ON syllabus_week_competency_links FOR UPDATE
  USING (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND EXISTS (
      SELECT 1 FROM syllabus_weeks
      JOIN syllabi ON syllabi.id = syllabus_weeks.syllabus_id
      WHERE syllabus_weeks.id = syllabus_week_competency_links.syllabus_week_id
        AND (syllabi.organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
        AND (syllabi.school_id IS NULL OR can_access_school(syllabi.school_id))
        AND (
          is_org_admin() OR
          can_edit_syllabus(syllabi.id)
        )
    )
  )
  WITH CHECK (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND EXISTS (
      SELECT 1 FROM syllabus_weeks
      JOIN syllabi ON syllabi.id = syllabus_weeks.syllabus_id
      WHERE syllabus_weeks.id = syllabus_week_competency_links.syllabus_week_id
        AND (syllabi.organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
        AND (syllabi.school_id IS NULL OR can_access_school(syllabi.school_id))
        AND (
          is_org_admin() OR
          can_edit_syllabus(syllabi.id)
        )
    )
  );

-- ============================================================================
-- Weekly Lesson Logs: RLS Policies
-- ============================================================================

-- ============================================================================
-- weekly_lesson_logs
-- ============================================================================

-- SELECT: principal/admin/registrar (all within org), mentor/teacher (own + syllabi they can access)
DROP POLICY IF EXISTS "weekly_lesson_logs_select_multi_role" ON weekly_lesson_logs;
CREATE POLICY "weekly_lesson_logs_select_multi_role"
  ON weekly_lesson_logs FOR SELECT
  USING (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND (
      (is_org_admin() OR is_registrar()) OR
      (is_mentor() AND (
        teacher_id = current_profile_id() OR
        (syllabus_id IS NOT NULL AND can_edit_syllabus(syllabus_id))
      ))
    )
  );

-- INSERT: mentor/teacher only (within org/school)
DROP POLICY IF EXISTS "weekly_lesson_logs_insert_teacher" ON weekly_lesson_logs;
CREATE POLICY "weekly_lesson_logs_insert_teacher"
  ON weekly_lesson_logs FOR INSERT
  WITH CHECK (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND is_mentor()
    AND teacher_id = current_profile_id()
    AND created_by = current_profile_id()
  );

-- UPDATE: mentor/teacher (own only), principal/admin (all)
DROP POLICY IF EXISTS "weekly_lesson_logs_update_teacher_admin" ON weekly_lesson_logs;
CREATE POLICY "weekly_lesson_logs_update_teacher_admin"
  ON weekly_lesson_logs FOR UPDATE
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

-- ============================================================================
-- weekly_lesson_log_items
-- ============================================================================

-- SELECT: If user can SELECT parent lesson log
DROP POLICY IF EXISTS "weekly_lesson_log_items_select" ON weekly_lesson_log_items;
CREATE POLICY "weekly_lesson_log_items_select"
  ON weekly_lesson_log_items FOR SELECT
  USING (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (archived_at IS NULL)
    AND EXISTS (
      SELECT 1 FROM weekly_lesson_logs
      WHERE weekly_lesson_logs.id = weekly_lesson_log_items.lesson_log_id
        AND can_access_lesson_log(weekly_lesson_logs.id)
    )
  );

-- INSERT: If user can UPDATE parent lesson log
DROP POLICY IF EXISTS "weekly_lesson_log_items_insert" ON weekly_lesson_log_items;
CREATE POLICY "weekly_lesson_log_items_insert"
  ON weekly_lesson_log_items FOR INSERT
  WITH CHECK (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND EXISTS (
      SELECT 1 FROM weekly_lesson_logs
      WHERE weekly_lesson_logs.id = weekly_lesson_log_items.lesson_log_id
        AND (
          is_org_admin() OR
          (is_mentor() AND weekly_lesson_logs.teacher_id = current_profile_id())
        )
    )
    AND created_by = current_profile_id()
  );

-- UPDATE: If user can UPDATE parent lesson log
DROP POLICY IF EXISTS "weekly_lesson_log_items_update" ON weekly_lesson_log_items;
CREATE POLICY "weekly_lesson_log_items_update"
  ON weekly_lesson_log_items FOR UPDATE
  USING (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND EXISTS (
      SELECT 1 FROM weekly_lesson_logs
      WHERE weekly_lesson_logs.id = weekly_lesson_log_items.lesson_log_id
        AND (
          is_org_admin() OR
          (is_mentor() AND weekly_lesson_logs.teacher_id = current_profile_id())
        )
    )
  )
  WITH CHECK (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND EXISTS (
      SELECT 1 FROM weekly_lesson_logs
      WHERE weekly_lesson_logs.id = weekly_lesson_log_items.lesson_log_id
        AND (
          is_org_admin() OR
          (is_mentor() AND weekly_lesson_logs.teacher_id = current_profile_id())
        )
    )
  );

-- ============================================================================
-- weekly_lesson_log_learner_verifications
-- ============================================================================

-- SELECT: If user can SELECT parent lesson log
DROP POLICY IF EXISTS "weekly_lesson_log_learner_verifications_select" ON weekly_lesson_log_learner_verifications;
CREATE POLICY "weekly_lesson_log_learner_verifications_select"
  ON weekly_lesson_log_learner_verifications FOR SELECT
  USING (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (archived_at IS NULL)
    AND (
      EXISTS (
        SELECT 1 FROM weekly_lesson_logs
        WHERE weekly_lesson_logs.id = weekly_lesson_log_learner_verifications.lesson_log_id
          AND can_access_lesson_log(weekly_lesson_logs.id)
      ) OR
      (is_student() AND learner_id = current_student_id()) OR
      (is_guardian() AND guardian_can_view_student(learner_id))
    )
  );

-- INSERT: If user can UPDATE parent lesson log
DROP POLICY IF EXISTS "weekly_lesson_log_learner_verifications_insert" ON weekly_lesson_log_learner_verifications;
CREATE POLICY "weekly_lesson_log_learner_verifications_insert"
  ON weekly_lesson_log_learner_verifications FOR INSERT
  WITH CHECK (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND EXISTS (
      SELECT 1 FROM weekly_lesson_logs
      WHERE weekly_lesson_logs.id = weekly_lesson_log_learner_verifications.lesson_log_id
        AND (
          is_org_admin() OR
          (is_mentor() AND weekly_lesson_logs.teacher_id = current_profile_id())
        )
    )
    AND created_by = current_profile_id()
  );

-- UPDATE: If user can UPDATE parent lesson log
DROP POLICY IF EXISTS "weekly_lesson_log_learner_verifications_update" ON weekly_lesson_log_learner_verifications;
CREATE POLICY "weekly_lesson_log_learner_verifications_update"
  ON weekly_lesson_log_learner_verifications FOR UPDATE
  USING (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND EXISTS (
      SELECT 1 FROM weekly_lesson_logs
      WHERE weekly_lesson_logs.id = weekly_lesson_log_learner_verifications.lesson_log_id
        AND (
          is_org_admin() OR
          (is_mentor() AND weekly_lesson_logs.teacher_id = current_profile_id())
        )
    )
  )
  WITH CHECK (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND EXISTS (
      SELECT 1 FROM weekly_lesson_logs
      WHERE weekly_lesson_logs.id = weekly_lesson_log_learner_verifications.lesson_log_id
        AND (
          is_org_admin() OR
          (is_mentor() AND weekly_lesson_logs.teacher_id = current_profile_id())
        )
    )
  );

-- ============================================================================
-- weekly_lesson_log_attachments
-- ============================================================================

-- SELECT: If user can SELECT parent lesson log item or learner verification
DROP POLICY IF EXISTS "weekly_lesson_log_attachments_select" ON weekly_lesson_log_attachments;
CREATE POLICY "weekly_lesson_log_attachments_select"
  ON weekly_lesson_log_attachments FOR SELECT
  USING (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (archived_at IS NULL)
    AND (
      (lesson_log_item_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM weekly_lesson_log_items
        JOIN weekly_lesson_logs ON weekly_lesson_logs.id = weekly_lesson_log_items.lesson_log_id
        WHERE weekly_lesson_log_items.id = weekly_lesson_log_attachments.lesson_log_item_id
          AND can_access_lesson_log(weekly_lesson_logs.id)
      )) OR
      (learner_verification_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM weekly_lesson_log_learner_verifications
        JOIN weekly_lesson_logs ON weekly_lesson_logs.id = weekly_lesson_log_learner_verifications.lesson_log_id
        WHERE weekly_lesson_log_learner_verifications.id = weekly_lesson_log_attachments.learner_verification_id
          AND can_access_lesson_log(weekly_lesson_logs.id)
      ))
    )
  );

-- INSERT: If user can UPDATE parent lesson log
DROP POLICY IF EXISTS "weekly_lesson_log_attachments_insert" ON weekly_lesson_log_attachments;
CREATE POLICY "weekly_lesson_log_attachments_insert"
  ON weekly_lesson_log_attachments FOR INSERT
  WITH CHECK (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (
      (lesson_log_item_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM weekly_lesson_log_items
        JOIN weekly_lesson_logs ON weekly_lesson_logs.id = weekly_lesson_log_items.lesson_log_id
        WHERE weekly_lesson_log_items.id = weekly_lesson_log_attachments.lesson_log_item_id
          AND (
            is_org_admin() OR
            (is_mentor() AND weekly_lesson_logs.teacher_id = current_profile_id())
          )
      )) OR
      (learner_verification_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM weekly_lesson_log_learner_verifications
        JOIN weekly_lesson_logs ON weekly_lesson_logs.id = weekly_lesson_log_learner_verifications.lesson_log_id
        WHERE weekly_lesson_log_learner_verifications.id = weekly_lesson_log_attachments.learner_verification_id
          AND (
            is_org_admin() OR
            (is_mentor() AND weekly_lesson_logs.teacher_id = current_profile_id())
          )
      ))
    )
    AND created_by = current_profile_id()
  );

-- UPDATE: If user can UPDATE parent lesson log
DROP POLICY IF EXISTS "weekly_lesson_log_attachments_update" ON weekly_lesson_log_attachments;
CREATE POLICY "weekly_lesson_log_attachments_update"
  ON weekly_lesson_log_attachments FOR UPDATE
  USING (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (
      (lesson_log_item_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM weekly_lesson_log_items
        JOIN weekly_lesson_logs ON weekly_lesson_logs.id = weekly_lesson_log_items.lesson_log_id
        WHERE weekly_lesson_log_items.id = weekly_lesson_log_attachments.lesson_log_item_id
          AND (
            is_org_admin() OR
            (is_mentor() AND weekly_lesson_logs.teacher_id = current_profile_id())
          )
      )) OR
      (learner_verification_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM weekly_lesson_log_learner_verifications
        JOIN weekly_lesson_logs ON weekly_lesson_logs.id = weekly_lesson_log_learner_verifications.lesson_log_id
        WHERE weekly_lesson_log_learner_verifications.id = weekly_lesson_log_attachments.learner_verification_id
          AND (
            is_org_admin() OR
            (is_mentor() AND weekly_lesson_logs.teacher_id = current_profile_id())
          )
      ))
    )
  )
  WITH CHECK (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (
      (lesson_log_item_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM weekly_lesson_log_items
        JOIN weekly_lesson_logs ON weekly_lesson_logs.id = weekly_lesson_log_items.lesson_log_id
        WHERE weekly_lesson_log_items.id = weekly_lesson_log_attachments.lesson_log_item_id
          AND (
            is_org_admin() OR
            (is_mentor() AND weekly_lesson_logs.teacher_id = current_profile_id())
          )
      )) OR
      (learner_verification_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM weekly_lesson_log_learner_verifications
        JOIN weekly_lesson_logs ON weekly_lesson_logs.id = weekly_lesson_log_learner_verifications.lesson_log_id
        WHERE weekly_lesson_log_learner_verifications.id = weekly_lesson_log_attachments.learner_verification_id
          AND (
            is_org_admin() OR
            (is_mentor() AND weekly_lesson_logs.teacher_id = current_profile_id())
          )
      ))
    )
  );

-- ============================================================================
-- weekly_lesson_log_experience_links
-- ============================================================================

-- SELECT: If user can SELECT parent lesson log
DROP POLICY IF EXISTS "weekly_lesson_log_experience_links_select" ON weekly_lesson_log_experience_links;
CREATE POLICY "weekly_lesson_log_experience_links_select"
  ON weekly_lesson_log_experience_links FOR SELECT
  USING (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (archived_at IS NULL)
    AND EXISTS (
      SELECT 1 FROM weekly_lesson_logs
      WHERE weekly_lesson_logs.id = weekly_lesson_log_experience_links.lesson_log_id
        AND can_access_lesson_log(weekly_lesson_logs.id)
    )
  );

-- INSERT: If user can UPDATE parent lesson log
DROP POLICY IF EXISTS "weekly_lesson_log_experience_links_insert" ON weekly_lesson_log_experience_links;
CREATE POLICY "weekly_lesson_log_experience_links_insert"
  ON weekly_lesson_log_experience_links FOR INSERT
  WITH CHECK (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND EXISTS (
      SELECT 1 FROM weekly_lesson_logs
      WHERE weekly_lesson_logs.id = weekly_lesson_log_experience_links.lesson_log_id
        AND (
          is_org_admin() OR
          (is_mentor() AND weekly_lesson_logs.teacher_id = current_profile_id())
        )
    )
    AND created_by = current_profile_id()
  );

-- UPDATE: If user can UPDATE parent lesson log
DROP POLICY IF EXISTS "weekly_lesson_log_experience_links_update" ON weekly_lesson_log_experience_links;
CREATE POLICY "weekly_lesson_log_experience_links_update"
  ON weekly_lesson_log_experience_links FOR UPDATE
  USING (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND EXISTS (
      SELECT 1 FROM weekly_lesson_logs
      WHERE weekly_lesson_logs.id = weekly_lesson_log_experience_links.lesson_log_id
        AND (
          is_org_admin() OR
          (is_mentor() AND weekly_lesson_logs.teacher_id = current_profile_id())
        )
    )
  )
  WITH CHECK (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND EXISTS (
      SELECT 1 FROM weekly_lesson_logs
      WHERE weekly_lesson_logs.id = weekly_lesson_log_experience_links.lesson_log_id
        AND (
          is_org_admin() OR
          (is_mentor() AND weekly_lesson_logs.teacher_id = current_profile_id())
        )
    )
  );

-- ============================================================================
-- Monitoring: RLS Policies
-- ============================================================================

-- ============================================================================
-- progress_reflections
-- ============================================================================

-- SELECT: principal/admin/registrar (all within org), mentor/teacher (own only)
DROP POLICY IF EXISTS "progress_reflections_select_multi_role" ON progress_reflections;
CREATE POLICY "progress_reflections_select_multi_role"
  ON progress_reflections FOR SELECT
  USING (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND (
      (is_org_admin() OR is_registrar()) OR
      (is_mentor() AND teacher_id = current_profile_id())
    )
  );

-- INSERT: mentor/teacher only (own only)
DROP POLICY IF EXISTS "progress_reflections_insert_teacher" ON progress_reflections;
CREATE POLICY "progress_reflections_insert_teacher"
  ON progress_reflections FOR INSERT
  WITH CHECK (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND is_mentor()
    AND teacher_id = current_profile_id()
    AND created_by = current_profile_id()
  );

-- UPDATE: mentor/teacher (own only), principal/admin (all)
DROP POLICY IF EXISTS "progress_reflections_update_teacher_admin" ON progress_reflections;
CREATE POLICY "progress_reflections_update_teacher_admin"
  ON progress_reflections FOR UPDATE
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

-- ============================================================================
-- Attendance: RLS Policies
-- ============================================================================

-- ============================================================================
-- attendance_sessions
-- ============================================================================

-- SELECT: principal/admin/registrar (all within org), mentor/teacher (own + sessions they can access)
DROP POLICY IF EXISTS "attendance_sessions_select_multi_role" ON attendance_sessions;
CREATE POLICY "attendance_sessions_select_multi_role"
  ON attendance_sessions FOR SELECT
  USING (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND (
      (is_org_admin() OR is_registrar()) OR
      (is_mentor() AND teacher_id = current_profile_id())
    )
  );

-- INSERT: mentor/teacher only (within org/school)
DROP POLICY IF EXISTS "attendance_sessions_insert_teacher" ON attendance_sessions;
CREATE POLICY "attendance_sessions_insert_teacher"
  ON attendance_sessions FOR INSERT
  WITH CHECK (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND is_mentor()
    AND teacher_id = current_profile_id()
    AND created_by = current_profile_id()
  );

-- UPDATE: mentor/teacher (own only), principal/admin (all)
DROP POLICY IF EXISTS "attendance_sessions_update_teacher_admin" ON attendance_sessions;
CREATE POLICY "attendance_sessions_update_teacher_admin"
  ON attendance_sessions FOR UPDATE
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

-- ============================================================================
-- attendance_records
-- ============================================================================

-- SELECT: Multi-role access
DROP POLICY IF EXISTS "attendance_records_select_multi_role" ON attendance_records;
CREATE POLICY "attendance_records_select_multi_role"
  ON attendance_records FOR SELECT
  USING (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND (
      (is_org_admin() OR is_registrar()) OR
      (is_mentor() AND EXISTS (
        SELECT 1 FROM attendance_sessions
        WHERE attendance_sessions.id = attendance_records.session_id
          AND attendance_sessions.teacher_id = current_profile_id()
      )) OR
      (is_student() AND learner_id = current_student_id()) OR
      (is_guardian() AND guardian_can_view_student(learner_id))
    )
  );

-- INSERT: mentor/teacher only (for sessions they own)
DROP POLICY IF EXISTS "attendance_records_insert_teacher" ON attendance_records;
CREATE POLICY "attendance_records_insert_teacher"
  ON attendance_records FOR INSERT
  WITH CHECK (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND is_mentor()
    AND EXISTS (
      SELECT 1 FROM attendance_sessions
      WHERE attendance_sessions.id = attendance_records.session_id
        AND attendance_sessions.teacher_id = current_profile_id()
    )
    AND created_by = current_profile_id()
  );

-- UPDATE: mentor/teacher (sessions they own), principal/admin (all)
DROP POLICY IF EXISTS "attendance_records_update_teacher_admin" ON attendance_records;
CREATE POLICY "attendance_records_update_teacher_admin"
  ON attendance_records FOR UPDATE
  USING (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND (
      is_org_admin() OR
      (is_mentor() AND EXISTS (
        SELECT 1 FROM attendance_sessions
        WHERE attendance_sessions.id = attendance_records.session_id
          AND attendance_sessions.teacher_id = current_profile_id()
      ))
    )
  )
  WITH CHECK (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND (
      is_org_admin() OR
      (is_mentor() AND EXISTS (
        SELECT 1 FROM attendance_sessions
        WHERE attendance_sessions.id = attendance_records.session_id
          AND attendance_sessions.teacher_id = current_profile_id()
      ))
    )
  );

-- ============================================================================
-- teacher_attendance
-- ============================================================================

-- SELECT: principal/admin/registrar (all within org), mentor/teacher (own only)
DROP POLICY IF EXISTS "teacher_attendance_select_multi_role" ON teacher_attendance;
CREATE POLICY "teacher_attendance_select_multi_role"
  ON teacher_attendance FOR SELECT
  USING (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND (
      (is_org_admin() OR is_registrar()) OR
      (is_mentor() AND teacher_id = current_profile_id())
    )
  );

-- INSERT: mentor/teacher only (own only)
DROP POLICY IF EXISTS "teacher_attendance_insert_teacher" ON teacher_attendance;
CREATE POLICY "teacher_attendance_insert_teacher"
  ON teacher_attendance FOR INSERT
  WITH CHECK (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND is_mentor()
    AND teacher_id = current_profile_id()
    AND created_by = current_profile_id()
  );

-- UPDATE: mentor/teacher (own only), principal/admin (all)
DROP POLICY IF EXISTS "teacher_attendance_update_teacher_admin" ON teacher_attendance;
CREATE POLICY "teacher_attendance_update_teacher_admin"
  ON teacher_attendance FOR UPDATE
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

-- ============================================================================
-- Portfolio: RLS Policies
-- ============================================================================

-- ============================================================================
-- portfolio_artifacts
-- ============================================================================

-- SELECT: Multi-role access with visibility checks
DROP POLICY IF EXISTS "portfolio_artifacts_select_multi_role" ON portfolio_artifacts;
CREATE POLICY "portfolio_artifacts_select_multi_role"
  ON portfolio_artifacts FOR SELECT
  USING (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND (
      (is_org_admin()) OR
      (is_mentor() AND visibility IN ('internal', 'shared')) OR
      (is_student() AND student_id = current_student_id()) OR
      (is_guardian() AND visibility IN ('internal', 'shared') AND guardian_can_view_student(student_id))
    )
  );

-- INSERT: student only (own only)
DROP POLICY IF EXISTS "portfolio_artifacts_insert_student" ON portfolio_artifacts;
CREATE POLICY "portfolio_artifacts_insert_student"
  ON portfolio_artifacts FOR INSERT
  WITH CHECK (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND is_student()
    AND student_id = current_student_id()
    AND created_by = current_profile_id()
  );

-- UPDATE: student (own only), principal/admin (all)
DROP POLICY IF EXISTS "portfolio_artifacts_update_student_admin" ON portfolio_artifacts;
CREATE POLICY "portfolio_artifacts_update_student_admin"
  ON portfolio_artifacts FOR UPDATE
  USING (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND (
      is_org_admin() OR
      (is_student() AND student_id = current_student_id())
    )
  )
  WITH CHECK (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND (
      is_org_admin() OR
      (is_student() AND student_id = current_student_id())
    )
  );

-- ============================================================================
-- portfolio_artifact_tags
-- ============================================================================

-- SELECT: If user can SELECT parent artifact
DROP POLICY IF EXISTS "portfolio_artifact_tags_select" ON portfolio_artifact_tags;
CREATE POLICY "portfolio_artifact_tags_select"
  ON portfolio_artifact_tags FOR SELECT
  USING (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (archived_at IS NULL)
    AND EXISTS (
      SELECT 1 FROM portfolio_artifacts
      WHERE portfolio_artifacts.id = portfolio_artifact_tags.artifact_id
        AND (portfolio_artifacts.organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
        AND (portfolio_artifacts.school_id IS NULL OR can_access_school(portfolio_artifacts.school_id))
        AND (
          (is_org_admin()) OR
          (is_mentor() AND portfolio_artifacts.visibility IN ('internal', 'shared')) OR
          (is_student() AND portfolio_artifacts.student_id = current_student_id()) OR
          (is_guardian() AND portfolio_artifacts.visibility IN ('internal', 'shared') AND guardian_can_view_student(portfolio_artifacts.student_id))
        )
    )
  );

-- INSERT: If user can UPDATE parent artifact
DROP POLICY IF EXISTS "portfolio_artifact_tags_insert" ON portfolio_artifact_tags;
CREATE POLICY "portfolio_artifact_tags_insert"
  ON portfolio_artifact_tags FOR INSERT
  WITH CHECK (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND EXISTS (
      SELECT 1 FROM portfolio_artifacts
      WHERE portfolio_artifacts.id = portfolio_artifact_tags.artifact_id
        AND (portfolio_artifacts.organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
        AND (portfolio_artifacts.school_id IS NULL OR can_access_school(portfolio_artifacts.school_id))
        AND (
          is_org_admin() OR
          (is_student() AND portfolio_artifacts.student_id = current_student_id())
        )
    )
    AND created_by = current_profile_id()
  );

-- UPDATE: If user can UPDATE parent artifact
DROP POLICY IF EXISTS "portfolio_artifact_tags_update" ON portfolio_artifact_tags;
CREATE POLICY "portfolio_artifact_tags_update"
  ON portfolio_artifact_tags FOR UPDATE
  USING (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND EXISTS (
      SELECT 1 FROM portfolio_artifacts
      WHERE portfolio_artifacts.id = portfolio_artifact_tags.artifact_id
        AND (portfolio_artifacts.organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
        AND (portfolio_artifacts.school_id IS NULL OR can_access_school(portfolio_artifacts.school_id))
        AND (
          is_org_admin() OR
          (is_student() AND portfolio_artifacts.student_id = current_student_id())
        )
    )
  )
  WITH CHECK (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND EXISTS (
      SELECT 1 FROM portfolio_artifacts
      WHERE portfolio_artifacts.id = portfolio_artifact_tags.artifact_id
        AND (portfolio_artifacts.organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
        AND (portfolio_artifacts.school_id IS NULL OR can_access_school(portfolio_artifacts.school_id))
        AND (
          is_org_admin() OR
          (is_student() AND portfolio_artifacts.student_id = current_student_id())
        )
    )
  );

-- ============================================================================
-- portfolio_artifact_links
-- ============================================================================

-- SELECT: If user can SELECT parent artifact
DROP POLICY IF EXISTS "portfolio_artifact_links_select" ON portfolio_artifact_links;
CREATE POLICY "portfolio_artifact_links_select"
  ON portfolio_artifact_links FOR SELECT
  USING (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (archived_at IS NULL)
    AND EXISTS (
      SELECT 1 FROM portfolio_artifacts
      WHERE portfolio_artifacts.id = portfolio_artifact_links.artifact_id
        AND (portfolio_artifacts.organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
        AND (portfolio_artifacts.school_id IS NULL OR can_access_school(portfolio_artifacts.school_id))
        AND (
          (is_org_admin()) OR
          (is_mentor() AND portfolio_artifacts.visibility IN ('internal', 'shared')) OR
          (is_student() AND portfolio_artifacts.student_id = current_student_id()) OR
          (is_guardian() AND portfolio_artifacts.visibility IN ('internal', 'shared') AND guardian_can_view_student(portfolio_artifacts.student_id))
        )
    )
  );

-- INSERT: If user can UPDATE parent artifact
DROP POLICY IF EXISTS "portfolio_artifact_links_insert" ON portfolio_artifact_links;
CREATE POLICY "portfolio_artifact_links_insert"
  ON portfolio_artifact_links FOR INSERT
  WITH CHECK (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND EXISTS (
      SELECT 1 FROM portfolio_artifacts
      WHERE portfolio_artifacts.id = portfolio_artifact_links.artifact_id
        AND (portfolio_artifacts.organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
        AND (portfolio_artifacts.school_id IS NULL OR can_access_school(portfolio_artifacts.school_id))
        AND (
          is_org_admin() OR
          (is_student() AND portfolio_artifacts.student_id = current_student_id())
        )
    )
    AND created_by = current_profile_id()
  );

-- UPDATE: If user can UPDATE parent artifact
DROP POLICY IF EXISTS "portfolio_artifact_links_update" ON portfolio_artifact_links;
CREATE POLICY "portfolio_artifact_links_update"
  ON portfolio_artifact_links FOR UPDATE
  USING (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND EXISTS (
      SELECT 1 FROM portfolio_artifacts
      WHERE portfolio_artifacts.id = portfolio_artifact_links.artifact_id
        AND (portfolio_artifacts.organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
        AND (portfolio_artifacts.school_id IS NULL OR can_access_school(portfolio_artifacts.school_id))
        AND (
          is_org_admin() OR
          (is_student() AND portfolio_artifacts.student_id = current_student_id())
        )
    )
  )
  WITH CHECK (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND EXISTS (
      SELECT 1 FROM portfolio_artifacts
      WHERE portfolio_artifacts.id = portfolio_artifact_links.artifact_id
        AND (portfolio_artifacts.organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
        AND (portfolio_artifacts.school_id IS NULL OR can_access_school(portfolio_artifacts.school_id))
        AND (
          is_org_admin() OR
          (is_student() AND portfolio_artifacts.student_id = current_student_id())
        )
    )
  );

-- ============================================================================
-- Industry Assessment: RLS Policies (Optional)
-- ============================================================================

-- ============================================================================
-- industry_assessments
-- ============================================================================

-- SELECT: principal/admin/registrar (all within org), coordinator (own only)
-- Note: Coordinator role is assumed to be normalized to mentor/teacher, but can be checked separately if needed
DROP POLICY IF EXISTS "industry_assessments_select_multi_role" ON industry_assessments;
CREATE POLICY "industry_assessments_select_multi_role"
  ON industry_assessments FOR SELECT
  USING (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND (
      (is_org_admin() OR is_registrar()) OR
      (is_mentor() AND coordinator_id = current_profile_id())
    )
  );

-- INSERT: coordinator only (within org/school)
DROP POLICY IF EXISTS "industry_assessments_insert_coordinator" ON industry_assessments;
CREATE POLICY "industry_assessments_insert_coordinator"
  ON industry_assessments FOR INSERT
  WITH CHECK (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND is_mentor()
    AND coordinator_id = current_profile_id()
    AND created_by = current_profile_id()
  );

-- UPDATE: coordinator (own only), principal/admin (all)
DROP POLICY IF EXISTS "industry_assessments_update_coordinator_admin" ON industry_assessments;
CREATE POLICY "industry_assessments_update_coordinator_admin"
  ON industry_assessments FOR UPDATE
  USING (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND (
      is_org_admin() OR
      (is_mentor() AND coordinator_id = current_profile_id())
    )
  )
  WITH CHECK (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND (
      is_org_admin() OR
      (is_mentor() AND coordinator_id = current_profile_id())
    )
  );

-- ============================================================================
-- End of RLS Policies for Phase 6 Pedagogy Operations
-- ============================================================================
