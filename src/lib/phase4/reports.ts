/**
 * Phase 4 Reports Data Access Layer
 * Grade Translation & Reporting Layer
 * 
 * All functions respect RLS policies and filter by organization_id unless super admin.
 * Reports read from confirmed grades only and never modify learning data.
 */

import { supabase } from "@/lib/supabase/client";

// ============================================================================
// Types
// ============================================================================

export interface ReportTemplate {
  id: string;
  organization_id: string;
  school_id: string | null;
  template_name: string;
  template_type: "report_card" | "transcript" | "compliance_export";
  template_config: Record<string, any> | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  archived_at: string | null;
}

export interface TranscriptRecord {
  id: string;
  organization_id: string;
  school_id: string | null;
  student_id: string;
  student_grade_id: string;
  program_id: string | null;
  school_year_id: string;
  term_period: string;
  course_name: string | null;
  grade_value: string;
  credits: number | null;
  transcript_status: "draft" | "finalized";
  finalized_at: string | null;
  finalized_by: string | null;
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
  student_grade?: {
    id: string;
    status: string;
    notes: string | null;
  };
  school_year?: {
    id: string;
    year_label: string;
  };
  program?: {
    id: string;
    name: string;
  };
}

// ============================================================================
// Report Template Functions
// ============================================================================

export async function listReportTemplates(
  organizationId: string | null,
  filters?: {
    templateType?: "report_card" | "transcript" | "compliance_export" | null;
    isActive?: boolean | null;
    schoolId?: string | null;
  }
): Promise<ReportTemplate[]> {
  let query = supabase
    .from("report_templates")
    .select("*")
    .is("archived_at", null)
    .order("template_name", { ascending: true });

  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  if (filters?.templateType) {
    query = query.eq("template_type", filters.templateType);
  }

  if (filters?.isActive !== undefined && filters.isActive !== null) {
    query = query.eq("is_active", filters.isActive);
  }

  if (filters?.schoolId) {
    query = query.eq("school_id", filters.schoolId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching report templates:", error);
    throw error;
  }

  return data || [];
}

export async function getReportTemplate(id: string): Promise<ReportTemplate | null> {
  const { data, error } = await supabase
    .from("report_templates")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching report template:", error);
    return null;
  }

  return data;
}

// ============================================================================
// Transcript Record Functions
// ============================================================================

export async function listTranscriptRecords(
  organizationId: string | null,
  filters?: {
    studentId?: string | null;
    schoolYearId?: string | null;
    termPeriod?: string | null;
    programId?: string | null;
    transcriptStatus?: "draft" | "finalized" | null;
    schoolId?: string | null;
  }
): Promise<TranscriptRecord[]> {
  let query = supabase
    .from("transcript_records")
    .select(`
      *,
      student:students(id, first_name, last_name, student_number),
      student_grade:student_grades(id, status, notes),
      school_year:school_years(id, year_label),
      program:programs(id, name)
    `)
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  if (filters?.studentId) {
    query = query.eq("student_id", filters.studentId);
  }

  if (filters?.schoolYearId) {
    query = query.eq("school_year_id", filters.schoolYearId);
  }

  if (filters?.termPeriod) {
    query = query.eq("term_period", filters.termPeriod);
  }

  if (filters?.programId) {
    query = query.eq("program_id", filters.programId);
  }

  if (filters?.transcriptStatus) {
    query = query.eq("transcript_status", filters.transcriptStatus);
  }

  if (filters?.schoolId) {
    query = query.eq("school_id", filters.schoolId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching transcript records:", error);
    throw error;
  }

  return data || [];
}

export async function getTranscriptRecord(id: string): Promise<TranscriptRecord | null> {
  const { data, error } = await supabase
    .from("transcript_records")
    .select(`
      *,
      student:students(id, first_name, last_name, student_number),
      student_grade:student_grades(id, status, notes),
      school_year:school_years(id, year_label),
      program:programs(id, name)
    `)
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching transcript record:", error);
    return null;
  }

  return data;
}

export async function generateTranscriptRecordFromConfirmedGrades(data: {
  organization_id: string;
  school_id?: string | null;
  student_id: string;
  student_grade_id: string;
  program_id?: string | null;
  school_year_id: string;
  term_period: string;
  course_name?: string | null;
  grade_value: string;
  credits?: number | null;
  created_by?: string;
}): Promise<TranscriptRecord> {
  const { data: result, error } = await supabase
    .from("transcript_records")
    .insert([{
      ...data,
      transcript_status: "draft",
    }])
    .select(`
      *,
      student:students(id, first_name, last_name, student_number),
      student_grade:student_grades(id, status, notes),
      school_year:school_years(id, year_label),
      program:programs(id, name)
    `)
    .single();

  if (error) {
    console.error("Error creating transcript record:", error);
    throw error;
  }

  return result;
}

export async function finalizeTranscriptRecord(
  id: string,
  data: {
    finalized_by: string;
    updated_by?: string;
  }
): Promise<TranscriptRecord> {
  const { data: result, error } = await supabase
    .from("transcript_records")
    .update({
      transcript_status: "finalized",
      finalized_by: data.finalized_by,
      finalized_at: new Date().toISOString(),
      updated_by: data.updated_by,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select(`
      *,
      student:students(id, first_name, last_name, student_number),
      student_grade:student_grades(id, status, notes),
      school_year:school_years(id, year_label),
      program:programs(id, name)
    `)
    .single();

  if (error) {
    console.error("Error finalizing transcript record:", error);
    throw error;
  }

  return result;
}
