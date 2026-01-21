-- Migration: Create Phase 5 External Interfaces & Operational Scaling tables
-- Created: 2024
-- Description: Creates tables for export generation, template management, and external ID mapping
-- Enforces Phase 5 boundaries: no modification to Phase 2/3/4 tables, read-only consumption of grade records
--
-- HARDENING NOTES:
--   - All tables scoped by organization_id for tenant isolation
--   - Optional school_id for multi-school support
--   - Soft delete via archived_at (no hard deletes)
--   - Auto-update triggers for updated_at
--   - No numeric computation fields

-- ============================================================================
-- 1. export_jobs
-- ============================================================================

CREATE TABLE IF NOT EXISTS export_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  requested_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  export_type TEXT NOT NULL CHECK (export_type IN ('transcript', 'report_card', 'compliance_export')),
  export_parameters JSONB NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
  file_path TEXT,
  file_size_bytes BIGINT,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  archived_at TIMESTAMPTZ
);

-- Indexes for export_jobs
CREATE INDEX IF NOT EXISTS idx_export_jobs_organization_id ON export_jobs(organization_id);
CREATE INDEX IF NOT EXISTS idx_export_jobs_school_id ON export_jobs(school_id) WHERE school_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_export_jobs_requested_by ON export_jobs(requested_by);
CREATE INDEX IF NOT EXISTS idx_export_jobs_export_type ON export_jobs(export_type);
CREATE INDEX IF NOT EXISTS idx_export_jobs_status ON export_jobs(status);
CREATE INDEX IF NOT EXISTS idx_export_jobs_created_at ON export_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_export_jobs_completed_at ON export_jobs(completed_at DESC) WHERE completed_at IS NOT NULL;

-- Comments for export_jobs
COMMENT ON TABLE export_jobs IS 'Tracks export generation requests, status, and file references. Append-only audit trail for all export operations.';
COMMENT ON COLUMN export_jobs.organization_id IS 'Scopes export job to organization - enforces tenant isolation';
COMMENT ON COLUMN export_jobs.school_id IS 'Optional: scopes export job to specific school within organization';
COMMENT ON COLUMN export_jobs.requested_by IS 'FK to profiles.id - who requested the export (audit trail)';
COMMENT ON COLUMN export_jobs.export_type IS 'Type of export: transcript, report_card, or compliance_export';
COMMENT ON COLUMN export_jobs.export_parameters IS 'JSONB containing export scope: student_ids, school_year_id, term_period, filters, etc.';
COMMENT ON COLUMN export_jobs.status IS 'Export status: pending, processing, completed, or failed';
COMMENT ON COLUMN export_jobs.file_path IS 'Object storage path to generated export file (not stored in database)';
COMMENT ON COLUMN export_jobs.archived_at IS 'Soft delete: NULL = active, timestamp = archived. Records should rarely be archived.';

-- ============================================================================
-- 2. export_templates
-- ============================================================================
-- Note: Phase 4 has report_templates table. Phase 5 creates separate export_templates
-- table for export-specific configuration (export_format, version fields).

CREATE TABLE IF NOT EXISTS export_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  template_name TEXT NOT NULL,
  template_type TEXT NOT NULL CHECK (template_type IN ('transcript', 'report_card', 'compliance_export')),
  template_config JSONB NOT NULL,
  export_format TEXT NOT NULL CHECK (export_format IN ('pdf', 'csv', 'excel')) DEFAULT 'pdf',
  is_active BOOLEAN DEFAULT TRUE,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  archived_at TIMESTAMPTZ
);

-- Indexes for export_templates
CREATE INDEX IF NOT EXISTS idx_export_templates_organization_id ON export_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_export_templates_school_id ON export_templates(school_id) WHERE school_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_export_templates_template_type ON export_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_export_templates_export_format ON export_templates(export_format);
CREATE INDEX IF NOT EXISTS idx_export_templates_is_active ON export_templates(is_active) WHERE is_active = TRUE;
-- Unique index for template name/type uniqueness (only for non-archived records)
CREATE UNIQUE INDEX IF NOT EXISTS idx_export_templates_org_name_type_unique ON export_templates(organization_id, template_name, template_type) WHERE archived_at IS NULL;

-- Comments for export_templates
COMMENT ON TABLE export_templates IS 'Defines export format templates for transcripts, report cards, and compliance exports. Format configuration only, no computation.';
COMMENT ON COLUMN export_templates.template_config IS 'JSONB configuration for format, fields, layout, styling, column mappings. No computation logic.';
COMMENT ON COLUMN export_templates.export_format IS 'Export file format: pdf, csv, or excel';
COMMENT ON COLUMN export_templates.version IS 'Template version for future versioning support';
COMMENT ON COLUMN export_templates.archived_at IS 'Soft delete: NULL = active, timestamp = archived';

-- ============================================================================
-- 3. external_id_mappings
-- ============================================================================

CREATE TABLE IF NOT EXISTS external_id_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('student', 'school', 'program', 'section', 'school_year', 'staff')),
  internal_id UUID NOT NULL,
  external_system TEXT NOT NULL,
  external_id TEXT NOT NULL,
  external_id_display_name TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  archived_at TIMESTAMPTZ
);

-- Indexes for external_id_mappings
CREATE INDEX IF NOT EXISTS idx_external_id_mappings_organization_id ON external_id_mappings(organization_id);
CREATE INDEX IF NOT EXISTS idx_external_id_mappings_entity_type ON external_id_mappings(entity_type);
CREATE INDEX IF NOT EXISTS idx_external_id_mappings_internal_id ON external_id_mappings(internal_id);
CREATE INDEX IF NOT EXISTS idx_external_id_mappings_external_system ON external_id_mappings(external_system);
CREATE INDEX IF NOT EXISTS idx_external_id_mappings_external_id ON external_id_mappings(external_id);
CREATE INDEX IF NOT EXISTS idx_external_id_mappings_is_active ON external_id_mappings(is_active) WHERE is_active = TRUE;
-- Unique indexes for external ID uniqueness (only for non-archived records)
CREATE UNIQUE INDEX IF NOT EXISTS idx_external_id_mappings_org_system_type_ext_unique ON external_id_mappings(organization_id, external_system, entity_type, external_id) WHERE archived_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_external_id_mappings_org_type_internal_system_unique ON external_id_mappings(organization_id, entity_type, internal_id, external_system) WHERE archived_at IS NULL;

-- Comments for external_id_mappings
COMMENT ON TABLE external_id_mappings IS 'Maps internal entity IDs to external system identifiers. Supports integration with third-party systems while maintaining tenant isolation.';
COMMENT ON COLUMN external_id_mappings.entity_type IS 'Type of entity: student, school, program, section, school_year, or staff';
COMMENT ON COLUMN external_id_mappings.internal_id IS 'UUID reference to internal entity (no FK to avoid coupling with multiple tables)';
COMMENT ON COLUMN external_id_mappings.external_system IS 'Identifier for external system (e.g., deped_sis, ched_portal, sis_vendor)';
COMMENT ON COLUMN external_id_mappings.external_id IS 'Identifier in external system. Must be unique within (organization_id, external_system, entity_type).';
COMMENT ON COLUMN external_id_mappings.archived_at IS 'Soft delete: NULL = active, timestamp = archived';

-- ============================================================================
-- 4. audit_events (Optional - create only if not exists)
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_category TEXT NOT NULL,
  actor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  target_entity_type TEXT,
  target_entity_id UUID,
  event_data JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for audit_events
CREATE INDEX IF NOT EXISTS idx_audit_events_organization_id ON audit_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_school_id ON audit_events(school_id) WHERE school_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_events_event_type ON audit_events(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_events_event_category ON audit_events(event_category);
CREATE INDEX IF NOT EXISTS idx_audit_events_actor_id ON audit_events(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_target_entity ON audit_events(target_entity_type, target_entity_id) WHERE target_entity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON audit_events(created_at DESC);

-- Comments for audit_events
COMMENT ON TABLE audit_events IS 'General-purpose audit trail for system events. Append-only records for compliance auditing.';
COMMENT ON COLUMN audit_events.actor_id IS 'FK to profiles.id - who performed the action';
COMMENT ON COLUMN audit_events.target_entity_type IS 'Optional: type of entity that was acted upon';
COMMENT ON COLUMN audit_events.target_entity_id IS 'Optional: UUID reference to target entity';
COMMENT ON COLUMN audit_events.event_data IS 'Optional: JSONB containing additional event context';
COMMENT ON COLUMN audit_events.created_at IS 'When the event occurred. Records are append-only (never updated or deleted).';

-- ============================================================================
-- 5. report_render_runs (Optional - for performance monitoring)
-- ============================================================================

CREATE TABLE IF NOT EXISTS report_render_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  export_job_id UUID NOT NULL REFERENCES export_jobs(id) ON DELETE CASCADE,
  template_id UUID REFERENCES export_templates(id) ON DELETE SET NULL,
  render_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  render_completed_at TIMESTAMPTZ,
  render_duration_ms INTEGER,
  records_processed INTEGER,
  render_status TEXT NOT NULL CHECK (render_status IN ('success', 'failed')) DEFAULT 'success',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for report_render_runs
CREATE INDEX IF NOT EXISTS idx_report_render_runs_organization_id ON report_render_runs(organization_id);
CREATE INDEX IF NOT EXISTS idx_report_render_runs_export_job_id ON report_render_runs(export_job_id);
CREATE INDEX IF NOT EXISTS idx_report_render_runs_template_id ON report_render_runs(template_id) WHERE template_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_report_render_runs_render_status ON report_render_runs(render_status);
CREATE INDEX IF NOT EXISTS idx_report_render_runs_render_started_at ON report_render_runs(render_started_at DESC);

-- Comments for report_render_runs
COMMENT ON TABLE report_render_runs IS 'Tracks individual report rendering operations for performance monitoring and debugging. Optional table for detailed render tracking.';
COMMENT ON COLUMN report_render_runs.export_job_id IS 'FK to export_jobs.id - the export job this render run belongs to';
COMMENT ON COLUMN report_render_runs.render_duration_ms IS 'Render duration in milliseconds (measurement, not computation)';
COMMENT ON COLUMN report_render_runs.records_processed IS 'Number of records processed during render (measurement, not computation)';
COMMENT ON COLUMN report_render_runs.created_at IS 'When the render run was created. Records are append-only.';

-- ============================================================================
-- Triggers: Auto-update updated_at
-- ============================================================================

-- Function to update updated_at timestamp (reuse if exists, create if not)
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for tables with updated_at
CREATE TRIGGER update_export_jobs_updated_at
  BEFORE UPDATE ON export_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_export_templates_updated_at
  BEFORE UPDATE ON export_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_external_id_mappings_updated_at
  BEFORE UPDATE ON external_id_mappings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Note: audit_events and report_render_runs are append-only (no updated_at triggers)

-- ============================================================================
-- End of Migration
-- ============================================================================
