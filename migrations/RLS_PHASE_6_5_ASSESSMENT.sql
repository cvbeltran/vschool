-- Migration: Add Row Level Security (RLS) policies for Phase 6.5 Assessment & Judgment Layer
-- Created: 2024
-- Description: Creates RLS policies for Phase 6.5 tables (Assessment Records, Label Taxonomies, Evidence Links)
-- Enforces tenant isolation, role-based access control, row ownership, and privacy
-- Super admins can bypass RLS checks and access all data
--
-- HARDENING NOTES:
--   - All SECURITY DEFINER functions set search_path = public, auth
--   - Policies made idempotent with DROP POLICY IF EXISTS
--   - Org isolation enforced via organization_id
--   - School scoping via (school_id IS NULL OR can_access_school(school_id))
--   - No computation, scoring, or aggregation in policies
--   - Uses existing helper functions from Phase 2/3/6 RLS (is_mentor() normalizes teacher/faculty -> mentor)

-- ============================================================================
-- README: Role Taxonomy, Policy Intent, and Dependencies
-- ============================================================================

-- ROLE TAXONOMY (Canonical Roles for Phase 6.5):
--   principal: Full CRUD on label taxonomies, view all assessments (monitoring)
--   admin: Same as principal
--   registrar: READ-ONLY for all assessments and label taxonomies (monitoring)
--   mentor/teacher: CREATE/UPDATE own assessments, view available label sets (read-only)
--   student: READ-only own assessments (if enabled, default off unless implemented)
--   guardian: READ-only linked learners' assessments (if enabled, default off unless implemented)

-- POLICY INTENT PER TABLE:
--   Label Taxonomy Tables:
--     assessment_label_sets:
--       - SELECT: principal, admin, registrar, mentor/teacher (within org/school)
--       - INSERT/UPDATE: principal, admin only
--       - DELETE: Disallow (use archived_at)
--
--     assessment_labels:
--       - SELECT: Same visibility as parent label set
--       - INSERT/UPDATE: If user can UPDATE parent label set
--       - DELETE: Disallow (use archived_at)
--
--   Assessment Records:
--     assessments:
--       - SELECT: principal/admin/registrar (all within org), mentor/teacher (own only), student (own only if enabled), guardian (linked learners only if enabled)
--       - INSERT: mentor/teacher only (own only, within org/school)
--       - UPDATE: mentor/teacher (own only), principal/admin (all)
--       - DELETE: Disallow (use archived_at)
--
--   Evidence Links:
--     assessment_evidence_links:
--       - SELECT: If user can SELECT parent assessment
--       - INSERT/UPDATE: If user can UPDATE parent assessment
--       - DELETE: Disallow (use archived_at)

-- DEPENDENCIES:
--   - Uses helper functions from Phase 2/3/6 RLS (assumed to exist):
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
-- Enable Row Level Security on Phase 6.5 Tables
-- ============================================================================

ALTER TABLE assessment_label_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_evidence_links ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Helper Functions (Phase 6.5 Specific)
-- ============================================================================

-- Check if current user can edit an assessment (own assessment or admin)
CREATE OR REPLACE FUNCTION can_edit_assessment(assessment_id_param UUID)
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
  
  -- Org admin can edit all in org
  IF is_org_admin() THEN
    RETURN EXISTS (
      SELECT 1 FROM assessments
      WHERE id = assessment_id_param
        AND organization_id = current_organization_id()
    );
  END IF;
  
  -- Teacher can edit own assessments only
  IF is_mentor() THEN
    RETURN EXISTS (
      SELECT 1 FROM assessments
      WHERE id = assessment_id_param
        AND teacher_id = current_profile_id()
        AND organization_id = current_organization_id()
    );
  END IF;
  
  RETURN FALSE;
END;
$$;

-- ============================================================================
-- Assessment Label Sets: RLS Policies
-- ============================================================================

-- SELECT: principal, admin, registrar, mentor/teacher (within org/school, staff roles only, non-archived)
DROP POLICY IF EXISTS "assessment_label_sets_select_org" ON assessment_label_sets;
CREATE POLICY "assessment_label_sets_select_org"
  ON assessment_label_sets FOR SELECT
  USING (
    (
      (is_org_admin() OR is_registrar() OR is_mentor())
      AND organization_id = current_organization_id()
      AND (school_id IS NULL OR can_access_school(school_id))
      AND archived_at IS NULL
    )
    OR is_super_admin(current_profile_id())
  );

-- INSERT: principal, admin only
DROP POLICY IF EXISTS "assessment_label_sets_insert_admin" ON assessment_label_sets;
CREATE POLICY "assessment_label_sets_insert_admin"
  ON assessment_label_sets FOR INSERT
  WITH CHECK (
    (is_org_admin() AND organization_id = current_organization_id() AND (school_id IS NULL OR can_access_school(school_id)))
    OR is_super_admin(current_profile_id())
  );

-- UPDATE: principal, admin only
DROP POLICY IF EXISTS "assessment_label_sets_update_admin" ON assessment_label_sets;
CREATE POLICY "assessment_label_sets_update_admin"
  ON assessment_label_sets FOR UPDATE
  USING (
    (is_org_admin() AND organization_id = current_organization_id() AND (school_id IS NULL OR can_access_school(school_id)))
    OR is_super_admin(current_profile_id())
  )
  WITH CHECK (
    (
      is_super_admin(current_profile_id())
      OR (
        is_org_admin()
        AND organization_id = current_organization_id()
        AND (school_id IS NULL OR can_access_school(school_id))
      )
    )
  );

-- ============================================================================
-- Assessment Labels: RLS Policies
-- ============================================================================

-- SELECT: Same visibility as parent label set
DROP POLICY IF EXISTS "assessment_labels_select_org" ON assessment_labels;
CREATE POLICY "assessment_labels_select_org"
  ON assessment_labels FOR SELECT
  USING (
    assessment_labels.archived_at IS NULL
    AND (
      EXISTS (
        SELECT 1 FROM assessment_label_sets
        WHERE id = assessment_labels.label_set_id
          AND organization_id = current_organization_id()
          AND (school_id IS NULL OR can_access_school(school_id))
          AND archived_at IS NULL
      )
      OR is_super_admin(current_profile_id())
    )
  );

-- INSERT: If user can UPDATE parent label set
DROP POLICY IF EXISTS "assessment_labels_insert_admin" ON assessment_labels;
CREATE POLICY "assessment_labels_insert_admin"
  ON assessment_labels FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM assessment_label_sets
      WHERE id = assessment_labels.label_set_id
        AND (
          (is_org_admin() AND organization_id = current_organization_id() AND (school_id IS NULL OR can_access_school(school_id)))
          OR is_super_admin(current_profile_id())
        )
        AND archived_at IS NULL
    )
  );

-- UPDATE: If user can UPDATE parent label set
DROP POLICY IF EXISTS "assessment_labels_update_admin" ON assessment_labels;
CREATE POLICY "assessment_labels_update_admin"
  ON assessment_labels FOR UPDATE
  USING (
    assessment_labels.archived_at IS NULL
    AND EXISTS (
      SELECT 1 FROM assessment_label_sets
      WHERE id = assessment_labels.label_set_id
        AND (
          (is_org_admin() AND organization_id = current_organization_id() AND (school_id IS NULL OR can_access_school(school_id)))
          OR is_super_admin(current_profile_id())
        )
        AND archived_at IS NULL
    )
  )
  WITH CHECK (
    assessment_labels.archived_at IS NULL
    AND (
      is_super_admin(current_profile_id())
      OR EXISTS (
        SELECT 1 FROM assessment_label_sets
        WHERE id = assessment_labels.label_set_id
          AND is_org_admin()
          AND organization_id = current_organization_id()
          AND (school_id IS NULL OR can_access_school(school_id))
          AND archived_at IS NULL
      )
    )
  );

-- ============================================================================
-- Assessments: RLS Policies
-- ============================================================================

-- SELECT: principal/admin/registrar (all within org), mentor/teacher (own only), student (own only if enabled), guardian (linked learners only if enabled)
-- Hardened: archived_at IS NULL and status <> 'archived' required
DROP POLICY IF EXISTS "assessments_select_all" ON assessments;
CREATE POLICY "assessments_select_all"
  ON assessments FOR SELECT
  USING (
    archived_at IS NULL
    AND status <> 'archived'
    AND (
      -- Super admin can see all
      is_super_admin(current_profile_id())
      OR
      -- Org admin/registrar can see all in org
      (
        (is_org_admin() OR is_registrar())
        AND organization_id = current_organization_id()
        AND (school_id IS NULL OR can_access_school(school_id))
      )
      OR
      -- Teacher can see own assessments
      (
        is_mentor()
        AND teacher_id = current_profile_id()
        AND organization_id = current_organization_id()
        AND (school_id IS NULL OR can_access_school(school_id))
      )
      OR
      -- Student can see own assessments (if enabled - default off, so this may be empty unless implemented)
      (
        is_student()
        AND learner_id = current_student_id()
        AND organization_id = current_organization_id()
        AND (school_id IS NULL OR can_access_school(school_id))
      )
      OR
      -- Guardian can see linked learners' assessments (if enabled - default off, so this may be empty unless implemented)
      (
        is_guardian()
        AND guardian_can_view_student(learner_id)
        AND organization_id = current_organization_id()
        AND (school_id IS NULL OR can_access_school(school_id))
      )
    )
  );

-- INSERT: mentor/teacher only (own only, within org/school)
DROP POLICY IF EXISTS "assessments_insert_teacher" ON assessments;
CREATE POLICY "assessments_insert_teacher"
  ON assessments FOR INSERT
  WITH CHECK (
    -- Super admin can insert
    is_super_admin(current_profile_id())
    OR
    -- Teacher can insert own assessments
    (
      is_mentor()
      AND teacher_id = current_profile_id()
      AND created_by = current_profile_id()
      AND organization_id = current_organization_id()
      AND (school_id IS NULL OR can_access_school(school_id))
    )
  );

-- UPDATE: mentor/teacher (own only), principal/admin (all)
DROP POLICY IF EXISTS "assessments_update_teacher_admin" ON assessments;
CREATE POLICY "assessments_update_teacher_admin"
  ON assessments FOR UPDATE
  USING (
    -- Super admin can update all
    is_super_admin(current_profile_id())
    OR
    -- Org admin can update all in org
    (
      is_org_admin()
      AND organization_id = current_organization_id()
      AND (school_id IS NULL OR can_access_school(school_id))
    )
    OR
    -- Teacher can update own assessments
    (
      is_mentor()
      AND teacher_id = current_profile_id()
      AND organization_id = current_organization_id()
      AND (school_id IS NULL OR can_access_school(school_id))
    )
  )
  WITH CHECK (
    -- Super admin can change anything
    is_super_admin(current_profile_id())
    OR
    -- Org admin must keep org/school scope
    (
      is_org_admin()
      AND organization_id = current_organization_id()
      AND (school_id IS NULL OR can_access_school(school_id))
    )
    OR
    -- Teacher can only update own assessments and cannot change critical fields
    (
      is_mentor()
      AND teacher_id = current_profile_id()
      AND organization_id = current_organization_id()
      AND (school_id IS NULL OR can_access_school(school_id))
      -- Note: learner_id, teacher_id, organization_id changes prevented by application logic/triggers
      -- RLS ensures teacher_id and organization_id remain correct
    )
  );

-- ============================================================================
-- Assessment Evidence Links: RLS Policies
-- ============================================================================

-- SELECT: If user can SELECT parent assessment
-- Hardened: archived_at IS NULL checks for both evidence link and parent assessment
DROP POLICY IF EXISTS "assessment_evidence_links_select_assessment" ON assessment_evidence_links;
CREATE POLICY "assessment_evidence_links_select_assessment"
  ON assessment_evidence_links FOR SELECT
  USING (
    archived_at IS NULL
    AND EXISTS (
      SELECT 1 FROM assessments
      WHERE id = assessment_evidence_links.assessment_id
        AND archived_at IS NULL
        AND status <> 'archived'
        AND (
          -- Super admin can see all
          is_super_admin(current_profile_id())
          OR
          -- Org admin/registrar can see all in org
          (
            (is_org_admin() OR is_registrar())
            AND organization_id = current_organization_id()
            AND (school_id IS NULL OR can_access_school(school_id))
          )
          OR
          -- Teacher can see own assessments' evidence
          (
            is_mentor()
            AND teacher_id = current_profile_id()
            AND organization_id = current_organization_id()
            AND (school_id IS NULL OR can_access_school(school_id))
          )
          OR
          -- Student can see own assessments' evidence (if enabled)
          (
            is_student()
            AND learner_id = current_student_id()
            AND organization_id = current_organization_id()
            AND (school_id IS NULL OR can_access_school(school_id))
          )
          OR
          -- Guardian can see linked learners' assessments' evidence (if enabled)
          (
            is_guardian()
            AND guardian_can_view_student(learner_id)
            AND organization_id = current_organization_id()
            AND (school_id IS NULL OR can_access_school(school_id))
          )
        )
    )
  );

-- INSERT: If user can UPDATE parent assessment
-- Hardened: archived_at IS NULL checks for parent assessment, evidence existence validation
DROP POLICY IF EXISTS "assessment_evidence_links_insert_assessment" ON assessment_evidence_links;
CREATE POLICY "assessment_evidence_links_insert_assessment"
  ON assessment_evidence_links FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM assessments
      WHERE id = assessment_evidence_links.assessment_id
        AND archived_at IS NULL
        AND status <> 'archived'
        AND (
          -- Super admin can insert
          is_super_admin(current_profile_id())
          OR
          -- Org admin can insert
          (
            is_org_admin()
            AND organization_id = current_organization_id()
            AND (school_id IS NULL OR can_access_school(school_id))
          )
          OR
          -- Teacher can insert for own assessments
          (
            is_mentor()
            AND teacher_id = current_profile_id()
            AND organization_id = current_organization_id()
            AND (school_id IS NULL OR can_access_school(school_id))
          )
        )
    )
    AND created_by = current_profile_id()
    -- Validate referenced evidence exists in same organization
    AND (
      -- observation
      (assessment_evidence_links.evidence_type = 'observation' AND assessment_evidence_links.observation_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM observations WHERE id = assessment_evidence_links.observation_id AND organization_id = current_organization_id()
      ))
      OR
      -- experience
      (assessment_evidence_links.evidence_type = 'experience' AND assessment_evidence_links.experience_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM experiences WHERE id = assessment_evidence_links.experience_id AND organization_id = current_organization_id()
      ))
      OR
      -- teacher_reflection
      (assessment_evidence_links.evidence_type = 'teacher_reflection' AND assessment_evidence_links.teacher_reflection_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM teacher_reflections WHERE id = assessment_evidence_links.teacher_reflection_id AND organization_id = current_organization_id()
      ))
      OR
      -- student_feedback
      (assessment_evidence_links.evidence_type = 'student_feedback' AND assessment_evidence_links.student_feedback_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM student_feedback WHERE id = assessment_evidence_links.student_feedback_id AND organization_id = current_organization_id()
      ))
      OR
      -- portfolio_artifact
      (assessment_evidence_links.evidence_type = 'portfolio_artifact' AND assessment_evidence_links.portfolio_artifact_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM portfolio_artifacts WHERE id = assessment_evidence_links.portfolio_artifact_id AND organization_id = current_organization_id()
      ))
      OR
      -- attendance_session
      (assessment_evidence_links.evidence_type = 'attendance_session' AND assessment_evidence_links.attendance_session_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM attendance_sessions WHERE id = assessment_evidence_links.attendance_session_id AND organization_id = current_organization_id()
      ))
      OR
      -- attendance_record
      (assessment_evidence_links.evidence_type = 'attendance_record' AND assessment_evidence_links.attendance_record_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM attendance_records WHERE id = assessment_evidence_links.attendance_record_id AND organization_id = current_organization_id()
      ))
    )
  );

-- UPDATE: If user can UPDATE parent assessment
-- Hardened: archived_at IS NULL checks for both evidence link and parent assessment
DROP POLICY IF EXISTS "assessment_evidence_links_update_assessment" ON assessment_evidence_links;
CREATE POLICY "assessment_evidence_links_update_assessment"
  ON assessment_evidence_links FOR UPDATE
  USING (
    archived_at IS NULL
    AND EXISTS (
      SELECT 1 FROM assessments
      WHERE id = assessment_evidence_links.assessment_id
        AND archived_at IS NULL
        AND status <> 'archived'
        AND (
          -- Super admin can update
          is_super_admin(current_profile_id())
          OR
          -- Org admin can update
          (
            is_org_admin()
            AND organization_id = current_organization_id()
            AND (school_id IS NULL OR can_access_school(school_id))
          )
          OR
          -- Teacher can update for own assessments
          (
            is_mentor()
            AND teacher_id = current_profile_id()
            AND organization_id = current_organization_id()
            AND (school_id IS NULL OR can_access_school(school_id))
          )
        )
    )
  )
  WITH CHECK (
    archived_at IS NULL
    AND (
      -- Super admin can change anything
      is_super_admin(current_profile_id())
      OR
      -- Org admin/teacher must keep assessment_id pointing to valid assessment
      (
        EXISTS (
          SELECT 1 FROM assessments
          WHERE id = assessment_evidence_links.assessment_id
            AND archived_at IS NULL
            AND status <> 'archived'
            AND (
              (is_org_admin() AND organization_id = current_organization_id() AND (school_id IS NULL OR can_access_school(school_id)))
              OR
              (is_mentor() AND teacher_id = current_profile_id() AND organization_id = current_organization_id() AND (school_id IS NULL OR can_access_school(school_id)))
            )
        )
        -- For teachers, ensure created_by remains themselves (prevents changing ownership)
        AND (
          is_org_admin()
          OR (
            is_mentor()
            AND assessment_evidence_links.created_by = current_profile_id()
          )
        )
      )
    )
  );

-- ============================================================================
-- End of RLS Policies
-- ============================================================================

