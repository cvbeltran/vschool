/**
 * Feedback Data Access Layer
 * Phase 3: Reflection & Feedback System
 * 
 * All functions respect RLS policies and filter by organization_id unless super admin.
 */

import { supabase } from "@/lib/supabase/client";

// ============================================================================
// Types
// ============================================================================

export interface FeedbackDimension {
  id: string;
  organization_id: string;
  school_id: string | null;
  dimension_name: string;
  description: string | null;
  reflection_prompt_id: string | null;
  display_order: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  archived_at: string | null;
  // Joined fields
  reflection_prompt?: {
    id: string;
    prompt_text: string;
  };
}

export interface StudentFeedback {
  id: string;
  organization_id: string;
  school_id: string | null;
  student_id: string;
  teacher_id: string | null;
  experience_id: string | null;
  experience_type: string | null;
  school_year_id: string | null;
  quarter: string;
  feedback_dimension_id: string;
  feedback_text: string;
  provided_at: string;
  status: "draft" | "completed";
  is_anonymous: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  archived_at: string | null;
  // Joined fields
  feedback_dimension?: FeedbackDimension;
  teacher?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
  };
  experience?: {
    id: string;
    name: string;
  };
  school_year?: {
    id: string;
    year_label: string;
  };
}

export interface TeacherFeedbackView {
  id: string;
  organization_id: string;
  school_id: string | null;
  student_id: string | null; // NULL if is_anonymous = true
  teacher_id: string;
  experience_id: string | null;
  experience_type: string | null;
  school_year_id: string | null;
  quarter: string;
  feedback_dimension_id: string;
  feedback_text: string;
  provided_at: string;
  status: "draft" | "completed";
  is_anonymous: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  archived_at: string | null;
  // Joined fields
  feedback_dimension?: FeedbackDimension;
  experience?: {
    id: string;
    name: string;
  };
}

// ============================================================================
// Feedback Dimension Functions
// ============================================================================

export async function listFeedbackDimensions(
  organizationId: string | null,
  filters?: { isActive?: boolean | null; schoolId?: string | null }
): Promise<FeedbackDimension[]> {
  let query = supabase
    .from("feedback_dimensions")
    .select(`
      *,
      reflection_prompt:reflection_prompts(id, prompt_text)
    `)
    .is("archived_at", null)
    .order("display_order", { ascending: true, nullsFirst: false })
    .order("dimension_name", { ascending: true });

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
    console.error("Error fetching feedback dimensions:", error);
    throw error;
  }

  // Transform nested structure
  return (data || []).map((item: any) => ({
    ...item,
    reflection_prompt: item.reflection_prompt || undefined,
  }));
}

export async function getFeedbackDimension(id: string): Promise<FeedbackDimension | null> {
  const { data, error } = await supabase
    .from("feedback_dimensions")
    .select(`
      *,
      reflection_prompt:reflection_prompts(id, prompt_text)
    `)
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching feedback dimension:", error);
    return null;
  }

  if (data) {
    return {
      ...data,
      reflection_prompt: data.reflection_prompt || undefined,
    };
  }

  return null;
}

export async function createFeedbackDimension(data: {
  organization_id: string;
  school_id?: string | null;
  dimension_name: string;
  description?: string | null;
  reflection_prompt_id?: string | null;
  display_order?: number | null;
  is_active?: boolean;
  created_by?: string;
}): Promise<FeedbackDimension> {
  const { data: result, error } = await supabase
    .from("feedback_dimensions")
    .insert([data])
    .select()
    .single();

  if (error) {
    console.error("Error creating feedback dimension:", error);
    throw error;
  }

  return result;
}

export async function updateFeedbackDimension(
  id: string,
  data: {
    dimension_name?: string;
    description?: string | null;
    reflection_prompt_id?: string | null;
    display_order?: number | null;
    is_active?: boolean;
    updated_by?: string;
  }
): Promise<FeedbackDimension> {
  const { data: result, error } = await supabase
    .from("feedback_dimensions")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating feedback dimension:", error);
    throw error;
  }

  return result;
}

export async function archiveFeedbackDimension(id: string): Promise<void> {
  const { error } = await supabase
    .from("feedback_dimensions")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.error("Error archiving feedback dimension:", error);
    throw error;
  }
}

// ============================================================================
// Student Feedback Functions
// ============================================================================

export async function listStudentFeedback(
  organizationId: string | null,
  filters?: {
    studentId?: string | null;
    status?: "draft" | "completed" | null;
    quarter?: string | null;
    teacherId?: string | null;
    experienceId?: string | null;
    schoolId?: string | null;
  }
): Promise<StudentFeedback[]> {
  let query = supabase
    .from("student_feedback")
    .select(`
      *,
      feedback_dimension:feedback_dimensions(*),
      experience:experiences(id, name),
      school_year:school_years(id, year_label)
    `)
    .is("archived_at", null)
    .order("provided_at", { ascending: false });

  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  if (filters?.studentId) {
    query = query.eq("student_id", filters.studentId);
  }

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  if (filters?.quarter) {
    query = query.eq("quarter", filters.quarter);
  }

  if (filters?.teacherId) {
    query = query.eq("teacher_id", filters.teacherId);
  }

  if (filters?.experienceId) {
    query = query.eq("experience_id", filters.experienceId);
  }

  if (filters?.schoolId) {
    query = query.eq("school_id", filters.schoolId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching student feedback:", error);
    throw error;
  }

  // Fetch staff data for teachers
  const teacherIds = [...new Set((data || []).map((item: any) => item.teacher_id).filter(Boolean))];
  let teachersMap: Record<string, { id: string; first_name: string | null; last_name: string | null }> = {};
  
  if (teacherIds.length > 0) {
    const { data: staffData } = await supabase
      .from("staff")
      .select("user_id, first_name, last_name")
      .in("user_id", teacherIds);
    
    if (staffData) {
      staffData.forEach((staff: any) => {
        teachersMap[staff.user_id] = {
          id: staff.user_id,
          first_name: staff.first_name,
          last_name: staff.last_name,
        };
      });
    }
  }

  // Transform nested structure and merge teacher data
  return (data || []).map((item: any) => ({
    ...item,
    feedback_dimension: item.feedback_dimension || undefined,
    teacher: item.teacher_id ? teachersMap[item.teacher_id] || undefined : undefined,
    experience: item.experience || undefined,
    school_year: item.school_year || undefined,
  }));
}

export async function getStudentFeedback(id: string): Promise<StudentFeedback | null> {
  const { data, error } = await supabase
    .from("student_feedback")
    .select(`
      *,
      feedback_dimension:feedback_dimensions(*),
      experience:experiences(id, name),
      school_year:school_years(id, year_label)
    `)
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching student feedback:", error);
    return null;
  }

  if (data) {
    // Fetch staff data for teacher if teacher_id exists
    let teacher = undefined;
    if (data.teacher_id) {
      const { data: staffData } = await supabase
        .from("staff")
        .select("user_id, first_name, last_name")
        .eq("user_id", data.teacher_id)
        .single();
      
      if (staffData) {
        teacher = {
          id: staffData.user_id,
          first_name: staffData.first_name,
          last_name: staffData.last_name,
        };
      }
    }

    return {
      ...data,
      feedback_dimension: data.feedback_dimension || undefined,
      teacher: teacher,
      experience: data.experience || undefined,
      school_year: data.school_year || undefined,
    };
  }

  return null;
}

export async function createStudentFeedback(data: {
  organization_id: string;
  school_id?: string | null;
  student_id: string;
  teacher_id?: string | null;
  experience_id?: string | null;
  experience_type?: string | null;
  school_year_id?: string | null;
  quarter: string;
  feedback_dimension_id: string;
  feedback_text: string;
  provided_at?: string;
  status?: "draft" | "completed";
  is_anonymous?: boolean;
  created_by?: string;
}): Promise<StudentFeedback> {
  const { data: result, error } = await supabase
    .from("student_feedback")
    .insert([{
      ...data,
      provided_at: data.provided_at || new Date().toISOString(),
      status: data.status || "draft",
      is_anonymous: data.is_anonymous || false,
    }])
    .select()
    .single();

  if (error) {
    console.error("Error creating student feedback:", error);
    throw error;
  }

  return result;
}

export async function updateStudentFeedback(
  id: string,
  data: {
    teacher_id?: string | null;
    experience_id?: string | null;
    experience_type?: string | null;
    school_year_id?: string | null;
    quarter?: string;
    feedback_dimension_id?: string;
    feedback_text?: string;
    provided_at?: string;
    status?: "draft" | "completed";
    is_anonymous?: boolean;
    updated_by?: string;
  }
): Promise<StudentFeedback> {
  const { data: result, error } = await supabase
    .from("student_feedback")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating student feedback:", error);
    throw error;
  }

  return result;
}

export async function archiveStudentFeedback(id: string): Promise<void> {
  const { error } = await supabase
    .from("student_feedback")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.error("Error archiving student feedback:", error);
    throw error;
  }
}

// ============================================================================
// Teacher Feedback View Functions (from v_student_feedback_teacher_view)
// ============================================================================

export async function listTeacherFeedbackFromView(
  organizationId: string | null,
  filters?: {
    quarter?: string | null;
    experienceType?: string | null;
    experienceId?: string | null;
    feedbackDimensionId?: string | null;
    schoolId?: string | null;
  }
): Promise<TeacherFeedbackView[]> {
  let query = supabase
    .from("v_student_feedback_teacher_view")
    .select(`
      *,
      feedback_dimension:feedback_dimensions(*),
      experience:experiences(id, name)
    `)
    .order("provided_at", { ascending: false });

  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  if (filters?.quarter) {
    query = query.eq("quarter", filters.quarter);
  }

  if (filters?.experienceType) {
    query = query.eq("experience_type", filters.experienceType);
  }

  if (filters?.experienceId) {
    query = query.eq("experience_id", filters.experienceId);
  }

  if (filters?.feedbackDimensionId) {
    query = query.eq("feedback_dimension_id", filters.feedbackDimensionId);
  }

  if (filters?.schoolId) {
    query = query.eq("school_id", filters.schoolId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching teacher feedback view:", error);
    throw error;
  }

  // Transform nested structure
  return (data || []).map((item: any) => ({
    ...item,
    feedback_dimension: item.feedback_dimension || undefined,
    experience: item.experience || undefined,
  }));
}
