/**
 * Phase 6.5 Assessments Data Access Layer
 * Assessment & Judgment Layer - Assessment Records & Evidence Links
 * 
 * All functions respect RLS policies and filter by organization_id unless super admin.
 * No computation fields - purely qualitative judgment.
 * 
 * Role-based access control:
 *   - Teachers: Create/edit own assessments
 *   - Admins/Principals: View all assessments, can edit
 *   - Registrars: View-only access
 */

import { supabase } from "@/lib/supabase/client";

// ============================================================================
// Types
// ============================================================================

export interface Assessment {
  id: string;
  organization_id: string;
  school_id: string | null;
  teacher_id: string;
  learner_id: string;
  school_year_id: string | null;
  term_period: string | null;
  label_id: string;
  rationale: string;
  status: "draft" | "confirmed" | "archived";
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  archived_at: string | null;
  // Joined fields
  teacher?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
  };
  learner?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    student_number: string | null;
  };
  label?: {
    id: string;
    label_text: string;
    description: string | null;
    label_set?: {
      id: string;
      name: string;
    };
  };
  school_year?: {
    id: string;
    name: string;
  };
}

export interface AssessmentEvidenceLink {
  id: string;
  organization_id: string;
  assessment_id: string;
  evidence_type: "observation" | "experience" | "teacher_reflection" | "student_feedback" | "portfolio_artifact" | "attendance_session" | "attendance_record";
  observation_id: string | null;
  experience_id: string | null;
  teacher_reflection_id: string | null;
  student_feedback_id: string | null;
  portfolio_artifact_id: string | null;
  attendance_session_id: string | null;
  attendance_record_id: string | null;
  notes: string | null;
  created_at: string;
  created_by: string | null;
  archived_at: string | null;
}

export interface CreateAssessmentPayload {
  learner_id: string;
  experience_id?: string | null;
  competency_id?: string | null;
  school_year_id?: string | null;
  term_period?: string | null;
  label_set_id: string;
  label_id: string;
  rationale: string;
  status?: "draft" | "confirmed";
}

export interface UpdateAssessmentPayload {
  school_year_id?: string | null;
  term_period?: string | null;
  label_id?: string;
  rationale?: string;
  status?: "draft" | "confirmed" | "archived";
}

export interface CreateEvidenceLinkPayload {
  evidence_type: "observation" | "experience" | "teacher_reflection" | "student_feedback" | "portfolio_artifact" | "attendance_session" | "attendance_record";
  observation_id?: string | null;
  experience_id?: string | null;
  teacher_reflection_id?: string | null;
  student_feedback_id?: string | null;
  portfolio_artifact_id?: string | null;
  attendance_session_id?: string | null;
  attendance_record_id?: string | null;
  notes?: string | null;
}

export interface UpdateEvidenceLinkPayload {
  notes?: string | null;
}

export interface ListAssessmentsFilters {
  scope?: "mine" | "org";
  status?: "draft" | "confirmed" | "archived";
  learner_id?: string;
  experience_id?: string;
  teacher_id?: string;
  label_set_id?: string;
  school_year_id?: string;
  term_period?: string;
}

export interface EvidenceCandidate {
  id: string;
  type: "observation" | "experience" | "teacher_reflection" | "student_feedback" | "portfolio_artifact" | "attendance_session" | "attendance_record";
  title?: string | null;
  description?: string | null;
  created_at: string;
  created_by?: string | null;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get current user's organization_id and school_id from session
 */
async function getCurrentUserContext() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("No active session");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, school_id")
    .eq("id", session.user.id)
    .single();

  return {
    userId: session.user.id,
    organizationId: profile?.organization_id,
    schoolId: profile?.school_id,
  };
}

/**
 * Enrich assessments with joined data
 */
async function enrichAssessments(assessments: any[]): Promise<Assessment[]> {
  if (!assessments || assessments.length === 0) return assessments as Assessment[];

  // Collect unique IDs for joins
  const teacherIds = [...new Set(assessments.map((a) => a.teacher_id))].filter(Boolean);
  const learnerIds = [...new Set(assessments.map((a) => a.learner_id))].filter(Boolean);
  const labelIds = [...new Set(assessments.map((a) => a.label_id))].filter(Boolean);
  const schoolYearIds = [...new Set(assessments.map((a) => a.school_year_id))].filter(Boolean);

  // Fetch joined data
  const [staffData, studentData, labelData, schoolYearData] = await Promise.all([
    teacherIds.length > 0
      ? supabase
          .from("staff")
          .select("user_id, first_name, last_name")
          .in("user_id", teacherIds)
      : Promise.resolve({ data: [] }),
    learnerIds.length > 0
      ? supabase
          .from("students")
          .select("id, first_name, last_name, student_number")
          .in("id", learnerIds)
      : Promise.resolve({ data: [] }),
    labelIds.length > 0
      ? supabase
          .from("assessment_labels")
          .select(`
            id,
            label_text,
            description,
            label_set_id,
            assessment_label_sets!inner(id, name)
          `)
          .in("id", labelIds)
          .is("archived_at", null)
      : Promise.resolve({ data: [] }),
    schoolYearIds.length > 0
      ? supabase
          .from("school_years")
          .select("id, name")
          .in("id", schoolYearIds)
      : Promise.resolve({ data: [] }),
  ]);

  // Create maps
  const staffMap = new Map(
    (staffData.data || []).map((staff) => [
      staff.user_id,
      { id: staff.user_id, first_name: staff.first_name, last_name: staff.last_name },
    ])
  );
  const studentMap = new Map(
    (studentData.data || []).map((student) => [
      student.id,
      { id: student.id, first_name: student.first_name, last_name: student.last_name, student_number: student.student_number },
    ])
  );
  const labelMap = new Map(
    (labelData.data || []).map((label: any) => [
      label.id,
      {
        id: label.id,
        label_text: label.label_text,
        description: label.description,
        label_set: label.assessment_label_sets,
      },
    ])
  );
  const schoolYearMap = new Map(
    (schoolYearData.data || []).map((sy) => [sy.id, { id: sy.id, name: sy.name }])
  );

  // Enrich assessments
  return assessments.map((assessment) => ({
    ...assessment,
    teacher: staffMap.get(assessment.teacher_id) || {
      id: assessment.teacher_id,
      first_name: null,
      last_name: null,
    },
    learner: studentMap.get(assessment.learner_id) || {
      id: assessment.learner_id,
      first_name: null,
      last_name: null,
      student_number: null,
    },
    label: labelMap.get(assessment.label_id),
    school_year: assessment.school_year_id ? schoolYearMap.get(assessment.school_year_id) : null,
  })) as Assessment[];
}

// ============================================================================
// Assessment CRUD
// ============================================================================

/**
 * List assessments with optional filters
 */
export async function listAssessments(
  filters?: ListAssessmentsFilters
): Promise<Assessment[]> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("No active session");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("organization_id, school_id, role, is_super_admin")
    .eq("id", session.user.id)
    .single();

  if (profileError || !profile) {
    console.error("Profile fetch error:", profileError);
    throw new Error("Profile not found. Please ensure your profile is set up correctly.");
  }

  const scope = filters?.scope || (profile.role === "teacher" ? "mine" : "org");
  const isSuperAdmin = profile.is_super_admin === true;

  let query = supabase
    .from("assessments")
    .select(`
      *,
      teacher:profiles!assessments_teacher_id_fkey(id),
      learner:students!assessments_learner_id_fkey(id, first_name, last_name, student_number),
      label:assessment_labels!assessments_label_id_fkey(id, label_text, description),
      school_year:school_years(id, name)
    `)
    .is("archived_at", null);

  // Scope filtering
  if (!isSuperAdmin && profile.organization_id) {
    query = query.eq("organization_id", profile.organization_id);
  }

  if (scope === "mine") {
    query = query.eq("teacher_id", session.user.id);
  }

  // Apply filters
  if (filters?.status) {
    query = query.eq("status", filters.status);
  }
  if (filters?.learner_id) {
    query = query.eq("learner_id", filters.learner_id);
  }
  if (filters?.teacher_id) {
    query = query.eq("teacher_id", filters.teacher_id);
  }
  if (filters?.label_set_id) {
    // Need to join through labels
    query = query.eq("label_id", filters.label_set_id); // This is simplified - would need proper join
  }
  if (filters?.school_year_id) {
    query = query.eq("school_year_id", filters.school_year_id);
  }
  if (filters?.term_period) {
    query = query.eq("term_period", filters.term_period);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to list assessments: ${error.message}`);
  }

  return enrichAssessments(data || []);
}

/**
 * Get single assessment by ID
 */
export async function getAssessment(id: string): Promise<Assessment | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("No active session");
  }

  const { data, error } = await supabase
    .from("assessments")
    .select(`
      *,
      teacher:profiles!assessments_teacher_id_fkey(id),
      learner:students!assessments_learner_id_fkey(id, first_name, last_name, student_number),
      label:assessment_labels!assessments_label_id_fkey(id, label_text, description),
      school_year:school_years(id, name)
    `)
    .eq("id", id)
    .is("archived_at", null)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(`Failed to get assessment: ${error.message}`);
  }

  const enriched = await enrichAssessments([data]);
  return enriched[0] || null;
}

/**
 * Create new assessment
 */
export async function createAssessment(
  payload: CreateAssessmentPayload
): Promise<Assessment> {
  const context = await getCurrentUserContext();
  if (!context.organizationId) {
    throw new Error("Organization context required");
  }

  const { data, error } = await supabase
    .from("assessments")
    .insert({
      organization_id: context.organizationId,
      school_id: context.schoolId,
      teacher_id: context.userId,
      learner_id: payload.learner_id,
      school_year_id: payload.school_year_id || null,
      term_period: payload.term_period || null,
      label_id: payload.label_id,
      rationale: payload.rationale,
      status: payload.status || "draft",
      created_by: context.userId,
      updated_by: context.userId,
    })
    .select(`
      *,
      teacher:profiles!assessments_teacher_id_fkey(id),
      learner:students!assessments_learner_id_fkey(id, first_name, last_name, student_number),
      label:assessment_labels!assessments_label_id_fkey(id, label_text, description),
      school_year:school_years(id, name)
    `)
    .single();

  if (error) {
    throw new Error(`Failed to create assessment: ${error.message}`);
  }

  const enriched = await enrichAssessments([data]);
  return enriched[0];
}

/**
 * Update assessment
 */
export async function updateAssessment(
  id: string,
  payload: UpdateAssessmentPayload
): Promise<Assessment> {
  const context = await getCurrentUserContext();

  const { data, error } = await supabase
    .from("assessments")
    .update({
      ...payload,
      updated_by: context.userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select(`
      *,
      teacher:profiles!assessments_teacher_id_fkey(id),
      learner:students!assessments_learner_id_fkey(id, first_name, last_name, student_number),
      label:assessment_labels!assessments_label_id_fkey(id, label_text, description),
      school_year:school_years(id, name)
    `)
    .single();

  if (error) {
    throw new Error(`Failed to update assessment: ${error.message}`);
  }

  const enriched = await enrichAssessments([data]);
  return enriched[0];
}

/**
 * Archive assessment (soft delete)
 */
export async function archiveAssessment(id: string): Promise<void> {
  const context = await getCurrentUserContext();

  const { error } = await supabase
    .from("assessments")
    .update({
      archived_at: new Date().toISOString(),
      updated_by: context.userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to archive assessment: ${error.message}`);
  }
}

/**
 * Set assessment status
 */
export async function setAssessmentStatus(
  id: string,
  status: "draft" | "confirmed" | "archived"
): Promise<Assessment> {
  return updateAssessment(id, { status });
}

// ============================================================================
// Evidence Links
// ============================================================================

/**
 * List evidence links for an assessment
 */
export async function listEvidenceLinks(
  assessmentId: string
): Promise<AssessmentEvidenceLink[]> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("No active session");
  }

  const { data, error } = await supabase
    .from("assessment_evidence_links")
    .select("*")
    .eq("assessment_id", assessmentId)
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to list evidence links: ${error.message}`);
  }

  return (data || []) as AssessmentEvidenceLink[];
}

/**
 * Add evidence link to assessment
 */
export async function addEvidenceLink(
  assessmentId: string,
  linkPayload: CreateEvidenceLinkPayload
): Promise<AssessmentEvidenceLink> {
  const context = await getCurrentUserContext();
  if (!context.organizationId) {
    throw new Error("Organization context required");
  }

  const { data, error } = await supabase
    .from("assessment_evidence_links")
    .insert({
      organization_id: context.organizationId,
      assessment_id: assessmentId,
      evidence_type: linkPayload.evidence_type,
      observation_id: linkPayload.observation_id || null,
      experience_id: linkPayload.experience_id || null,
      teacher_reflection_id: linkPayload.teacher_reflection_id || null,
      student_feedback_id: linkPayload.student_feedback_id || null,
      portfolio_artifact_id: linkPayload.portfolio_artifact_id || null,
      attendance_session_id: linkPayload.attendance_session_id || null,
      attendance_record_id: linkPayload.attendance_record_id || null,
      notes: linkPayload.notes || null,
      created_by: context.userId,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to add evidence link: ${error.message}`);
  }

  return data as AssessmentEvidenceLink;
}

/**
 * Update evidence link
 */
export async function updateEvidenceLink(
  linkId: string,
  payload: UpdateEvidenceLinkPayload
): Promise<AssessmentEvidenceLink> {
  const { data, error } = await supabase
    .from("assessment_evidence_links")
    .update(payload)
    .eq("id", linkId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update evidence link: ${error.message}`);
  }

  return data as AssessmentEvidenceLink;
}

/**
 * Archive evidence link (soft delete)
 */
export async function archiveEvidenceLink(linkId: string): Promise<void> {
  const { error } = await supabase
    .from("assessment_evidence_links")
    .update({
      archived_at: new Date().toISOString(),
    })
    .eq("id", linkId);

  if (error) {
    throw new Error(`Failed to archive evidence link: ${error.message}`);
  }
}

// ============================================================================
// Evidence Candidates (Read-only data for linking)
// ============================================================================

/**
 * List evidence candidates for linking
 */
export async function listEvidenceCandidates(
  filters: {
    learnerId?: string;
    experienceId?: string;
    teacherId?: string;
  }
): Promise<EvidenceCandidate[]> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("No active session");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, is_super_admin")
    .eq("id", session.user.id)
    .single();

  if (!profile) {
    throw new Error("Profile not found");
  }

  const candidates: EvidenceCandidate[] = [];

  // Fetch observations (Phase 2)
  if (filters.learnerId || filters.teacherId) {
    let obsQuery = supabase
      .from("observations")
      .select("id, title, description, created_at, created_by")
      .is("archived_at", null);

    if (!profile.is_super_admin && profile.organization_id) {
      obsQuery = obsQuery.eq("organization_id", profile.organization_id);
    }
    if (filters.learnerId) {
      obsQuery = obsQuery.eq("learner_id", filters.learnerId);
    }
    if (filters.teacherId) {
      obsQuery = obsQuery.eq("teacher_id", filters.teacherId);
    }

    const { data: observations } = await obsQuery;
    if (observations) {
      candidates.push(
        ...observations.map((obs) => ({
          id: obs.id,
          type: "observation" as const,
          title: obs.title,
          description: obs.description,
          created_at: obs.created_at,
          created_by: obs.created_by,
        }))
      );
    }
  }

  // Fetch experiences (Phase 2)
  if (filters.experienceId || filters.teacherId) {
    let expQuery = supabase
      .from("experiences")
      .select("id, title, description, created_at, created_by")
      .is("archived_at", null);

    if (!profile.is_super_admin && profile.organization_id) {
      expQuery = expQuery.eq("organization_id", profile.organization_id);
    }
    if (filters.experienceId) {
      expQuery = expQuery.eq("id", filters.experienceId);
    }
    if (filters.teacherId) {
      expQuery = expQuery.eq("created_by", filters.teacherId);
    }

    const { data: experiences } = await expQuery;
    if (experiences) {
      candidates.push(
        ...experiences.map((exp) => ({
          id: exp.id,
          type: "experience" as const,
          title: exp.title,
          description: exp.description,
          created_at: exp.created_at,
          created_by: exp.created_by,
        }))
      );
    }
  }

  // Add other evidence types as needed (teacher_reflection, student_feedback, portfolio_artifact, attendance_session, attendance_record)
  // Similar pattern for each type

  return candidates;
}

