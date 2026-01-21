/**
 * Phase 7 Insights Data Access Layer (Server-side)
 * Narrative Analytics & Insight Layer
 * 
 * Server-side functions for querying Phase 7 insight views
 * Uses Supabase server client that respects RLS
 */

import { createSupabaseServerClient } from "@/lib/supabase/server-client";

// ============================================================================
// Types (re-exported from phase7/insights.ts for consistency)
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

// ============================================================================
// Observation Patterns
// ============================================================================

export async function getObservationCompetencyCounts(
  filters?: { competency_id?: string; domain_name?: string }
): Promise<ObservationCompetencyCount[]> {
  const supabase = await createSupabaseServerClient();
  
  let query = supabase
    .from("v_insight_observation_competency_counts")
    .select("*");

  if (filters?.competency_id) {
    query = query.eq("competency_id", filters.competency_id);
  }

  if (filters?.domain_name) {
    query = query.eq("domain_name", filters.domain_name);
  }

  const { data, error } = await query.order("competency_name", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch observation competency counts: ${error.message}`);
  }

  return (data || []) as ObservationCompetencyCount[];
}

export async function getObservationExperienceFrequency(
  filters?: { experience_id?: string; experience_type?: string }
): Promise<ObservationExperienceFrequency[]> {
  const supabase = await createSupabaseServerClient();
  
  let query = supabase
    .from("v_insight_observation_experience_frequency")
    .select("*");

  if (filters?.experience_id) {
    query = query.eq("experience_id", filters.experience_id);
  }

  if (filters?.experience_type) {
    query = query.eq("experience_type", filters.experience_type);
  }

  const { data, error } = await query.order("experience_name", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch observation experience frequency: ${error.message}`);
  }

  return (data || []) as ObservationExperienceFrequency[];
}

export async function getIndicatorOccurrenceCounts(
  filters?: { indicator_id?: string; competency_id?: string }
): Promise<IndicatorOccurrenceCount[]> {
  const supabase = await createSupabaseServerClient();
  
  let query = supabase
    .from("v_insight_indicator_occurrence_counts")
    .select("*");

  if (filters?.indicator_id) {
    query = query.eq("indicator_id", filters.indicator_id);
  }

  if (filters?.competency_id) {
    query = query.eq("competency_id", filters.competency_id);
  }

  const { data, error } = await query.order("indicator_description", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch indicator occurrence counts: ${error.message}`);
  }

  return (data || []) as IndicatorOccurrenceCount[];
}

// ============================================================================
// Teaching Adaptation
// ============================================================================

export async function getLessonLogVsPlanned(
  filters?: { syllabus_id?: string; teacher_id?: string }
): Promise<LessonLogVsPlanned[]> {
  const supabase = await createSupabaseServerClient();
  
  let query = supabase
    .from("v_insight_lesson_log_vs_planned")
    .select("*");

  if (filters?.syllabus_id) {
    query = query.eq("syllabus_id", filters.syllabus_id);
  }

  const { data, error } = await query.order("syllabus_name", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch lesson log vs planned: ${error.message}`);
  }

  return (data || []) as LessonLogVsPlanned[];
}

export async function getOffTrackReasons(
  filters?: { teacher_id?: string; syllabus_id?: string }
): Promise<OffTrackReason[]> {
  const supabase = await createSupabaseServerClient();
  
  let query = supabase
    .from("v_insight_off_track_reasons")
    .select("*");

  if (filters?.teacher_id) {
    query = query.eq("teacher_id", filters.teacher_id);
  }

  if (filters?.syllabus_id) {
    query = query.eq("syllabus_id", filters.syllabus_id);
  }

  const { data, error } = await query.order("syllabus_name", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch off-track reasons: ${error.message}`);
  }

  return (data || []) as OffTrackReason[];
}

export async function getSyllabusRevisionCounts(
  filters?: { teacher_id?: string }
): Promise<SyllabusRevisionCount[]> {
  const supabase = await createSupabaseServerClient();
  
  let query = supabase
    .from("v_insight_syllabus_revision_counts")
    .select("*");

  if (filters?.teacher_id) {
    query = query.eq("teacher_id", filters.teacher_id);
  }

  const { data, error } = await query.order("syllabus_revision_count", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch syllabus revision counts: ${error.message}`);
  }

  return (data || []) as SyllabusRevisionCount[];
}

// ============================================================================
// Reflection & Feedback
// ============================================================================

export async function getReflectionFrequency(
  filters?: {
    teacher_id?: string;
    school_year_id?: string;
    quarter?: string;
  }
): Promise<ReflectionFrequency[]> {
  const supabase = await createSupabaseServerClient();
  
  let query = supabase
    .from("v_insight_reflection_frequency")
    .select("*");

  if (filters?.teacher_id) {
    query = query.eq("teacher_id", filters.teacher_id);
  }

  if (filters?.school_year_id) {
    query = query.eq("school_year_id", filters.school_year_id);
  }

  if (filters?.quarter) {
    query = query.eq("quarter", filters.quarter);
  }

  // Order by school year label, then quarter
  const { data, error } = await query
    .order("school_year_label", { ascending: false })
    .order("quarter", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch reflection frequency: ${error.message}`);
  }

  return (data || []) as ReflectionFrequency[];
}

export async function getFeedbackVolumeByExperience(
  filters?: {
    experience_id?: string;
    experience_type?: string;
    quarter?: string;
  }
): Promise<FeedbackVolumeByExperience[]> {
  const supabase = await createSupabaseServerClient();
  
  let query = supabase
    .from("v_insight_feedback_volume_by_experience")
    .select("*");

  if (filters?.experience_id) {
    query = query.eq("experience_id", filters.experience_id);
  }

  if (filters?.experience_type) {
    query = query.eq("experience_type", filters.experience_type);
  }

  if (filters?.quarter) {
    query = query.eq("quarter", filters.quarter);
  }

  const { data, error } = await query
    .order("quarter", { ascending: true })
    .order("experience_name", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch feedback volume by experience: ${error.message}`);
  }

  return (data || []) as FeedbackVolumeByExperience[];
}

export async function getReflectionFeedbackAlignment(
  filters?: { experience_id?: string }
): Promise<ReflectionFeedbackAlignment[]> {
  const supabase = await createSupabaseServerClient();
  
  let query = supabase
    .from("v_insight_reflection_feedback_alignment")
    .select("*");

  if (filters?.experience_id) {
    query = query.eq("experience_id", filters.experience_id);
  }

  const { data, error } = await query.order("experience_name", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch reflection feedback alignment: ${error.message}`);
  }

  return (data || []) as ReflectionFeedbackAlignment[];
}

// ============================================================================
// Engagement Signals
// ============================================================================

export async function getPortfolioArtifactCounts(
  filters?: { student_id?: string }
): Promise<PortfolioArtifactCount[]> {
  const supabase = await createSupabaseServerClient();
  
  let query = supabase
    .from("v_insight_portfolio_artifact_counts")
    .select("*");

  if (filters?.student_id) {
    query = query.eq("student_id", filters.student_id);
  }

  const { data, error } = await query.order("student_last_name", { ascending: true })
    .order("student_first_name", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch portfolio artifact counts: ${error.message}`);
  }

  return (data || []) as PortfolioArtifactCount[];
}

export async function getAttendanceParticipation(
  filters?: { learner_id?: string }
): Promise<AttendanceParticipation[]> {
  const supabase = await createSupabaseServerClient();
  
  let query = supabase
    .from("v_insight_attendance_participation")
    .select("*");

  if (filters?.learner_id) {
    query = query.eq("learner_id", filters.learner_id);
  }

  const { data, error } = await query.order("student_last_name", { ascending: true })
    .order("student_first_name", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch attendance participation: ${error.message}`);
  }

  return (data || []) as AttendanceParticipation[];
}

export async function getExperienceParticipation(
  filters?: { experience_id?: string; experience_type?: string }
): Promise<ExperienceParticipation[]> {
  const supabase = await createSupabaseServerClient();
  
  let query = supabase
    .from("v_insight_experience_participation")
    .select("*");

  if (filters?.experience_id) {
    query = query.eq("experience_id", filters.experience_id);
  }

  if (filters?.experience_type) {
    query = query.eq("experience_type", filters.experience_type);
  }

  const { data, error } = await query.order("experience_name", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch experience participation: ${error.message}`);
  }

  return (data || []) as ExperienceParticipation[];
}

// ============================================================================
// Helper: Get current user role
// ============================================================================

export async function getCurrentUserRole(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  return profile?.role || null;
}

