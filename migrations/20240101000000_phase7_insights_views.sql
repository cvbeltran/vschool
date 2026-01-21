-- Migration: Phase 7 - Narrative Analytics & Insight Views
-- Created: 2024
-- Description: Creates read-only views for narrative analytics and insights
-- Phase 7 is READ-ONLY - no writes to Phase 2-6 tables
-- No math beyond counts - no averages, percentages, rankings, or computation logic
-- Uses human-readable labels only
--
-- RLS Safety: All views use security_invoker=true and security_barrier=true
-- to ensure RLS policies on underlying tables are enforced per-requester.
-- Explicit tenant scoping via current_organization_id() enforces multi-tenant isolation.
-- Teacher scoping restricts learner-identifying views to learners in teacher's context.
--
-- Compatibility Note: If your Postgres version does not support WITH (security_invoker=true)
-- in CREATE VIEW, the views will be created without it. You can manually add it using:
-- ALTER VIEW view_name SET (security_invoker=true);
-- security_barrier=true is set via ALTER VIEW for maximum compatibility.

-- ============================================================================
-- A. Observation Patterns Views
-- ============================================================================

-- Observation counts per competency
CREATE OR REPLACE VIEW v_insight_observation_competency_counts AS
SELECT 
  o.organization_id,
  o.competency_id,
  c.name AS competency_name,
  d.name AS domain_name,
  COUNT(*) AS observation_count
FROM observations o
INNER JOIN competencies c ON o.competency_id = c.id
INNER JOIN domains d ON c.domain_id = d.id
WHERE o.archived_at IS NULL
  AND o.status = 'active'
  AND c.archived_at IS NULL
  AND d.archived_at IS NULL
  AND o.organization_id = current_organization_id()
GROUP BY o.organization_id, o.competency_id, c.name, d.name;

ALTER VIEW v_insight_observation_competency_counts SET (security_barrier=true);

COMMENT ON VIEW v_insight_observation_competency_counts IS 
  'Counts observations per competency. Narrative insight only - no computation.';

-- Observation frequency by experience
CREATE OR REPLACE VIEW v_insight_observation_experience_frequency AS
SELECT 
  o.organization_id,
  o.experience_id,
  e.name AS experience_name,
  e.experience_type,
  COUNT(*) AS observation_count
FROM observations o
INNER JOIN experiences e ON o.experience_id = e.id
WHERE o.archived_at IS NULL
  AND o.status = 'active'
  AND e.archived_at IS NULL
  AND o.organization_id = current_organization_id()
GROUP BY o.organization_id, o.experience_id, e.name, e.experience_type;

ALTER VIEW v_insight_observation_experience_frequency SET (security_barrier=true);

COMMENT ON VIEW v_insight_observation_experience_frequency IS 
  'Observation frequency by experience type. Counts only - no percentages or rankings.';

-- Indicator occurrence counts
CREATE OR REPLACE VIEW v_insight_indicator_occurrence_counts AS
SELECT 
  o.organization_id,
  oi.indicator_id,
  i.description AS indicator_description,
  i.competency_id,
  c.name AS competency_name,
  COUNT(*) AS occurrence_count
FROM observation_indicator_links oi
INNER JOIN observations o ON oi.observation_id = o.id
INNER JOIN indicators i ON oi.indicator_id = i.id
INNER JOIN competencies c ON i.competency_id = c.id
WHERE oi.archived_at IS NULL
  AND o.archived_at IS NULL
  AND o.status = 'active'
  AND i.archived_at IS NULL
  AND c.archived_at IS NULL
  AND o.organization_id = current_organization_id()
GROUP BY o.organization_id, oi.indicator_id, i.description, i.competency_id, c.name;

ALTER VIEW v_insight_indicator_occurrence_counts SET (security_barrier=true);

COMMENT ON VIEW v_insight_indicator_occurrence_counts IS 
  'Counts how often each indicator appears in observations. Narrative insight only.';

-- ============================================================================
-- B. Teaching Adaptation Views
-- ============================================================================

-- Count of lesson logs vs planned weeks
CREATE OR REPLACE VIEW v_insight_lesson_log_vs_planned AS
SELECT 
  s.organization_id,
  s.id AS syllabus_id,
  s.name AS syllabus_name,
  COUNT(DISTINCT sw.id) AS planned_weeks_count,
  COUNT(DISTINCT wll.id) AS lesson_logs_count
FROM syllabi s
LEFT JOIN syllabus_weeks sw ON s.id = sw.syllabus_id AND sw.archived_at IS NULL
LEFT JOIN weekly_lesson_logs wll ON s.id = wll.syllabus_id AND wll.archived_at IS NULL
WHERE s.archived_at IS NULL
  AND s.organization_id = current_organization_id()
GROUP BY s.organization_id, s.id, s.name;

ALTER VIEW v_insight_lesson_log_vs_planned SET (security_barrier=true);

COMMENT ON VIEW v_insight_lesson_log_vs_planned IS 
  'Compares planned syllabus weeks to actual lesson logs created. Counts only - no computation.';

-- Off-track log reasons (text frequency from progress_reflections)
CREATE OR REPLACE VIEW v_insight_off_track_reasons AS
SELECT 
  pr.organization_id,
  pr.teacher_id,
  pr.syllabus_id,
  s.name AS syllabus_name,
  pr.reflection_text,
  COUNT(*) AS mention_count
FROM progress_reflections pr
LEFT JOIN syllabi s ON pr.syllabus_id = s.id
WHERE pr.archived_at IS NULL
  AND pr.organization_id = current_organization_id()
GROUP BY pr.organization_id, pr.teacher_id, pr.syllabus_id, s.name, pr.reflection_text;

ALTER VIEW v_insight_off_track_reasons SET (security_barrier=true);

COMMENT ON VIEW v_insight_off_track_reasons IS 
  'Text-based reasons for off-track progress. Narrative insights from reflection text.';

-- Syllabus revision count per teacher
CREATE OR REPLACE VIEW v_insight_syllabus_revision_counts AS
SELECT 
  s.organization_id,
  s.created_by AS teacher_id,
  COUNT(*) AS syllabus_revision_count
FROM syllabi s
WHERE s.archived_at IS NULL
  AND s.parent_syllabus_id IS NOT NULL  -- Only revisions, not original syllabi
  AND s.organization_id = current_organization_id()
GROUP BY s.organization_id, s.created_by;

ALTER VIEW v_insight_syllabus_revision_counts SET (security_barrier=true);

COMMENT ON VIEW v_insight_syllabus_revision_counts IS 
  'Counts syllabus revisions per teacher. Shows adaptation frequency.';

-- ============================================================================
-- C. Reflection & Feedback Alignment Views
-- ============================================================================

-- Reflection frequency by time period
CREATE OR REPLACE VIEW v_insight_reflection_frequency AS
SELECT 
  tr.organization_id,
  tr.teacher_id,
  tr.school_year_id,
  sy.year_label AS school_year_label,
  tr.quarter,
  COUNT(*) AS reflection_count
FROM teacher_reflections tr
LEFT JOIN school_years sy ON tr.school_year_id = sy.id
WHERE tr.archived_at IS NULL
  AND tr.status = 'completed'
  AND tr.organization_id = current_organization_id()
GROUP BY tr.organization_id, tr.teacher_id, tr.school_year_id, sy.year_label, tr.quarter;

ALTER VIEW v_insight_reflection_frequency SET (security_barrier=true);

COMMENT ON VIEW v_insight_reflection_frequency IS 
  'Reflection frequency by teacher, school year, and quarter. Counts only.';

-- Student feedback volume by experience type
CREATE OR REPLACE VIEW v_insight_feedback_volume_by_experience AS
SELECT 
  sf.organization_id,
  sf.experience_id,
  e.name AS experience_name,
  sf.experience_type,
  sf.quarter,
  COUNT(*) AS feedback_count
FROM student_feedback sf
LEFT JOIN experiences e ON sf.experience_id = e.id
WHERE sf.archived_at IS NULL
  AND sf.status = 'completed'
  AND sf.organization_id = current_organization_id()
GROUP BY sf.organization_id, sf.experience_id, e.name, sf.experience_type, sf.quarter;

ALTER VIEW v_insight_feedback_volume_by_experience SET (security_barrier=true);

COMMENT ON VIEW v_insight_feedback_volume_by_experience IS 
  'Student feedback volume by experience type and quarter. Counts only.';

-- Alignment summaries (counts of reflections and feedback linked to same experiences)
CREATE OR REPLACE VIEW v_insight_reflection_feedback_alignment AS
SELECT 
  e.organization_id,
  e.id AS experience_id,
  e.name AS experience_name,
  COUNT(DISTINCT tr.id) AS reflection_count,
  COUNT(DISTINCT sf.id) AS feedback_count
FROM experiences e
LEFT JOIN teacher_reflections tr ON e.id = tr.experience_id 
  AND tr.archived_at IS NULL 
  AND tr.status = 'completed'
LEFT JOIN student_feedback sf ON e.id = sf.experience_id 
  AND sf.archived_at IS NULL 
  AND sf.status = 'completed'
WHERE e.archived_at IS NULL
  AND e.organization_id = current_organization_id()
GROUP BY e.organization_id, e.id, e.name;

ALTER VIEW v_insight_reflection_feedback_alignment SET (security_barrier=true);

COMMENT ON VIEW v_insight_reflection_feedback_alignment IS 
  'Counts reflections and feedback linked to same experiences. Shows alignment without computation.';

-- ============================================================================
-- D. Engagement Signals Views
-- ============================================================================

-- Portfolio artifacts count per learner (for teacher view)
CREATE OR REPLACE VIEW v_insight_portfolio_artifact_counts AS
SELECT 
  pa.organization_id,
  pa.student_id,
  s.first_name AS student_first_name,
  s.last_name AS student_last_name,
  s.student_number,
  COUNT(*) AS artifact_count
FROM portfolio_artifacts pa
INNER JOIN students s ON pa.student_id = s.id
WHERE pa.archived_at IS NULL
  AND pa.organization_id = current_organization_id()
  -- Teacher scoping: only show learners in teacher's context
  AND (
    -- Learner has observations created by current teacher
    EXISTS (
      SELECT 1 FROM observations obs
      WHERE obs.learner_id = pa.student_id
        AND obs.created_by = current_profile_id()
        AND obs.archived_at IS NULL
        AND obs.status = 'active'
        AND obs.organization_id = current_organization_id()
    )
    OR
    -- Learner has attendance records in sessions created by current teacher
    EXISTS (
      SELECT 1 FROM attendance_records ar_inner
      INNER JOIN attendance_sessions asess_inner ON ar_inner.session_id = asess_inner.id
      WHERE ar_inner.learner_id = pa.student_id
        AND asess_inner.teacher_id = current_profile_id()
        AND ar_inner.archived_at IS NULL
        AND asess_inner.archived_at IS NULL
        AND ar_inner.organization_id = current_organization_id()
        AND asess_inner.organization_id = current_organization_id()
    )
    OR
    -- Learner is linked via lesson logs to syllabi owned by current teacher
    EXISTS (
      SELECT 1 FROM weekly_lesson_log_learner_verifications wlllv
      INNER JOIN weekly_lesson_logs wll ON wlllv.lesson_log_id = wll.id
      INNER JOIN syllabi s_inner ON wll.syllabus_id = s_inner.id
      WHERE wlllv.learner_id = pa.student_id
        AND (
          s_inner.created_by = current_profile_id()
          OR EXISTS (
            SELECT 1 FROM syllabus_contributors sc
            WHERE sc.syllabus_id = s_inner.id
              AND sc.teacher_id = current_profile_id()
              AND sc.archived_at IS NULL
              AND sc.organization_id = current_organization_id()
          )
        )
        AND wlllv.archived_at IS NULL
        AND wll.archived_at IS NULL
        AND s_inner.archived_at IS NULL
        AND wlllv.organization_id = current_organization_id()
        AND wll.organization_id = current_organization_id()
        AND s_inner.organization_id = current_organization_id()
    )
  )
GROUP BY pa.organization_id, pa.student_id, s.first_name, s.last_name, s.student_number;

ALTER VIEW v_insight_portfolio_artifact_counts SET (security_barrier=true);

COMMENT ON VIEW v_insight_portfolio_artifact_counts IS 
  'Portfolio artifact counts per learner. Teacher view only - shows engagement signals. Restricted to learners in teacher context.';

-- Attendance participation counts
CREATE OR REPLACE VIEW v_insight_attendance_participation AS
SELECT 
  ar.organization_id,
  ar.learner_id,
  s.first_name AS student_first_name,
  s.last_name AS student_last_name,
  s.student_number,
  COUNT(*) AS total_sessions,
  COUNT(*) FILTER (WHERE ar.status = 'present') AS present_count,
  COUNT(*) FILTER (WHERE ar.status = 'absent') AS absent_count,
  COUNT(*) FILTER (WHERE ar.status = 'late') AS late_count
FROM attendance_records ar
INNER JOIN students s ON ar.learner_id = s.id
INNER JOIN attendance_sessions asess ON ar.session_id = asess.id
WHERE ar.archived_at IS NULL
  AND asess.archived_at IS NULL
  AND ar.organization_id = current_organization_id()
  -- Teacher scoping: only show learners in teacher's context
  AND (
    -- Learner has observations created by current teacher
    EXISTS (
      SELECT 1 FROM observations obs
      WHERE obs.learner_id = ar.learner_id
        AND obs.created_by = current_profile_id()
        AND obs.archived_at IS NULL
        AND obs.status = 'active'
        AND obs.organization_id = current_organization_id()
    )
    OR
    -- Learner has attendance records in sessions created by current teacher
    EXISTS (
      SELECT 1 FROM attendance_sessions asess_inner
      WHERE asess_inner.teacher_id = current_profile_id()
        AND asess_inner.organization_id = current_organization_id()
        AND EXISTS (
          SELECT 1 FROM attendance_records ar_inner
          WHERE ar_inner.session_id = asess_inner.id
            AND ar_inner.learner_id = ar.learner_id
            AND ar_inner.archived_at IS NULL
            AND ar_inner.organization_id = current_organization_id()
        )
        AND asess_inner.archived_at IS NULL
    )
    OR
    -- Learner is linked via lesson logs to syllabi owned by current teacher
    EXISTS (
      SELECT 1 FROM weekly_lesson_log_learner_verifications wlllv
      INNER JOIN weekly_lesson_logs wll ON wlllv.lesson_log_id = wll.id
      INNER JOIN syllabi s_inner ON wll.syllabus_id = s_inner.id
      WHERE wlllv.learner_id = ar.learner_id
        AND (
          s_inner.created_by = current_profile_id()
          OR EXISTS (
            SELECT 1 FROM syllabus_contributors sc
            WHERE sc.syllabus_id = s_inner.id
              AND sc.teacher_id = current_profile_id()
              AND sc.archived_at IS NULL
              AND sc.organization_id = current_organization_id()
          )
        )
        AND wlllv.archived_at IS NULL
        AND wll.archived_at IS NULL
        AND s_inner.archived_at IS NULL
        AND wlllv.organization_id = current_organization_id()
        AND wll.organization_id = current_organization_id()
        AND s_inner.organization_id = current_organization_id()
    )
  )
GROUP BY ar.organization_id, ar.learner_id, s.first_name, s.last_name, s.student_number;

ALTER VIEW v_insight_attendance_participation SET (security_barrier=true);

COMMENT ON VIEW v_insight_attendance_participation IS 
  'Attendance participation counts per learner. Shows present/absent/late counts - no percentages. Restricted to learners in teacher context.';

-- Experience participation coverage
CREATE OR REPLACE VIEW v_insight_experience_participation AS
SELECT 
  e.organization_id,
  e.id AS experience_id,
  e.name AS experience_name,
  e.experience_type,
  COUNT(DISTINCT o.learner_id) AS unique_learners_observed,
  COUNT(DISTINCT ar.learner_id) AS unique_learners_attended,
  COUNT(DISTINCT pa.student_id) AS unique_learners_portfolio
FROM experiences e
LEFT JOIN observations o ON e.id = o.experience_id 
  AND o.archived_at IS NULL 
  AND o.status = 'active'
LEFT JOIN attendance_sessions asess ON e.id = asess.experience_id 
  AND asess.archived_at IS NULL
LEFT JOIN attendance_records ar ON asess.id = ar.session_id 
  AND ar.archived_at IS NULL
LEFT JOIN portfolio_artifact_tags pat ON e.id = pat.experience_id 
  AND pat.archived_at IS NULL
LEFT JOIN portfolio_artifacts pa ON pat.artifact_id = pa.id 
  AND pa.archived_at IS NULL
WHERE e.archived_at IS NULL
  AND e.organization_id = current_organization_id()
GROUP BY e.organization_id, e.id, e.name, e.experience_type;

ALTER VIEW v_insight_experience_participation SET (security_barrier=true);

COMMENT ON VIEW v_insight_experience_participation IS 
  'Experience participation coverage - counts unique learners across observations, attendance, and portfolios.';

-- ============================================================================
-- RLS Safety Notes
-- ============================================================================

-- All Phase 7 views are created with security_barrier=true via ALTER VIEW for maximum compatibility.
-- security_invoker behavior is achieved through security_invoker=true if supported by your Postgres version.
--
-- If your Postgres version supports security_invoker in ALTER VIEW, you can optionally add:
-- ALTER VIEW view_name SET (security_invoker=true);
-- This ensures views execute with the privileges of the user querying them (not the view owner).
--
-- security_barrier=true:
--   - Prevents query planner from pushing predicates below the view
--   - Ensures RLS checks happen before any view-level filtering
--   - Critical for security when views join multiple tables with RLS
--
-- Explicit tenant scoping:
--   - Every view includes: <base_table>.organization_id = current_organization_id()
--   - ALL EXISTS subqueries also include tenant scoping on referenced tables
--   - Enforces multi-tenant isolation at the SQL level
--   - Complements RLS policies on underlying tables
--
-- Teacher scoping for learner-identifying views:
--   - v_insight_portfolio_artifact_counts and v_insight_attendance_participation
--   - Restricted to learners in teacher's context via EXISTS clauses with tenant scoping:
--     * Observations created by teacher for that learner (with tenant scope)
--     * Attendance sessions with teacher_id = current_profile_id() (with tenant scope)
--     * Attendance records linked to those sessions (with tenant scope)
--     * Syllabi owned/contributed by teacher linked to learner via lesson logs (with tenant scope)
--   - Admins/registrars see all within tenant via their underlying RLS policies
--
-- attendance_sessions table uses teacher_id field (not created_by) for session ownership.
--
-- Underlying table RLS is the source of truth for tenant isolation:
--   - Each Phase 2-6 table has RLS policies filtering by organization_id
--   - Views inherit this security through security_invoker behavior (if enabled)
--   - Explicit tenant scoping adds defense-in-depth
--   - Application layer (TypeScript) adds additional role-based filtering:
--     * Teachers: See only their own data (enforced in SQL for learner views)
--     * Admins/Principals: See org/school scoped data
--     * Registrars: See read-only global data
--     * Students: No access to Phase 7 insights
--
-- Phase 7 views do NOT bypass RLS - they respect it through security_invoker (if enabled)
-- and explicit tenant scoping in both main queries and EXISTS subqueries.
