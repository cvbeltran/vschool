-- Migration: Create Supabase Storage bucket for Phase 5 exports
-- Created: 2024
-- Description: Creates 'exports' storage bucket with access policies
-- Files stored by organization_id/school_id/export_job_id
-- Access rules: only admin/principal/registrar in same org (and school scope if applicable) can download

-- ============================================================================
-- Storage Bucket Creation
-- ============================================================================

-- Create the exports bucket (if it doesn't exist)
-- Note: This requires Supabase Storage API or manual creation via dashboard
-- SQL cannot directly create buckets, but we document the bucket configuration here

-- Bucket Configuration:
--   Name: exports
--   Public: false (private bucket)
--   File size limit: 50MB (configurable)
--   Allowed MIME types: application/pdf, text/csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet

-- ============================================================================
-- Storage Policies (RLS for Storage)
-- ============================================================================
--
-- IMPORTANT: Storage policies require superuser privileges to create via SQL.
-- They must be created through the Supabase Dashboard (Storage > Policies).
-- 
-- The policy definitions are provided below for reference. Copy them into
-- the Dashboard when creating policies.
--
-- Steps to create policies via Dashboard:
-- 1. Go to Storage > Policies in Supabase Dashboard
-- 2. Select the 'exports' bucket
-- 3. Click "New Policy" for each policy below
-- 4. Copy the policy definition into the SQL editor
-- 5. Save the policy
--
-- ============================================================================
-- Policy 1: Allow authenticated users to upload files (admin/principal/registrar only)
-- ============================================================================
-- Policy Name: exports_upload_org_admin_registrar
-- Policy Type: INSERT
-- Target Roles: authenticated
--
-- Policy Definition:
/*
CREATE POLICY "exports_upload_org_admin_registrar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'exports'
  AND (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND (
          role IN ('admin', 'principal', 'registrar')
          OR is_super_admin = TRUE
        )
        AND organization_id::TEXT = (string_to_array(name, '/'))[1]
    )
  )
);
*/

-- ============================================================================
-- Policy 2: Allow authenticated users to read files (admin/principal/registrar only)
-- ============================================================================
-- Policy Name: exports_read_org_admin_registrar
-- Policy Type: SELECT
-- Target Roles: authenticated
--
-- Policy Definition:
/*
CREATE POLICY "exports_read_org_admin_registrar"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'exports'
  AND (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND (
          role IN ('admin', 'principal', 'registrar')
          OR is_super_admin = TRUE
        )
        AND organization_id::TEXT = (string_to_array(name, '/'))[1]
    )
  )
);
*/

-- ============================================================================
-- Policy 3: Allow service role full access (for Edge Function)
-- ============================================================================
-- Policy Name: exports_service_role_full_access
-- Policy Type: ALL (SELECT, INSERT, UPDATE, DELETE)
-- Target Roles: service_role
--
-- Policy Definition:
/*
CREATE POLICY "exports_service_role_full_access"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'exports')
WITH CHECK (bucket_id = 'exports');
*/

-- Policy: Disallow public access (bucket is private)
-- No policy needed - bucket is private by default

-- Policy: Disallow delete (exports are append-only audit trail)
-- Users cannot delete export files directly
-- Only service role can delete (for cleanup/maintenance if needed)

-- ============================================================================
-- Helper Function: Extract organization_id from storage path
-- ============================================================================

-- Helper function to extract organization_id from storage path
-- Path format: {organization_id}/{school_id}/{export_job_id}/filename
CREATE OR REPLACE FUNCTION storage_path_organization_id(path TEXT)
RETURNS UUID
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  path_parts TEXT[];
BEGIN
  -- Split path by '/' and get first part (organization_id)
  path_parts := string_to_array(trim(both '/' from path), '/');
  IF array_length(path_parts, 1) >= 1 THEN
    RETURN path_parts[1]::UUID;
  END IF;
  RETURN NULL;
END;
$$;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON FUNCTION storage_path_organization_id IS 
'Extracts organization_id from storage path. Path format: {organization_id}/{school_id}/{export_job_id}/filename';

-- ============================================================================
-- Manual Steps Required
-- ============================================================================

-- STEP 1: Create the Storage Bucket
-- ============================================================================
-- You must create the bucket manually via one of these methods:
--
-- Option A: Supabase Dashboard (Recommended)
--   1. Go to Storage > New Bucket
--   2. Name: exports
--   3. Public: false (private)
--   4. File size limit: 50MB (or as needed)
--   5. Allowed MIME types: application/pdf, text/csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
--
-- Option B: Supabase CLI
--   supabase storage create exports --public false
--
-- Option C: Supabase Management API
--   POST /storage/v1/bucket
--   {
--     "name": "exports",
--     "public": false,
--     "file_size_limit": 52428800,
--     "allowed_mime_types": ["application/pdf", "text/csv", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]
--   }
--
-- ============================================================================
-- STEP 2: Create Storage Policies via Dashboard
-- ============================================================================
-- IMPORTANT: Storage policies CANNOT be created via regular SQL (requires superuser).
-- They MUST be created through the Supabase Dashboard:
--
--   1. Go to Storage > Policies in Supabase Dashboard
--   2. Select the 'exports' bucket
--   3. Click "New Policy" for each of the 3 policies defined above (in comments)
--   4. Copy the policy definition from the comments above into the SQL editor
--   5. Set the appropriate policy type (INSERT, SELECT, or ALL)
--   6. Set the target role (authenticated or service_role)
--   7. Save the policy
--
-- ============================================================================
-- STEP 3: Run This SQL File
-- ============================================================================
-- After creating the bucket and policies, run this SQL file to create the
-- helper function (storage_path_organization_id) which can be created normally.
