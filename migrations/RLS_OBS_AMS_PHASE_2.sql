-- Migration: Add Row Level Security (RLS) policies for Phase 2 OBS + AMS
-- Created: 2024
-- Description: Creates RLS policies for Phase 2 OBS (Structure of Meaning) and AMS (Experience & Observation) tables
-- Enforces tenant isolation, role-based access control, row ownership, and learner privacy
-- Super admins can bypass RLS checks and access all data
--
-- HARDENING CHANGELOG:
--   - OBS SELECT tightened to staff roles (principal/admin/registrar/mentor only, excludes students/guardians)
--   - School scoping added to EXISTS clauses in link tables (experience_competency_links, observation_indicator_links, observation_attachments)
--   - SECURITY DEFINER functions now set search_path = public, auth
--   - Policies made idempotent with DROP POLICY IF EXISTS
--   - Renamed current_role() to current_user_role() to avoid conflict with PostgreSQL's built-in current_role function

-- ============================================================================
-- README: Role Taxonomy, Policy Intent, and Dependencies
-- ============================================================================

-- ROLE TAXONOMY (Canonical Roles for Phase 2):
--   principal: Full CRUD on OBS, READ on AMS, can manage all experiences
--   admin: Same as principal
--   registrar: READ-ONLY for all OBS + AMS
--   mentor: CREATE/UPDATE experiences, CREATE/UPDATE/WITHDRAW own observations, READ OBS
--   student: READ-only own observations (requires profile-student linking - see dependencies)
--   guardian: READ-only linked learners' observations (requires profile-guardian linking - see dependencies)

-- POLICY INTENT PER TABLE:
--   OBS Tables (domains, competencies, indicators, competency_levels):
--     - SELECT: principal, admin, registrar, mentor (all org members)
--     - INSERT/UPDATE: principal, admin only
--     - DELETE: Disallow (use archived_at for soft deletes)
--
--   AMS Tables:
--     experiences:
--       - SELECT: principal, admin, registrar, mentor (within org/school)
--       - INSERT/UPDATE: mentor (own experiences), principal/admin (all)
--       - DELETE: Disallow (use archived_at)
--
--     experience_competency_links:
--       - SELECT: Same visibility as parent experience
--       - INSERT/UPDATE: If user can UPDATE parent experience
--       - DELETE: Disallow (use archived_at)
--
--     observations (CORE RECORD):
--       - SELECT: principal/admin/registrar (all within org), mentor (own + experiences they own),
--                 student (own only), guardian (linked learners only)
--       - INSERT: mentor only (within org/school)
--       - UPDATE: mentor (own only), principal/admin (all), allow status='withdrawn'
--       - DELETE: Disallow
--
--     observation_indicator_links / observation_attachments:
--       - SELECT: If user can SELECT parent observation
--       - INSERT/UPDATE: If user can UPDATE parent observation
--       - DELETE: Disallow (use archived_at)

-- DEPENDENCIES (Documented, Not Implemented in This Migration):
--   1. Student-Profile Linking:
--      - For student users to view their own observations, we need either:
--        * profiles.student_id UUID REFERENCES students(id) field, OR
--        * Helper function matching profiles.email to students.primary_email
--      - Current implementation: current_student_id() function assumes profile-student linking exists
--      - If missing, student role policies will not work until linking is implemented
--
--   2. Guardian-Profile Linking:
--      - For guardian users to view linked learners' observations, we need either:
--        * profiles.guardian_id UUID REFERENCES guardians(id) field, OR
--        * Helper function matching profiles.email to guardians.email
--      - Current implementation: guardian_can_view_student() uses student_guardians table
--      - Assumes guardian profile can be linked to guardian record (via email or guardian_id)
--
--   3. School ID in Profiles:
--      - profiles table may need school_id for school-scoped access
--      - Current implementation: current_school_id() checks if profiles.school_id exists
--      - If missing, school scoping will default to org-wide access

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Reuse existing super admin check (if exists, otherwise create)
CREATE OR REPLACE FUNCTION is_super_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = user_id AND is_super_admin = TRUE
  );
END;
$$;

-- Reuse existing organization_id getter (if exists, otherwise create)
CREATE OR REPLACE FUNCTION get_user_organization_id(user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN (
    SELECT organization_id FROM profiles WHERE id = user_id
  );
END;
$$;

-- Get current authenticated user's profile ID
CREATE OR REPLACE FUNCTION current_profile_id()
RETURNS UUID AS $$
BEGIN
  RETURN auth.uid();
END;
$$ LANGUAGE plpgsql STABLE;

-- Get current user's organization_id
CREATE OR REPLACE FUNCTION current_organization_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN get_user_organization_id(current_profile_id());
END;
$$;

-- Normalize role to canonical role (teacher/faculty -> mentor)
CREATE OR REPLACE FUNCTION normalize_role(role_text TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN CASE
    WHEN LOWER(role_text) IN ('teacher', 'faculty', 'instructor') THEN 'mentor'
    WHEN LOWER(role_text) = 'principal' THEN 'principal'
    WHEN LOWER(role_text) = 'admin' THEN 'admin'
    WHEN LOWER(role_text) = 'registrar' THEN 'registrar'
    WHEN LOWER(role_text) = 'student' THEN 'student'
    WHEN LOWER(role_text) = 'guardian' THEN 'guardian'
    ELSE LOWER(role_text)
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Get current user's canonical role
-- Note: Renamed from current_role() to avoid conflict with PostgreSQL's built-in current_role function
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN normalize_role(
    (SELECT role FROM profiles WHERE id = current_profile_id())
  );
END;
$$;

-- Get current user's school_id (nullable)
CREATE OR REPLACE FUNCTION current_school_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Check if school_id column exists in profiles (graceful fallback)
  RETURN (
    SELECT school_id FROM profiles WHERE id = current_profile_id()
  );
EXCEPTION
  WHEN undefined_column THEN
    RETURN NULL;
END;
$$;

-- Role check: Is user an org admin (principal or admin)?
CREATE OR REPLACE FUNCTION is_org_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN current_user_role() IN ('principal', 'admin') OR is_super_admin(current_profile_id());
END;
$$;

-- Role check: Is user a registrar?
CREATE OR REPLACE FUNCTION is_registrar()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN current_user_role() = 'registrar' OR is_super_admin(current_profile_id());
END;
$$;

-- Role check: Is user a mentor?
CREATE OR REPLACE FUNCTION is_mentor()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN current_user_role() = 'mentor' OR is_super_admin(current_profile_id());
END;
$$;

-- Role check: Is user a student?
CREATE OR REPLACE FUNCTION is_student()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN current_user_role() = 'student' OR is_super_admin(current_profile_id());
END;
$$;

-- Role check: Is user a guardian?
CREATE OR REPLACE FUNCTION is_guardian()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN current_user_role() = 'guardian' OR is_super_admin(current_profile_id());
END;
$$;

-- Get student_id linked to current profile (DEPENDENCY: requires profile-student linking)
-- This function assumes either:
--   1. profiles.student_id field exists, OR
--   2. profiles.email matches students.primary_email
CREATE OR REPLACE FUNCTION current_student_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  profile_email TEXT;
  student_record_id UUID;
BEGIN
  -- Try direct link via profiles.student_id (if column exists)
  BEGIN
    SELECT student_id INTO student_record_id
    FROM profiles
    WHERE id = current_profile_id();
    
    IF student_record_id IS NOT NULL THEN
      RETURN student_record_id;
    END IF;
  EXCEPTION
    WHEN undefined_column THEN
      -- Column doesn't exist, try email matching
      NULL;
  END;
  
  -- Fallback: Try email matching
  SELECT email INTO profile_email
  FROM auth.users
  WHERE id = current_profile_id();
  
  IF profile_email IS NOT NULL THEN
    SELECT id INTO student_record_id
    FROM students
    WHERE primary_email = profile_email
      AND organization_id = current_organization_id()
    LIMIT 1;
    
    RETURN student_record_id;
  END IF;
  
  RETURN NULL;
END;
$$;

-- Check if current guardian can view a specific student
-- DEPENDENCY: Assumes guardian profile can be linked to guardian record
CREATE OR REPLACE FUNCTION guardian_can_view_student(student_id_param UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  guardian_record_id UUID;
  profile_email TEXT;
BEGIN
  -- Get guardian record ID linked to current profile
  -- Try direct link via profiles.guardian_id (if column exists)
  BEGIN
    SELECT guardian_id INTO guardian_record_id
    FROM profiles
    WHERE id = current_profile_id();
  EXCEPTION
    WHEN undefined_column THEN
      -- Column doesn't exist, try email matching
      SELECT email INTO profile_email
      FROM auth.users
      WHERE id = current_profile_id();
      
      IF profile_email IS NOT NULL THEN
        SELECT id INTO guardian_record_id
        FROM guardians
        WHERE email = profile_email
          AND organization_id = current_organization_id()
        LIMIT 1;
      END IF;
  END;
  
  -- Check if guardian is linked to student via student_guardians
  IF guardian_record_id IS NOT NULL THEN
    RETURN EXISTS (
      SELECT 1 FROM student_guardians
      WHERE student_id = student_id_param
        AND guardian_id = guardian_record_id
        AND organization_id = current_organization_id()
    );
  END IF;
  
  RETURN FALSE;
END;
$$;

-- Check if user can access a school-scoped record
CREATE OR REPLACE FUNCTION can_access_school(school_id_param UUID)
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
  
  -- Org admins can access all schools in their org
  IF is_org_admin() THEN
    RETURN EXISTS (
      SELECT 1 FROM schools
      WHERE id = school_id_param
        AND organization_id = current_organization_id()
    );
  END IF;
  
  -- Other users can only access their own school
  IF school_id_param IS NULL THEN
    RETURN TRUE; -- NULL school_id means org-wide, accessible to all org members
  END IF;
  
  RETURN school_id_param = current_school_id();
END;
$$;

-- ============================================================================
-- Enable Row Level Security on Phase 2 Tables
-- ============================================================================

ALTER TABLE domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE competencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE competency_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE experience_competency_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE observation_indicator_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE observation_attachments ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- OBS Tables: RLS Policies
-- ============================================================================

-- ============================================================================
-- domains
-- ============================================================================

-- SELECT: principal, admin, registrar, mentor (staff roles only, excludes students/guardians)
DROP POLICY IF EXISTS "domains_select_org_members" ON domains;
CREATE POLICY "domains_select_org_members"
  ON domains FOR SELECT
  USING (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND (archived_at IS NULL)
    AND (is_org_admin() OR is_registrar() OR is_mentor())
  );

-- INSERT: principal, admin only
DROP POLICY IF EXISTS "domains_insert_admin" ON domains;
CREATE POLICY "domains_insert_admin"
  ON domains FOR INSERT
  WITH CHECK (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND is_org_admin()
  );

-- UPDATE: principal, admin only
DROP POLICY IF EXISTS "domains_update_admin" ON domains;
CREATE POLICY "domains_update_admin"
  ON domains FOR UPDATE
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

-- DELETE: Disallow (use archived_at)
-- No DELETE policy - hard deletes are forbidden

-- ============================================================================
-- competencies
-- ============================================================================

-- SELECT: principal, admin, registrar, mentor (staff roles only, excludes students/guardians)
DROP POLICY IF EXISTS "competencies_select_org_members" ON competencies;
CREATE POLICY "competencies_select_org_members"
  ON competencies FOR SELECT
  USING (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND (archived_at IS NULL)
    AND (is_org_admin() OR is_registrar() OR is_mentor())
  );

-- INSERT: principal, admin only
DROP POLICY IF EXISTS "competencies_insert_admin" ON competencies;
CREATE POLICY "competencies_insert_admin"
  ON competencies FOR INSERT
  WITH CHECK (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND is_org_admin()
  );

-- UPDATE: principal, admin only
DROP POLICY IF EXISTS "competencies_update_admin" ON competencies;
CREATE POLICY "competencies_update_admin"
  ON competencies FOR UPDATE
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
-- indicators
-- ============================================================================

-- SELECT: principal, admin, registrar, mentor (staff roles only, excludes students/guardians)
DROP POLICY IF EXISTS "indicators_select_org_members" ON indicators;
CREATE POLICY "indicators_select_org_members"
  ON indicators FOR SELECT
  USING (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND (archived_at IS NULL)
    AND (is_org_admin() OR is_registrar() OR is_mentor())
  );

-- INSERT: principal, admin only
DROP POLICY IF EXISTS "indicators_insert_admin" ON indicators;
CREATE POLICY "indicators_insert_admin"
  ON indicators FOR INSERT
  WITH CHECK (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND is_org_admin()
  );

-- UPDATE: principal, admin only
DROP POLICY IF EXISTS "indicators_update_admin" ON indicators;
CREATE POLICY "indicators_update_admin"
  ON indicators FOR UPDATE
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
-- competency_levels
-- ============================================================================

-- SELECT: principal, admin, registrar, mentor (staff roles only, excludes students/guardians)
DROP POLICY IF EXISTS "competency_levels_select_org_members" ON competency_levels;
CREATE POLICY "competency_levels_select_org_members"
  ON competency_levels FOR SELECT
  USING (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND (archived_at IS NULL)
    AND (is_org_admin() OR is_registrar() OR is_mentor())
  );

-- INSERT: principal, admin only
DROP POLICY IF EXISTS "competency_levels_insert_admin" ON competency_levels;
CREATE POLICY "competency_levels_insert_admin"
  ON competency_levels FOR INSERT
  WITH CHECK (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND is_org_admin()
  );

-- UPDATE: principal, admin only
DROP POLICY IF EXISTS "competency_levels_update_admin" ON competency_levels;
CREATE POLICY "competency_levels_update_admin"
  ON competency_levels FOR UPDATE
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
-- AMS Tables: RLS Policies
-- ============================================================================

-- ============================================================================
-- experiences
-- ============================================================================

-- SELECT: principal, admin, registrar, mentor (within org/school)
DROP POLICY IF EXISTS "experiences_select_org_members" ON experiences;
CREATE POLICY "experiences_select_org_members"
  ON experiences FOR SELECT
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

-- INSERT: mentor (own experiences), principal/admin (all)
DROP POLICY IF EXISTS "experiences_insert_mentor_admin" ON experiences;
CREATE POLICY "experiences_insert_mentor_admin"
  ON experiences FOR INSERT
  WITH CHECK (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND (is_mentor() OR is_org_admin())
  );

-- UPDATE: mentor (own experiences via created_by), principal/admin (all)
DROP POLICY IF EXISTS "experiences_update_mentor_admin" ON experiences;
CREATE POLICY "experiences_update_mentor_admin"
  ON experiences FOR UPDATE
  USING (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND (
      is_org_admin() OR
      (is_mentor() AND created_by = current_profile_id())
    )
  )
  WITH CHECK (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND (
      is_org_admin() OR
      (is_mentor() AND created_by = current_profile_id())
    )
  );

-- ============================================================================
-- experience_competency_links
-- ============================================================================

-- SELECT: Same visibility as parent experience
DROP POLICY IF EXISTS "experience_competency_links_select" ON experience_competency_links;
CREATE POLICY "experience_competency_links_select"
  ON experience_competency_links FOR SELECT
  USING (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (archived_at IS NULL)
    AND EXISTS (
      SELECT 1 FROM experiences
      WHERE experiences.id = experience_competency_links.experience_id
        AND (experiences.archived_at IS NULL)
        AND (experiences.school_id IS NULL OR can_access_school(experiences.school_id))
        AND (
          is_org_admin() OR
          is_registrar() OR
          is_mentor()
        )
    )
  );

-- INSERT: If user can UPDATE parent experience
DROP POLICY IF EXISTS "experience_competency_links_insert" ON experience_competency_links;
CREATE POLICY "experience_competency_links_insert"
  ON experience_competency_links FOR INSERT
  WITH CHECK (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND EXISTS (
      SELECT 1 FROM experiences
      WHERE experiences.id = experience_competency_links.experience_id
        AND (experiences.organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
        AND (experiences.school_id IS NULL OR can_access_school(experiences.school_id))
        AND (
          is_org_admin() OR
          (is_mentor() AND experiences.created_by = current_profile_id())
        )
    )
  );

-- UPDATE: If user can UPDATE parent experience
DROP POLICY IF EXISTS "experience_competency_links_update" ON experience_competency_links;
CREATE POLICY "experience_competency_links_update"
  ON experience_competency_links FOR UPDATE
  USING (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND EXISTS (
      SELECT 1 FROM experiences
      WHERE experiences.id = experience_competency_links.experience_id
        AND (experiences.organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
        AND (experiences.school_id IS NULL OR can_access_school(experiences.school_id))
        AND (
          is_org_admin() OR
          (is_mentor() AND experiences.created_by = current_profile_id())
        )
    )
  )
  WITH CHECK (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND EXISTS (
      SELECT 1 FROM experiences
      WHERE experiences.id = experience_competency_links.experience_id
        AND (experiences.organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
        AND (experiences.school_id IS NULL OR can_access_school(experiences.school_id))
        AND (
          is_org_admin() OR
          (is_mentor() AND experiences.created_by = current_profile_id())
        )
    )
  );

-- ============================================================================
-- observations (CORE RECORD)
-- ============================================================================

-- SELECT: Multi-role access
-- principal/admin/registrar: All within org (and school if applicable)
-- mentor: Own observations + observations in experiences they own
-- student: Own observations only
-- guardian: Linked learners' observations
DROP POLICY IF EXISTS "observations_select_multi_role" ON observations;
CREATE POLICY "observations_select_multi_role"
  ON observations FOR SELECT
  USING (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND (
      -- Org admins and registrars see all
      (is_org_admin() OR is_registrar()) OR
      -- Mentors see own observations + observations in experiences they own
      (is_mentor() AND (
        created_by = current_profile_id() OR
        EXISTS (
          SELECT 1 FROM experiences
          WHERE experiences.id = observations.experience_id
            AND experiences.created_by = current_profile_id()
        )
      )) OR
      -- Students see own observations only
      (is_student() AND learner_id = current_student_id()) OR
      -- Guardians see linked learners' observations
      (is_guardian() AND guardian_can_view_student(learner_id))
    )
  );

-- INSERT: mentor only (within org/school)
DROP POLICY IF EXISTS "observations_insert_mentor" ON observations;
CREATE POLICY "observations_insert_mentor"
  ON observations FOR INSERT
  WITH CHECK (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND is_mentor()
    AND created_by = current_profile_id()
  );

-- UPDATE: mentor (own only), principal/admin (all), allow status='withdrawn'
DROP POLICY IF EXISTS "observations_update_mentor_admin" ON observations;
CREATE POLICY "observations_update_mentor_admin"
  ON observations FOR UPDATE
  USING (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND (
      is_org_admin() OR
      (is_mentor() AND created_by = current_profile_id())
    )
  )
  WITH CHECK (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (school_id IS NULL OR can_access_school(school_id))
    AND (
      is_org_admin() OR
      (is_mentor() AND created_by = current_profile_id())
    )
    -- Allow status changes to 'withdrawn' (reversibility preserved)
    AND (
      status = 'withdrawn' OR
      status = 'active'
    )
  );

-- ============================================================================
-- observation_indicator_links
-- ============================================================================

-- SELECT: If user can SELECT parent observation
DROP POLICY IF EXISTS "observation_indicator_links_select" ON observation_indicator_links;
CREATE POLICY "observation_indicator_links_select"
  ON observation_indicator_links FOR SELECT
  USING (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (archived_at IS NULL)
    AND EXISTS (
      SELECT 1 FROM observations
      WHERE observations.id = observation_indicator_links.observation_id
        AND (observations.organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
        AND (observations.school_id IS NULL OR can_access_school(observations.school_id))
        AND (
          (is_org_admin() OR is_registrar()) OR
          (is_mentor() AND (
            observations.created_by = current_profile_id() OR
            EXISTS (
              SELECT 1 FROM experiences
              WHERE experiences.id = observations.experience_id
                AND experiences.created_by = current_profile_id()
            )
          )) OR
          (is_student() AND observations.learner_id = current_student_id()) OR
          (is_guardian() AND guardian_can_view_student(observations.learner_id))
        )
    )
  );

-- INSERT: If user can UPDATE parent observation
DROP POLICY IF EXISTS "observation_indicator_links_insert" ON observation_indicator_links;
CREATE POLICY "observation_indicator_links_insert"
  ON observation_indicator_links FOR INSERT
  WITH CHECK (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND EXISTS (
      SELECT 1 FROM observations
      WHERE observations.id = observation_indicator_links.observation_id
        AND (observations.organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
        AND (observations.school_id IS NULL OR can_access_school(observations.school_id))
        AND (
          is_org_admin() OR
          (is_mentor() AND observations.created_by = current_profile_id())
        )
    )
    AND created_by = current_profile_id()
  );

-- UPDATE: If user can UPDATE parent observation (links are append-only, but allow updates for corrections)
DROP POLICY IF EXISTS "observation_indicator_links_update" ON observation_indicator_links;
CREATE POLICY "observation_indicator_links_update"
  ON observation_indicator_links FOR UPDATE
  USING (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND EXISTS (
      SELECT 1 FROM observations
      WHERE observations.id = observation_indicator_links.observation_id
        AND (observations.organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
        AND (observations.school_id IS NULL OR can_access_school(observations.school_id))
        AND (
          is_org_admin() OR
          (is_mentor() AND observations.created_by = current_profile_id())
        )
    )
  )
  WITH CHECK (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND EXISTS (
      SELECT 1 FROM observations
      WHERE observations.id = observation_indicator_links.observation_id
        AND (observations.organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
        AND (observations.school_id IS NULL OR can_access_school(observations.school_id))
        AND (
          is_org_admin() OR
          (is_mentor() AND observations.created_by = current_profile_id())
        )
    )
  );

-- ============================================================================
-- observation_attachments
-- ============================================================================

-- SELECT: If user can SELECT parent observation
DROP POLICY IF EXISTS "observation_attachments_select" ON observation_attachments;
CREATE POLICY "observation_attachments_select"
  ON observation_attachments FOR SELECT
  USING (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND (archived_at IS NULL)
    AND EXISTS (
      SELECT 1 FROM observations
      WHERE observations.id = observation_attachments.observation_id
        AND (observations.organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
        AND (observations.school_id IS NULL OR can_access_school(observations.school_id))
        AND (
          (is_org_admin() OR is_registrar()) OR
          (is_mentor() AND (
            observations.created_by = current_profile_id() OR
            EXISTS (
              SELECT 1 FROM experiences
              WHERE experiences.id = observations.experience_id
                AND experiences.created_by = current_profile_id()
            )
          )) OR
          (is_student() AND observations.learner_id = current_student_id()) OR
          (is_guardian() AND guardian_can_view_student(observations.learner_id))
        )
    )
  );

-- INSERT: If user can UPDATE parent observation
DROP POLICY IF EXISTS "observation_attachments_insert" ON observation_attachments;
CREATE POLICY "observation_attachments_insert"
  ON observation_attachments FOR INSERT
  WITH CHECK (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND EXISTS (
      SELECT 1 FROM observations
      WHERE observations.id = observation_attachments.observation_id
        AND (observations.organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
        AND (observations.school_id IS NULL OR can_access_school(observations.school_id))
        AND (
          is_org_admin() OR
          (is_mentor() AND observations.created_by = current_profile_id())
        )
    )
    AND created_by = current_profile_id()
  );

-- UPDATE: If user can UPDATE parent observation
DROP POLICY IF EXISTS "observation_attachments_update" ON observation_attachments;
CREATE POLICY "observation_attachments_update"
  ON observation_attachments FOR UPDATE
  USING (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND EXISTS (
      SELECT 1 FROM observations
      WHERE observations.id = observation_attachments.observation_id
        AND (observations.organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
        AND (observations.school_id IS NULL OR can_access_school(observations.school_id))
        AND (
          is_org_admin() OR
          (is_mentor() AND observations.created_by = current_profile_id())
        )
    )
  )
  WITH CHECK (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND EXISTS (
      SELECT 1 FROM observations
      WHERE observations.id = observation_attachments.observation_id
        AND (observations.organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
        AND (observations.school_id IS NULL OR can_access_school(observations.school_id))
        AND (
          is_org_admin() OR
          (is_mentor() AND observations.created_by = current_profile_id())
        )
    )
  );

-- ============================================================================
-- Validation Queries (Manual Testing)
-- ============================================================================

-- These queries can be run manually to validate RLS policies work correctly.
-- Replace placeholders with actual UUIDs from your test data.

/*
-- TEST 1: Mentor cannot update others' observations
-- Expected: Should fail or return 0 rows
SET ROLE authenticated;
SET request.jwt.claim.sub = '<mentor_user_id>';
UPDATE observations
SET notes = 'Unauthorized update'
WHERE created_by != '<mentor_user_id>'
LIMIT 1;

-- TEST 2: Registrar cannot insert anywhere
-- Expected: Should fail
SET ROLE authenticated;
SET request.jwt.claim.sub = '<registrar_user_id>';
INSERT INTO domains (organization_id, name, created_by)
VALUES (current_organization_id(), 'Test Domain', current_profile_id());

-- TEST 3: Student cannot see other learners' observations
-- Expected: Should only return own observations
SET ROLE authenticated;
SET request.jwt.claim.sub = '<student_user_id>';
SELECT COUNT(*) FROM observations
WHERE learner_id != current_student_id();
-- Should return 0 if RLS is working

-- TEST 4: Org isolation blocks cross-org access
-- Expected: Should return 0 rows
SET ROLE authenticated;
SET request.jwt.claim.sub = '<user_from_org_a>';
SELECT COUNT(*) FROM observations
WHERE organization_id != current_organization_id();
-- Should return 0 if RLS is working

-- TEST 5: Mentor can withdraw own observation
-- Expected: Should succeed
SET ROLE authenticated;
SET request.jwt.claim.sub = '<mentor_user_id>';
UPDATE observations
SET status = 'withdrawn',
    withdrawn_at = NOW(),
    withdrawn_reason = 'Test withdrawal'
WHERE created_by = current_profile_id()
LIMIT 1;

-- TEST 6: Principal/Admin can update any observation
-- Expected: Should succeed
SET ROLE authenticated;
SET request.jwt.claim.sub = '<admin_user_id>';
UPDATE observations
SET notes = 'Admin update'
WHERE created_by != current_profile_id()
LIMIT 1;
*/

-- ============================================================================
-- End of RLS Policies for Phase 2 OBS + AMS
-- ============================================================================
