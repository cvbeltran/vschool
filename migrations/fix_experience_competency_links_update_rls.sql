-- Migration: Fix experience_competency_links UPDATE RLS policy
-- Purpose: Use SECURITY DEFINER function to check experience access, bypassing RLS conflicts
-- Date: 2024

-- The UPDATE policy's EXISTS clause was querying experiences table which has its own RLS
-- This caused RLS conflicts. Created a helper function that bypasses RLS to check experience access.

-- Helper function to check if user can update an experience (bypasses experiences RLS)
CREATE OR REPLACE FUNCTION can_update_experience_link(experience_id_param UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Super admin can update all
  IF is_super_admin(current_profile_id()) THEN
    RETURN TRUE;
  END IF;
  
  -- Check if experience exists and user has access
  RETURN EXISTS (
    SELECT 1 FROM experiences
    WHERE id = experience_id_param
      AND organization_id = current_organization_id()
      AND (school_id IS NULL OR can_access_school(school_id))
      AND archived_at IS NULL
      AND (
        is_org_admin() OR
        (is_mentor() AND created_by = current_profile_id())
      )
  );
END;
$$;

-- Update the policy to use the helper function
DROP POLICY IF EXISTS "experience_competency_links_update" ON experience_competency_links;
CREATE POLICY "experience_competency_links_update"
  ON experience_competency_links FOR UPDATE
  USING (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND can_update_experience_link(experience_competency_links.experience_id)
  )
  WITH CHECK (
    (organization_id = current_organization_id() OR is_super_admin(current_profile_id()))
    AND can_update_experience_link(experience_competency_links.experience_id)
  );
