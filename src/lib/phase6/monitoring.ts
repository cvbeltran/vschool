/**
 * Phase 6 Monitoring Data Access Layer
 * Pedagogy Operations - Progress Monitoring
 * 
 * All functions respect RLS policies and filter by organization_id unless super admin.
 * No computation fields - purely narrative flags and lists.
 */

import { supabase } from "@/lib/supabase/client";
import { listLessonLogs, LessonLog, listLearnerVerifications } from "./lesson-logs";
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
  // Enhanced metrics
  active_syllabi_count: number;
  weeks_logged_count: number;
  weeks_planned_count: number;
  missing_weeks_count: number;
  learners_with_unverified_objectives_count: number;
  sessions_with_attendance_gaps_count: number;
}

export interface SyllabusProgress {
  syllabus_id: string;
  syllabus_name: string;
  planned_weeks: number;
  weeks_logged: number;
  missing_weeks: number;
  last_logged_week: string | null;
  status: "on_track" | "needs_attention" | "off_track";
  teacher_name?: string | null;
}

export interface WeeklyProgress {
  week_id: string;
  week_number: number;
  week_start_date: string | null;
  week_end_date: string | null;
  lesson_log_status: "logged" | "missing";
  lesson_log_id: string | null;
  objectives_planned: number;
  learners_verified: number;
  learners_total: number;
  attendance_recorded: "yes" | "partial" | "missing";
  reflection_added: boolean;
}

export interface LearnerProgressSignal {
  learner_id: string;
  learner_name: string;
  weeks_participated: number;
  objectives_verified: number;
  pending_verifications: number;
  evidence_linked: boolean;
  attention_flag: "normal" | "needs_followup";
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

  // Filter active syllabi (published or draft, not archived)
  const activeSyllabi = filteredSyllabi.filter(
    (s) => s.status !== "archived"
  );

  // Get lesson logs
  const logsFilters: any = {};
  if (filters?.teacher_id) logsFilters.teacher_id = filters.teacher_id;
  if (filters?.syllabus_id) logsFilters.syllabus_id = filters.syllabus_id;
  if (filters?.school_id) logsFilters.school_id = filters.school_id;
  const lessonLogs = await listLessonLogs(logsFilters);

  // Count weeks
  let weeksPlanned = 0;
  let weeksLogged = 0;
  const missingLogs: MissingLog[] = [];
  
  for (const syllabus of filteredSyllabi) {
    const weeks = await listSyllabusWeeks(syllabus.id);
    weeksPlanned += weeks.length;
    
    for (const week of weeks) {
      const hasLog = lessonLogs.some(
        (log) =>
          log.syllabus_id === syllabus.id &&
          log.syllabus_week_id === week.id
      );
      if (hasLog) {
        weeksLogged++;
      } else {
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

  // Count learners with unverified objectives
  let learnersWithUnverified = 0;
  const learnerVerificationMap = new Map<string, Set<string>>();
  for (const log of lessonLogs) {
    const verifications = await listLearnerVerifications(log.id);
    for (const verification of verifications) {
      if (!verification.accomplished_flag) {
        if (!learnerVerificationMap.has(verification.learner_id)) {
          learnerVerificationMap.set(verification.learner_id, new Set());
        }
        learnerVerificationMap.get(verification.learner_id)!.add(log.id);
      }
    }
  }
  learnersWithUnverified = learnerVerificationMap.size;

  // Count sessions with attendance gaps (simplified - check if lesson logs have attendance sessions)
  let sessionsWithGaps = 0;
  for (const log of lessonLogs) {
    const { data: sessions } = await supabase
      .from("attendance_sessions")
      .select("id")
      .eq("lesson_log_id", log.id)
      .is("archived_at", null);
    
    if (!sessions || sessions.length === 0) {
      sessionsWithGaps++;
    }
  }

  return {
    total_syllabi: filteredSyllabi.length,
    total_lesson_logs: lessonLogs.length,
    missing_logs: missingLogs,
    off_track_logs: offTrackLogs,
    active_syllabi_count: activeSyllabi.length,
    weeks_logged_count: weeksLogged,
    weeks_planned_count: weeksPlanned,
    missing_weeks_count: missingLogs.length,
    learners_with_unverified_objectives_count: learnersWithUnverified,
    sessions_with_attendance_gaps_count: sessionsWithGaps,
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

/**
 * Get syllabus progress for all syllabi
 * For teachers: Only shows syllabi where they are contributors OR have lesson logs
 * For admins/principals: Shows all syllabi
 */
export async function getSyllabusProgress(
  filters?: ProgressOverviewFilters
): Promise<SyllabusProgress[]> {
  const syllabiFilters: any = {};
  if (filters?.program_id) syllabiFilters.program_id = filters.program_id;
  if (filters?.school_id) syllabiFilters.school_id = filters.school_id;
  const syllabi = await listSyllabi(syllabiFilters);

  // For teachers, filter to only syllabi they have access to (via RLS) or have lesson logs for
  let filteredSyllabi = filters?.syllabus_id
    ? syllabi.filter((s) => s.id === filters.syllabus_id)
    : syllabi;

  const logsFilters: any = {};
  if (filters?.teacher_id) logsFilters.teacher_id = filters.teacher_id;
  if (filters?.syllabus_id) logsFilters.syllabus_id = filters.syllabus_id;
  if (filters?.school_id) logsFilters.school_id = filters.school_id;
  const lessonLogs = await listLessonLogs(logsFilters);

  // Note: RLS policies already filter syllabi by teacher access (contributors can see their syllabi)
  // So filteredSyllabi already contains only syllabi the teacher can access

  const syllabusProgress: SyllabusProgress[] = [];

  for (const syllabus of filteredSyllabi) {
    const weeks = await listSyllabusWeeks(syllabus.id);
    const plannedWeeks = weeks.length;
    
    const syllabusLogs = lessonLogs.filter(
      (log) => log.syllabus_id === syllabus.id
    );
    const weeksLogged = new Set(
      syllabusLogs
        .map((log) => log.syllabus_week_id)
        .filter(Boolean)
    ).size;

    const missingWeeks = plannedWeeks - weeksLogged;

    // Find last logged week
    let lastLoggedWeek: string | null = null;
    if (syllabusLogs.length > 0) {
      const sortedLogs = syllabusLogs.sort(
        (a, b) => new Date(b.week_start_date).getTime() - new Date(a.week_start_date).getTime()
      );
      lastLoggedWeek = sortedLogs[0].week_start_date;
    }

    // Determine status
    let status: "on_track" | "needs_attention" | "off_track" = "on_track";
    if (missingWeeks > 0) {
      status = "needs_attention";
    }
    if (missingWeeks > 0 && !lastLoggedWeek) {
      status = "off_track";
    }
    // Check if last log is old (more than 2 weeks ago)
    if (lastLoggedWeek) {
      const daysSinceLastLog = Math.floor(
        (Date.now() - new Date(lastLoggedWeek).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceLastLog > 14 && missingWeeks > 0) {
        status = "off_track";
      }
    }

    // Get teacher name from first log or syllabus contributors
    let teacherName: string | null = null;
    if (syllabusLogs.length > 0 && syllabusLogs[0].teacher) {
      teacherName = `${syllabusLogs[0].teacher.first_name || ""} ${syllabusLogs[0].teacher.last_name || ""}`.trim() || null;
    }

    syllabusProgress.push({
      syllabus_id: syllabus.id,
      syllabus_name: syllabus.name,
      planned_weeks: plannedWeeks,
      weeks_logged: weeksLogged,
      missing_weeks: missingWeeks,
      last_logged_week: lastLoggedWeek,
      status,
      teacher_name: teacherName,
    });
  }

  return syllabusProgress;
}

/**
 * Get weekly progress for a specific syllabus
 */
export async function getWeeklyProgress(
  syllabusId: string
): Promise<WeeklyProgress[]> {
  const weeks = await listSyllabusWeeks(syllabusId);
  const lessonLogs = await listLessonLogs({ syllabus_id: syllabusId });

  // Get all learners for this syllabus (from lesson log verifications)
  // This represents learners who have participated in any lesson log for this syllabus
  const allLearnerIds = new Set<string>();
  for (const log of lessonLogs) {
    const verifications = await listLearnerVerifications(log.id);
    for (const verification of verifications) {
      allLearnerIds.add(verification.learner_id);
    }
  }
  const learnersTotal = allLearnerIds.size || 0; // Default to 0 if no learners found

  const weeklyProgress: WeeklyProgress[] = [];

  for (const week of weeks) {
    const weekLog = lessonLogs.find(
      (log) => log.syllabus_week_id === week.id
    );

    const lessonLogStatus: "logged" | "missing" = weekLog ? "logged" : "missing";
    const objectivesPlanned = week.objectives.length;

    let learnersVerified = 0;
    let attendanceRecorded: "yes" | "partial" | "missing" = "missing";
    let reflectionAdded = false;

    if (weekLog) {
      const verifications = await listLearnerVerifications(weekLog.id);
      learnersVerified = verifications.filter((v) => v.accomplished_flag).length;

      // Check attendance
      const { data: sessions } = await supabase
        .from("attendance_sessions")
        .select("id")
        .eq("lesson_log_id", weekLog.id)
        .is("archived_at", null);

      if (sessions && sessions.length > 0) {
        // Check if all learners have attendance records
        const { data: records } = await supabase
          .from("attendance_records")
          .select("learner_id")
          .in("session_id", sessions.map((s) => s.id))
          .is("archived_at", null);

        const learnersWithAttendance = new Set(
          records?.map((r) => r.learner_id) || []
        );

        if (learnersWithAttendance.size === learnersTotal) {
          attendanceRecorded = "yes";
        } else if (learnersWithAttendance.size > 0) {
          attendanceRecorded = "partial";
        }
      }

      // Check for reflection
      const { data: reflection } = await supabase
        .from("progress_reflections")
        .select("id")
        .eq("lesson_log_id", weekLog.id)
        .is("archived_at", null)
        .single();

      reflectionAdded = !!reflection;
    }

    weeklyProgress.push({
      week_id: week.id,
      week_number: week.week_number,
      week_start_date: week.week_start_date,
      week_end_date: week.week_end_date,
      lesson_log_status: lessonLogStatus,
      lesson_log_id: weekLog?.id || null,
      objectives_planned: objectivesPlanned,
      learners_verified: learnersVerified,
      learners_total: learnersTotal || 0,
      attendance_recorded: attendanceRecorded,
      reflection_added: reflectionAdded,
    });
  }

  return weeklyProgress.sort((a, b) => a.week_number - b.week_number);
}

/**
 * Get learner progress signals for a specific syllabus
 */
export async function getLearnerProgressSignals(
  syllabusId: string
): Promise<LearnerProgressSignal[]> {
  const lessonLogs = await listLessonLogs({ syllabus_id: syllabusId });
  const learnerMap = new Map<string, LearnerProgressSignal>();

  for (const log of lessonLogs) {
    const verifications = await listLearnerVerifications(log.id);
    
    for (const verification of verifications) {
      const learnerId = verification.learner_id;
      
      if (!learnerMap.has(learnerId)) {
        const learner = verification.learner;
        learnerMap.set(learnerId, {
          learner_id: learnerId,
          learner_name: learner
            ? `${learner.first_name || ""} ${learner.last_name || ""}`.trim() || "Unknown"
            : "Unknown",
          weeks_participated: 0,
          objectives_verified: 0,
          pending_verifications: 0,
          evidence_linked: false,
          attention_flag: "normal",
        });
      }

      const signal = learnerMap.get(learnerId)!;
      
      // Count weeks participated (if has any verification)
      if (verification.accomplished_flag) {
        signal.objectives_verified++;
      } else {
        signal.pending_verifications++;
      }

      // Check for evidence
      if (verification.evidence_text) {
        signal.evidence_linked = true;
      }

      // Check for attachments
      const { data: attachments } = await supabase
        .from("weekly_lesson_log_attachments")
        .select("id")
        .eq("learner_verification_id", verification.id)
        .is("archived_at", null)
        .limit(1);

      if (attachments && attachments.length > 0) {
        signal.evidence_linked = true;
      }
    }
  }

  // Count weeks participated
  for (const log of lessonLogs) {
    const verifications = await listLearnerVerifications(log.id);
    const learnersInWeek = new Set(
      verifications.map((v) => v.learner_id)
    );
    
    for (const learnerId of learnersInWeek) {
      const signal = learnerMap.get(learnerId);
      if (signal) {
        signal.weeks_participated++;
      }
    }
  }

  // Determine attention flags
  for (const signal of learnerMap.values()) {
    // If learner has lesson logs but no verification → Needs Follow-up
    // If learner has pending verifications → Needs Follow-up
    if (signal.pending_verifications > 0) {
      signal.attention_flag = "needs_followup";
    }
    // If learner has weeks participated but no evidence → Flag
    if (signal.weeks_participated > 0 && !signal.evidence_linked) {
      signal.attention_flag = "needs_followup";
    }
  }

  return Array.from(learnerMap.values());
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
