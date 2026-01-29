/**
 * Student Portal Data Access Layer
 * All functions are scoped to the current student (via profile_id)
 * Respects RLS policies - students can only access their own data
 * 
 * NOTE: This file uses client-side Supabase client for use in client components.
 * For server-side usage, use the server client directly.
 */

import { supabase } from "@/lib/supabase/client";
import { logError } from "@/lib/logger";

// ============================================================================
// Types
// ============================================================================

export interface StudentRow {
  id: string;
  legal_first_name: string | null;
  legal_last_name: string | null;
  preferred_name: string | null;
  primary_email: string | null;
  student_number: string | null;
  profile_id: string | null;
  organization_id: string;
}

export interface AttendanceRecord {
  id: string;
  session_id: string;
  learner_id: string;
  status: "present" | "absent" | "late";
  notes: string | null;
  created_at: string;
  updated_at: string;
  session?: {
    id: string;
    session_date: string;
    session_time: string | null;
    description: string | null;
    teacher?: {
      id: string;
      first_name: string | null;
      last_name: string | null;
    };
  };
}

export interface PortfolioArtifact {
  id: string;
  student_id: string;
  organization_id: string;
  artifact_type: "upload" | "link" | "text";
  title: string;
  description: string | null;
  file_url: string | null;
  text_content: string | null;
  visibility: "internal" | "private" | "shared";
  status: "draft" | "submitted";
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  archived_at: string | null;
}

export interface Assessment {
  id: string;
  teacher_id: string;
  learner_id: string;
  school_year_id: string | null;
  term_period: string | null;
  label_id: string;
  rationale: string;
  status: "draft" | "confirmed" | "archived";
  created_at: string;
  updated_at: string;
  teacher?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
  };
  label?: {
    id: string;
    label_text: string;
    description: string | null;
  };
  school_year?: {
    id: string;
    year_label: string;
  };
}

export interface StudentFeedback {
  id: string;
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
  feedback_dimension?: {
    id: string;
    dimension_name: string;
    description: string | null;
  };
  teacher?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
  };
}

// ============================================================================
// Helper: Get current student's profile_id
// ============================================================================

async function getCurrentStudentId(): Promise<string | null> {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      logError("No session or session error in getCurrentStudentId", sessionError);
      return null;
    }

    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("id")
      .eq("profile_id", session.user.id)
      .maybeSingle();

    if (studentError) {
      logError("Error fetching student ID", studentError);
      return null;
    }

    return student?.id || null;
  } catch (error) {
    logError("Exception in getCurrentStudentId", error);
    return null;
  }
}

// ============================================================================
// Student Row
// ============================================================================

/**
 * Get current student's row
 */
export async function getMyStudentRow(): Promise<StudentRow | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return null;
  }

  const { data, error } = await supabase
    .from("students")
    .select("id, legal_first_name, legal_last_name, preferred_name, primary_email, student_number, profile_id, organization_id")
    .eq("profile_id", session.user.id)
    .maybeSingle();

  if (error) {
    logError("Error fetching student row", error);
    return null;
  }

  return data || null;
}


// ============================================================================
// Attendance
// ============================================================================

/**
 * Get current student's attendance records
 */
export async function getMyAttendance(
  filters?: { startDate?: string; endDate?: string; status?: "present" | "absent" | "late" }
): Promise<AttendanceRecord[]> {
  const studentId = await getCurrentStudentId();
  if (!studentId) {
    return [];
  }

  let query = supabase
    .from("attendance_records")
    .select(`
      id,
      session_id,
      learner_id,
      status,
      notes,
      created_at,
      updated_at,
      session:attendance_sessions(
        id,
        session_date,
        session_time,
        description,
        teacher_id
      )
    `)
    .eq("learner_id", studentId)
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  if (filters?.startDate) {
    // Filter by session date through the join
    query = query.gte("session.session_date", filters.startDate);
  }

  if (filters?.endDate) {
    query = query.lte("session.session_date", filters.endDate);
  }

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query;

  if (error) {
    logError("Error fetching attendance", error);
    return [];
  }

  // Enrich with teacher names from staff table
  const sessions = data || [];
  const teacherIds = [...new Set(
    sessions
      .map((item: any) => item.session?.teacher_id)
      .filter(Boolean)
  )];

  let staffMap = new Map();
  if (teacherIds.length > 0) {
    const { data: staffData } = await supabase
      .from("staff")
      .select("user_id, first_name, last_name")
      .in("user_id", teacherIds);

    staffMap = new Map(
      (staffData || []).map((staff) => [
        staff.user_id,
        { id: staff.user_id, first_name: staff.first_name, last_name: staff.last_name },
      ])
    );
  }

  return sessions.map((item: any) => ({
    ...item,
    session: item.session ? {
      ...item.session,
      teacher: item.session.teacher_id
        ? (staffMap.get(item.session.teacher_id) || {
            id: item.session.teacher_id,
            first_name: null,
            last_name: null,
          })
        : undefined,
    } : undefined,
  }));
}

// ============================================================================
// Portfolio
// ============================================================================

/**
 * Get current student's portfolio artifacts
 * @param studentId Optional student ID to avoid redundant lookups
 */
export async function getMyPortfolio(studentId?: string): Promise<PortfolioArtifact[]> {
  let finalStudentId = studentId;
  
  if (!finalStudentId) {
    finalStudentId = await getCurrentStudentId();
  }
  
  if (!finalStudentId) {
    return [];
  }

  const { data, error } = await supabase
    .from("portfolio_artifacts")
    .select("*")
    .eq("student_id", finalStudentId)
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    logError("Error fetching portfolio", error);
    return [];
  }

  return data || [];
}

/**
 * Get a single portfolio artifact by ID (must belong to current student)
 */
export async function getMyArtifact(id: string): Promise<PortfolioArtifact | null> {
  const studentId = await getCurrentStudentId();
  if (!studentId) {
    return null;
  }

  const { data, error } = await supabase
    .from("portfolio_artifacts")
    .select("*")
    .eq("id", id)
    .eq("student_id", studentId)
    .is("archived_at", null)
    .maybeSingle();

  if (error) {
    logError("Error fetching artifact", error);
    return null;
  }

  return data || null;
}

/**
 * Create a new portfolio artifact
 */
export async function createArtifact(data: {
  title: string;
  description: string; // Now required
  artifact_type: "upload" | "link" | "text";
  file_url?: string | null;
  text_content?: string | null;
  visibility?: "internal" | "private" | "shared";
  status?: "draft" | "submitted";
  experience_id?: string | null; // Optional experience link
}): Promise<PortfolioArtifact | null> {
  const studentId = await getCurrentStudentId();
  if (!studentId) {
    throw new Error("Student not found");
  }

  const student = await getMyStudentRow();
  if (!student) {
    throw new Error("Student record not found");
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("Not authenticated");
  }

  // Get school_id from profile (matching pattern from createPortfolioItem)
  const { data: profile } = await supabase
    .from("profiles")
    .select("school_id")
    .eq("id", session.user.id)
    .single();
  const schoolId = profile?.school_id || null;

  const status = data.status || "draft";
  const insertData: any = {
    organization_id: student.organization_id,
    school_id: schoolId,
    student_id: studentId,
    artifact_type: data.artifact_type,
    title: data.title,
    description: data.description || null,
    file_url: data.file_url || null,
    text_content: data.text_content || null,
    visibility: data.visibility || "internal",
    source: "student_upload",
    status,
    created_by: session.user.id,
    updated_by: session.user.id,
  };

  const { data: artifact, error } = await supabase
    .from("portfolio_artifacts")
    .insert(insertData)
    .select()
    .single();

  if (error) {
    logError("Error creating artifact", error);
    throw error;
  }

  // Link to experience if provided (read-only reference)
  if (data.experience_id && artifact) {
    try {
      await supabase
        .from("portfolio_artifact_links")
        .insert({
          organization_id: student.organization_id,
          artifact_id: artifact.id,
          experience_id: data.experience_id,
          created_by: session.user.id,
        });
    } catch (linkError) {
      // Log but don't fail - artifact is created, link is optional
      logError("Error linking artifact to experience", linkError);
    }
  }

  return artifact;
}

/**
 * Update a portfolio artifact (only if status = 'draft' and not linked to assessment)
 */
export async function updateArtifact(
  id: string,
  data: {
    title?: string;
    description?: string | null;
    artifact_type?: "upload" | "link" | "text";
    file_url?: string | null;
    text_content?: string | null;
    visibility?: "internal" | "private" | "shared";
  }
): Promise<PortfolioArtifact | null> {
  const studentId = await getCurrentStudentId();
  if (!studentId) {
    throw new Error("Student not found");
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("Not authenticated");
  }

  // Verify artifact belongs to current student and is draft
  const existing = await getMyArtifact(id);
  if (!existing) {
    throw new Error("Artifact not found or access denied");
  }

  if (existing.status !== "draft") {
    throw new Error("Only draft artifacts can be edited");
  }

  // Check if artifact is linked to an assessment
  const isLinked = await isArtifactLinkedToAssessment(id);
  if (isLinked) {
    throw new Error("Cannot edit artifact that is linked to an assessment");
  }

  const updateData: any = {
    ...data,
    updated_by: session.user.id,
  };

  // Remove undefined values
  Object.keys(updateData).forEach(key => {
    if (updateData[key] === undefined) {
      delete updateData[key];
    }
  });

  const { data: updated, error } = await supabase
    .from("portfolio_artifacts")
    .update(updateData)
    .eq("id", id)
    .eq("student_id", studentId)
    .select()
    .single();

  if (error) {
    logError("Error updating artifact", error);
    throw error;
  }

  return updated;
}

/**
 * Submit artifact (change status from draft to submitted)
 */
export async function submitArtifact(id: string): Promise<PortfolioArtifact | null> {
  const studentId = await getCurrentStudentId();
  if (!studentId) {
    throw new Error("Student not found");
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("Not authenticated");
  }

  // Verify artifact belongs to current student and is draft
  const existing = await getMyArtifact(id);
  if (!existing) {
    throw new Error("Artifact not found or access denied");
  }

  if (existing.status !== "draft") {
    throw new Error("Only draft artifacts can be submitted");
  }

  // Ensure description exists before submitting
  if (!existing.description || existing.description.trim() === "") {
    throw new Error("Description is required before submitting");
  }

  const { data: updated, error } = await supabase
    .from("portfolio_artifacts")
    .update({
      status: "submitted",
      updated_by: session.user.id,
    })
    .eq("id", id)
    .eq("student_id", studentId)
    .select()
    .single();

  if (error) {
    logError("Error submitting artifact", error);
    throw error;
  }

  return updated;
}

/**
 * Archive artifact (soft delete)
 */
export async function archiveArtifact(id: string): Promise<void> {
  const studentId = await getCurrentStudentId();
  if (!studentId) {
    throw new Error("Student not found");
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("Not authenticated");
  }

  // Verify artifact belongs to current student
  const existing = await getMyArtifact(id);
  if (!existing) {
    throw new Error("Artifact not found or access denied");
  }

  // Check if artifact is linked to an assessment
  const isLinked = await isArtifactLinkedToAssessment(id);
  if (isLinked) {
    throw new Error("Cannot archive artifact that is linked to an assessment");
  }

  const { error } = await supabase
    .from("portfolio_artifacts")
    .update({
      archived_at: new Date().toISOString(),
      updated_by: session.user.id,
    })
    .eq("id", id)
    .eq("student_id", studentId);

  if (error) {
    logError("Error archiving artifact", error);
    throw error;
  }
}

/**
 * Check if an artifact is linked to any assessment
 */
export async function isArtifactLinkedToAssessment(artifactId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("assessment_evidence_links")
    .select("id")
    .eq("portfolio_artifact_id", artifactId)
    .eq("evidence_type", "portfolio_artifact")
    .is("archived_at", null)
    .limit(1);

  if (error) {
    logError("Error checking artifact links", error);
    return false;
  }

  return (data?.length || 0) > 0;
}

// ============================================================================
// Experiences (read-only reference for artifact linking)
// ============================================================================

export interface Experience {
  id: string;
  name: string;
  description: string | null;
  experience_type: string | null;
}

/**
 * Get experiences for current student's organization (read-only reference)
 */
export async function getMyExperiences(): Promise<Experience[]> {
  const student = await getMyStudentRow();
  if (!student) {
    return [];
  }

  const { data, error } = await supabase
    .from("experiences")
    .select("id, name, description, experience_type")
    .eq("organization_id", student.organization_id)
    .is("archived_at", null)
    .order("name", { ascending: true });

  if (error) {
    logError("Error fetching experiences", error);
    return [];
  }

  return data || [];
}

// ============================================================================
// Assessments
// ============================================================================

/**
 * Get current student's assessments
 */
export async function getMyAssessments(): Promise<Assessment[]> {
  const studentId = await getCurrentStudentId();
  if (!studentId) {
    return [];
  }

  const { data, error } = await supabase
    .from("assessments")
    .select(`
      id,
      teacher_id,
      learner_id,
      school_year_id,
      term_period,
      label_id,
      rationale,
      status,
      created_at,
      updated_at,
      label:assessment_labels!assessments_label_id_fkey(id, label_text, description),
      school_year:school_years(id, year_label)
    `)
    .eq("learner_id", studentId)
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    logError("Error fetching assessments", error);
    return [];
  }

  // Enrich with teacher names from staff table
  const assessments = data || [];
  const teacherIds = [...new Set(
    assessments.map((item: any) => item.teacher_id).filter(Boolean)
  )];

  let staffMap = new Map();
  if (teacherIds.length > 0) {
    const { data: staffData } = await supabase
      .from("staff")
      .select("user_id, first_name, last_name")
      .in("user_id", teacherIds);

    staffMap = new Map(
      (staffData || []).map((staff) => [
        staff.user_id,
        { id: staff.user_id, first_name: staff.first_name, last_name: staff.last_name },
      ])
    );
  }

  return assessments.map((item: any) => ({
    ...item,
    teacher: item.teacher_id
      ? (staffMap.get(item.teacher_id) || {
          id: item.teacher_id,
          first_name: null,
          last_name: null,
        })
      : undefined,
    label: item.label || undefined,
    school_year: item.school_year || undefined,
  }));
}

/**
 * Get evidence links for an assessment (student can see their own assessments' evidence)
 */
export async function getAssessmentEvidenceLinks(assessmentId: string): Promise<Array<{
  id: string;
  evidence_type: string;
  portfolio_artifact_id: string | null;
  portfolio_artifact?: { title: string } | null;
}>> {
  const studentId = await getCurrentStudentId();
  if (!studentId) {
    return [];
  }

  // Verify assessment belongs to student
  const assessment = await getMyAssessment(assessmentId);
  if (!assessment) {
    return [];
  }

  const { data, error } = await supabase
    .from("assessment_evidence_links")
    .select(`
      id,
      evidence_type,
      portfolio_artifact_id,
      portfolio_artifact:portfolio_artifacts!assessment_evidence_links_portfolio_artifact_id_fkey(title)
    `)
    .eq("assessment_id", assessmentId)
    .eq("evidence_type", "portfolio_artifact")
    .is("archived_at", null);

  if (error) {
    logError("Error fetching evidence links", error);
    return [];
  }

  return (data || []).map((item: any) => ({
    id: item.id,
    evidence_type: item.evidence_type,
    portfolio_artifact_id: item.portfolio_artifact_id,
    portfolio_artifact: item.portfolio_artifact || null,
  }));
}

/**
 * Get a single assessment by ID (must belong to current student)
 */
export async function getMyAssessment(id: string): Promise<Assessment | null> {
  const studentId = await getCurrentStudentId();
  if (!studentId) {
    return null;
  }

  const { data, error } = await supabase
    .from("assessments")
    .select(`
      id,
      teacher_id,
      learner_id,
      school_year_id,
      term_period,
      label_id,
      rationale,
      status,
      created_at,
      updated_at,
      label:assessment_labels!assessments_label_id_fkey(id, label_text, description),
      school_year:school_years(id, year_label)
    `)
    .eq("id", id)
    .eq("learner_id", studentId)
    .is("archived_at", null)
    .maybeSingle();

  if (error) {
    logError("Error fetching assessment", error);
    return null;
  }

  if (!data) {
    return null;
  }

  // Enrich with teacher name from staff table
  let teacher = undefined;
  if (data.teacher_id) {
    const { data: staffData } = await supabase
      .from("staff")
      .select("user_id, first_name, last_name")
      .eq("user_id", data.teacher_id)
      .maybeSingle();

    teacher = staffData
      ? { id: staffData.user_id, first_name: staffData.first_name, last_name: staffData.last_name }
      : { id: data.teacher_id, first_name: null, last_name: null };
  }

  return {
    ...data,
    teacher,
    label: data.label || undefined,
    school_year: data.school_year || undefined,
  };
}

// ============================================================================
// Feedback
// ============================================================================

/**
 * Get current student's feedback entries
 */
export async function getMyFeedback(
  filters?: { status?: "draft" | "completed"; quarter?: string }
): Promise<StudentFeedback[]> {
  const studentId = await getCurrentStudentId();
  if (!studentId) {
    return [];
  }

  let query = supabase
    .from("student_feedback")
    .select(`
      id,
      student_id,
      teacher_id,
      experience_id,
      experience_type,
      school_year_id,
      quarter,
      feedback_dimension_id,
      feedback_text,
      provided_at,
      status,
      is_anonymous,
      created_at,
      updated_at,
      feedback_dimension:feedback_dimensions(id, dimension_name, description)
    `)
    .eq("student_id", studentId)
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  if (filters?.quarter) {
    query = query.eq("quarter", filters.quarter);
  }

  const { data, error } = await query;

  if (error) {
    logError("Error fetching feedback", error);
    return [];
  }

  // Enrich with teacher names from staff table
  const feedbacks = data || [];
  const teacherIds = [...new Set(
    feedbacks.map((item: any) => item.teacher_id).filter(Boolean)
  )];

  let staffMap = new Map();
  if (teacherIds.length > 0) {
    const { data: staffData } = await supabase
      .from("staff")
      .select("user_id, first_name, last_name")
      .in("user_id", teacherIds);

    staffMap = new Map(
      (staffData || []).map((staff) => [
        staff.user_id,
        { id: staff.user_id, first_name: staff.first_name, last_name: staff.last_name },
      ])
    );
  }

  return feedbacks.map((item: any) => ({
    ...item,
    feedback_dimension: item.feedback_dimension || undefined,
    teacher: item.teacher_id
      ? (staffMap.get(item.teacher_id) || {
          id: item.teacher_id,
          first_name: null,
          last_name: null,
        })
      : undefined,
  }));
}

/**
 * Create a new feedback entry
 */
export async function createFeedback(data: {
  quarter: string;
  feedback_dimension_id: string;
  feedback_text: string;
  teacher_id?: string | null;
  experience_id?: string | null;
  experience_type?: string | null;
  school_year_id?: string | null;
  is_anonymous?: boolean;
  status?: "draft" | "completed";
}): Promise<StudentFeedback | null> {
  const studentId = await getCurrentStudentId();
  if (!studentId) {
    throw new Error("Student not found");
  }

  const student = await getMyStudentRow();
  if (!student) {
    throw new Error("Student record not found");
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("Not authenticated");
  }

  const status = data.status || "draft";
  const insertData: any = {
    organization_id: student.organization_id,
    student_id: studentId,
    quarter: data.quarter,
    feedback_dimension_id: data.feedback_dimension_id,
    feedback_text: data.feedback_text,
    teacher_id: data.teacher_id || null,
    experience_id: data.experience_id || null,
    experience_type: data.experience_type || null,
    school_year_id: data.school_year_id || null,
    is_anonymous: data.is_anonymous || false,
    status,
    created_by: session.user.id,
  };

  // If submitting (status='completed'), set provided_at
  if (status === "completed") {
    insertData.provided_at = new Date().toISOString();
  }

  const { data: feedback, error } = await supabase
    .from("student_feedback")
    .insert(insertData)
    .select(`
      *,
      feedback_dimension:feedback_dimensions!inner(id, dimension_name, description)
    `)
    .single();

  if (error) {
    logError("Error creating feedback", error);
    throw error;
  }

  // Enrich with teacher name from staff table
  let teacher = undefined;
  if (feedback.teacher_id) {
    const { data: staffData } = await supabase
      .from("staff")
      .select("user_id, first_name, last_name")
      .eq("user_id", feedback.teacher_id)
      .maybeSingle();

    teacher = staffData
      ? { id: staffData.user_id, first_name: staffData.first_name, last_name: staffData.last_name }
      : { id: feedback.teacher_id, first_name: null, last_name: null };
  }

  return {
    ...feedback,
    feedback_dimension: feedback.feedback_dimension || undefined,
    teacher,
  };
}

/**
 * Update a feedback entry (only if it belongs to current student and is draft)
 */
export async function updateFeedback(
  id: string,
  data: {
    quarter?: string;
    feedback_dimension_id?: string;
    feedback_text?: string;
    teacher_id?: string | null;
    experience_id?: string | null;
    experience_type?: string | null;
    school_year_id?: string | null;
    is_anonymous?: boolean;
  }
): Promise<StudentFeedback | null> {
  const studentId = await getCurrentStudentId();
  if (!studentId) {
    throw new Error("Student not found");
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("Not authenticated");
  }

  // Verify feedback belongs to current student
  const existing = await getMyFeedback();
  const feedback = existing.find((f) => f.id === id);
  
  if (!feedback) {
    throw new Error("Feedback not found or access denied");
  }

  // Only allow editing drafts
  if (feedback.status !== "draft") {
    throw new Error("Only draft feedback can be edited");
  }

  const updateData: any = {
    ...data,
    updated_by: session.user.id,
  };

  // Remove undefined values
  Object.keys(updateData).forEach(key => {
    if (updateData[key] === undefined) {
      delete updateData[key];
    }
  });

  const { data: updated, error } = await supabase
    .from("student_feedback")
    .update(updateData)
    .eq("id", id)
    .eq("student_id", studentId)
    .select(`
      *,
      feedback_dimension:feedback_dimensions!inner(id, dimension_name, description)
    `)
    .single();

  if (error) {
    logError("Error updating feedback", error);
    throw error;
  }

  // Enrich with teacher name from staff table
  let teacher = undefined;
  if (updated.teacher_id) {
    const { data: staffData } = await supabase
      .from("staff")
      .select("user_id, first_name, last_name")
      .eq("user_id", updated.teacher_id)
      .maybeSingle();

    teacher = staffData
      ? { id: staffData.user_id, first_name: staffData.first_name, last_name: staffData.last_name }
      : { id: updated.teacher_id, first_name: null, last_name: null };
  }

  return {
    ...updated,
    feedback_dimension: updated.feedback_dimension || undefined,
    teacher,
  };
}

/**
 * Submit feedback (change status from draft to completed)
 */
export async function submitFeedback(id: string): Promise<StudentFeedback | null> {
  const studentId = await getCurrentStudentId();
  if (!studentId) {
    throw new Error("Student not found");
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("Not authenticated");
  }

  // Verify feedback belongs to current student and is draft
  const existing = await getMyFeedback();
  const feedback = existing.find((f) => f.id === id);
  
  if (!feedback) {
    throw new Error("Feedback not found or access denied");
  }

  if (feedback.status !== "draft") {
    throw new Error("Only draft feedback can be submitted");
  }

  const { data: updated, error } = await supabase
    .from("student_feedback")
    .update({
      status: "completed",
      provided_at: new Date().toISOString(),
      updated_by: session.user.id,
    })
    .eq("id", id)
    .eq("student_id", studentId)
    .select(`
      *,
      feedback_dimension:feedback_dimensions!inner(id, dimension_name, description)
    `)
    .single();

  if (error) {
    logError("Error submitting feedback", error);
    throw error;
  }

  // Enrich with teacher name from staff table
  let teacher = undefined;
  if (updated.teacher_id) {
    const { data: staffData } = await supabase
      .from("staff")
      .select("user_id, first_name, last_name")
      .eq("user_id", updated.teacher_id)
      .maybeSingle();

    teacher = staffData
      ? { id: staffData.user_id, first_name: staffData.first_name, last_name: staffData.last_name }
      : { id: updated.teacher_id, first_name: null, last_name: null };
  }

  return {
    ...updated,
    feedback_dimension: updated.feedback_dimension || undefined,
    teacher,
  };
}
