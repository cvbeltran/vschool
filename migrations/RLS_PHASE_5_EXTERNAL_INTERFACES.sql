-- Migration: Add Row Level Security (RLS) policies for Phase 5 External Interfaces & Operational Scaling
-- Created: 2024
-- Description: Creates RLS policies for Phase 5 export and reporting tables
-- Enforces tenant isolation, role-based access control, and privacy
-- Super admins can bypass RLS checks and access all data
--
-- HARDENING NOTES:
--   - All SECURITY DEFINER functions set search_path = public, auth
--   - Policies made idempotent with DROP POLICY IF EXISTS
--   - Org isolation enforced via organization_id
--   - School scoping via can_access_school(school_id)
--   - No computation, scoring, or aggregation in policies
--   - Students/guardians have no export access

-- ============================================================================
-- README: Role Taxonomy, Policy Intent, and Dependencies
-- ============================================================================

-- ROLE TAXONOMY (Canonical Roles for Phase 5):
--   principal: Full access to export generation, template management, external ID mapping, export history
--   admin: Same as principal (full access)
--   registrar: Can generate compliance exports, view export history, download exports (limited export generation)
--   mentor/teacher: No export generation access (read-only access to finalized transcripts if permitted)
--   student: Read-only access to own finalized transcripts/report cards (no export generation)
--   guardian: No export access by default (privacy protection)

-- POLICY INTENT PER TABLE:
--   export_jobs:
--     - SELECT: admin, principal, registrar (all in org/school)
--     - INSERT: admin/principal (transcript/report_card), admin/principal/registrar (compliance_export)
--     - UPDATE: System only (status updates during export processing)
--     - DELETE: Disallow (use archived_at for soft deletes)
--
--   export_templates:
--     - SELECT: admin, principal, registrar (all in org/school)
--     - INSERT/UPDATE: admin, principal only
--     - DELETE: Disallow (use archived_at for soft deletes)
--
--   external_id_mappings:
--     - SELECT: admin, principal, registrar (all in org)
--     - INSERT/UPDATE: admin, principal only
--     - DELETE: Disallow (use archived_at for soft deletes)
--
--   audit_events:
--     - SELECT: admin, principal, registrar (all in org/school)
--     - INSERT: System only (audit events created by application logic)
--     - UPDATE/DELETE: Disallow (append-only)
--
--   report_render_runs:
--     - SELECT: admin, principal, registrar (all in org)
--     - INSERT: System only (render runs created by application logic)
--     - UPDATE/DELETE: Disallow (append-only)

-- DEPENDENCIES:
--   - Uses helper functions from Phase 2/3/4 RLS (is_super_admin, current_profile_id, etc.)
--   - Assumes profile-student linking exists (for current_student_id())
--   - Teachers are identified via is_mentor() (normalizes teacher/faculty -> mentor)

-- ============================================================================
-- Helper Functions (Reuse Phase 2/3/4 helpers)
-- ============================================================================

-- Note: All helper functions from Phase 2/3/4 RLS are assumed to exist:
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
-- Enable Row Level Security on Phase 5 Tables
-- ============================================================================

ALTER TABLE export_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE export_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_id_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_render_runs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- export_jobs: RLS Policies
-- ============================================================================

-- SELECT: admin, principal, registrar (all in org/school)
DROP POLICY IF EXISTS "export_jobs_select_org_scope" ON export_jobs;
CREATE POLICY "export_jobs_select_org_scope"
  ON export_jobs FOR SELECT
  USING (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND (archived_at IS NULL)
    AND (is_org_admin() OR is_registrar())
  );

-- INSERT: admin/principal (transcript/report_card), admin/principal/registrar (compliance_export)
DROP POLICY IF EXISTS "export_jobs_insert_admin_principal" ON export_jobs;
CREATE POLICY "export_jobs_insert_admin_principal"
  ON export_jobs FOR INSERT
  WITH CHECK (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND (
      (is_org_admin() AND export_type IN ('transcript', 'report_card', 'compliance_export'))
      OR (is_registrar() AND export_type = 'compliance_export')
    )
    AND requested_by = current_profile_id()
  );

-- UPDATE: System/admin only (status updates during export processing)
-- Note: In practice, this allows admin/principal to update status and related fields
-- Field-level restrictions (preventing updates to organization_id, requested_by, etc.)
-- should be enforced via application logic or triggers if needed
DROP POLICY IF EXISTS "export_jobs_update_status" ON export_jobs;
CREATE POLICY "export_jobs_update_status"
  ON export_jobs FOR UPDATE
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
-- export_templates: RLS Policies
-- ============================================================================

-- SELECT: admin, principal, registrar (all in org/school)
DROP POLICY IF EXISTS "export_templates_select_org_scope" ON export_templates;
CREATE POLICY "export_templates_select_org_scope"
  ON export_templates FOR SELECT
  USING (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND (archived_at IS NULL)
    AND (is_org_admin() OR is_registrar())
  );

-- INSERT: admin, principal only
DROP POLICY IF EXISTS "export_templates_insert_admin" ON export_templates;
CREATE POLICY "export_templates_insert_admin"
  ON export_templates FOR INSERT
  WITH CHECK (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND is_org_admin()
  );

-- UPDATE: admin, principal only
DROP POLICY IF EXISTS "export_templates_update_admin" ON export_templates;
CREATE POLICY "export_templates_update_admin"
  ON export_templates FOR UPDATE
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
-- external_id_mappings: RLS Policies
-- ============================================================================

-- SELECT: admin, principal, registrar (all in org)
DROP POLICY IF EXISTS "external_id_mappings_select_org_scope" ON external_id_mappings;
CREATE POLICY "external_id_mappings_select_org_scope"
  ON external_id_mappings FOR SELECT
  USING (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (archived_at IS NULL)
    AND (is_org_admin() OR is_registrar())
  );

-- INSERT: admin, principal only
-- Note: Additional validation that internal_id belongs to current organization
-- should be enforced via application logic or EXISTS subquery
DROP POLICY IF EXISTS "external_id_mappings_insert_admin" ON external_id_mappings;
CREATE POLICY "external_id_mappings_insert_admin"
  ON external_id_mappings FOR INSERT
  WITH CHECK (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND is_org_admin()
  );

-- UPDATE: admin, principal only
-- Note: Field-level restrictions (preventing changes to organization_id, entity_type, etc.)
-- should be enforced via application logic or triggers if needed
DROP POLICY IF EXISTS "external_id_mappings_update_admin" ON external_id_mappings;
CREATE POLICY "external_id_mappings_update_admin"
  ON external_id_mappings FOR UPDATE
  USING (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND is_org_admin()
  )
  WITH CHECK (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND is_org_admin()
  );

-- ============================================================================
-- audit_events: RLS Policies
-- ============================================================================

-- SELECT: admin, principal, registrar (all in org/school)
DROP POLICY IF EXISTS "audit_events_select_org_scope" ON audit_events;
CREATE POLICY "audit_events_select_org_scope"
  ON audit_events FOR SELECT
  USING (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND (is_org_admin() OR is_registrar())
  );

-- INSERT: System only (audit events created by application logic)
-- Note: In practice, application code will insert audit events using service role
-- This policy allows system/admin to insert for application logic
DROP POLICY IF EXISTS "audit_events_insert_system" ON audit_events;
CREATE POLICY "audit_events_insert_system"
  ON audit_events FOR INSERT
  WITH CHECK (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    -- Allow system/admin to insert audit events
    -- Application code should use service role or admin role
    AND (is_org_admin() OR is_super_admin(current_profile_id()))
  );

-- UPDATE/DELETE: Disallow (append-only)
-- No UPDATE or DELETE policies - table is append-only

-- ============================================================================
-- report_render_runs: RLS Policies
-- ============================================================================

-- SELECT: admin, principal, registrar (all in org)
DROP POLICY IF EXISTS "report_render_runs_select_org_scope" ON report_render_runs;
CREATE POLICY "report_render_runs_select_org_scope"
  ON report_render_runs FOR SELECT
  USING (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (is_org_admin() OR is_registrar())
  );

-- INSERT: System only (render runs created by application logic)
DROP POLICY IF EXISTS "report_render_runs_insert_system" ON report_render_runs;
CREATE POLICY "report_render_runs_insert_system"
  ON report_render_runs FOR INSERT
  WITH CHECK (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    -- Allow system/admin to insert render runs
    -- Application code should use service role or admin role
    AND (is_org_admin() OR is_super_admin(current_profile_id()))
    -- Validate export_job_id belongs to same organization
    AND EXISTS (
      SELECT 1 FROM export_jobs
      WHERE id = report_render_runs.export_job_id
        AND organization_id = current_organization_id()
    )
  );

-- UPDATE/DELETE: Disallow (append-only)
-- No UPDATE or DELETE policies - table is append-only

-- ============================================================================
-- End of Phase 5 RLS Policies
-- ============================================================================
