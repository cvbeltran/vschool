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
    year_label: string;
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
  organization_id?: string | null; // Optional: if provided, will be used instead of getting from profile
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
  organization_id?: string | null; // Optional: if provided, will be used instead of getting from profile
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
  // Optional: If provided, will be used instead of fetching from profile
  organization_id?: string | null;
  role?: string | null;
  is_super_admin?: boolean;
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
          .select("id, year_label")
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
    (schoolYearData.data || []).map((sy) => [sy.id, { id: sy.id, year_label: sy.year_label }])
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

  // Use provided context or fetch from profile
  let organizationId: string | null = null;
  let role: string | null = null;
  let isSuperAdmin = false;

  if (filters?.organization_id !== undefined && filters?.role !== undefined && filters?.is_super_admin !== undefined) {
    // Use provided context
    organizationId = filters.organization_id;
    role = filters.role;
    isSuperAdmin = filters.is_super_admin === true;
  } else {
    // Fetch from profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("organization_id, school_id, role, is_super_admin")
      .eq("id", session.user.id)
      .single();

    if (profileError) {
      console.error("Profile fetch error:", {
        error: profileError,
        code: profileError.code,
        message: profileError.message,
        details: profileError.details,
        hint: profileError.hint,
        userId: session.user.id,
      });
      
      // Provide more specific error message based on error code
      if (profileError.code === "PGRST116") {
        throw new Error("Profile not found. Please contact an administrator to set up your profile.");
      } else if (profileError.code === "42501") {
        throw new Error("Permission denied. You may not have access to view your profile. Please contact an administrator.");
      } else {
        throw new Error(`Failed to load profile: ${profileError.message || "Unknown error"}. Please ensure your profile is set up correctly.`);
      }
    }

    if (!profile) {
      console.error("Profile is null but no error was returned", { userId: session.user.id });
      throw new Error("Profile not found. Please contact an administrator to set up your profile.");
    }

    organizationId = profile.organization_id;
    role = profile.role;
    isSuperAdmin = profile.is_super_admin === true;
  }

  const scope = filters?.scope || (role === "teacher" ? "mine" : "org");

  let query = supabase
    .from("assessments")
    .select(`
      *,
      teacher:profiles!assessments_teacher_id_fkey(id),
      learner:students!assessments_learner_id_fkey(id, first_name, last_name, student_number),
      label:assessment_labels!assessments_label_id_fkey(id, label_text, description),
      school_year:school_years(id, year_label)
    `)
    .is("archived_at", null);

  // Scope filtering
  if (!isSuperAdmin && organizationId) {
    query = query.eq("organization_id", organizationId);
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
      school_year:school_years(id, year_label)
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
  
  // Use provided organizationId or get from context
  const organizationId = payload.organization_id || context.organizationId;
  if (!organizationId) {
    throw new Error("Organization context required. Please ensure your profile has an organization_id set.");
  }

  const { data, error } = await supabase
    .from("assessments")
    .insert({
      organization_id: organizationId,
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
      school_year:school_years(id, year_label)
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
      school_year:school_years(id, year_label)
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
  
  // Use provided organizationId or get from context
  const organizationId = linkPayload.organization_id || context.organizationId;
  if (!organizationId) {
    throw new Error("Organization context required. Please ensure your profile has an organization_id set.");
  }

  const { data, error } = await supabase
    .from("assessment_evidence_links")
    .insert({
      organization_id: organizationId,
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
  const context = await getCurrentUserContext();
  
  // First, fetch the link to verify the user is the creator and get created_by
  const { data: link, error: fetchError } = await supabase
    .from("assessment_evidence_links")
    .select("created_by, organization_id, assessment_id")
    .eq("id", linkId)
    .single();

  if (fetchError || !link) {
    throw new Error(`Failed to fetch evidence link: ${fetchError?.message || "Link not found"}`);
  }

  // Debug: Log the link details
  console.log("Archive Evidence Link Debug:", {
    linkId,
    userId: context.userId,
    linkCreatedBy: link.created_by,
    linkOrgId: link.organization_id,
    assessmentId: link.assessment_id,
    isCreator: link.created_by === context.userId,
    createdByIsNull: link.created_by === null,
    createdByIsUndefined: link.created_by === undefined,
  });

  // Also check the assessment details
  const { data: assessment, error: assessmentError } = await supabase
    .from("assessments")
    .select("id, teacher_id, organization_id, archived_at, status")
    .eq("id", link.assessment_id)
    .single();

  console.log("Archive Evidence Link - Assessment Debug:", {
    assessmentExists: !!assessment,
    assessmentError: assessmentError?.message,
    assessmentTeacherId: assessment?.teacher_id,
    assessmentOrgId: assessment?.organization_id,
    linkOrgId: link.organization_id,
    orgMatch: assessment?.organization_id === link.organization_id,
    isTeacherOwner: assessment?.teacher_id === context.userId,
    assessmentArchivedAt: assessment?.archived_at,
    assessmentStatus: assessment?.status,
  });

  // Verify the user is the creator OR check if they own the assessment
  if (link.created_by !== context.userId) {
    // Check if user owns the assessment
    const { data: assessment, error: assessmentError } = await supabase
      .from("assessments")
      .select("teacher_id, organization_id")
      .eq("id", link.assessment_id)
      .single();

    if (assessmentError || !assessment) {
      throw new Error("You can only archive evidence links you created or for assessments you own");
    }

    if (assessment.teacher_id !== context.userId) {
      throw new Error("You can only archive evidence links you created or for assessments you own");
    }

    console.log("Archive allowed: User owns the assessment", {
      assessmentTeacherId: assessment.teacher_id,
      userId: context.userId,
    });
  }

  // Test: Check if we can select the row (RLS check)
  const { data: testSelect, error: selectError } = await supabase
    .from("assessment_evidence_links")
    .select("id, created_by, archived_at")
    .eq("id", linkId)
    .single();
  
  console.log("RLS Test - Can select row:", {
    canSelect: !!testSelect,
    selectError: selectError?.message,
    currentArchivedAt: testSelect?.archived_at,
  });

  // Update with explicit created_by to ensure it's preserved
  const { error } = await supabase
    .from("assessment_evidence_links")
    .update({
      archived_at: new Date().toISOString(),
      created_by: link.created_by, // Explicitly preserve created_by
    })
    .eq("id", linkId);

  if (error) {
    // Log the full error object to see what we're dealing with
    console.error("Archive Evidence Link Error - Full Error Object:", error);
    console.error("Archive Evidence Link Error - Error Stringified:", JSON.stringify(error, null, 2));
    console.error("Archive Evidence Link Error - Error Properties:", {
      message: error?.message,
      code: error?.code,
      details: error?.details,
      hint: error?.hint,
      hasMessage: 'message' in error,
      hasCode: 'code' in error,
      errorKeys: Object.keys(error || {}),
    });
    
    const errorMessage = error?.message || error?.toString() || 'Unknown error';
    throw new Error(`Failed to archive evidence link: ${errorMessage}`);
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

