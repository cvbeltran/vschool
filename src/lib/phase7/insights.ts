/**
 * Phase 7 Insights Data Access Layer
 * Narrative Analytics & Insight Layer
 * 
 * Phase 7 is READ-ONLY - no writes to Phase 2-6 tables
 * No math beyond counts - no averages, percentages, rankings, or computation logic
 * Uses human-readable labels only
 * 
 * All functions respect RLS policies and filter by organization_id unless super admin.
 * Role-based access control:
 *   - Teachers: See only their own data
 *   - Admins/Principals: See org/school scoped data
 *   - Registrars: See read-only global data
 *   - Students: No access (not exposed in UI)
 */

import { supabase } from "@/lib/supabase/client";

// ============================================================================
// Types
// ============================================================================

export interface ObservationCompetencyCount {
  organization_id: string;
  competency_id: string;
  competency_name: string;
  domain_name: string;
  observation_count: number;
}

export interface ObservationExperienceFrequency {
  organization_id: string;
  experience_id: string;
  experience_name: string;
  experience_type: string | null;
  observation_count: number;
}

export interface IndicatorOccurrenceCount {
  organization_id: string;
  indicator_id: string;
  indicator_description: string;
  competency_id: string;
  competency_name: string;
  occurrence_count: number;
}

export interface LessonLogVsPlanned {
  organization_id: string;
  syllabus_id: string;
  syllabus_name: string;
  planned_weeks_count: number;
  lesson_logs_count: number;
}

export interface OffTrackReason {
  organization_id: string;
  teacher_id: string;
  syllabus_id: string | null;
  syllabus_name: string | null;
  reflection_text: string;
  mention_count: number;
}

export interface SyllabusRevisionCount {
  organization_id: string;
  teacher_id: string;
  syllabus_revision_count: number;
}

export interface ReflectionFrequency {
  organization_id: string;
  teacher_id: string;
  school_year_id: string | null;
  school_year_label: string | null;
  quarter: string | null;
  reflection_count: number;
}

export interface FeedbackVolumeByExperience {
  organization_id: string;
  experience_id: string | null;
  experience_name: string | null;
  experience_type: string | null;
  quarter: string;
  feedback_count: number;
}

export interface ReflectionFeedbackAlignment {
  organization_id: string;
  experience_id: string;
  experience_name: string;
  reflection_count: number;
  feedback_count: number;
}

export interface PortfolioArtifactCount {
  organization_id: string;
  student_id: string;
  student_first_name: string | null;
  student_last_name: string | null;
  student_number: string | null;
  artifact_count: number;
}

export interface AttendanceParticipation {
  organization_id: string;
  learner_id: string;
  student_first_name: string | null;
  student_last_name: string | null;
  student_number: string | null;
  total_sessions: number;
  present_count: number;
  absent_count: number;
  late_count: number;
}

export interface ExperienceParticipation {
  organization_id: string;
  experience_id: string;
  experience_name: string;
  experience_type: string | null;
  unique_learners_observed: number;
  unique_learners_attended: number;
  unique_learners_portfolio: number;
}

export interface TeacherInsights {
  observationPatterns: {
    competencyCounts: ObservationCompetencyCount[];
    experienceFrequencies: ObservationExperienceFrequency[];
    indicatorOccurrences: IndicatorOccurrenceCount[];
  };
  teachingAdaptation: {
    lessonLogVsPlanned: LessonLogVsPlanned[];
    offTrackReasons: OffTrackReason[];
    syllabusRevisions: SyllabusRevisionCount[];
  };
  reflectionFeedback: {
    reflectionFrequency: ReflectionFrequency[];
    feedbackVolume: FeedbackVolumeByExperience[];
    alignment: ReflectionFeedbackAlignment[];
  };
  engagementSignals: {
    portfolioArtifacts: PortfolioArtifactCount[];
    attendanceParticipation: AttendanceParticipation[];
    experienceParticipation: ExperienceParticipation[];
  };
}

export interface AdminInsights {
  pedagogyEvolution: {
    lessonLogVsPlanned: LessonLogVsPlanned[];
    syllabusRevisions: SyllabusRevisionCount[];
  };
  planVsExecution: {
    lessonLogVsPlanned: LessonLogVsPlanned[];
    offTrackReasons: OffTrackReason[];
  };
  reflectionCoverage: {
    reflectionFrequency: ReflectionFrequency[];
    feedbackVolume: FeedbackVolumeByExperience[];
    alignment: ReflectionFeedbackAlignment[];
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get current user's role
 */
async function getCurrentUserRole(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .single();

  return profile?.role || null;
}

/**
 * Get current user's organization ID
 */
async function getCurrentOrganizationId(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", session.user.id)
    .single();

  return profile?.organization_id || null;
}

/**
 * Check if user is super admin
 */
async function isSuperAdmin(): Promise<boolean> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return false;

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_super_admin")
    .eq("id", session.user.id)
    .single();

  return profile?.is_super_admin === true;
}

/**
 * Get current user ID
 */
async function getCurrentUserId(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user.id || null;
}

// ============================================================================
// Observation Patterns
// ============================================================================

/**
 * Get observation counts per competency
 * Teachers see only competencies they've observed
 * Admins see all competencies in their org
 */
export async function getObservationCompetencyCounts(
  filters?: { competency_id?: string; domain_id?: string }
): Promise<ObservationCompetencyCount[]> {
  const role = await getCurrentUserRole();
  const organizationId = await getCurrentOrganizationId();
  const userId = await getCurrentUserId();
  const superAdmin = await isSuperAdmin();

  if (!role || !organizationId) {
    throw new Error("User not authenticated or organization not found");
  }

  let query = supabase
    .from("v_insight_observation_competency_counts")
    .select("*")
    .eq("organization_id", organizationId);

  // Teachers see only competencies they've observed
  if (role === "teacher" && !superAdmin) {
    // Filter to competencies where user has created observations
    const { data: observedCompetencies } = await supabase
      .from("observations")
      .select("competency_id")
      .eq("created_by", userId!)
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .eq("status", "active");

    const competencyIds = [
      ...new Set((observedCompetencies || []).map((o) => o.competency_id)),
    ];

    if (competencyIds.length === 0) {
      return [];
    }

    query = query.in("competency_id", competencyIds);
  }

  if (filters?.competency_id) {
    query = query.eq("competency_id", filters.competency_id);
  }

  if (filters?.domain_id) {
    // Need to join with competencies to filter by domain
    // For now, we'll filter in application layer
  }

  const { data, error } = await query.order("observation_count", {
    ascending: false,
  });

  if (error) {
    throw new Error(
      `Failed to fetch observation competency counts: ${error.message}`
    );
  }

  return (data || []) as ObservationCompetencyCount[];
}

/**
 * Get observation frequency by experience
 * Teachers see only experiences they've observed
 * Admins see all experiences in their org
 */
export async function getObservationExperienceFrequency(
  filters?: { experience_id?: string; experience_type?: string }
): Promise<ObservationExperienceFrequency[]> {
  const role = await getCurrentUserRole();
  const organizationId = await getCurrentOrganizationId();
  const userId = await getCurrentUserId();
  const superAdmin = await isSuperAdmin();

  if (!role || !organizationId) {
    throw new Error("User not authenticated or organization not found");
  }

  let query = supabase
    .from("v_insight_observation_experience_frequency")
    .select("*")
    .eq("organization_id", organizationId);

  // Teachers see only experiences they've observed
  if (role === "teacher" && !superAdmin) {
    const { data: observedExperiences } = await supabase
      .from("observations")
      .select("experience_id")
      .eq("created_by", userId!)
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .eq("status", "active");

    const experienceIds = [
      ...new Set((observedExperiences || []).map((o) => o.experience_id)),
    ];

    if (experienceIds.length === 0) {
      return [];
    }

    query = query.in("experience_id", experienceIds);
  }

  if (filters?.experience_id) {
    query = query.eq("experience_id", filters.experience_id);
  }

  if (filters?.experience_type) {
    query = query.eq("experience_type", filters.experience_type);
  }

  const { data, error } = await query.order("observation_count", {
    ascending: false,
  });

  if (error) {
    throw new Error(
      `Failed to fetch observation experience frequency: ${error.message}`
    );
  }

  return (data || []) as ObservationExperienceFrequency[];
}

/**
 * Get indicator occurrence counts
 * Teachers see only indicators from their observations
 * Admins see all indicators in their org
 */
export async function getIndicatorOccurrenceCounts(
  filters?: { indicator_id?: string; competency_id?: string }
): Promise<IndicatorOccurrenceCount[]> {
  const role = await getCurrentUserRole();
  const organizationId = await getCurrentOrganizationId();
  const userId = await getCurrentUserId();
  const superAdmin = await isSuperAdmin();

  if (!role || !organizationId) {
    throw new Error("User not authenticated or organization not found");
  }

  let query = supabase
    .from("v_insight_indicator_occurrence_counts")
    .select("*")
    .eq("organization_id", organizationId);

  // Teachers see only indicators from their observations
  if (role === "teacher" && !superAdmin) {
    // Get observations created by current user
    const { data: myObservations } = await supabase
      .from("observations")
      .select("id")
      .eq("created_by", userId!)
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .eq("status", "active");

    const observationIds = (myObservations || []).map((o) => o.id);

    if (observationIds.length === 0) {
      return [];
    }

    // Get indicators from those observations
    const { data: observedIndicators } = await supabase
      .from("observation_indicator_links")
      .select("indicator_id")
      .in("observation_id", observationIds)
      .eq("organization_id", organizationId)
      .is("archived_at", null);

    const indicatorIds = [
      ...new Set((observedIndicators || []).map((oi) => oi.indicator_id)),
    ];

    if (indicatorIds.length === 0) {
      return [];
    }

    query = query.in("indicator_id", indicatorIds);
  }

  if (filters?.indicator_id) {
    query = query.eq("indicator_id", filters.indicator_id);
  }

  if (filters?.competency_id) {
    query = query.eq("competency_id", filters.competency_id);
  }

  const { data, error } = await query.order("occurrence_count", {
    ascending: false,
  });

  if (error) {
    throw new Error(
      `Failed to fetch indicator occurrence counts: ${error.message}`
    );
  }

  return (data || []) as IndicatorOccurrenceCount[];
}

// ============================================================================
// Teaching Adaptation
// ============================================================================

/**
 * Get lesson logs vs planned weeks comparison
 * Teachers see only their own syllabi
 * Admins see all syllabi in their org
 */
export async function getLessonLogVsPlanned(
  filters?: { syllabus_id?: string; teacher_id?: string }
): Promise<LessonLogVsPlanned[]> {
  const role = await getCurrentUserRole();
  const organizationId = await getCurrentOrganizationId();
  const userId = await getCurrentUserId();
  const superAdmin = await isSuperAdmin();

  if (!role || !organizationId) {
    throw new Error("User not authenticated or organization not found");
  }

  let query = supabase
    .from("v_insight_lesson_log_vs_planned")
    .select("*")
    .eq("organization_id", organizationId);

  // Teachers see only their own syllabi
  if (role === "teacher" && !superAdmin) {
    // Get syllabi where user is a contributor or creator
    const { data: syllabiCreated } = await supabase
      .from("syllabi")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("created_by", userId!)
      .is("archived_at", null);

    const { data: syllabiContributor } = await supabase
      .from("syllabus_contributors")
      .select("syllabus_id")
      .eq("teacher_id", userId!)
      .eq("organization_id", organizationId)
      .is("archived_at", null);

    const syllabusIds = [
      ...new Set([
        ...(syllabiCreated || []).map((s) => s.id),
        ...(syllabiContributor || []).map((sc) => sc.syllabus_id),
      ]),
    ];

    if (syllabusIds.length === 0) {
      return [];
    }

    query = query.in("syllabus_id", syllabusIds);
  }

  if (filters?.syllabus_id) {
    query = query.eq("syllabus_id", filters.syllabus_id);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(
      `Failed to fetch lesson log vs planned comparison: ${error.message}`
    );
  }

  return (data || []) as LessonLogVsPlanned[];
}

/**
 * Get off-track reasons from progress reflections
 * Teachers see only their own reflections
 * Admins see all reflections in their org
 */
export async function getOffTrackReasons(
  filters?: { teacher_id?: string; syllabus_id?: string }
): Promise<OffTrackReason[]> {
  const role = await getCurrentUserRole();
  const organizationId = await getCurrentOrganizationId();
  const userId = await getCurrentUserId();
  const superAdmin = await isSuperAdmin();

  if (!role || !organizationId) {
    throw new Error("User not authenticated or organization not found");
  }

  let query = supabase
    .from("v_insight_off_track_reasons")
    .select("*")
    .eq("organization_id", organizationId);

  // Teachers see only their own reflections
  if (role === "teacher" && !superAdmin) {
    query = query.eq("teacher_id", userId!);
  }

  if (filters?.teacher_id) {
    query = query.eq("teacher_id", filters.teacher_id);
  }

  if (filters?.syllabus_id) {
    query = query.eq("syllabus_id", filters.syllabus_id);
  }

  const { data, error } = await query.order("mention_count", {
    ascending: false,
  });

  if (error) {
    throw new Error(`Failed to fetch off-track reasons: ${error.message}`);
  }

  return (data || []) as OffTrackReason[];
}

/**
 * Get syllabus revision counts per teacher
 * Teachers see only their own revisions
 * Admins see all revisions in their org
 */
export async function getSyllabusRevisionCounts(
  filters?: { teacher_id?: string }
): Promise<SyllabusRevisionCount[]> {
  const role = await getCurrentUserRole();
  const organizationId = await getCurrentOrganizationId();
  const userId = await getCurrentUserId();
  const superAdmin = await isSuperAdmin();

  if (!role || !organizationId) {
    throw new Error("User not authenticated or organization not found");
  }

  let query = supabase
    .from("v_insight_syllabus_revision_counts")
    .select("*")
    .eq("organization_id", organizationId);

  // Teachers see only their own revisions
  if (role === "teacher" && !superAdmin) {
    query = query.eq("teacher_id", userId!);
  }

  if (filters?.teacher_id) {
    query = query.eq("teacher_id", filters.teacher_id);
  }

  const { data, error } = await query.order("syllabus_revision_count", {
    ascending: false,
  });

  if (error) {
    throw new Error(
      `Failed to fetch syllabus revision counts: ${error.message}`
    );
  }

  return (data || []) as SyllabusRevisionCount[];
}

// ============================================================================
// Reflection & Feedback Alignment
// ============================================================================

/**
 * Get reflection frequency by time period
 * Teachers see only their own reflections
 * Admins see all reflections in their org
 */
export async function getReflectionFrequency(
  filters?: {
    teacher_id?: string;
    school_year_id?: string;
    quarter?: string;
  }
): Promise<ReflectionFrequency[]> {
  const role = await getCurrentUserRole();
  const organizationId = await getCurrentOrganizationId();
  const userId = await getCurrentUserId();
  const superAdmin = await isSuperAdmin();

  if (!role || !organizationId) {
    throw new Error("User not authenticated or organization not found");
  }

  let query = supabase
    .from("v_insight_reflection_frequency")
    .select("*")
    .eq("organization_id", organizationId);

  // Teachers see only their own reflections
  if (role === "teacher" && !superAdmin) {
    query = query.eq("teacher_id", userId!);
  }

  if (filters?.teacher_id) {
    query = query.eq("teacher_id", filters.teacher_id);
  }

  if (filters?.school_year_id) {
    query = query.eq("school_year_id", filters.school_year_id);
  }

  if (filters?.quarter) {
    query = query.eq("quarter", filters.quarter);
  }

  const { data, error } = await query.order("reflection_count", {
    ascending: false,
  });

  if (error) {
    throw new Error(`Failed to fetch reflection frequency: ${error.message}`);
  }

  return (data || []) as ReflectionFrequency[];
}

/**
 * Get student feedback volume by experience type
 * Teachers see feedback for experiences they teach
 * Admins see all feedback in their org
 */
export async function getFeedbackVolumeByExperience(
  filters?: {
    experience_id?: string;
    experience_type?: string;
    quarter?: string;
  }
): Promise<FeedbackVolumeByExperience[]> {
  const role = await getCurrentUserRole();
  const organizationId = await getCurrentOrganizationId();
  const userId = await getCurrentUserId();
  const superAdmin = await isSuperAdmin();

  if (!role || !organizationId) {
    throw new Error("User not authenticated or organization not found");
  }

  let query = supabase
    .from("v_insight_feedback_volume_by_experience")
    .select("*")
    .eq("organization_id", organizationId);

  // Teachers see feedback for experiences they teach
  if (role === "teacher" && !superAdmin) {
    const { data: teacherFeedback } = await supabase
      .from("student_feedback")
      .select("experience_id")
      .eq("teacher_id", userId!)
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .eq("status", "completed");

    const experienceIds = [
      ...new Set(
        (teacherFeedback || [])
          .map((f) => f.experience_id)
          .filter((id): id is string => id !== null)
      ),
    ];

    if (experienceIds.length === 0) {
      return [];
    }

    query = query.in("experience_id", experienceIds);
  }

  if (filters?.experience_id) {
    query = query.eq("experience_id", filters.experience_id);
  }

  if (filters?.experience_type) {
    query = query.eq("experience_type", filters.experience_type);
  }

  if (filters?.quarter) {
    query = query.eq("quarter", filters.quarter);
  }

  const { data, error } = await query.order("feedback_count", {
    ascending: false,
  });

  if (error) {
    throw new Error(
      `Failed to fetch feedback volume by experience: ${error.message}`
    );
  }

  return (data || []) as FeedbackVolumeByExperience[];
}

/**
 * Get reflection and feedback alignment
 * Teachers see alignment for experiences they teach
 * Admins see all alignment in their org
 */
export async function getReflectionFeedbackAlignment(
  filters?: { experience_id?: string }
): Promise<ReflectionFeedbackAlignment[]> {
  const role = await getCurrentUserRole();
  const organizationId = await getCurrentOrganizationId();
  const userId = await getCurrentUserId();
  const superAdmin = await isSuperAdmin();

  if (!role || !organizationId) {
    throw new Error("User not authenticated or organization not found");
  }

  let query = supabase
    .from("v_insight_reflection_feedback_alignment")
    .select("*")
    .eq("organization_id", organizationId);

  // Teachers see alignment for experiences they teach
  if (role === "teacher" && !superAdmin) {
    // Get experiences where user has reflections or receives feedback
    const { data: teacherReflections } = await supabase
      .from("teacher_reflections")
      .select("experience_id")
      .eq("teacher_id", userId!)
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .eq("status", "completed");

    const { data: teacherFeedback } = await supabase
      .from("student_feedback")
      .select("experience_id")
      .eq("teacher_id", userId!)
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .eq("status", "completed");

    const experienceIds = [
      ...new Set([
        ...(teacherReflections || [])
          .map((r) => r.experience_id)
          .filter((id): id is string => id !== null),
        ...(teacherFeedback || [])
          .map((f) => f.experience_id)
          .filter((id): id is string => id !== null),
      ]),
    ];

    if (experienceIds.length === 0) {
      return [];
    }

    query = query.in("experience_id", experienceIds);
  }

  if (filters?.experience_id) {
    query = query.eq("experience_id", filters.experience_id);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(
      `Failed to fetch reflection feedback alignment: ${error.message}`
    );
  }

  return (data || []) as ReflectionFeedbackAlignment[];
}

// ============================================================================
// Engagement Signals
// ============================================================================

/**
 * Get portfolio artifact counts per learner
 * Teachers see artifacts for learners in their experiences
 * Admins see all artifacts in their org
 */
export async function getPortfolioArtifactCounts(
  filters?: { student_id?: string }
): Promise<PortfolioArtifactCount[]> {
  const role = await getCurrentUserRole();
  const organizationId = await getCurrentOrganizationId();
  const userId = await getCurrentUserId();
  const superAdmin = await isSuperAdmin();

  if (!role || !organizationId) {
    throw new Error("User not authenticated or organization not found");
  }

  // Students have no access to Phase 7 insights
  if (role === "student") {
    throw new Error("Students do not have access to Phase 7 insights");
  }

  let query = supabase
    .from("v_insight_portfolio_artifact_counts")
    .select("*")
    .eq("organization_id", organizationId);

  // Teachers see artifacts for learners in their experiences
  if (role === "teacher" && !superAdmin) {
    // Get students from observations, attendance, or feedback
    const { data: observedStudents } = await supabase
      .from("observations")
      .select("learner_id")
      .eq("created_by", userId!)
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .eq("status", "active");

    const { data: attendanceSessions } = await supabase
      .from("attendance_sessions")
      .select("id")
      .eq("teacher_id", userId!)
      .eq("organization_id", organizationId)
      .is("archived_at", null);

    const sessionIds = (attendanceSessions || []).map((s) => s.id);
    let attendedStudents: any[] = [];

    if (sessionIds.length > 0) {
      const { data: attendanceRecords } = await supabase
        .from("attendance_records")
        .select("learner_id")
        .in("session_id", sessionIds)
        .is("archived_at", null);

      attendedStudents = attendanceRecords || [];
    }

    const { data: feedbackStudents } = await supabase
      .from("student_feedback")
      .select("student_id")
      .eq("teacher_id", userId!)
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .eq("status", "completed");

    const studentIds = [
      ...new Set([
        ...(observedStudents || []).map((o) => o.learner_id),
        ...attendedStudents.map((a) => a.learner_id),
        ...(feedbackStudents || []).map((f) => f.student_id),
      ]),
    ];

    if (studentIds.length === 0) {
      return [];
    }

    query = query.in("student_id", studentIds);
  }

  if (filters?.student_id) {
    query = query.eq("student_id", filters.student_id);
  }

  const { data, error } = await query.order("artifact_count", {
    ascending: false,
  });

  if (error) {
    throw new Error(
      `Failed to fetch portfolio artifact counts: ${error.message}`
    );
  }

  return (data || []) as PortfolioArtifactCount[];
}

/**
 * Get attendance participation counts
 * Teachers see attendance for their sessions
 * Admins see all attendance in their org
 */
export async function getAttendanceParticipation(
  filters?: { learner_id?: string }
): Promise<AttendanceParticipation[]> {
  const role = await getCurrentUserRole();
  const organizationId = await getCurrentOrganizationId();
  const userId = await getCurrentUserId();
  const superAdmin = await isSuperAdmin();

  if (!role || !organizationId) {
    throw new Error("User not authenticated or organization not found");
  }

  // Students have no access to Phase 7 insights
  if (role === "student") {
    throw new Error("Students do not have access to Phase 7 insights");
  }

  let query = supabase
    .from("v_insight_attendance_participation")
    .select("*")
    .eq("organization_id", organizationId);

  // Teachers see attendance for their sessions
  if (role === "teacher" && !superAdmin) {
    const { data: sessions } = await supabase
      .from("attendance_sessions")
      .select("id")
      .eq("teacher_id", userId!)
      .eq("organization_id", organizationId)
      .is("archived_at", null);

    const sessionIds = (sessions || []).map((s) => s.id);

    if (sessionIds.length === 0) {
      return [];
    }

    const { data: records } = await supabase
      .from("attendance_records")
      .select("learner_id")
      .in("session_id", sessionIds)
      .is("archived_at", null);

    const learnerIds = [
      ...new Set((records || []).map((r) => r.learner_id)),
    ];

    if (learnerIds.length === 0) {
      return [];
    }

    query = query.in("learner_id", learnerIds);
  }

  if (filters?.learner_id) {
    query = query.eq("learner_id", filters.learner_id);
  }

  const { data, error } = await query.order("total_sessions", {
    ascending: false,
  });

  if (error) {
    throw new Error(
      `Failed to fetch attendance participation: ${error.message}`
    );
  }

  return (data || []) as AttendanceParticipation[];
}

/**
 * Get experience participation coverage
 * Teachers see participation for their experiences
 * Admins see all participation in their org
 */
export async function getExperienceParticipation(
  filters?: { experience_id?: string; experience_type?: string }
): Promise<ExperienceParticipation[]> {
  const role = await getCurrentUserRole();
  const organizationId = await getCurrentOrganizationId();
  const userId = await getCurrentUserId();
  const superAdmin = await isSuperAdmin();

  if (!role || !organizationId) {
    throw new Error("User not authenticated or organization not found");
  }

  // Students have no access to Phase 7 insights
  if (role === "student") {
    throw new Error("Students do not have access to Phase 7 insights");
  }

  let query = supabase
    .from("v_insight_experience_participation")
    .select("*")
    .eq("organization_id", organizationId);

  // Teachers see participation for their experiences
  if (role === "teacher" && !superAdmin) {
    // Get experiences where user has observations, reflections, or attendance sessions
    const { data: observedExperiences } = await supabase
      .from("observations")
      .select("experience_id")
      .eq("created_by", userId!)
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .eq("status", "active");

    const { data: reflectedExperiences } = await supabase
      .from("teacher_reflections")
      .select("experience_id")
      .eq("teacher_id", userId!)
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .eq("status", "completed");

    const { data: sessionExperiences } = await supabase
      .from("attendance_sessions")
      .select("experience_id")
      .eq("teacher_id", userId!)
      .eq("organization_id", organizationId)
      .is("archived_at", null);

    const experienceIds = [
      ...new Set([
        ...(observedExperiences || [])
          .map((o) => o.experience_id)
          .filter((id): id is string => id !== null),
        ...(reflectedExperiences || [])
          .map((r) => r.experience_id)
          .filter((id): id is string => id !== null),
        ...(sessionExperiences || [])
          .map((s) => s.experience_id)
          .filter((id): id is string => id !== null),
      ]),
    ];

    if (experienceIds.length === 0) {
      return [];
    }

    query = query.in("experience_id", experienceIds);
  }

  if (filters?.experience_id) {
    query = query.eq("experience_id", filters.experience_id);
  }

  if (filters?.experience_type) {
    query = query.eq("experience_type", filters.experience_type);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(
      `Failed to fetch experience participation: ${error.message}`
    );
  }

  return (data || []) as ExperienceParticipation[];
}

// ============================================================================
// Composite Insights
// ============================================================================

/**
 * Get all insights for teacher view
 */
export async function getTeacherInsights(): Promise<TeacherInsights> {
  const [
    competencyCounts,
    experienceFrequencies,
    indicatorOccurrences,
    lessonLogVsPlanned,
    offTrackReasons,
    syllabusRevisions,
    reflectionFrequency,
    feedbackVolume,
    alignment,
    portfolioArtifacts,
    attendanceParticipation,
    experienceParticipation,
  ] = await Promise.all([
    getObservationCompetencyCounts(),
    getObservationExperienceFrequency(),
    getIndicatorOccurrenceCounts(),
    getLessonLogVsPlanned(),
    getOffTrackReasons(),
    getSyllabusRevisionCounts(),
    getReflectionFrequency(),
    getFeedbackVolumeByExperience(),
    getReflectionFeedbackAlignment(),
    getPortfolioArtifactCounts(),
    getAttendanceParticipation(),
    getExperienceParticipation(),
  ]);

  return {
    observationPatterns: {
      competencyCounts,
      experienceFrequencies,
      indicatorOccurrences,
    },
    teachingAdaptation: {
      lessonLogVsPlanned,
      offTrackReasons,
      syllabusRevisions,
    },
    reflectionFeedback: {
      reflectionFrequency,
      feedbackVolume,
      alignment,
    },
    engagementSignals: {
      portfolioArtifacts,
      attendanceParticipation,
      experienceParticipation,
    },
  };
}

/**
 * Get all insights for admin view
 */
export async function getAdminInsights(): Promise<AdminInsights> {
  const [lessonLogVsPlanned, syllabusRevisions, offTrackReasons, reflectionFrequency, feedbackVolume, alignment] =
    await Promise.all([
      getLessonLogVsPlanned(),
      getSyllabusRevisionCounts(),
      getOffTrackReasons(),
      getReflectionFrequency(),
      getFeedbackVolumeByExperience(),
      getReflectionFeedbackAlignment(),
    ]);

  return {
    pedagogyEvolution: {
      lessonLogVsPlanned,
      syllabusRevisions,
    },
    planVsExecution: {
      lessonLogVsPlanned,
      offTrackReasons,
    },
    reflectionCoverage: {
      reflectionFrequency,
      feedbackVolume,
      alignment,
    },
  };
}

