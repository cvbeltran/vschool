-- Migration: Create Phase 3 Reflection & Feedback tables
-- Created: 2024
-- Description: Creates all Phase 3 Reflection & Feedback System tables
-- This migration must be run AFTER create_obs_ams_phase_2_tables.sql
-- Phase 3 boundaries: No grades, scores, math, computation, aggregation, or modification to Phase 2 tables

-- ============================================================================
-- Phase 3 Tables (Reflection & Feedback System)
-- ============================================================================

-- ============================================================================
-- 1. reflection_prompts
-- ============================================================================

CREATE TABLE IF NOT EXISTS reflection_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  prompt_text TEXT NOT NULL,
  description TEXT,
  display_order INTEGER,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  archived_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_reflection_prompts_organization_id ON reflection_prompts(organization_id);
CREATE INDEX IF NOT EXISTS idx_reflection_prompts_school_id ON reflection_prompts(school_id) WHERE school_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reflection_prompts_is_active ON reflection_prompts(is_active) WHERE is_active = TRUE;
CREATE UNIQUE INDEX IF NOT EXISTS idx_reflection_prompts_org_text_unique ON reflection_prompts(organization_id, prompt_text) WHERE archived_at IS NULL;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_reflection_prompts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_reflection_prompts_updated_at
  BEFORE UPDATE ON reflection_prompts
  FOR EACH ROW
  EXECUTE FUNCTION update_reflection_prompts_updated_at();

-- Comments
COMMENT ON TABLE reflection_prompts IS 'Org-scoped taxonomy of prompts that teachers answer during reflection. Qualitative questions only. No numeric scoring fields.';
COMMENT ON COLUMN reflection_prompts.organization_id IS 'Scopes reflection prompt to organization';
COMMENT ON COLUMN reflection_prompts.school_id IS 'Optional: scopes reflection prompt to specific school within organization';
COMMENT ON COLUMN reflection_prompts.prompt_text IS 'Qualitative prompt question (e.g., "What worked?", "What didn''t?", "What changed from plan?", "What evidence supports this reflection?")';
COMMENT ON COLUMN reflection_prompts.display_order IS 'UI ordering only, no computation';
COMMENT ON COLUMN reflection_prompts.archived_at IS 'Soft delete: NULL = active, timestamp = archived';

-- ============================================================================
-- 2. teacher_reflections
-- ============================================================================

CREATE TABLE IF NOT EXISTS teacher_reflections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  reflection_prompt_id UUID REFERENCES reflection_prompts(id) ON DELETE SET NULL,
  experience_id UUID REFERENCES experiences(id) ON DELETE SET NULL,
  school_year_id UUID REFERENCES school_years(id) ON DELETE SET NULL,
  quarter TEXT,
  competency_id UUID REFERENCES competencies(id) ON DELETE SET NULL,
  reflection_text TEXT NOT NULL,
  reflected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL CHECK (status IN ('draft', 'completed')) DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  archived_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_teacher_reflections_organization_id ON teacher_reflections(organization_id);
CREATE INDEX IF NOT EXISTS idx_teacher_reflections_school_id ON teacher_reflections(school_id) WHERE school_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_teacher_reflections_teacher_id ON teacher_reflections(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_reflections_reflection_prompt_id ON teacher_reflections(reflection_prompt_id) WHERE reflection_prompt_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_teacher_reflections_experience_id ON teacher_reflections(experience_id) WHERE experience_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_teacher_reflections_school_year_id ON teacher_reflections(school_year_id) WHERE school_year_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_teacher_reflections_status ON teacher_reflections(status);
CREATE INDEX IF NOT EXISTS idx_teacher_reflections_reflected_at ON teacher_reflections(reflected_at);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_teacher_reflections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_teacher_reflections_updated_at
  BEFORE UPDATE ON teacher_reflections
  FOR EACH ROW
  EXECUTE FUNCTION update_teacher_reflections_updated_at();

-- Comments
COMMENT ON TABLE teacher_reflections IS 'Narrative reflections by teachers on their teaching practice. Links to experiences, time periods, and optionally competencies (read-only reference). Narrative text only, no numeric fields.';
COMMENT ON COLUMN teacher_reflections.teacher_id IS 'FK to profiles.id - teacher who wrote reflection';
COMMENT ON COLUMN teacher_reflections.reflection_prompt_id IS 'Optional: FK to reflection_prompts.id - which prompt this answers';
COMMENT ON COLUMN teacher_reflections.experience_id IS 'Optional: FK to experiences.id - reflection on specific experience (read-only reference)';
COMMENT ON COLUMN teacher_reflections.school_year_id IS 'Optional: FK to school_years.id - reflection for specific school year';
COMMENT ON COLUMN teacher_reflections.quarter IS 'Optional: "Q1", "Q2", "Q3", "Q4" - informational only, no computation';
COMMENT ON COLUMN teacher_reflections.competency_id IS 'Optional: FK to competencies.id - read-only reference to competency (no modification to competencies table)';
COMMENT ON COLUMN teacher_reflections.reflection_text IS 'Narrative reflection content - qualitative text only';
COMMENT ON COLUMN teacher_reflections.reflected_at IS 'When reflection occurred (may differ from created_at)';
COMMENT ON COLUMN teacher_reflections.status IS 'Reflection status: draft or completed. All fields editable including status.';
COMMENT ON COLUMN teacher_reflections.archived_at IS 'Soft delete: NULL = active, timestamp = archived';

-- ============================================================================
-- 3. feedback_dimensions
-- ============================================================================

CREATE TABLE IF NOT EXISTS feedback_dimensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  dimension_name TEXT NOT NULL,
  description TEXT,
  reflection_prompt_id UUID REFERENCES reflection_prompts(id) ON DELETE SET NULL,
  display_order INTEGER,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  archived_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_feedback_dimensions_organization_id ON feedback_dimensions(organization_id);
CREATE INDEX IF NOT EXISTS idx_feedback_dimensions_school_id ON feedback_dimensions(school_id) WHERE school_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_feedback_dimensions_reflection_prompt_id ON feedback_dimensions(reflection_prompt_id) WHERE reflection_prompt_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_feedback_dimensions_is_active ON feedback_dimensions(is_active) WHERE is_active = TRUE;
CREATE UNIQUE INDEX IF NOT EXISTS idx_feedback_dimensions_org_name_unique ON feedback_dimensions(organization_id, dimension_name) WHERE archived_at IS NULL;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_feedback_dimensions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_feedback_dimensions_updated_at
  BEFORE UPDATE ON feedback_dimensions
  FOR EACH ROW
  EXECUTE FUNCTION update_feedback_dimensions_updated_at();

-- Comments
COMMENT ON TABLE feedback_dimensions IS 'Org-scoped taxonomy of feedback dimensions that align with teacher reflection prompts. Used by students when providing feedback. No numeric scoring fields.';
COMMENT ON COLUMN feedback_dimensions.organization_id IS 'Scopes feedback dimension to organization';
COMMENT ON COLUMN feedback_dimensions.school_id IS 'Optional: scopes feedback dimension to specific school within organization';
COMMENT ON COLUMN feedback_dimensions.dimension_name IS 'Feedback dimension name (e.g., "What worked?", "What didn''t?", "What changed from plan?", "What evidence supports this?")';
COMMENT ON COLUMN feedback_dimensions.reflection_prompt_id IS 'Optional: FK to reflection_prompts.id - links to teacher reflection prompt for alignment (informational only, no computation)';
COMMENT ON COLUMN feedback_dimensions.display_order IS 'UI ordering only, no computation';
COMMENT ON COLUMN feedback_dimensions.archived_at IS 'Soft delete: NULL = active, timestamp = archived';

-- ============================================================================
-- 4. student_feedback
-- ============================================================================

CREATE TABLE IF NOT EXISTS student_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  teacher_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  experience_id UUID REFERENCES experiences(id) ON DELETE SET NULL,
  experience_type TEXT,
  school_year_id UUID REFERENCES school_years(id) ON DELETE SET NULL,
  quarter TEXT NOT NULL,
  feedback_dimension_id UUID NOT NULL REFERENCES feedback_dimensions(id) ON DELETE RESTRICT,
  feedback_text TEXT NOT NULL,
  provided_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL CHECK (status IN ('draft', 'completed')) DEFAULT 'draft',
  is_anonymous BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  archived_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_student_feedback_organization_id ON student_feedback(organization_id);
CREATE INDEX IF NOT EXISTS idx_student_feedback_school_id ON student_feedback(school_id) WHERE school_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_student_feedback_student_id ON student_feedback(student_id);
CREATE INDEX IF NOT EXISTS idx_student_feedback_teacher_id ON student_feedback(teacher_id) WHERE teacher_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_student_feedback_experience_id ON student_feedback(experience_id) WHERE experience_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_student_feedback_school_year_id ON student_feedback(school_year_id) WHERE school_year_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_student_feedback_quarter ON student_feedback(quarter);
CREATE INDEX IF NOT EXISTS idx_student_feedback_status ON student_feedback(status);
CREATE INDEX IF NOT EXISTS idx_student_feedback_provided_at ON student_feedback(provided_at);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_student_feedback_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_student_feedback_updated_at
  BEFORE UPDATE ON student_feedback
  FOR EACH ROW
  EXECUTE FUNCTION update_student_feedback_updated_at();

-- Comments
COMMENT ON TABLE student_feedback IS 'Quarterly qualitative feedback from students on their learning experiences. Links to experiences, time periods, and feedback dimensions. Narrative text only, no numeric fields.';
COMMENT ON COLUMN student_feedback.student_id IS 'FK to students.id - student who provided feedback';
COMMENT ON COLUMN student_feedback.teacher_id IS 'Optional: FK to profiles.id - teacher being given feedback about';
COMMENT ON COLUMN student_feedback.experience_id IS 'Optional: FK to experiences.id - feedback on specific experience (read-only reference)';
COMMENT ON COLUMN student_feedback.experience_type IS 'Optional: "mentoring", "apprenticeship", "lab", "studio" - informational only, no computation';
COMMENT ON COLUMN student_feedback.school_year_id IS 'Optional: FK to school_years.id - feedback for specific school year';
COMMENT ON COLUMN student_feedback.quarter IS 'Required: "Q1", "Q2", "Q3", "Q4" - quarterly feedback requirement, informational only, no computation';
COMMENT ON COLUMN student_feedback.feedback_dimension_id IS 'FK to feedback_dimensions.id - which dimension this feedback addresses';
COMMENT ON COLUMN student_feedback.feedback_text IS 'Narrative feedback content - qualitative text only, no scores, ratings, percentages';
COMMENT ON COLUMN student_feedback.provided_at IS 'When feedback was provided (may differ from created_at)';
COMMENT ON COLUMN student_feedback.status IS 'Feedback status: draft or completed. All fields editable including status.';
COMMENT ON COLUMN student_feedback.is_anonymous IS 'Whether student wants feedback anonymized (privacy support, does not compute anything)';
COMMENT ON COLUMN student_feedback.archived_at IS 'Soft delete: NULL = active, timestamp = archived';

-- ============================================================================
-- End of Phase 3 Reflection & Feedback Table Creation
-- ============================================================================
