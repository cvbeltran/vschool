-- Migration: Add Row Level Security (RLS) policies for multi-tenant isolation
-- Created: 2024
-- Description: Creates RLS policies for all tenant-scoped tables to enforce organization isolation
-- Super admins can bypass RLS checks and access all data

-- Enable RLS on all tenant-scoped tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE admissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_taxonomy_items ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is super admin
CREATE OR REPLACE FUNCTION is_super_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = user_id AND is_super_admin = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get user's organization_id
CREATE OR REPLACE FUNCTION get_user_organization_id(user_id UUID)
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT organization_id FROM profiles WHERE id = user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies for profiles table
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id OR is_super_admin(auth.uid()));

CREATE POLICY "Users can view profiles in their organization"
  ON profiles FOR SELECT
  USING (
    organization_id = get_user_organization_id(auth.uid()) OR
    is_super_admin(auth.uid())
  );

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id OR is_super_admin(auth.uid()));

-- RLS Policies for organizations table
CREATE POLICY "Users can view their own organization"
  ON organizations FOR SELECT
  USING (
    id = get_user_organization_id(auth.uid()) OR
    is_super_admin(auth.uid())
  );

CREATE POLICY "Admins can update their organization"
  ON organizations FOR UPDATE
  USING (
    id = get_user_organization_id(auth.uid()) OR
    is_super_admin(auth.uid())
  );

-- RLS Policies for schools table
CREATE POLICY "Users can view schools in their organization"
  ON schools FOR SELECT
  USING (
    organization_id = get_user_organization_id(auth.uid()) OR
    is_super_admin(auth.uid())
  );

CREATE POLICY "Users can insert schools in their organization"
  ON schools FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization_id(auth.uid()) OR
    is_super_admin(auth.uid())
  );

CREATE POLICY "Users can update schools in their organization"
  ON schools FOR UPDATE
  USING (
    organization_id = get_user_organization_id(auth.uid()) OR
    is_super_admin(auth.uid())
  );

CREATE POLICY "Users can delete schools in their organization"
  ON schools FOR DELETE
  USING (
    organization_id = get_user_organization_id(auth.uid()) OR
    is_super_admin(auth.uid())
  );

-- RLS Policies for students table
CREATE POLICY "Users can view students in their organization"
  ON students FOR SELECT
  USING (
    organization_id = get_user_organization_id(auth.uid()) OR
    is_super_admin(auth.uid())
  );

CREATE POLICY "Users can insert students in their organization"
  ON students FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization_id(auth.uid()) OR
    is_super_admin(auth.uid())
  );

CREATE POLICY "Users can update students in their organization"
  ON students FOR UPDATE
  USING (
    organization_id = get_user_organization_id(auth.uid()) OR
    is_super_admin(auth.uid())
  );

CREATE POLICY "Users can delete students in their organization"
  ON students FOR DELETE
  USING (
    organization_id = get_user_organization_id(auth.uid()) OR
    is_super_admin(auth.uid())
  );

-- RLS Policies for admissions table
CREATE POLICY "Users can view admissions in their organization"
  ON admissions FOR SELECT
  USING (
    organization_id = get_user_organization_id(auth.uid()) OR
    is_super_admin(auth.uid())
  );

CREATE POLICY "Users can insert admissions in their organization"
  ON admissions FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization_id(auth.uid()) OR
    is_super_admin(auth.uid())
  );

CREATE POLICY "Users can update admissions in their organization"
  ON admissions FOR UPDATE
  USING (
    organization_id = get_user_organization_id(auth.uid()) OR
    is_super_admin(auth.uid())
  );

CREATE POLICY "Users can delete admissions in their organization"
  ON admissions FOR DELETE
  USING (
    organization_id = get_user_organization_id(auth.uid()) OR
    is_super_admin(auth.uid())
  );

-- RLS Policies for staff table
CREATE POLICY "Users can view staff in their organization"
  ON staff FOR SELECT
  USING (
    organization_id = get_user_organization_id(auth.uid()) OR
    is_super_admin(auth.uid())
  );

CREATE POLICY "Users can insert staff in their organization"
  ON staff FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization_id(auth.uid()) OR
    is_super_admin(auth.uid())
  );

CREATE POLICY "Users can update staff in their organization"
  ON staff FOR UPDATE
  USING (
    organization_id = get_user_organization_id(auth.uid()) OR
    is_super_admin(auth.uid())
  );

CREATE POLICY "Users can delete staff in their organization"
  ON staff FOR DELETE
  USING (
    organization_id = get_user_organization_id(auth.uid()) OR
    is_super_admin(auth.uid())
  );

-- RLS Policies for school_years table
CREATE POLICY "Users can view school_years in their organization"
  ON school_years FOR SELECT
  USING (
    organization_id = get_user_organization_id(auth.uid()) OR
    is_super_admin(auth.uid())
  );

CREATE POLICY "Users can insert school_years in their organization"
  ON school_years FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization_id(auth.uid()) OR
    is_super_admin(auth.uid())
  );

CREATE POLICY "Users can update school_years in their organization"
  ON school_years FOR UPDATE
  USING (
    organization_id = get_user_organization_id(auth.uid()) OR
    is_super_admin(auth.uid())
  );

CREATE POLICY "Users can delete school_years in their organization"
  ON school_years FOR DELETE
  USING (
    organization_id = get_user_organization_id(auth.uid()) OR
    is_super_admin(auth.uid())
  );

-- RLS Policies for programs table
CREATE POLICY "Users can view programs in their organization"
  ON programs FOR SELECT
  USING (
    organization_id = get_user_organization_id(auth.uid()) OR
    is_super_admin(auth.uid())
  );

CREATE POLICY "Users can insert programs in their organization"
  ON programs FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization_id(auth.uid()) OR
    is_super_admin(auth.uid())
  );

CREATE POLICY "Users can update programs in their organization"
  ON programs FOR UPDATE
  USING (
    organization_id = get_user_organization_id(auth.uid()) OR
    is_super_admin(auth.uid())
  );

CREATE POLICY "Users can delete programs in their organization"
  ON programs FOR DELETE
  USING (
    organization_id = get_user_organization_id(auth.uid()) OR
    is_super_admin(auth.uid())
  );

-- RLS Policies for sections table
CREATE POLICY "Users can view sections in their organization"
  ON sections FOR SELECT
  USING (
    organization_id = get_user_organization_id(auth.uid()) OR
    is_super_admin(auth.uid())
  );

CREATE POLICY "Users can insert sections in their organization"
  ON sections FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization_id(auth.uid()) OR
    is_super_admin(auth.uid())
  );

CREATE POLICY "Users can update sections in their organization"
  ON sections FOR UPDATE
  USING (
    organization_id = get_user_organization_id(auth.uid()) OR
    is_super_admin(auth.uid())
  );

CREATE POLICY "Users can delete sections in their organization"
  ON sections FOR DELETE
  USING (
    organization_id = get_user_organization_id(auth.uid()) OR
    is_super_admin(auth.uid())
  );

-- RLS Policies for batches table
CREATE POLICY "Users can view batches in their organization"
  ON batches FOR SELECT
  USING (
    organization_id = get_user_organization_id(auth.uid()) OR
    is_super_admin(auth.uid())
  );

CREATE POLICY "Users can insert batches in their organization"
  ON batches FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization_id(auth.uid()) OR
    is_super_admin(auth.uid())
  );

CREATE POLICY "Users can update batches in their organization"
  ON batches FOR UPDATE
  USING (
    organization_id = get_user_organization_id(auth.uid()) OR
    is_super_admin(auth.uid())
  );

CREATE POLICY "Users can delete batches in their organization"
  ON batches FOR DELETE
  USING (
    organization_id = get_user_organization_id(auth.uid()) OR
    is_super_admin(auth.uid())
  );

-- RLS Policies for guardians table
CREATE POLICY "Users can view guardians in their organization"
  ON guardians FOR SELECT
  USING (
    organization_id = get_user_organization_id(auth.uid()) OR
    is_super_admin(auth.uid())
  );

CREATE POLICY "Users can insert guardians in their organization"
  ON guardians FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization_id(auth.uid()) OR
    is_super_admin(auth.uid())
  );

CREATE POLICY "Users can update guardians in their organization"
  ON guardians FOR UPDATE
  USING (
    organization_id = get_user_organization_id(auth.uid()) OR
    is_super_admin(auth.uid())
  );

CREATE POLICY "Users can delete guardians in their organization"
  ON guardians FOR DELETE
  USING (
    organization_id = get_user_organization_id(auth.uid()) OR
    is_super_admin(auth.uid())
  );

-- RLS Policies for student_guardians table
CREATE POLICY "Users can view student_guardians in their organization"
  ON student_guardians FOR SELECT
  USING (
    organization_id = get_user_organization_id(auth.uid()) OR
    is_super_admin(auth.uid())
  );

CREATE POLICY "Users can insert student_guardians in their organization"
  ON student_guardians FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization_id(auth.uid()) OR
    is_super_admin(auth.uid())
  );

CREATE POLICY "Users can update student_guardians in their organization"
  ON student_guardians FOR UPDATE
  USING (
    organization_id = get_user_organization_id(auth.uid()) OR
    is_super_admin(auth.uid())
  );

CREATE POLICY "Users can delete student_guardians in their organization"
  ON student_guardians FOR DELETE
  USING (
    organization_id = get_user_organization_id(auth.uid()) OR
    is_super_admin(auth.uid())
  );

-- RLS Policies for organization_taxonomy_items table
CREATE POLICY "Users can view organization_taxonomy_items in their organization"
  ON organization_taxonomy_items FOR SELECT
  USING (
    organization_id = get_user_organization_id(auth.uid()) OR
    is_super_admin(auth.uid())
  );

CREATE POLICY "Users can insert organization_taxonomy_items in their organization"
  ON organization_taxonomy_items FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization_id(auth.uid()) OR
    is_super_admin(auth.uid())
  );

CREATE POLICY "Users can update organization_taxonomy_items in their organization"
  ON organization_taxonomy_items FOR UPDATE
  USING (
    organization_id = get_user_organization_id(auth.uid()) OR
    is_super_admin(auth.uid())
  );

CREATE POLICY "Users can delete organization_taxonomy_items in their organization"
  ON organization_taxonomy_items FOR DELETE
  USING (
    organization_id = get_user_organization_id(auth.uid()) OR
    is_super_admin(auth.uid())
  );
