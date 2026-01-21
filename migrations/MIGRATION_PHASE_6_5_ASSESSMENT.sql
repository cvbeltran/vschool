-- Migration: Create Phase 6.5 Assessment & Judgment Layer tables
-- Created: 2024
-- Description: Creates all Phase 6.5 tables for Assessment Records, Label Taxonomies, and Evidence Links
-- This migration must be run BEFORE RLS_PHASE_6_5_ASSESSMENT.sql
-- Phase 6.5 boundaries: No grades, scores, math, computation, or modification to Phase 2/3/6 tables

-- ============================================================================
-- Assessment Label Taxonomy Tables
-- ============================================================================

-- ============================================================================
-- 1. assessment_label_sets
-- ============================================================================

CREATE TABLE IF NOT EXISTS assessment_label_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  archived_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_assessment_label_sets_organization_id ON assessment_label_sets(organization_id);
CREATE INDEX IF NOT EXISTS idx_assessment_label_sets_school_id ON assessment_label_sets(school_id) WHERE school_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_assessment_label_sets_is_active ON assessment_label_sets(is_active);
CREATE INDEX IF NOT EXISTS idx_assessment_label_sets_created_by ON assessment_label_sets(created_by);
CREATE UNIQUE INDEX IF NOT EXISTS idx_assessment_label_sets_org_name_unique ON assessment_label_sets(organization_id, name) WHERE archived_at IS NULL;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_assessment_label_sets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_assessment_label_sets_updated_at
  BEFORE UPDATE ON assessment_label_sets
  FOR EACH ROW
  EXECUTE FUNCTION update_assessment_label_sets_updated_at();

-- Comments
COMMENT ON TABLE assessment_label_sets IS 'Org/school-scoped collections of assessment labels. Managed by admin/principal. No computation fields.';
COMMENT ON COLUMN assessment_label_sets.archived_at IS 'Soft delete: NULL = active, timestamp = archived';

-- ============================================================================
-- 2. assessment_labels
-- ============================================================================

CREATE TABLE IF NOT EXISTS assessment_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  label_set_id UUID NOT NULL REFERENCES assessment_label_sets(id) ON DELETE CASCADE,
  label_text TEXT NOT NULL,
  description TEXT,
  display_order INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  archived_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_assessment_labels_organization_id ON assessment_labels(organization_id);
CREATE INDEX IF NOT EXISTS idx_assessment_labels_label_set_id ON assessment_labels(label_set_id);
CREATE INDEX IF NOT EXISTS idx_assessment_labels_display_order ON assessment_labels(display_order);
CREATE UNIQUE INDEX IF NOT EXISTS idx_assessment_labels_set_text_unique ON assessment_labels(label_set_id, label_text) WHERE archived_at IS NULL;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_assessment_labels_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_assessment_labels_updated_at
  BEFORE UPDATE ON assessment_labels
  FOR EACH ROW
  EXECUTE FUNCTION update_assessment_labels_updated_at();

-- Comments
COMMENT ON TABLE assessment_labels IS 'Individual judgment labels within a label set. Text-only, no numeric values.';
COMMENT ON COLUMN assessment_labels.label_text IS 'Text-only judgment label (e.g., "Emerging", "Developing", "Proficient", "Exceeds"). No numeric values.';
COMMENT ON COLUMN assessment_labels.display_order IS 'UI-only ordering for display. Not used for computation, ranking, or ordering.';
COMMENT ON COLUMN assessment_labels.archived_at IS 'Soft delete: NULL = active, timestamp = archived';

-- ============================================================================
-- Assessment Records Tables
-- ============================================================================

-- ============================================================================
-- 3. assessments
-- ============================================================================

CREATE TABLE IF NOT EXISTS assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  teacher_id UUID NOT NULL REFERENCES profiles(id),
  learner_id UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  school_year_id UUID REFERENCES school_years(id) ON DELETE SET NULL,
  term_period TEXT,
  label_id UUID NOT NULL REFERENCES assessment_labels(id) ON DELETE RESTRICT,
  rationale TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'confirmed', 'archived')) DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  archived_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_assessments_organization_id ON assessments(organization_id);
CREATE INDEX IF NOT EXISTS idx_assessments_school_id ON assessments(school_id) WHERE school_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_assessments_teacher_id ON assessments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_assessments_learner_id ON assessments(learner_id);
CREATE INDEX IF NOT EXISTS idx_assessments_school_year_id ON assessments(school_year_id) WHERE school_year_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_assessments_label_id ON assessments(label_id);
CREATE INDEX IF NOT EXISTS idx_assessments_status ON assessments(status);
CREATE INDEX IF NOT EXISTS idx_assessments_created_at ON assessments(created_at);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_assessments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_assessments_updated_at
  BEFORE UPDATE ON assessments
  FOR EACH ROW
  EXECUTE FUNCTION update_assessments_updated_at();

-- Comments
COMMENT ON TABLE assessments IS 'Assessment records: teacher judgment about a learner with rationale and optional evidence. No computation fields.';
COMMENT ON COLUMN assessments.rationale IS 'Required narrative rationale explaining the judgment. Human-written, not computed.';
COMMENT ON COLUMN assessments.label_id IS 'Judgment label selected by teacher. Text-only, no numeric value.';
COMMENT ON COLUMN assessments.archived_at IS 'Soft delete: NULL = active, timestamp = archived';

-- ============================================================================
-- Assessment Evidence Link Tables
-- ============================================================================

-- ============================================================================
-- 4. assessment_evidence_links
-- ============================================================================

CREATE TABLE IF NOT EXISTS assessment_evidence_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  evidence_type TEXT NOT NULL CHECK (evidence_type IN ('observation', 'experience', 'teacher_reflection', 'student_feedback', 'portfolio_artifact', 'attendance_session', 'attendance_record')),
  observation_id UUID REFERENCES observations(id) ON DELETE SET NULL,
  experience_id UUID REFERENCES experiences(id) ON DELETE SET NULL,
  teacher_reflection_id UUID REFERENCES teacher_reflections(id) ON DELETE SET NULL,
  student_feedback_id UUID REFERENCES student_feedback(id) ON DELETE SET NULL,
  portfolio_artifact_id UUID REFERENCES portfolio_artifacts(id) ON DELETE SET NULL,
  attendance_session_id UUID REFERENCES attendance_sessions(id) ON DELETE SET NULL,
  attendance_record_id UUID REFERENCES attendance_records(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  archived_at TIMESTAMPTZ,
  CONSTRAINT assessment_evidence_links_evidence_check CHECK (
    (evidence_type = 'observation' AND observation_id IS NOT NULL) OR
    (evidence_type = 'experience' AND experience_id IS NOT NULL) OR
    (evidence_type = 'teacher_reflection' AND teacher_reflection_id IS NOT NULL) OR
    (evidence_type = 'student_feedback' AND student_feedback_id IS NOT NULL) OR
    (evidence_type = 'portfolio_artifact' AND portfolio_artifact_id IS NOT NULL) OR
    (evidence_type = 'attendance_session' AND attendance_session_id IS NOT NULL) OR
    (evidence_type = 'attendance_record' AND attendance_record_id IS NOT NULL)
  )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_assessment_evidence_links_organization_id ON assessment_evidence_links(organization_id);
CREATE INDEX IF NOT EXISTS idx_assessment_evidence_links_assessment_id ON assessment_evidence_links(assessment_id);
CREATE INDEX IF NOT EXISTS idx_assessment_evidence_links_evidence_type ON assessment_evidence_links(evidence_type);
CREATE INDEX IF NOT EXISTS idx_assessment_evidence_links_observation_id ON assessment_evidence_links(observation_id) WHERE observation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_assessment_evidence_links_experience_id ON assessment_evidence_links(experience_id) WHERE experience_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_assessment_evidence_links_teacher_reflection_id ON assessment_evidence_links(teacher_reflection_id) WHERE teacher_reflection_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_assessment_evidence_links_student_feedback_id ON assessment_evidence_links(student_feedback_id) WHERE student_feedback_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_assessment_evidence_links_portfolio_artifact_id ON assessment_evidence_links(portfolio_artifact_id) WHERE portfolio_artifact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_assessment_evidence_links_attendance_session_id ON assessment_evidence_links(attendance_session_id) WHERE attendance_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_assessment_evidence_links_attendance_record_id ON assessment_evidence_links(attendance_record_id) WHERE attendance_record_id IS NOT NULL;

-- Unique constraint to prevent duplicate links
CREATE UNIQUE INDEX IF NOT EXISTS idx_assessment_evidence_links_unique ON assessment_evidence_links(
  assessment_id,
  evidence_type,
  COALESCE(observation_id::text, ''),
  COALESCE(experience_id::text, ''),
  COALESCE(teacher_reflection_id::text, ''),
  COALESCE(student_feedback_id::text, ''),
  COALESCE(portfolio_artifact_id::text, ''),
  COALESCE(attendance_session_id::text, ''),
  COALESCE(attendance_record_id::text, '')
) WHERE archived_at IS NULL;

-- Comments
COMMENT ON TABLE assessment_evidence_links IS 'Optional read-only references from assessments to evidence in Phase 2/3/6. Informational only, no modification to referenced tables.';
COMMENT ON COLUMN assessment_evidence_links.observation_id IS 'Read-only reference to Phase 2 observations. ON DELETE SET NULL preserves Phase 6.5 data.';
COMMENT ON COLUMN assessment_evidence_links.experience_id IS 'Read-only reference to Phase 2 experiences. ON DELETE SET NULL preserves Phase 6.5 data.';
COMMENT ON COLUMN assessment_evidence_links.teacher_reflection_id IS 'Read-only reference to Phase 3 teacher reflections. ON DELETE SET NULL preserves Phase 6.5 data.';
COMMENT ON COLUMN assessment_evidence_links.student_feedback_id IS 'Read-only reference to Phase 3 student feedback. ON DELETE SET NULL preserves Phase 6.5 data.';
COMMENT ON COLUMN assessment_evidence_links.portfolio_artifact_id IS 'Read-only reference to Phase 6 portfolio artifacts. ON DELETE SET NULL preserves Phase 6.5 data.';
COMMENT ON COLUMN assessment_evidence_links.attendance_session_id IS 'Read-only reference to Phase 6 attendance sessions. ON DELETE SET NULL preserves Phase 6.5 data.';
COMMENT ON COLUMN assessment_evidence_links.attendance_record_id IS 'Read-only reference to Phase 6 attendance records. ON DELETE SET NULL preserves Phase 6.5 data.';

-- ============================================================================
-- End of Migration
-- ============================================================================

