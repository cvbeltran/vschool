-- Migration: Create Phase 2 OBS + AMS tables
-- Created: 2024
-- Description: Creates all Phase 2 OBS (Structure of Meaning) and AMS (Experience & Observation) tables
-- This migration must be run BEFORE RLS_OBS_AMS_PHASE_2.sql
-- Phase 2 boundaries: No grades, scores, math, mastery computation, or compliance logic

-- ============================================================================
-- OBS Tables (Structure of Meaning)
-- ============================================================================

-- ============================================================================
-- 1. domains
-- ============================================================================

CREATE TABLE IF NOT EXISTS domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  archived_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_domains_organization_id ON domains(organization_id);
CREATE INDEX IF NOT EXISTS idx_domains_school_id ON domains(school_id) WHERE school_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_domains_org_name_unique ON domains(organization_id, name) WHERE archived_at IS NULL;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_domains_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_domains_updated_at
  BEFORE UPDATE ON domains
  FOR EACH ROW
  EXECUTE FUNCTION update_domains_updated_at();

-- Comments
COMMENT ON TABLE domains IS 'High-level formation/learning areas. Few and stable. No numeric computation fields.';
COMMENT ON COLUMN domains.organization_id IS 'Scopes domain to organization';
COMMENT ON COLUMN domains.school_id IS 'Optional: scopes domain to specific school within organization';
COMMENT ON COLUMN domains.archived_at IS 'Soft delete: NULL = active, timestamp = archived';

-- ============================================================================
-- 2. competencies
-- ============================================================================

CREATE TABLE IF NOT EXISTS competencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  domain_id UUID NOT NULL REFERENCES domains(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  archived_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_competencies_organization_id ON competencies(organization_id);
CREATE INDEX IF NOT EXISTS idx_competencies_school_id ON competencies(school_id) WHERE school_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_competencies_domain_id ON competencies(domain_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_competencies_org_domain_name_unique ON competencies(organization_id, domain_id, name) WHERE archived_at IS NULL;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_competencies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_competencies_updated_at
  BEFORE UPDATE ON competencies
  FOR EACH ROW
  EXECUTE FUNCTION update_competencies_updated_at();

-- Comments
COMMENT ON TABLE competencies IS 'Human capabilities under a domain. Belongs to exactly one domain. No numeric properties.';
COMMENT ON COLUMN competencies.domain_id IS 'FK to domains.id - competency belongs to exactly one domain';
COMMENT ON COLUMN competencies.archived_at IS 'Soft delete: NULL = active, timestamp = archived';

-- ============================================================================
-- 3. indicators
-- ============================================================================

CREATE TABLE IF NOT EXISTS indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  competency_id UUID NOT NULL REFERENCES competencies(id) ON DELETE RESTRICT,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  archived_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_indicators_organization_id ON indicators(organization_id);
CREATE INDEX IF NOT EXISTS idx_indicators_school_id ON indicators(school_id) WHERE school_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_indicators_competency_id ON indicators(competency_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_indicators_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_indicators_updated_at
  BEFORE UPDATE ON indicators
  FOR EACH ROW
  EXECUTE FUNCTION update_indicators_updated_at();

-- Comments
COMMENT ON TABLE indicators IS 'Observable signals of a competency. Evidence descriptors only. No points, levels, bands, or weights.';
COMMENT ON COLUMN indicators.competency_id IS 'FK to competencies.id - indicator belongs to exactly one competency';
COMMENT ON COLUMN indicators.description IS 'Observable signal description - qualitative evidence only';
COMMENT ON COLUMN indicators.archived_at IS 'Soft delete: NULL = active, timestamp = archived';

-- ============================================================================
-- 4. competency_levels
-- ============================================================================

CREATE TABLE IF NOT EXISTS competency_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  label TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  archived_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_competency_levels_organization_id ON competency_levels(organization_id);
CREATE INDEX IF NOT EXISTS idx_competency_levels_school_id ON competency_levels(school_id) WHERE school_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_competency_levels_org_label_unique ON competency_levels(organization_id, label) WHERE archived_at IS NULL;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_competency_levels_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_competency_levels_updated_at
  BEFORE UPDATE ON competency_levels
  FOR EACH ROW
  EXECUTE FUNCTION update_competency_levels_updated_at();

-- Comments
COMMENT ON TABLE competency_levels IS 'Qualitative taxonomy for mentor-selected judgment. Shared taxonomy scoped by organization (not per-competency). No numeric ordering. System must not auto-select or suggest levels.';
COMMENT ON COLUMN competency_levels.organization_id IS 'Scopes competency level to organization - levels are shared across all competencies';
COMMENT ON COLUMN competency_levels.label IS 'Qualitative label (e.g., Emerging, Developing, Proficient, Advanced). No numeric ordering.';
COMMENT ON COLUMN competency_levels.archived_at IS 'Soft delete: NULL = active, timestamp = archived';

-- ============================================================================
-- AMS Tables (Experience & Observation)
-- ============================================================================

-- ============================================================================
-- 5. experiences
-- ============================================================================

CREATE TABLE IF NOT EXISTS experiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  experience_type TEXT,
  program_id UUID,
  section_id UUID,
  batch_id UUID,
  term_id UUID,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  archived_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_experiences_organization_id ON experiences(organization_id);
CREATE INDEX IF NOT EXISTS idx_experiences_school_id ON experiences(school_id) WHERE school_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_experiences_experience_type ON experiences(experience_type) WHERE experience_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_experiences_program_id ON experiences(program_id) WHERE program_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_experiences_section_id ON experiences(section_id) WHERE section_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_experiences_batch_id ON experiences(batch_id) WHERE batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_experiences_term_id ON experiences(term_id) WHERE term_id IS NOT NULL;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_experiences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_experiences_updated_at
  BEFORE UPDATE ON experiences
  FOR EACH ROW
  EXECUTE FUNCTION update_experiences_updated_at();

-- Comments
COMMENT ON TABLE experiences IS 'Learning activities where observation happens. May surface zero, one, or many competencies. Supports mixed programs, sections, batches. No assessment math.';
COMMENT ON COLUMN experiences.experience_type IS 'Type of experience (e.g., mentoring, apprenticeship, lab, studio, project)';
COMMENT ON COLUMN experiences.program_id IS 'Optional: scopes experience to specific program';
COMMENT ON COLUMN experiences.section_id IS 'Optional: scopes experience to specific section';
COMMENT ON COLUMN experiences.batch_id IS 'Optional: scopes experience to specific batch';
COMMENT ON COLUMN experiences.term_id IS 'Optional: scopes experience to specific term';
COMMENT ON COLUMN experiences.start_at IS 'Optional: experience start time';
COMMENT ON COLUMN experiences.end_at IS 'Optional: experience end time';
COMMENT ON COLUMN experiences.archived_at IS 'Soft delete: NULL = active, timestamp = archived';

-- ============================================================================
-- 6. experience_competency_links
-- ============================================================================

CREATE TABLE IF NOT EXISTS experience_competency_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  experience_id UUID NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,
  competency_id UUID NOT NULL REFERENCES competencies(id) ON DELETE RESTRICT,
  emphasis TEXT NOT NULL CHECK (emphasis IN ('Primary', 'Secondary', 'Contextual')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  archived_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_experience_competency_links_organization_id ON experience_competency_links(organization_id);
CREATE INDEX IF NOT EXISTS idx_experience_competency_links_experience_id ON experience_competency_links(experience_id);
CREATE INDEX IF NOT EXISTS idx_experience_competency_links_competency_id ON experience_competency_links(competency_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_exp_comp_links_unique ON experience_competency_links(experience_id, competency_id) WHERE archived_at IS NULL;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_experience_competency_links_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_experience_competency_links_updated_at
  BEFORE UPDATE ON experience_competency_links
  FOR EACH ROW
  EXECUTE FUNCTION update_experience_competency_links_updated_at();

-- Comments
COMMENT ON TABLE experience_competency_links IS 'Declares emphasis only (Primary/Secondary/Contextual). Non-numeric and informational. Does not influence competency levels.';
COMMENT ON COLUMN experience_competency_links.emphasis IS 'Emphasis type: Primary, Secondary, or Contextual. Non-numeric, informational only.';
COMMENT ON COLUMN experience_competency_links.archived_at IS 'Soft delete: NULL = active, timestamp = archived';

-- ============================================================================
-- 7. observations (CORE RECORD)
-- ============================================================================

CREATE TABLE IF NOT EXISTS observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  learner_id UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  experience_id UUID NOT NULL REFERENCES experiences(id) ON DELETE RESTRICT,
  competency_id UUID NOT NULL REFERENCES competencies(id) ON DELETE RESTRICT,
  competency_level_id UUID NOT NULL REFERENCES competency_levels(id) ON DELETE RESTRICT,
  notes TEXT,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL CHECK (status IN ('active','withdrawn')) DEFAULT 'active',
  withdrawn_at TIMESTAMPTZ,
  withdrawn_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  archived_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_observations_organization_id ON observations(organization_id);
CREATE INDEX IF NOT EXISTS idx_observations_school_id ON observations(school_id) WHERE school_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_observations_learner_id ON observations(learner_id);
CREATE INDEX IF NOT EXISTS idx_observations_experience_id ON observations(experience_id);
CREATE INDEX IF NOT EXISTS idx_observations_competency_id ON observations(competency_id);
CREATE INDEX IF NOT EXISTS idx_observations_competency_level_id ON observations(competency_level_id);
CREATE INDEX IF NOT EXISTS idx_observations_observed_at ON observations(observed_at);
CREATE INDEX IF NOT EXISTS idx_observations_created_by ON observations(created_by);
CREATE INDEX IF NOT EXISTS idx_observations_status ON observations(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_observations_unique ON observations(learner_id, experience_id, competency_id) WHERE status='active';

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_observations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_observations_updated_at
  BEFORE UPDATE ON observations
  FOR EACH ROW
  EXECUTE FUNCTION update_observations_updated_at();

-- Comments
COMMENT ON TABLE observations IS 'CORE RECORD: One learner, one experience, one competency. Mentor-selected competency level. Editable and withdrawable. No numeric fields.';
COMMENT ON COLUMN observations.learner_id IS 'FK to students.id - the learner being observed';
COMMENT ON COLUMN observations.competency_level_id IS 'FK to competency_levels.id - mentor-selected level. System must not auto-populate or suggest.';
COMMENT ON COLUMN observations.observed_at IS 'When the observation occurred (may differ from created_at)';
COMMENT ON COLUMN observations.status IS 'Observation status: active or withdrawn. Withdrawal preserves reversibility.';
COMMENT ON COLUMN observations.withdrawn_at IS 'When the observation was withdrawn (set when status changes to withdrawn)';
COMMENT ON COLUMN observations.withdrawn_reason IS 'Optional reason for withdrawal';
COMMENT ON COLUMN observations.archived_at IS 'Lifecycle/admin archival timestamp. NOT the withdrawal mechanism. NULL = active, timestamp = archived';

-- ============================================================================
-- 8. observation_indicator_links
-- ============================================================================

CREATE TABLE IF NOT EXISTS observation_indicator_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  observation_id UUID NOT NULL REFERENCES observations(id) ON DELETE CASCADE,
  indicator_id UUID NOT NULL REFERENCES indicators(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  archived_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_observation_indicator_links_organization_id ON observation_indicator_links(organization_id);
CREATE INDEX IF NOT EXISTS idx_observation_indicator_links_observation_id ON observation_indicator_links(observation_id);
CREATE INDEX IF NOT EXISTS idx_observation_indicator_links_indicator_id ON observation_indicator_links(indicator_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_obs_ind_links_unique ON observation_indicator_links(observation_id, indicator_id) WHERE archived_at IS NULL;

-- Comments
COMMENT ON TABLE observation_indicator_links IS 'Records which indicators were observed. Evidence only, no scoring.';
COMMENT ON COLUMN observation_indicator_links.observation_id IS 'FK to observations.id - the observation this indicator link belongs to';
COMMENT ON COLUMN observation_indicator_links.indicator_id IS 'FK to indicators.id - the indicator that was observed';
COMMENT ON COLUMN observation_indicator_links.archived_at IS 'Soft delete: NULL = active, timestamp = archived';

-- ============================================================================
-- 9. observation_attachments
-- ============================================================================

CREATE TABLE IF NOT EXISTS observation_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  observation_id UUID NOT NULL REFERENCES observations(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT,
  file_type TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  archived_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_observation_attachments_organization_id ON observation_attachments(organization_id);
CREATE INDEX IF NOT EXISTS idx_observation_attachments_observation_id ON observation_attachments(observation_id);
CREATE INDEX IF NOT EXISTS idx_observation_attachments_file_type ON observation_attachments(file_type) WHERE file_type IS NOT NULL;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_observation_attachments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_observation_attachments_updated_at
  BEFORE UPDATE ON observation_attachments
  FOR EACH ROW
  EXECUTE FUNCTION update_observation_attachments_updated_at();

-- Comments
COMMENT ON TABLE observation_attachments IS 'Artifacts linked to observations. No derived or computed fields.';
COMMENT ON COLUMN observation_attachments.observation_id IS 'FK to observations.id - the observation this attachment belongs to';
COMMENT ON COLUMN observation_attachments.file_url IS 'File reference or URL to the artifact';
COMMENT ON COLUMN observation_attachments.archived_at IS 'Soft delete: NULL = active, timestamp = archived';

-- ============================================================================
-- End of Phase 2 OBS + AMS Table Creation
-- ============================================================================
