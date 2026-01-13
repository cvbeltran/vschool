/**
 * Reflection Data Access Layer
 * Phase 3: Reflection & Feedback System
 * 
 * All functions respect RLS policies and filter by organization_id unless super admin.
 */

import { supabase } from "@/lib/supabase/client";

// ============================================================================
// Types
// ============================================================================

export interface ReflectionPrompt {
  id: string;
  organization_id: string;
  school_id: string | null;
  prompt_text: string;
  description: string | null;
  display_order: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  archived_at: string | null;
}

export interface TeacherReflection {
  id: string;
  organization_id: string;
  school_id: string | null;
  teacher_id: string;
  reflection_prompt_id: string | null;
  experience_id: string | null;
  school_year_id: string | null;
  quarter: string | null;
  competency_id: string | null;
  reflection_text: string;
  reflected_at: string;
  status: "draft" | "completed";
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  archived_at: string | null;
  // Joined fields
  reflection_prompt?: ReflectionPrompt;
  experience?: {
    id: string;
    name: string;
  };
  school_year?: {
    id: string;
    year_label: string;
  };
  competency?: {
    id: string;
    name: string;
  };
}

// ============================================================================
// Reflection Prompt Functions
// ============================================================================

export async function listReflectionPrompts(
  organizationId: string | null,
  filters?: { isActive?: boolean | null; schoolId?: string | null }
): Promise<ReflectionPrompt[]> {
  let query = supabase
    .from("reflection_prompts")
    .select("*")
    .is("archived_at", null)
    .order("display_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  if (filters?.isActive !== undefined && filters.isActive !== null) {
    query = query.eq("is_active", filters.isActive);
  }

  if (filters?.schoolId) {
    query = query.eq("school_id", filters.schoolId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching reflection prompts:", error);
    throw error;
  }

  return data || [];
}

export async function getReflectionPrompt(id: string): Promise<ReflectionPrompt | null> {
  const { data, error } = await supabase
    .from("reflection_prompts")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching reflection prompt:", error);
    return null;
  }

  return data;
}

export async function createReflectionPrompt(data: {
  organization_id: string;
  school_id?: string | null;
  prompt_text: string;
  description?: string | null;
  display_order?: number | null;
  is_active?: boolean;
  created_by?: string;
}): Promise<ReflectionPrompt> {
  const { data: result, error } = await supabase
    .from("reflection_prompts")
    .insert([data])
    .select()
    .single();

  if (error) {
    console.error("Error creating reflection prompt:", error);
    throw error;
  }

  return result;
}

export async function updateReflectionPrompt(
  id: string,
  data: {
    prompt_text?: string;
    description?: string | null;
    display_order?: number | null;
    is_active?: boolean;
    updated_by?: string;
  }
): Promise<ReflectionPrompt> {
  const { data: result, error } = await supabase
    .from("reflection_prompts")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating reflection prompt:", error);
    throw error;
  }

  return result;
}

export async function archiveReflectionPrompt(id: string): Promise<void> {
  const { error } = await supabase
    .from("reflection_prompts")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.error("Error archiving reflection prompt:", error);
    throw error;
  }
}

// ============================================================================
// Teacher Reflection Functions
// ============================================================================

export async function listTeacherReflections(
  organizationId: string | null,
  filters?: {
    teacherId?: string | null;
    status?: "draft" | "completed" | null;
    schoolYearId?: string | null;
    quarter?: string | null;
    experienceId?: string | null;
    schoolId?: string | null;
  }
): Promise<TeacherReflection[]> {
  let query = supabase
    .from("teacher_reflections")
    .select(`
      *,
      reflection_prompt:reflection_prompts(*),
      experience:experiences(id, name),
      school_year:school_years(id, year_label),
      competency:competencies(id, name)
    `)
    .is("archived_at", null)
    .order("reflected_at", { ascending: false });

  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  if (filters?.teacherId) {
    query = query.eq("teacher_id", filters.teacherId);
  }

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  if (filters?.schoolYearId) {
    query = query.eq("school_year_id", filters.schoolYearId);
  }

  if (filters?.quarter) {
    query = query.eq("quarter", filters.quarter);
  }

  if (filters?.experienceId) {
    query = query.eq("experience_id", filters.experienceId);
  }

  if (filters?.schoolId) {
    query = query.eq("school_id", filters.schoolId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching teacher reflections:", error);
    throw error;
  }

  // Transform nested structure
  return (data || []).map((item: any) => ({
    ...item,
    reflection_prompt: item.reflection_prompt || undefined,
    experience: item.experience || undefined,
    school_year: item.school_year || undefined,
    competency: item.competency || undefined,
  }));
}

export async function getTeacherReflection(id: string): Promise<TeacherReflection | null> {
  const { data, error } = await supabase
    .from("teacher_reflections")
    .select(`
      *,
      reflection_prompt:reflection_prompts(*),
      experience:experiences(id, name),
      school_year:school_years(id, year_label),
      competency:competencies(id, name)
    `)
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching teacher reflection:", error);
    return null;
  }

  if (data) {
    return {
      ...data,
      reflection_prompt: data.reflection_prompt || undefined,
      experience: data.experience || undefined,
      school_year: data.school_year || undefined,
      competency: data.competency || undefined,
    };
  }

  return null;
}

export async function createTeacherReflection(data: {
  organization_id: string;
  school_id?: string | null;
  teacher_id: string;
  reflection_prompt_id?: string | null;
  experience_id?: string | null;
  school_year_id?: string | null;
  quarter?: string | null;
  competency_id?: string | null;
  reflection_text: string;
  reflected_at?: string;
  status?: "draft" | "completed";
  created_by?: string;
}): Promise<TeacherReflection> {
  const { data: result, error } = await supabase
    .from("teacher_reflections")
    .insert([{
      ...data,
      reflected_at: data.reflected_at || new Date().toISOString(),
      status: data.status || "draft",
    }])
    .select()
    .single();

  if (error) {
    console.error("Error creating teacher reflection:", error);
    throw error;
  }

  return result;
}

export async function updateTeacherReflection(
  id: string,
  data: {
    reflection_prompt_id?: string | null;
    experience_id?: string | null;
    school_year_id?: string | null;
    quarter?: string | null;
    competency_id?: string | null;
    reflection_text?: string;
    reflected_at?: string;
    status?: "draft" | "completed";
    updated_by?: string;
  }
): Promise<TeacherReflection> {
  const { data: result, error } = await supabase
    .from("teacher_reflections")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating teacher reflection:", error);
    throw error;
  }

  return result;
}

export async function archiveTeacherReflection(id: string): Promise<void> {
  const { error } = await supabase
    .from("teacher_reflections")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.error("Error archiving teacher reflection:", error);
    throw error;
  }
}
