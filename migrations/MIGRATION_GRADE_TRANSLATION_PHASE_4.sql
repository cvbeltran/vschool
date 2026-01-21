-- Migration: Create Phase 4 Grade Translation & Reporting Layer tables
-- Created: 2024
-- Description: Creates all Phase 4 Grade Translation & Reporting Layer tables
-- This migration must be run AFTER create_reflection_feedback_phase_3_tables.sql
-- Phase 4 boundaries: Grades are translations (not truth), require human confirmation, are reversible and auditable, never modify Phase 2 or Phase 3 tables

-- ============================================================================
-- Phase 4 Tables (Grade Translation & Reporting Layer)
-- ============================================================================

-- ============================================================================
-- 1. grade_policies
-- ============================================================================

CREATE TABLE IF NOT EXISTS grade_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  program_id UUID REFERENCES programs(id) ON DELETE SET NULL,
  policy_name TEXT NOT NULL,
  policy_type TEXT NOT NULL CHECK (policy_type IN ('letter_grade', 'descriptor', 'pass_fail')),
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  effective_start_date DATE,
  effective_end_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  archived_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_grade_policies_organization_id ON grade_policies(organization_id);
CREATE INDEX IF NOT EXISTS idx_grade_policies_school_id ON grade_policies(school_id) WHERE school_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_grade_policies_program_id ON grade_policies(program_id) WHERE program_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_grade_policies_is_active ON grade_policies(is_active) WHERE is_active = TRUE;
CREATE UNIQUE INDEX IF NOT EXISTS idx_grade_policies_org_name_unique ON grade_policies(organization_id, policy_name) WHERE archived_at IS NULL;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_grade_policies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_grade_policies_updated_at
  BEFORE UPDATE ON grade_policies
  FOR EACH ROW
  EXECUTE FUNCTION update_grade_policies_updated_at();

-- Comments
COMMENT ON TABLE grade_policies IS 'Defines how an organization/school translates learning evidence into grades. Policies are scoped to organization/school and optionally to programs. No numeric computation.';
COMMENT ON COLUMN grade_policies.organization_id IS 'Scopes policy to organization';
COMMENT ON COLUMN grade_policies.school_id IS 'Optional: scopes policy to specific school within organization';
COMMENT ON COLUMN grade_policies.program_id IS 'Optional: scopes policy to specific program';
COMMENT ON COLUMN grade_policies.policy_type IS 'Policy type: letter_grade, descriptor, or pass_fail. No numeric types allowed.';
COMMENT ON COLUMN grade_policies.archived_at IS 'Soft delete: NULL = active, timestamp = archived';

-- ============================================================================
-- 2. grading_scales
-- ============================================================================

CREATE TABLE IF NOT EXISTS grading_scales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  grade_policy_id UUID NOT NULL REFERENCES grade_policies(id) ON DELETE RESTRICT,
  grade_value TEXT NOT NULL,
  grade_label TEXT,
  description TEXT,
  is_passing BOOLEAN,
  display_order INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  archived_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_grading_scales_organization_id ON grading_scales(organization_id);
CREATE INDEX IF NOT EXISTS idx_grading_scales_grade_policy_id ON grading_scales(grade_policy_id);
CREATE INDEX IF NOT EXISTS idx_grading_scales_display_order ON grading_scales(display_order) WHERE display_order IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_grading_scales_policy_value_unique ON grading_scales(grade_policy_id, grade_value) WHERE archived_at IS NULL;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_grading_scales_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_grading_scales_updated_at
  BEFORE UPDATE ON grading_scales
  FOR EACH ROW
  EXECUTE FUNCTION update_grading_scales_updated_at();

-- Comments
COMMENT ON TABLE grading_scales IS 'Defines the actual grade values within a policy. No numeric computation fields.';
COMMENT ON COLUMN grading_scales.grade_policy_id IS 'FK to grade_policies.id - scale belongs to exactly one policy';
COMMENT ON COLUMN grading_scales.grade_value IS 'Grade value (e.g., A, B, Pass, Exceeds Expectations). Text only, no numeric computation.';
COMMENT ON COLUMN grading_scales.display_order IS 'UI ordering only, no computation';
COMMENT ON COLUMN grading_scales.archived_at IS 'Soft delete: NULL = active, timestamp = archived';

-- ============================================================================
-- 3. promotion_rules
-- ============================================================================

CREATE TABLE IF NOT EXISTS promotion_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  program_id UUID REFERENCES programs(id) ON DELETE SET NULL,
  rule_name TEXT NOT NULL,
  rule_description TEXT,
  requires_manual_review BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  archived_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_promotion_rules_organization_id ON promotion_rules(organization_id);
CREATE INDEX IF NOT EXISTS idx_promotion_rules_school_id ON promotion_rules(school_id) WHERE school_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_promotion_rules_program_id ON promotion_rules(program_id) WHERE program_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_promotion_rules_org_name_unique ON promotion_rules(organization_id, rule_name) WHERE archived_at IS NULL;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_promotion_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_promotion_rules_updated_at
  BEFORE UPDATE ON promotion_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_promotion_rules_updated_at();

-- Comments
COMMENT ON TABLE promotion_rules IS 'Defines rules for promotion/retention. Reference rules only, not automatic enforcement.';
COMMENT ON COLUMN promotion_rules.organization_id IS 'Scopes rule to organization';
COMMENT ON COLUMN promotion_rules.rule_description IS 'Human-readable rule description. Informational only, no computation.';
COMMENT ON COLUMN promotion_rules.requires_manual_review IS 'Always requires human confirmation. No automatic enforcement.';
COMMENT ON COLUMN promotion_rules.archived_at IS 'Soft delete: NULL = active, timestamp = archived';

-- ============================================================================
-- 4. student_grades
-- ============================================================================

CREATE TABLE IF NOT EXISTS student_grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  program_id UUID REFERENCES programs(id) ON DELETE SET NULL,
  section_id UUID REFERENCES sections(id) ON DELETE SET NULL,
  school_year_id UUID NOT NULL REFERENCES school_years(id) ON DELETE RESTRICT,
  term_period TEXT,
  grade_policy_id UUID NOT NULL REFERENCES grade_policies(id) ON DELETE RESTRICT,
  grading_scale_id UUID NOT NULL REFERENCES grading_scales(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('draft', 'pending_confirmation', 'confirmed', 'overridden')) DEFAULT 'draft',
  confirmed_at TIMESTAMPTZ,
  confirmed_by UUID REFERENCES profiles(id),
  override_reason TEXT,
  override_by UUID REFERENCES profiles(id),
  override_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  archived_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_student_grades_organization_id ON student_grades(organization_id);
CREATE INDEX IF NOT EXISTS idx_student_grades_school_id ON student_grades(school_id) WHERE school_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_student_grades_student_id ON student_grades(student_id);
CREATE INDEX IF NOT EXISTS idx_student_grades_school_year_id ON student_grades(school_year_id);
CREATE INDEX IF NOT EXISTS idx_student_grades_grade_policy_id ON student_grades(grade_policy_id);
CREATE INDEX IF NOT EXISTS idx_student_grades_grading_scale_id ON student_grades(grading_scale_id);
CREATE INDEX IF NOT EXISTS idx_student_grades_status ON student_grades(status);
CREATE INDEX IF NOT EXISTS idx_student_grades_confirmed_at ON student_grades(confirmed_at) WHERE confirmed_at IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_student_grades_unique ON student_grades(student_id, school_year_id, term_period, grade_policy_id) WHERE status IN ('confirmed', 'overridden') AND archived_at IS NULL;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_student_grades_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_student_grades_updated_at
  BEFORE UPDATE ON student_grades
  FOR EACH ROW
  EXECUTE FUNCTION update_student_grades_updated_at();

-- Comments
COMMENT ON TABLE student_grades IS 'Core grade record for a learner in a time period. Represents translation of learning evidence into formal grade. Requires human confirmation.';
COMMENT ON COLUMN student_grades.student_id IS 'FK to students.id - the learner receiving the grade';
COMMENT ON COLUMN student_grades.grade_policy_id IS 'FK to grade_policies.id - which policy governs this grade';
COMMENT ON COLUMN student_grades.grading_scale_id IS 'FK to grading_scales.id - the actual grade value';
COMMENT ON COLUMN student_grades.status IS 'Grade status: draft, pending_confirmation, confirmed, or overridden. Confirmation requires human action.';
COMMENT ON COLUMN student_grades.confirmed_at IS 'When grade was confirmed (required if status is confirmed or overridden)';
COMMENT ON COLUMN student_grades.confirmed_by IS 'Who confirmed the grade (required if status is confirmed or overridden)';
COMMENT ON COLUMN student_grades.override_reason IS 'Required if status is overridden. Must provide justification for override.';
COMMENT ON COLUMN student_grades.archived_at IS 'Soft delete: NULL = active, timestamp = archived';

-- ============================================================================
-- 5. grade_entries
-- ============================================================================

CREATE TABLE IF NOT EXISTS grade_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  student_grade_id UUID NOT NULL REFERENCES student_grades(id) ON DELETE CASCADE,
  observation_id UUID REFERENCES observations(id) ON DELETE SET NULL,
  competency_id UUID REFERENCES competencies(id) ON DELETE SET NULL,
  domain_id UUID REFERENCES domains(id) ON DELETE SET NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('observation_reference', 'competency_summary', 'domain_summary', 'manual_note')),
  entry_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  archived_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_grade_entries_organization_id ON grade_entries(organization_id);
CREATE INDEX IF NOT EXISTS idx_grade_entries_student_grade_id ON grade_entries(student_grade_id);
CREATE INDEX IF NOT EXISTS idx_grade_entries_observation_id ON grade_entries(observation_id) WHERE observation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_grade_entries_competency_id ON grade_entries(competency_id) WHERE competency_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_grade_entries_domain_id ON grade_entries(domain_id) WHERE domain_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_grade_entries_entry_type ON grade_entries(entry_type);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_grade_entries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_grade_entries_updated_at
  BEFORE UPDATE ON grade_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_grade_entries_updated_at();

-- Comments
COMMENT ON TABLE grade_entries IS 'Optional detailed breakdown of how a grade was determined. Links to learning evidence (read-only references to Phase 2).';
COMMENT ON COLUMN grade_entries.student_grade_id IS 'FK to student_grades.id - the grade this entry documents';
COMMENT ON COLUMN grade_entries.observation_id IS 'Optional: FK to observations.id - read-only reference to Phase 2 (ON DELETE SET NULL)';
COMMENT ON COLUMN grade_entries.competency_id IS 'Optional: FK to competencies.id - read-only reference to Phase 2 (ON DELETE SET NULL)';
COMMENT ON COLUMN grade_entries.domain_id IS 'Optional: FK to domains.id - read-only reference to Phase 2 (ON DELETE SET NULL)';
COMMENT ON COLUMN grade_entries.entry_type IS 'Type of entry: observation_reference, competency_summary, domain_summary, or manual_note';
COMMENT ON COLUMN grade_entries.entry_text IS 'Human notes about this entry. Informational only, no computation.';
COMMENT ON COLUMN grade_entries.archived_at IS 'Soft delete: NULL = active, timestamp = archived';

-- ============================================================================
-- 6. grade_justifications
-- ============================================================================

CREATE TABLE IF NOT EXISTS grade_justifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  student_grade_id UUID NOT NULL REFERENCES student_grades(id) ON DELETE CASCADE,
  justification_type TEXT NOT NULL CHECK (justification_type IN ('initial_assignment', 'confirmation', 'override', 'correction', 'appeal')),
  justification_text TEXT NOT NULL,
  previous_grade_id UUID REFERENCES grading_scales(id) ON DELETE SET NULL,
  new_grade_id UUID REFERENCES grading_scales(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_grade_justifications_organization_id ON grade_justifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_grade_justifications_student_grade_id ON grade_justifications(student_grade_id);
CREATE INDEX IF NOT EXISTS idx_grade_justifications_justification_type ON grade_justifications(justification_type);
CREATE INDEX IF NOT EXISTS idx_grade_justifications_created_at ON grade_justifications(created_at);
CREATE INDEX IF NOT EXISTS idx_grade_justifications_created_by ON grade_justifications(created_by);

-- No updated_at trigger (append-only table)

-- Comments
COMMENT ON TABLE grade_justifications IS 'Audit trail for grade decisions. Append-only records documenting why grades were assigned, changed, or overridden.';
COMMENT ON COLUMN grade_justifications.student_grade_id IS 'FK to student_grades.id - the grade this justification documents';
COMMENT ON COLUMN grade_justifications.justification_type IS 'Type of justification: initial_assignment, confirmation, override, correction, or appeal';
COMMENT ON COLUMN grade_justifications.justification_text IS 'Required: narrative explanation of why this action was taken';
COMMENT ON COLUMN grade_justifications.previous_grade_id IS 'Optional: FK to grading_scales.id - previous grade value (if changed)';
COMMENT ON COLUMN grade_justifications.new_grade_id IS 'Optional: FK to grading_scales.id - new grade value (if changed)';
COMMENT ON COLUMN grade_justifications.created_by IS 'Who made this justification. Records are append-only (never updated or deleted).';

-- ============================================================================
-- 7. transcript_records
-- ============================================================================

CREATE TABLE IF NOT EXISTS transcript_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  student_grade_id UUID NOT NULL REFERENCES student_grades(id) ON DELETE RESTRICT,
  program_id UUID REFERENCES programs(id) ON DELETE SET NULL,
  school_year_id UUID NOT NULL REFERENCES school_years(id) ON DELETE RESTRICT,
  term_period TEXT NOT NULL,
  course_name TEXT,
  grade_value TEXT NOT NULL,
  credits DECIMAL(4,2),
  transcript_status TEXT NOT NULL CHECK (transcript_status IN ('draft', 'finalized')) DEFAULT 'draft',
  finalized_at TIMESTAMPTZ,
  finalized_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  archived_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_transcript_records_organization_id ON transcript_records(organization_id);
CREATE INDEX IF NOT EXISTS idx_transcript_records_school_id ON transcript_records(school_id) WHERE school_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transcript_records_student_id ON transcript_records(student_id);
CREATE INDEX IF NOT EXISTS idx_transcript_records_student_grade_id ON transcript_records(student_grade_id);
CREATE INDEX IF NOT EXISTS idx_transcript_records_school_year_id ON transcript_records(school_year_id);
CREATE INDEX IF NOT EXISTS idx_transcript_records_transcript_status ON transcript_records(transcript_status);
CREATE INDEX IF NOT EXISTS idx_transcript_records_finalized_at ON transcript_records(finalized_at) WHERE finalized_at IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_transcript_records_unique ON transcript_records(student_id, school_year_id, term_period, course_name) WHERE transcript_status='finalized' AND archived_at IS NULL;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_transcript_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_transcript_records_updated_at
  BEFORE UPDATE ON transcript_records
  FOR EACH ROW
  EXECUTE FUNCTION update_transcript_records_updated_at();

-- Comments
COMMENT ON TABLE transcript_records IS 'Formal transcript entries derived from confirmed grades. Read-only from grade records.';
COMMENT ON COLUMN transcript_records.student_grade_id IS 'FK to student_grades.id - source grade (read-only reference)';
COMMENT ON COLUMN transcript_records.grade_value IS 'Grade value from grading_scale.grade_value. Text only, no numeric computation.';
COMMENT ON COLUMN transcript_records.credits IS 'Optional: credits if applicable. Informational only, no GPA computation in Phase 4.';
COMMENT ON COLUMN transcript_records.transcript_status IS 'Transcript status: draft or finalized. Finalization requires human confirmation.';
COMMENT ON COLUMN transcript_records.finalized_at IS 'When transcript was finalized (required if transcript_status is finalized)';
COMMENT ON COLUMN transcript_records.finalized_by IS 'Who finalized the transcript (required if transcript_status is finalized)';
COMMENT ON COLUMN transcript_records.archived_at IS 'Soft delete: NULL = active, timestamp = archived';

-- ============================================================================
-- 8. report_templates
-- ============================================================================

CREATE TABLE IF NOT EXISTS report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  template_name TEXT NOT NULL,
  template_type TEXT NOT NULL CHECK (template_type IN ('report_card', 'transcript', 'compliance_export')),
  template_config JSONB,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  archived_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_report_templates_organization_id ON report_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_report_templates_school_id ON report_templates(school_id) WHERE school_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_report_templates_template_type ON report_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_report_templates_is_active ON report_templates(is_active) WHERE is_active = TRUE;
CREATE UNIQUE INDEX IF NOT EXISTS idx_report_templates_org_name_unique ON report_templates(organization_id, template_name) WHERE archived_at IS NULL;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_report_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_report_templates_updated_at
  BEFORE UPDATE ON report_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_report_templates_updated_at();

-- Comments
COMMENT ON TABLE report_templates IS 'Defines report card and transcript formats per school/organization. Format configuration only, no computation.';
COMMENT ON COLUMN report_templates.organization_id IS 'Scopes template to organization';
COMMENT ON COLUMN report_templates.school_id IS 'Optional: scopes template to specific school within organization';
COMMENT ON COLUMN report_templates.template_type IS 'Template type: report_card, transcript, or compliance_export';
COMMENT ON COLUMN report_templates.template_config IS 'JSONB configuration for format, fields, layout. No computation logic.';
COMMENT ON COLUMN report_templates.archived_at IS 'Soft delete: NULL = active, timestamp = archived';

-- ============================================================================
-- End of Phase 4 Grade Translation & Reporting Layer Table Creation
-- ============================================================================
