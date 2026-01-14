/**
 * Phase 4 Student Grades Data Access Layer
 * Grade Translation & Reporting Layer
 * 
 * All functions respect RLS policies and filter by organization_id unless super admin.
 * Grades are manually created and require human confirmation.
 */

import { supabase } from "@/lib/supabase/client";

// ============================================================================
// Types
// ============================================================================

export interface StudentGrade {
  id: string;
  organization_id: string;
  school_id: string | null;
  student_id: string;
  program_id: string | null;
  section_id: string | null;
  school_year_id: string;
  term_period: string | null;
  grade_policy_id: string;
  grading_scale_id: string;
  status: "draft" | "pending_confirmation" | "confirmed" | "overridden";
  confirmed_at: string | null;
  confirmed_by: string | null;
  override_reason: string | null;
  override_by: string | null;
  override_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  archived_at: string | null;
  // Joined fields
  student?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    student_number: string | null;
  };
  grade_policy?: {
    id: string;
    policy_name: string;
    policy_type: string;
  };
  grading_scale?: {
    id: string;
    grade_value: string;
    grade_label: string | null;
  };
  school_year?: {
    id: string;
    year_label: string;
  };
}

export interface GradeEntry {
  id: string;
  organization_id: string;
  student_grade_id: string;
  observation_id: string | null;
  competency_id: string | null;
  domain_id: string | null;
  entry_type: "observation_reference" | "competency_summary" | "domain_summary" | "manual_note";
  entry_text: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  archived_at: string | null;
  // Joined fields (read-only references to Phase 2)
  observation?: {
    id: string;
    notes: string | null;
    observed_at: string;
  };
  competency?: {
    id: string;
    name: string;
  };
  domain?: {
    id: string;
    name: string;
  };
}

export interface GradeJustification {
  id: string;
  organization_id: string;
  student_grade_id: string;
  justification_type: "initial_assignment" | "confirmation" | "override" | "correction" | "appeal";
  justification_text: string;
  previous_grade_id: string | null;
  new_grade_id: string | null;
  created_at: string;
  created_by: string | null;
}

// ============================================================================
// Student Grade Functions
// ============================================================================

export async function listStudentGrades(
  organizationId: string | null,
  filters?: {
    schoolYearId?: string | null;
    termPeriod?: string | null;
    studentId?: string | null;
    programId?: string | null;
    status?: "draft" | "pending_confirmation" | "confirmed" | "overridden" | null;
    schoolId?: string | null;
  }
): Promise<StudentGrade[]> {
  let query = supabase
    .from("student_grades")
    .select(`
      *,
      student:students(id, first_name, last_name, student_number),
      grade_policy:grade_policies(id, policy_name, policy_type),
      grading_scale:grading_scales(id, grade_value, grade_label),
      school_year:school_years(id, year_label)
    `)
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  if (filters?.schoolYearId) {
    query = query.eq("school_year_id", filters.schoolYearId);
  }

  if (filters?.termPeriod) {
    query = query.eq("term_period", filters.termPeriod);
  }

  if (filters?.studentId) {
    query = query.eq("student_id", filters.studentId);
  }

  if (filters?.programId) {
    query = query.eq("program_id", filters.programId);
  }

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  if (filters?.schoolId) {
    query = query.eq("school_id", filters.schoolId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching student grades:", error);
    throw error;
  }

  return data || [];
}

export async function getStudentGrade(id: string): Promise<StudentGrade | null> {
  const { data, error } = await supabase
    .from("student_grades")
    .select(`
      *,
      student:students(id, first_name, last_name, student_number),
      grade_policy:grade_policies(id, policy_name, policy_type),
      grading_scale:grading_scales(id, grade_value, grade_label),
      school_year:school_years(id, year_label)
    `)
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching student grade:", error);
    return null;
  }

  return data;
}

export async function createStudentGradeHeader(data: {
  organization_id: string;
  school_id?: string | null;
  student_id: string;
  program_id?: string | null;
  section_id?: string | null;
  school_year_id: string;
  term_period?: string | null;
  grade_policy_id: string;
  grading_scale_id: string;
  notes?: string | null;
  created_by?: string;
}): Promise<StudentGrade> {
  const { data: result, error } = await supabase
    .from("student_grades")
    .insert([{
      ...data,
      status: "draft",
    }])
    .select(`
      *,
      student:students(id, first_name, last_name, student_number),
      grade_policy:grade_policies(id, policy_name, policy_type),
      grading_scale:grading_scales(id, grade_value, grade_label),
      school_year:school_years(id, year_label)
    `)
    .single();

  if (error) {
    console.error("Error creating student grade:", error);
    throw error;
  }

  return result;
}

export async function updateStudentGradeHeader(
  id: string,
  data: {
    term_period?: string | null;
    grade_policy_id?: string;
    grading_scale_id?: string;
    notes?: string | null;
    status?: "draft" | "pending_confirmation" | "confirmed" | "overridden";
    updated_by?: string;
  }
): Promise<StudentGrade> {
  const updatePayload = { ...data, updated_at: new Date().toISOString() };
  
  console.log("Updating student grade:", {
    id,
    updatePayload,
    timestamp: new Date().toISOString(),
  });

  const response = await supabase
    .from("student_grades")
    .update(updatePayload)
    .eq("id", id)
    .select(`
      *,
      student:students(id, first_name, last_name, student_number),
      grade_policy:grade_policies(id, policy_name, policy_type),
      grading_scale:grading_scales(id, grade_value, grade_label),
      school_year:school_years(id, year_label)
    `)
    .single();

  const { data: result, error } = response;

  // Log the full response structure
  console.log("Supabase response:", {
    hasData: !!result,
    hasError: !!error,
    errorType: typeof error,
    errorConstructor: error?.constructor?.name,
    responseKeys: Object.keys(response || {}),
  });

  if (error) {
    // Try to extract error information in multiple ways
    const errorInfo: any = {
      error,
      errorType: typeof error,
      errorString: String(error),
      errorJSON: JSON.stringify(error),
    };

    // Try to access common error properties
    if (error && typeof error === 'object') {
      errorInfo.errorMessage = (error as any).message;
      errorInfo.errorDetails = (error as any).details;
      errorInfo.errorHint = (error as any).hint;
      errorInfo.errorCode = (error as any).code;
      errorInfo.errorKeys = Object.keys(error);
      
      // Try to get all enumerable properties
      for (const key in error) {
        errorInfo[`error_${key}`] = (error as any)[key];
      }
    }

    console.error("Error updating student grade - Full details:", {
      ...errorInfo,
      id,
      data: updatePayload,
    });

    const errorMessage = 
      (error as any)?.message || 
      (error as any)?.details || 
      String(error) || 
      "Failed to update student grade";
    
    throw new Error(errorMessage);
  }

  if (!result) {
    console.error("No data returned from update:", { 
      id, 
      data: updatePayload,
      response,
    });
    throw new Error("Update succeeded but no data returned");
  }

  return result;
}

export async function finalizeStudentGrade(
  id: string,
  data: {
    confirmed_by: string;
    justification_text: string;
    updated_by?: string;
  }
): Promise<StudentGrade> {
  // Update grade status to confirmed
  const { data: grade, error: gradeError } = await supabase
    .from("student_grades")
    .update({
      status: "confirmed",
      confirmed_by: data.confirmed_by,
      confirmed_at: new Date().toISOString(),
      updated_by: data.updated_by,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (gradeError) {
    console.error("Error finalizing student grade:", gradeError);
    throw gradeError;
  }

  // Create justification record
  if (grade) {
    const { error: justificationError } = await supabase
      .from("grade_justifications")
      .insert({
        organization_id: grade.organization_id,
        student_grade_id: id,
        justification_type: "confirmation",
        justification_text: data.justification_text,
        created_by: data.confirmed_by,
      });

    if (justificationError) {
      console.error("Error creating justification:", justificationError);
      throw justificationError;
    }
  }

  // Fetch updated grade with joins
  return getStudentGrade(id) as Promise<StudentGrade>;
}

export async function overrideGradeEntry(
  id: string,
  data: {
    override_by: string;
    override_reason: string;
    new_grading_scale_id?: string;
    updated_by?: string;
  }
): Promise<StudentGrade> {
  // Get current grade to preserve previous grade value
  const currentGrade = await getStudentGrade(id);
  if (!currentGrade) {
    throw new Error("Grade not found");
  }

  const updateData: any = {
    status: "overridden",
    override_by: data.override_by,
    override_at: new Date().toISOString(),
    override_reason: data.override_reason,
    updated_by: data.updated_by,
    updated_at: new Date().toISOString(),
  };

  if (data.new_grading_scale_id) {
    updateData.grading_scale_id = data.new_grading_scale_id;
  }

  // Update grade status to overridden
  const { data: grade, error: gradeError } = await supabase
    .from("student_grades")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (gradeError) {
    console.error("Error overriding student grade:", gradeError);
    throw gradeError;
  }

  // Create justification record
  if (grade) {
    const { error: justificationError } = await supabase
      .from("grade_justifications")
      .insert({
        organization_id: grade.organization_id,
        student_grade_id: id,
        justification_type: "override",
        justification_text: data.override_reason,
        previous_grade_id: currentGrade.grading_scale_id,
        new_grade_id: data.new_grading_scale_id || currentGrade.grading_scale_id,
        created_by: data.override_by,
      });

    if (justificationError) {
      console.error("Error creating justification:", justificationError);
      throw justificationError;
    }
  }

  // Fetch updated grade with joins
  return getStudentGrade(id) as Promise<StudentGrade>;
}

// ============================================================================
// Grade Entry Functions
// ============================================================================

export async function listGradeEntries(
  studentGradeId: string,
  organizationId: string | null
): Promise<GradeEntry[]> {
  let query = supabase
    .from("grade_entries")
    .select(`
      *,
      observation:observations(id, notes, observed_at),
      competency:competencies(id, name),
      domain:domains(id, name)
    `)
    .eq("student_grade_id", studentGradeId)
    .is("archived_at", null)
    .order("created_at", { ascending: true });

  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching grade entries:", error);
    throw error;
  }

  return data || [];
}

export async function addGradeEntry(data: {
  organization_id: string;
  student_grade_id: string;
  observation_id?: string | null;
  competency_id?: string | null;
  domain_id?: string | null;
  entry_type: "observation_reference" | "competency_summary" | "domain_summary" | "manual_note";
  entry_text?: string | null;
  created_by?: string;
}): Promise<GradeEntry> {
  const { data: result, error } = await supabase
    .from("grade_entries")
    .insert([data])
    .select(`
      *,
      observation:observations(id, notes, observed_at),
      competency:competencies(id, name),
      domain:domains(id, name)
    `)
    .single();

  if (error) {
    console.error("Error creating grade entry:", error);
    throw error;
  }

  return result;
}

export async function updateGradeEntry(
  id: string,
  data: {
    entry_type?: "observation_reference" | "competency_summary" | "domain_summary" | "manual_note";
    entry_text?: string | null;
    observation_id?: string | null;
    competency_id?: string | null;
    domain_id?: string | null;
    updated_by?: string;
  }
): Promise<GradeEntry> {
  const { data: result, error } = await supabase
    .from("grade_entries")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(`
      *,
      observation:observations(id, notes, observed_at),
      competency:competencies(id, name),
      domain:domains(id, name)
    `)
    .single();

  if (error) {
    console.error("Error updating grade entry:", error);
    throw error;
  }

  return result;
}

export async function archiveGradeEntry(id: string): Promise<void> {
  const { error } = await supabase
    .from("grade_entries")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.error("Error archiving grade entry:", error);
    throw error;
  }
}

// ============================================================================
// Grade Justification Functions
// ============================================================================

export async function listGradeJustifications(
  studentGradeId: string,
  organizationId: string | null
): Promise<GradeJustification[]> {
  let query = supabase
    .from("grade_justifications")
    .select("*")
    .eq("student_grade_id", studentGradeId)
    .order("created_at", { ascending: true });

  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching grade justifications:", error);
    throw error;
  }

  return data || [];
}

export async function addJustification(data: {
  organization_id: string;
  student_grade_id: string;
  justification_type: "initial_assignment" | "confirmation" | "override" | "correction" | "appeal";
  justification_text: string;
  previous_grade_id?: string | null;
  new_grade_id?: string | null;
  created_by?: string;
}): Promise<GradeJustification> {
  const { data: result, error } = await supabase
    .from("grade_justifications")
    .insert([data])
    .select()
    .single();

  if (error) {
    console.error("Error creating grade justification:", error);
    throw error;
  }

  return result;
}
