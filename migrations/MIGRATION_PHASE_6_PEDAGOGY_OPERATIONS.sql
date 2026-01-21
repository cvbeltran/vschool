-- Migration: Create Phase 6 Pedagogy Operations tables
-- Created: 2024
-- Description: Creates all Phase 6 tables for Syllabus, Lesson Logs, Monitoring, Attendance, Portfolio, and Industry Assessment UX
-- This migration must be run BEFORE RLS_PHASE_6_PEDAGOGY_OPERATIONS.sql
-- Phase 6 boundaries: No grades, scores, math, computation, or modification to Phase 2/3/4/5 tables

-- ============================================================================
-- Syllabus Tables
-- ============================================================================

-- ============================================================================
-- 1. syllabus_templates
-- ============================================================================

CREATE TABLE IF NOT EXISTS syllabus_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  program_id UUID REFERENCES programs(id) ON DELETE SET NULL,
  subject TEXT,
  experience_id UUID REFERENCES experiences(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'archived')) DEFAULT 'draft',
  version_number INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  archived_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_syllabus_templates_organization_id ON syllabus_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_syllabus_templates_school_id ON syllabus_templates(school_id) WHERE school_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_syllabus_templates_program_id ON syllabus_templates(program_id) WHERE program_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_syllabus_templates_experience_id ON syllabus_templates(experience_id) WHERE experience_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_syllabus_templates_status ON syllabus_templates(status);
CREATE INDEX IF NOT EXISTS idx_syllabus_templates_created_by ON syllabus_templates(created_by);
CREATE UNIQUE INDEX IF NOT EXISTS idx_syllabus_templates_org_name_version_unique ON syllabus_templates(organization_id, name, version_number) WHERE archived_at IS NULL;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_syllabus_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_syllabus_templates_updated_at
  BEFORE UPDATE ON syllabus_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_syllabus_templates_updated_at();

-- Comments
COMMENT ON TABLE syllabus_templates IS 'Syllabus templates scoped by organization/school. Lead teacher creates, contributors can edit if assigned. No computation fields.';
COMMENT ON COLUMN syllabus_templates.experience_id IS 'Read-only reference to Phase 2 experiences. ON DELETE SET NULL preserves Phase 6 data if Phase 2 experience is deleted.';
COMMENT ON COLUMN syllabus_templates.version_number IS 'Version number for versioning support. Incremented when new version is created.';
COMMENT ON COLUMN syllabus_templates.archived_at IS 'Soft delete: NULL = active, timestamp = archived';

-- ============================================================================
-- 2. syllabi
-- ============================================================================

CREATE TABLE IF NOT EXISTS syllabi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  syllabus_template_id UUID REFERENCES syllabus_templates(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  program_id UUID REFERENCES programs(id) ON DELETE SET NULL,
  subject TEXT,
  experience_id UUID REFERENCES experiences(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'archived')) DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  archived_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_syllabi_organization_id ON syllabi(organization_id);
CREATE INDEX IF NOT EXISTS idx_syllabi_school_id ON syllabi(school_id) WHERE school_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_syllabi_syllabus_template_id ON syllabi(syllabus_template_id) WHERE syllabus_template_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_syllabi_program_id ON syllabi(program_id) WHERE program_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_syllabi_experience_id ON syllabi(experience_id) WHERE experience_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_syllabi_status ON syllabi(status);
CREATE INDEX IF NOT EXISTS idx_syllabi_created_by ON syllabi(created_by);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_syllabi_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_syllabi_updated_at
  BEFORE UPDATE ON syllabi
  FOR EACH ROW
  EXECUTE FUNCTION update_syllabi_updated_at();

-- Comments
COMMENT ON TABLE syllabi IS 'Syllabi instances (derived from templates or standalone). Header with program/subject/experience references.';
COMMENT ON COLUMN syllabi.experience_id IS 'Read-only reference to Phase 2 experiences. ON DELETE SET NULL preserves Phase 6 data.';

-- ============================================================================
-- 3. syllabus_contributors
-- ============================================================================

CREATE TABLE IF NOT EXISTS syllabus_contributors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  syllabus_id UUID NOT NULL REFERENCES syllabi(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES profiles(id),
  role TEXT NOT NULL CHECK (role IN ('lead', 'contributor')) DEFAULT 'contributor',
  permissions TEXT NOT NULL CHECK (permissions IN ('read', 'edit')) DEFAULT 'read',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  archived_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_syllabus_contributors_organization_id ON syllabus_contributors(organization_id);
CREATE INDEX IF NOT EXISTS idx_syllabus_contributors_syllabus_id ON syllabus_contributors(syllabus_id);
CREATE INDEX IF NOT EXISTS idx_syllabus_contributors_teacher_id ON syllabus_contributors(teacher_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_syllabus_contributors_unique ON syllabus_contributors(syllabus_id, teacher_id) WHERE archived_at IS NULL;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_syllabus_contributors_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_syllabus_contributors_updated_at
  BEFORE UPDATE ON syllabus_contributors
  FOR EACH ROW
  EXECUTE FUNCTION update_syllabus_contributors_updated_at();

-- Comments
COMMENT ON TABLE syllabus_contributors IS 'Multi-teacher collaboration. Lead vs contributor, permissions.';
COMMENT ON COLUMN syllabus_contributors.permissions IS 'Permissions: read (read-only) or edit (can edit syllabus). Enforced via RLS.';

-- ============================================================================
-- 4. syllabus_weeks
-- ============================================================================

CREATE TABLE IF NOT EXISTS syllabus_weeks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  syllabus_id UUID NOT NULL REFERENCES syllabi(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  week_start_date DATE,
  week_end_date DATE,
  objectives TEXT[],
  activities TEXT[],
  verification_method TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  archived_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_syllabus_weeks_organization_id ON syllabus_weeks(organization_id);
CREATE INDEX IF NOT EXISTS idx_syllabus_weeks_syllabus_id ON syllabus_weeks(syllabus_id);
CREATE INDEX IF NOT EXISTS idx_syllabus_weeks_week_number ON syllabus_weeks(week_number);
CREATE UNIQUE INDEX IF NOT EXISTS idx_syllabus_weeks_unique ON syllabus_weeks(syllabus_id, week_number) WHERE archived_at IS NULL;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_syllabus_weeks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_syllabus_weeks_updated_at
  BEFORE UPDATE ON syllabus_weeks
  FOR EACH ROW
  EXECUTE FUNCTION update_syllabus_weeks_updated_at();

-- Comments
COMMENT ON TABLE syllabus_weeks IS 'Planned objectives/activities per week. Links to competencies optional (read-only references via separate table).';
COMMENT ON COLUMN syllabus_weeks.objectives IS 'Array of planned objectives (narrative text). No computation.';
COMMENT ON COLUMN syllabus_weeks.activities IS 'Array of planned activities (narrative text). No computation.';

-- ============================================================================
-- 5. syllabus_week_competency_links (Optional)
-- ============================================================================

CREATE TABLE IF NOT EXISTS syllabus_week_competency_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  syllabus_week_id UUID NOT NULL REFERENCES syllabus_weeks(id) ON DELETE CASCADE,
  competency_id UUID NOT NULL REFERENCES competencies(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  archived_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_syllabus_week_competency_links_organization_id ON syllabus_week_competency_links(organization_id);
CREATE INDEX IF NOT EXISTS idx_syllabus_week_competency_links_syllabus_week_id ON syllabus_week_competency_links(syllabus_week_id);
CREATE INDEX IF NOT EXISTS idx_syllabus_week_competency_links_competency_id ON syllabus_week_competency_links(competency_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_syllabus_week_comp_links_unique ON syllabus_week_competency_links(syllabus_week_id, competency_id) WHERE archived_at IS NULL;

-- Comments
COMMENT ON TABLE syllabus_week_competency_links IS 'Optional links from syllabus weeks to Phase 2 competencies (read-only references). Informational only.';
COMMENT ON COLUMN syllabus_week_competency_links.competency_id IS 'Read-only reference to Phase 2 competencies. ON DELETE RESTRICT preserves Phase 2 data integrity.';

-- ============================================================================
-- Weekly Lesson Logs Tables
-- ============================================================================

-- ============================================================================
-- 6. weekly_lesson_logs
-- ============================================================================

CREATE TABLE IF NOT EXISTS weekly_lesson_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  teacher_id UUID NOT NULL REFERENCES profiles(id),
  syllabus_id UUID REFERENCES syllabi(id) ON DELETE SET NULL,
  syllabus_week_id UUID REFERENCES syllabus_weeks(id) ON DELETE SET NULL,
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'submitted', 'archived')) DEFAULT 'draft',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  archived_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_weekly_lesson_logs_organization_id ON weekly_lesson_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_weekly_lesson_logs_school_id ON weekly_lesson_logs(school_id) WHERE school_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_weekly_lesson_logs_teacher_id ON weekly_lesson_logs(teacher_id);
CREATE INDEX IF NOT EXISTS idx_weekly_lesson_logs_syllabus_id ON weekly_lesson_logs(syllabus_id) WHERE syllabus_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_weekly_lesson_logs_syllabus_week_id ON weekly_lesson_logs(syllabus_week_id) WHERE syllabus_week_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_weekly_lesson_logs_status ON weekly_lesson_logs(status);
CREATE INDEX IF NOT EXISTS idx_weekly_lesson_logs_week_dates ON weekly_lesson_logs(week_start_date, week_end_date);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_weekly_lesson_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_weekly_lesson_logs_updated_at
  BEFORE UPDATE ON weekly_lesson_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_weekly_lesson_logs_updated_at();

-- Comments
COMMENT ON TABLE weekly_lesson_logs IS 'Weekly lesson log header. Teacher_id, syllabus_id, week_range, status. No computation fields.';
COMMENT ON COLUMN weekly_lesson_logs.syllabus_id IS 'Optional link to syllabus. ON DELETE SET NULL preserves log if syllabus deleted.';
COMMENT ON COLUMN weekly_lesson_logs.syllabus_week_id IS 'Optional link to specific syllabus week. ON DELETE SET NULL preserves log if syllabus week deleted.';

-- ============================================================================
-- 7. weekly_lesson_log_items
-- ============================================================================

CREATE TABLE IF NOT EXISTS weekly_lesson_log_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lesson_log_id UUID NOT NULL REFERENCES weekly_lesson_logs(id) ON DELETE CASCADE,
  objective TEXT NOT NULL,
  activity TEXT NOT NULL,
  verification_method TEXT,
  display_order INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  archived_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_weekly_lesson_log_items_organization_id ON weekly_lesson_log_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_weekly_lesson_log_items_lesson_log_id ON weekly_lesson_log_items(lesson_log_id);
CREATE INDEX IF NOT EXISTS idx_weekly_lesson_log_items_display_order ON weekly_lesson_log_items(display_order);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_weekly_lesson_log_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_weekly_lesson_log_items_updated_at
  BEFORE UPDATE ON weekly_lesson_log_items
  FOR EACH ROW
  EXECUTE FUNCTION update_weekly_lesson_log_items_updated_at();

-- Comments
COMMENT ON TABLE weekly_lesson_log_items IS 'Objectives, activities, verification method per log entry. No computation fields.';
COMMENT ON COLUMN weekly_lesson_log_items.display_order IS 'For UI ordering only, not computation.';

-- ============================================================================
-- 8. weekly_lesson_log_learner_verifications
-- ============================================================================

CREATE TABLE IF NOT EXISTS weekly_lesson_log_learner_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lesson_log_id UUID NOT NULL REFERENCES weekly_lesson_logs(id) ON DELETE CASCADE,
  learner_id UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  evidence_text TEXT,
  accomplished_flag BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  archived_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_weekly_lesson_log_learner_verifications_organization_id ON weekly_lesson_log_learner_verifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_weekly_lesson_log_learner_verifications_lesson_log_id ON weekly_lesson_log_learner_verifications(lesson_log_id);
CREATE INDEX IF NOT EXISTS idx_weekly_lesson_log_learner_verifications_learner_id ON weekly_lesson_log_learner_verifications(learner_id);
CREATE INDEX IF NOT EXISTS idx_weekly_lesson_log_learner_verifications_accomplished_flag ON weekly_lesson_log_learner_verifications(accomplished_flag);
CREATE UNIQUE INDEX IF NOT EXISTS idx_weekly_lesson_log_learner_verifications_unique ON weekly_lesson_log_learner_verifications(lesson_log_id, learner_id) WHERE archived_at IS NULL;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_weekly_lesson_log_learner_verifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_weekly_lesson_log_learner_verifications_updated_at
  BEFORE UPDATE ON weekly_lesson_log_learner_verifications
  FOR EACH ROW
  EXECUTE FUNCTION update_weekly_lesson_log_learner_verifications_updated_at();

-- Comments
COMMENT ON TABLE weekly_lesson_log_learner_verifications IS 'Per learner verification entries. Evidence_text, accomplished_flag (yes/no, not a score), attachment refs via separate table.';
COMMENT ON COLUMN weekly_lesson_log_learner_verifications.accomplished_flag IS 'Binary flag (yes/no), not a score or percentage. No computation.';

-- ============================================================================
-- 9. weekly_lesson_log_attachments (Optional)
-- ============================================================================

CREATE TABLE IF NOT EXISTS weekly_lesson_log_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lesson_log_item_id UUID REFERENCES weekly_lesson_log_items(id) ON DELETE CASCADE,
  learner_verification_id UUID REFERENCES weekly_lesson_log_learner_verifications(id) ON DELETE CASCADE,
  observation_id UUID REFERENCES observations(id) ON DELETE SET NULL,
  file_url TEXT NOT NULL,
  file_name TEXT,
  file_type TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  archived_at TIMESTAMPTZ,
  CONSTRAINT check_attachment_parent CHECK (
    (lesson_log_item_id IS NOT NULL) OR (learner_verification_id IS NOT NULL)
  )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_weekly_lesson_log_attachments_organization_id ON weekly_lesson_log_attachments(organization_id);
CREATE INDEX IF NOT EXISTS idx_weekly_lesson_log_attachments_lesson_log_item_id ON weekly_lesson_log_attachments(lesson_log_item_id) WHERE lesson_log_item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_weekly_lesson_log_attachments_learner_verification_id ON weekly_lesson_log_attachments(learner_verification_id) WHERE learner_verification_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_weekly_lesson_log_attachments_observation_id ON weekly_lesson_log_attachments(observation_id) WHERE observation_id IS NOT NULL;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_weekly_lesson_log_attachments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_weekly_lesson_log_attachments_updated_at
  BEFORE UPDATE ON weekly_lesson_log_attachments
  FOR EACH ROW
  EXECUTE FUNCTION update_weekly_lesson_log_attachments_updated_at();

-- Comments
COMMENT ON TABLE weekly_lesson_log_attachments IS 'Attachments linked to lesson log items or learner verifications. Can link to Phase 2 observations (read-only).';
COMMENT ON COLUMN weekly_lesson_log_attachments.observation_id IS 'Read-only reference to Phase 2 observations. ON DELETE SET NULL preserves Phase 6 data.';

-- ============================================================================
-- 10. weekly_lesson_log_experience_links (Optional)
-- ============================================================================

CREATE TABLE IF NOT EXISTS weekly_lesson_log_experience_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lesson_log_id UUID NOT NULL REFERENCES weekly_lesson_logs(id) ON DELETE CASCADE,
  experience_id UUID NOT NULL REFERENCES experiences(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  archived_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_weekly_lesson_log_experience_links_organization_id ON weekly_lesson_log_experience_links(organization_id);
CREATE INDEX IF NOT EXISTS idx_weekly_lesson_log_experience_links_lesson_log_id ON weekly_lesson_log_experience_links(lesson_log_id);
CREATE INDEX IF NOT EXISTS idx_weekly_lesson_log_experience_links_experience_id ON weekly_lesson_log_experience_links(experience_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_weekly_lesson_log_exp_links_unique ON weekly_lesson_log_experience_links(lesson_log_id, experience_id) WHERE archived_at IS NULL;

-- Comments
COMMENT ON TABLE weekly_lesson_log_experience_links IS 'Optional links from lesson logs to Phase 2 experiences (read-only references). Informational only.';
COMMENT ON COLUMN weekly_lesson_log_experience_links.experience_id IS 'Read-only reference to Phase 2 experiences. ON DELETE SET NULL preserves Phase 6 data.';

-- ============================================================================
-- Monitoring / Variance Tables
-- ============================================================================

-- ============================================================================
-- 11. progress_reflections
-- ============================================================================

CREATE TABLE IF NOT EXISTS progress_reflections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  teacher_id UUID NOT NULL REFERENCES profiles(id),
  syllabus_id UUID REFERENCES syllabi(id) ON DELETE SET NULL,
  lesson_log_id UUID REFERENCES weekly_lesson_logs(id) ON DELETE SET NULL,
  reflection_text TEXT NOT NULL,
  reflection_prompt_id UUID REFERENCES reflection_prompts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  archived_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_progress_reflections_organization_id ON progress_reflections(organization_id);
CREATE INDEX IF NOT EXISTS idx_progress_reflections_school_id ON progress_reflections(school_id) WHERE school_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_progress_reflections_teacher_id ON progress_reflections(teacher_id);
CREATE INDEX IF NOT EXISTS idx_progress_reflections_syllabus_id ON progress_reflections(syllabus_id) WHERE syllabus_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_progress_reflections_lesson_log_id ON progress_reflections(lesson_log_id) WHERE lesson_log_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_progress_reflections_reflection_prompt_id ON progress_reflections(reflection_prompt_id) WHERE reflection_prompt_id IS NOT NULL;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_progress_reflections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_progress_reflections_updated_at
  BEFORE UPDATE ON progress_reflections
  FOR EACH ROW
  EXECUTE FUNCTION update_progress_reflections_updated_at();

-- Comments
COMMENT ON TABLE progress_reflections IS 'Reason/reflection when off-track; teacher-authored. Links to Phase 3 reflection prompts (read-only).';
COMMENT ON COLUMN progress_reflections.reflection_prompt_id IS 'Read-only reference to Phase 3 reflection prompts. ON DELETE SET NULL preserves Phase 6 data.';

-- ============================================================================
-- Attendance Tables
-- ============================================================================

-- ============================================================================
-- 12. attendance_sessions
-- ============================================================================

CREATE TABLE IF NOT EXISTS attendance_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  teacher_id UUID NOT NULL REFERENCES profiles(id),
  session_date DATE NOT NULL,
  session_time TIME,
  syllabus_id UUID REFERENCES syllabi(id) ON DELETE SET NULL,
  lesson_log_id UUID REFERENCES weekly_lesson_logs(id) ON DELETE SET NULL,
  experience_id UUID REFERENCES experiences(id) ON DELETE SET NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  archived_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_organization_id ON attendance_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_school_id ON attendance_sessions(school_id) WHERE school_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_teacher_id ON attendance_sessions(teacher_id);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_session_date ON attendance_sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_syllabus_id ON attendance_sessions(syllabus_id) WHERE syllabus_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_lesson_log_id ON attendance_sessions(lesson_log_id) WHERE lesson_log_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_experience_id ON attendance_sessions(experience_id) WHERE experience_id IS NOT NULL;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_attendance_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_attendance_sessions_updated_at
  BEFORE UPDATE ON attendance_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_attendance_sessions_updated_at();

-- Comments
COMMENT ON TABLE attendance_sessions IS 'Attendance sessions. Date/time, teacher_id, context: syllabus/experience. Links to Phase 2 experiences (read-only).';
COMMENT ON COLUMN attendance_sessions.experience_id IS 'Read-only reference to Phase 2 experiences. ON DELETE SET NULL preserves Phase 6 data.';

-- ============================================================================
-- 13. attendance_records
-- ============================================================================

CREATE TABLE IF NOT EXISTS attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  session_id UUID NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  learner_id UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late')) DEFAULT 'present',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  archived_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_attendance_records_organization_id ON attendance_records(organization_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_school_id ON attendance_records(school_id) WHERE school_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_attendance_records_session_id ON attendance_records(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_learner_id ON attendance_records(learner_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_status ON attendance_records(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_records_unique ON attendance_records(session_id, learner_id) WHERE archived_at IS NULL;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_attendance_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_attendance_records_updated_at
  BEFORE UPDATE ON attendance_records
  FOR EACH ROW
  EXECUTE FUNCTION update_attendance_records_updated_at();

-- Comments
COMMENT ON TABLE attendance_records IS 'Learner attendance records. Status: present/absent/late, notes. No computation fields.';
COMMENT ON COLUMN attendance_records.status IS 'Enum: present, absent, late. Not numeric, no computation.';

-- ============================================================================
-- 14. teacher_attendance
-- ============================================================================

CREATE TABLE IF NOT EXISTS teacher_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  teacher_id UUID NOT NULL REFERENCES profiles(id),
  attendance_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late')) DEFAULT 'present',
  notes TEXT,
  session_id UUID REFERENCES attendance_sessions(id) ON DELETE SET NULL,
  experience_id UUID REFERENCES experiences(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  archived_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_teacher_attendance_organization_id ON teacher_attendance(organization_id);
CREATE INDEX IF NOT EXISTS idx_teacher_attendance_school_id ON teacher_attendance(school_id) WHERE school_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_teacher_attendance_teacher_id ON teacher_attendance(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_attendance_attendance_date ON teacher_attendance(attendance_date);
CREATE INDEX IF NOT EXISTS idx_teacher_attendance_status ON teacher_attendance(status);
CREATE INDEX IF NOT EXISTS idx_teacher_attendance_session_id ON teacher_attendance(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_teacher_attendance_experience_id ON teacher_attendance(experience_id) WHERE experience_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_teacher_attendance_unique ON teacher_attendance(teacher_id, attendance_date) WHERE archived_at IS NULL;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_teacher_attendance_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_teacher_attendance_updated_at
  BEFORE UPDATE ON teacher_attendance
  FOR EACH ROW
  EXECUTE FUNCTION update_teacher_attendance_updated_at();

-- Comments
COMMENT ON TABLE teacher_attendance IS 'Teacher self-attendance logging. Teacher_id, date, status, notes. Links to Phase 2 experiences (read-only).';
COMMENT ON COLUMN teacher_attendance.experience_id IS 'Read-only reference to Phase 2 experiences. ON DELETE SET NULL preserves Phase 6 data.';

-- ============================================================================
-- Portfolio Tables
-- ============================================================================

-- ============================================================================
-- 15. portfolio_artifacts
-- ============================================================================

CREATE TABLE IF NOT EXISTS portfolio_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  artifact_type TEXT NOT NULL CHECK (artifact_type IN ('upload', 'link', 'text')),
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT,
  text_content TEXT,
  visibility TEXT NOT NULL CHECK (visibility IN ('internal', 'private', 'shared')) DEFAULT 'internal',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  archived_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_portfolio_artifacts_organization_id ON portfolio_artifacts(organization_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_artifacts_school_id ON portfolio_artifacts(school_id) WHERE school_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_portfolio_artifacts_student_id ON portfolio_artifacts(student_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_artifacts_artifact_type ON portfolio_artifacts(artifact_type);
CREATE INDEX IF NOT EXISTS idx_portfolio_artifacts_visibility ON portfolio_artifacts(visibility);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_portfolio_artifacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_portfolio_artifacts_updated_at
  BEFORE UPDATE ON portfolio_artifacts
  FOR EACH ROW
  EXECUTE FUNCTION update_portfolio_artifacts_updated_at();

-- Comments
COMMENT ON TABLE portfolio_artifacts IS 'Student portfolio artifacts. Type: upload/link/text, title, description, tags via separate table. No fixed template.';
COMMENT ON COLUMN portfolio_artifacts.visibility IS 'Visibility: internal (student + teachers), private (student only), shared (student + teachers + admin). Enforced via RLS.';

-- ============================================================================
-- 16. portfolio_artifact_tags (Optional)
-- ============================================================================

CREATE TABLE IF NOT EXISTS portfolio_artifact_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  artifact_id UUID NOT NULL REFERENCES portfolio_artifacts(id) ON DELETE CASCADE,
  tag_type TEXT NOT NULL CHECK (tag_type IN ('competency', 'domain', 'experience')),
  competency_id UUID REFERENCES competencies(id) ON DELETE RESTRICT,
  domain_id UUID REFERENCES domains(id) ON DELETE RESTRICT,
  experience_id UUID REFERENCES experiences(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  archived_at TIMESTAMPTZ,
  CONSTRAINT check_tag_type_match CHECK (
    (tag_type = 'competency' AND competency_id IS NOT NULL AND domain_id IS NULL AND experience_id IS NULL) OR
    (tag_type = 'domain' AND domain_id IS NOT NULL AND competency_id IS NULL AND experience_id IS NULL) OR
    (tag_type = 'experience' AND experience_id IS NOT NULL AND competency_id IS NULL AND domain_id IS NULL)
  )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_portfolio_artifact_tags_organization_id ON portfolio_artifact_tags(organization_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_artifact_tags_artifact_id ON portfolio_artifact_tags(artifact_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_artifact_tags_tag_type ON portfolio_artifact_tags(tag_type);
CREATE INDEX IF NOT EXISTS idx_portfolio_artifact_tags_competency_id ON portfolio_artifact_tags(competency_id) WHERE competency_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_portfolio_artifact_tags_domain_id ON portfolio_artifact_tags(domain_id) WHERE domain_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_portfolio_artifact_tags_experience_id ON portfolio_artifact_tags(experience_id) WHERE experience_id IS NOT NULL;

-- Comments
COMMENT ON TABLE portfolio_artifact_tags IS 'Tagging system for portfolio artifacts. Tags link to Phase 2 competencies, domains, experiences (read-only references).';
COMMENT ON COLUMN portfolio_artifact_tags.competency_id IS 'Read-only reference to Phase 2 competencies. ON DELETE RESTRICT preserves Phase 2 data integrity.';
COMMENT ON COLUMN portfolio_artifact_tags.domain_id IS 'Read-only reference to Phase 2 domains. ON DELETE RESTRICT preserves Phase 2 data integrity.';
COMMENT ON COLUMN portfolio_artifact_tags.experience_id IS 'Read-only reference to Phase 2 experiences. ON DELETE SET NULL preserves Phase 6 data.';

-- ============================================================================
-- 17. portfolio_artifact_links (Optional)
-- ============================================================================

CREATE TABLE IF NOT EXISTS portfolio_artifact_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  artifact_id UUID NOT NULL REFERENCES portfolio_artifacts(id) ON DELETE CASCADE,
  observation_id UUID REFERENCES observations(id) ON DELETE SET NULL,
  experience_id UUID REFERENCES experiences(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  archived_at TIMESTAMPTZ,
  CONSTRAINT check_link_parent CHECK (
    (observation_id IS NOT NULL) OR (experience_id IS NOT NULL)
  )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_portfolio_artifact_links_organization_id ON portfolio_artifact_links(organization_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_artifact_links_artifact_id ON portfolio_artifact_links(artifact_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_artifact_links_observation_id ON portfolio_artifact_links(observation_id) WHERE observation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_portfolio_artifact_links_experience_id ON portfolio_artifact_links(experience_id) WHERE experience_id IS NOT NULL;

-- Comments
COMMENT ON TABLE portfolio_artifact_links IS 'Optional links from portfolio artifacts to Phase 2 observations/experiences (read-only references).';
COMMENT ON COLUMN portfolio_artifact_links.observation_id IS 'Read-only reference to Phase 2 observations. ON DELETE SET NULL preserves Phase 6 data.';
COMMENT ON COLUMN portfolio_artifact_links.experience_id IS 'Read-only reference to Phase 2 experiences. ON DELETE SET NULL preserves Phase 6 data.';

-- ============================================================================
-- Industry Assessment Tables (Optional)
-- ============================================================================

-- ============================================================================
-- 18. industry_assessments (Optional)
-- ============================================================================

CREATE TABLE IF NOT EXISTS industry_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  coordinator_id UUID NOT NULL REFERENCES profiles(id),
  assessor_name TEXT,
  assessor_email TEXT,
  assessment_form_data JSONB,
  observation_id UUID REFERENCES observations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  archived_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_industry_assessments_organization_id ON industry_assessments(organization_id);
CREATE INDEX IF NOT EXISTS idx_industry_assessments_school_id ON industry_assessments(school_id) WHERE school_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_industry_assessments_coordinator_id ON industry_assessments(coordinator_id);
CREATE INDEX IF NOT EXISTS idx_industry_assessments_observation_id ON industry_assessments(observation_id) WHERE observation_id IS NOT NULL;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_industry_assessments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_industry_assessments_updated_at
  BEFORE UPDATE ON industry_assessments
  FOR EACH ROW
  EXECUTE FUNCTION update_industry_assessments_updated_at();

-- Comments
COMMENT ON TABLE industry_assessments IS 'Industry assessment forms filled by external assessors, proxied by coordinators. Links to Phase 2 observations (read-only).';
COMMENT ON COLUMN industry_assessments.observation_id IS 'Read-only reference to Phase 2 observations. ON DELETE SET NULL preserves Phase 6 data.';
COMMENT ON COLUMN industry_assessments.assessment_form_data IS 'Flexible form data (JSONB). No fixed structure, no computation.';

-- ============================================================================
-- End of Migration
-- ============================================================================
