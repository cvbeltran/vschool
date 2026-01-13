/**
 * Phase 4 Grade Policies Data Access Layer
 * Grade Translation & Reporting Layer
 * 
 * All functions respect RLS policies and filter by organization_id unless super admin.
 */

import { supabase } from "@/lib/supabase/client";

// ============================================================================
// Types
// ============================================================================

export interface GradePolicy {
  id: string;
  organization_id: string;
  school_id: string | null;
  program_id: string | null;
  policy_name: string;
  policy_type: "letter_grade" | "descriptor" | "pass_fail";
  description: string | null;
  is_active: boolean;
  effective_start_date: string | null;
  effective_end_date: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  archived_at: string | null;
}

export interface GradingScale {
  id: string;
  organization_id: string;
  grade_policy_id: string;
  grade_value: string;
  grade_label: string | null;
  description: string | null;
  is_passing: boolean | null;
  display_order: number | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  archived_at: string | null;
}

// ============================================================================
// Grade Policy Functions
// ============================================================================

export async function listGradePolicies(
  organizationId: string | null,
  filters?: {
    schoolId?: string | null;
    programId?: string | null;
    isActive?: boolean | null;
  }
): Promise<GradePolicy[]> {
  let query = supabase
    .from("grade_policies")
    .select("*")
    .is("archived_at", null)
    .order("policy_name", { ascending: true });

  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  if (filters?.schoolId) {
    query = query.eq("school_id", filters.schoolId);
  }

  if (filters?.programId) {
    query = query.eq("program_id", filters.programId);
  }

  if (filters?.isActive !== undefined && filters.isActive !== null) {
    query = query.eq("is_active", filters.isActive);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching grade policies:", error);
    throw error;
  }

  return data || [];
}

export async function getGradePolicy(id: string): Promise<GradePolicy | null> {
  const { data, error } = await supabase
    .from("grade_policies")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching grade policy:", error);
    return null;
  }

  return data;
}

export async function createGradePolicy(data: {
  organization_id: string;
  school_id?: string | null;
  program_id?: string | null;
  policy_name: string;
  policy_type: "letter_grade" | "descriptor" | "pass_fail";
  description?: string | null;
  is_active?: boolean;
  effective_start_date?: string | null;
  effective_end_date?: string | null;
  created_by?: string;
}): Promise<GradePolicy> {
  const { data: result, error } = await supabase
    .from("grade_policies")
    .insert([data])
    .select()
    .single();

  if (error) {
    console.error("Error creating grade policy:", error);
    throw error;
  }

  return result;
}

export async function updateGradePolicy(
  id: string,
  data: {
    policy_name?: string;
    policy_type?: "letter_grade" | "descriptor" | "pass_fail";
    description?: string | null;
    is_active?: boolean;
    effective_start_date?: string | null;
    effective_end_date?: string | null;
    school_id?: string | null;
    program_id?: string | null;
    updated_by?: string;
  }
): Promise<GradePolicy> {
  const { data: result, error } = await supabase
    .from("grade_policies")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating grade policy:", error);
    throw error;
  }

  return result;
}

export async function archiveGradePolicy(id: string): Promise<void> {
  const { error } = await supabase
    .from("grade_policies")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.error("Error archiving grade policy:", error);
    throw error;
  }
}

// ============================================================================
// Grading Scale Functions
// ============================================================================

export async function listGradingScales(
  policyId: string,
  organizationId: string | null
): Promise<GradingScale[]> {
  let query = supabase
    .from("grading_scales")
    .select("*")
    .eq("grade_policy_id", policyId)
    .is("archived_at", null)
    .order("display_order", { ascending: true, nullsFirst: true })
    .order("grade_value", { ascending: true });

  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching grading scales:", error);
    throw error;
  }

  return data || [];
}

export async function getGradingScale(id: string): Promise<GradingScale | null> {
  const { data, error } = await supabase
    .from("grading_scales")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching grading scale:", error);
    return null;
  }

  return data;
}

export async function createGradingScale(data: {
  organization_id: string;
  grade_policy_id: string;
  grade_value: string;
  grade_label?: string | null;
  description?: string | null;
  is_passing?: boolean | null;
  display_order?: number | null;
  created_by?: string;
}): Promise<GradingScale> {
  const { data: result, error } = await supabase
    .from("grading_scales")
    .insert([data])
    .select()
    .single();

  if (error) {
    console.error("Error creating grading scale:", error);
    throw error;
  }

  return result;
}

export async function updateGradingScale(
  id: string,
  data: {
    grade_value?: string;
    grade_label?: string | null;
    description?: string | null;
    is_passing?: boolean | null;
    display_order?: number | null;
    updated_by?: string;
  }
): Promise<GradingScale> {
  const { data: result, error } = await supabase
    .from("grading_scales")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating grading scale:", error);
    throw error;
  }

  return result;
}

export async function archiveGradingScale(id: string): Promise<void> {
  const { error } = await supabase
    .from("grading_scales")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.error("Error archiving grading scale:", error);
    throw error;
  }
}
