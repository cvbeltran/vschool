/**
 * Phase 6 Monitoring Data Access Layer
 * Pedagogy Operations - Progress Monitoring
 * 
 * All functions respect RLS policies and filter by organization_id unless super admin.
 * No computation fields - purely narrative flags and lists.
 */

import { supabase } from "@/lib/supabase/client";
import { listLessonLogs, LessonLog } from "./lesson-logs";
import { listSyllabi, Syllabus } from "./syllabus";
import { listSyllabusWeeks, SyllabusWeek } from "./syllabus";

// ============================================================================
// Types
// ============================================================================

export interface ProgressOverview {
  total_syllabi: number;
  total_lesson_logs: number;
  missing_logs: MissingLog[];
  off_track_logs: OffTrackLog[];
}

export interface MissingLog {
  syllabus_id: string;
  syllabus_name: string;
  week_number: number;
  week_start_date: string | null;
  week_end_date: string | null;
  planned_objectives: string[];
}

export interface OffTrackLog {
  lesson_log_id: string;
  lesson_log_notes: string | null;
  teacher_name: string | null;
  syllabus_name: string | null;
  week_start_date: string;
  week_end_date: string;
  not_accomplished_count: number;
  reflection_id: string | null;
}

export interface ProgressReflection {
  id: string;
  organization_id: string;
  school_id: string | null;
  teacher_id: string;
  syllabus_id: string | null;
  lesson_log_id: string | null;
  reflection_text: string;
  reflection_prompt_id: string | null;
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
  syllabus?: {
    id: string;
    name: string;
  };
}

export interface ProgressOverviewFilters {
  school_year_id?: string;
  teacher_id?: string;
  syllabus_id?: string;
  program_id?: string;
  school_id?: string;
}

export interface ListProgressReflectionsFilters {
  teacher_id?: string;
  syllabus_id?: string;
  lesson_log_id?: string;
  school_id?: string;
}

export interface CreateProgressReflectionPayload {
  organization_id: string;
  school_id?: string | null;
  teacher_id: string;
  syllabus_id?: string | null;
  lesson_log_id?: string | null;
  reflection_text: string;
  reflection_prompt_id?: string | null;
}

// ============================================================================
// Progress Overview
// ============================================================================

/**
 * Get progress overview with missing logs and off-track flags
 * No computation - just lists and counts
 */
export async function getProgressOverview(
  filters?: ProgressOverviewFilters
): Promise<ProgressOverview> {
  // Get syllabi
  const syllabiFilters: any = {};
  if (filters?.program_id) syllabiFilters.program_id = filters.program_id;
  if (filters?.school_id) syllabiFilters.school_id = filters.school_id;
  const syllabi = await listSyllabi(syllabiFilters);

  // Filter by syllabus_id if provided
  const filteredSyllabi = filters?.syllabus_id
    ? syllabi.filter((s) => s.id === filters.syllabus_id)
    : syllabi;

  // Get lesson logs
  const logsFilters: any = {};
  if (filters?.teacher_id) logsFilters.teacher_id = filters.teacher_id;
  if (filters?.syllabus_id) logsFilters.syllabus_id = filters.syllabus_id;
  if (filters?.school_id) logsFilters.school_id = filters.school_id;
  const lessonLogs = await listLessonLogs(logsFilters);

  // Find missing logs (syllabus weeks without corresponding lesson logs)
  const missingLogs: MissingLog[] = [];
  for (const syllabus of filteredSyllabi) {
    const weeks = await listSyllabusWeeks(syllabus.id);
    for (const week of weeks) {
      const hasLog = lessonLogs.some(
        (log) =>
          log.syllabus_id === syllabus.id &&
          log.syllabus_week_id === week.id
      );
      if (!hasLog) {
        missingLogs.push({
          syllabus_id: syllabus.id,
          syllabus_name: syllabus.name,
          week_number: week.week_number,
          week_start_date: week.week_start_date,
          week_end_date: week.week_end_date,
          planned_objectives: week.objectives,
        });
      }
    }
  }

  // Find off-track logs (logs with not accomplished verifications)
  const offTrackLogs: OffTrackLog[] = [];
  for (const log of lessonLogs) {
    const { data: verifications } = await supabase
      .from("weekly_lesson_log_learner_verifications")
      .select("accomplished_flag")
      .eq("lesson_log_id", log.id)
      .is("archived_at", null);

    const notAccomplishedCount =
      verifications?.filter((v) => !v.accomplished_flag).length || 0;

    if (notAccomplishedCount > 0) {
      // Check for reflection
      const { data: reflection } = await supabase
        .from("progress_reflections")
        .select("id")
        .eq("lesson_log_id", log.id)
        .is("archived_at", null)
        .single();

      offTrackLogs.push({
        lesson_log_id: log.id,
        lesson_log_notes: log.notes,
        teacher_name: log.teacher
          ? `${log.teacher.first_name || ""} ${log.teacher.last_name || ""}`.trim()
          : null,
        syllabus_name: log.syllabus?.name || null,
        week_start_date: log.week_start_date,
        week_end_date: log.week_end_date,
        not_accomplished_count: notAccomplishedCount,
        reflection_id: reflection?.id || null,
      });
    }
  }

  return {
    total_syllabi: filteredSyllabi.length,
    total_lesson_logs: lessonLogs.length,
    missing_logs: missingLogs,
    off_track_logs: offTrackLogs,
  };
}

/**
 * List missing logs for planned weeks
 */
export async function listMissingLogs(
  filters?: ProgressOverviewFilters
): Promise<MissingLog[]> {
  const overview = await getProgressOverview(filters);
  return overview.missing_logs;
}

/**
 * List off-track logs (with not accomplished entries)
 */
export async function listOffTrackLogs(
  filters?: ProgressOverviewFilters
): Promise<OffTrackLog[]> {
  const overview = await getProgressOverview(filters);
  return overview.off_track_logs;
}

// ============================================================================
// Progress Reflections
// ============================================================================

/**
 * List progress reflections
 */
export async function listProgressReflections(
  filters?: ListProgressReflectionsFilters
): Promise<ProgressReflection[]> {
  let query = supabase
    .from("progress_reflections")
    .select(`
      *,
      teacher:profiles!progress_reflections_teacher_id_fkey(id, first_name, last_name),
      syllabus:syllabi(id, name)
    `)
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  if (filters?.teacher_id) {
    query = query.eq("teacher_id", filters.teacher_id);
  }

  if (filters?.syllabus_id) {
    query = query.eq("syllabus_id", filters.syllabus_id);
  }

  if (filters?.lesson_log_id) {
    query = query.eq("lesson_log_id", filters.lesson_log_id);
  }

  if (filters?.school_id) {
    query = query.eq("school_id", filters.school_id);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to list progress reflections: ${error.message}`);
  }

  return (data || []) as ProgressReflection[];
}

/**
 * Create a progress reflection
 */
export async function createProgressReflection(
  payload: CreateProgressReflectionPayload
): Promise<ProgressReflection> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("No active session");
  }

  const { data: reflection, error } = await supabase
    .from("progress_reflections")
    .insert({
      ...payload,
      created_by: session.user.id,
      updated_by: session.user.id,
    })
    .select(`
      *,
      teacher:profiles!progress_reflections_teacher_id_fkey(id, first_name, last_name),
      syllabus:syllabi(id, name)
    `)
    .single();

  if (error) {
    throw new Error(`Failed to create progress reflection: ${error.message}`);
  }

  return reflection as ProgressReflection;
}
