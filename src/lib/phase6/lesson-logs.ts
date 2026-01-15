/**
 * Phase 6 Lesson Logs Data Access Layer
 * Pedagogy Operations - Weekly Lesson Logs
 * 
 * All functions respect RLS policies and filter by organization_id unless super admin.
 * No computation fields - purely operational.
 */

import { supabase } from "@/lib/supabase/client";

// ============================================================================
// Types
// ============================================================================

export interface LessonLog {
  id: string;
  organization_id: string;
  school_id: string | null;
  teacher_id: string;
  syllabus_id: string | null;
  syllabus_week_id: string | null;
  week_start_date: string;
  week_end_date: string;
  status: "draft" | "submitted" | "archived";
  notes: string | null;
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

export interface LessonLogItem {
  id: string;
  organization_id: string;
  lesson_log_id: string;
  objective: string;
  activity: string;
  verification_method: string | null;
  display_order: number | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  archived_at: string | null;
}

export interface LearnerVerification {
  id: string;
  organization_id: string;
  lesson_log_id: string;
  learner_id: string;
  evidence_text: string | null;
  accomplished_flag: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  archived_at: string | null;
  // Joined fields
  learner?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    student_number: string | null;
  };
}

export interface ListLessonLogsFilters {
  teacher_id?: string;
  syllabus_id?: string;
  week_start_date?: string;
  week_end_date?: string;
  status?: "draft" | "submitted" | "archived";
  search?: string;
  school_id?: string;
}

export interface CreateLessonLogPayload {
  organization_id: string;
  school_id?: string | null;
  teacher_id: string;
  syllabus_id?: string | null;
  syllabus_week_id?: string | null;
  week_start_date: string;
  week_end_date: string;
  status?: "draft" | "submitted";
  notes?: string | null;
  items?: Array<{
    objective: string;
    activity: string;
    verification_method?: string | null;
    display_order?: number;
  }>;
}

export interface UpdateLessonLogPayload {
  syllabus_id?: string | null;
  syllabus_week_id?: string | null;
  week_start_date?: string;
  week_end_date?: string;
  status?: "draft" | "submitted" | "archived";
  notes?: string | null;
}

export interface UpsertLearnerVerificationPayload {
  learner_id: string;
  evidence_text?: string | null;
  accomplished_flag: boolean;
}

// ============================================================================
// Lesson Logs CRUD
// ============================================================================

/**
 * List lesson logs with optional filters
 */
export async function listLessonLogs(
  filters?: ListLessonLogsFilters
): Promise<LessonLog[]> {
  let query = supabase
    .from("weekly_lesson_logs")
    .select(`
      *,
      teacher:profiles!weekly_lesson_logs_teacher_id_fkey(id, first_name, last_name),
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

  if (filters?.week_start_date) {
    query = query.gte("week_start_date", filters.week_start_date);
  }

  if (filters?.week_end_date) {
    query = query.lte("week_end_date", filters.week_end_date);
  }

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  if (filters?.search) {
    query = query.or(`notes.ilike.%${filters.search}%`);
  }

  if (filters?.school_id) {
    query = query.eq("school_id", filters.school_id);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to list lesson logs: ${error.message}`);
  }

  return (data || []) as LessonLog[];
}

/**
 * Get a single lesson log by ID
 */
export async function getLessonLog(id: string): Promise<LessonLog | null> {
  const { data, error } = await supabase
    .from("weekly_lesson_logs")
    .select(`
      *,
      teacher:profiles!weekly_lesson_logs_teacher_id_fkey(id, first_name, last_name),
      syllabus:syllabi(id, name)
    `)
    .eq("id", id)
    .is("archived_at", null)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(`Failed to get lesson log: ${error.message}`);
  }

  return data as LessonLog;
}

/**
 * Create a new lesson log
 * Supports "create from syllabus week" by copying planned data
 */
export async function createLessonLog(
  payload: CreateLessonLogPayload
): Promise<LessonLog> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("No active session");
  }

  const { data: log, error } = await supabase
    .from("weekly_lesson_logs")
    .insert({
      ...payload,
      status: payload.status || "draft",
      created_by: session.user.id,
      updated_by: session.user.id,
    })
    .select(`
      *,
      teacher:profiles!weekly_lesson_logs_teacher_id_fkey(id, first_name, last_name),
      syllabus:syllabi(id, name)
    `)
    .single();

  if (error) {
    throw new Error(`Failed to create lesson log: ${error.message}`);
  }

  // Create items if provided
  if (payload.items && payload.items.length > 0) {
    const items = payload.items.map((item, index) => ({
      organization_id: payload.organization_id,
      lesson_log_id: log.id,
      objective: item.objective,
      activity: item.activity,
      verification_method: item.verification_method || null,
      display_order: item.display_order ?? index,
      created_by: session.user.id,
      updated_by: session.user.id,
    }));

    const { error: itemsError } = await supabase
      .from("weekly_lesson_log_items")
      .insert(items);

    if (itemsError) {
      console.warn("Failed to create lesson log items:", itemsError);
      // Don't throw - log is created successfully
    }
  }

  return log as LessonLog;
}

/**
 * Update a lesson log
 */
export async function updateLessonLog(
  id: string,
  payload: UpdateLessonLogPayload
): Promise<LessonLog> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("No active session");
  }

  const { data: log, error } = await supabase
    .from("weekly_lesson_logs")
    .update({
      ...payload,
      updated_by: session.user.id,
    })
    .eq("id", id)
    .is("archived_at", null)
    .select(`
      *,
      teacher:profiles!weekly_lesson_logs_teacher_id_fkey(id, first_name, last_name),
      syllabus:syllabi(id, name)
    `)
    .single();

  if (error) {
    throw new Error(`Failed to update lesson log: ${error.message}`);
  }

  return log as LessonLog;
}

/**
 * Archive a lesson log (soft delete)
 */
export async function archiveLessonLog(id: string): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("No active session");
  }

  const { error } = await supabase
    .from("weekly_lesson_logs")
    .update({
      archived_at: new Date().toISOString(),
      updated_by: session.user.id,
    })
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to archive lesson log: ${error.message}`);
  }
}

// ============================================================================
// Lesson Log Items
// ============================================================================

/**
 * List items for a lesson log
 */
export async function listLessonLogItems(
  lessonLogId: string
): Promise<LessonLogItem[]> {
  const { data, error } = await supabase
    .from("weekly_lesson_log_items")
    .select("*")
    .eq("lesson_log_id", lessonLogId)
    .is("archived_at", null)
    .order("display_order", { ascending: true, nullsFirst: false });

  if (error) {
    throw new Error(`Failed to list lesson log items: ${error.message}`);
  }

  return (data || []) as LessonLogItem[];
}

// ============================================================================
// Learner Verifications
// ============================================================================

/**
 * List learner verifications for a lesson log
 */
export async function listLearnerVerifications(
  logId: string
): Promise<LearnerVerification[]> {
  const { data, error } = await supabase
    .from("weekly_lesson_log_learner_verifications")
    .select(`
      *,
      learner:students!weekly_lesson_log_learner_verifications_learner_id_fkey(id, first_name, last_name, student_number)
    `)
    .eq("lesson_log_id", logId)
    .is("archived_at", null)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to list learner verifications: ${error.message}`);
  }

  return (data || []) as LearnerVerification[];
}

/**
 * Upsert learner verification (create or update)
 */
export async function upsertLessonLogLearnerVerification(
  logId: string,
  learnerId: string,
  payload: UpsertLearnerVerificationPayload
): Promise<LearnerVerification> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("No active session");
  }

  // Get organization_id from lesson log
  const log = await getLessonLog(logId);
  if (!log) {
    throw new Error("Lesson log not found");
  }

  // Check if verification exists
  const existing = await supabase
    .from("weekly_lesson_log_learner_verifications")
    .select("id")
    .eq("lesson_log_id", logId)
    .eq("learner_id", learnerId)
    .is("archived_at", null)
    .single();

  if (existing.data) {
    // Update
    const { data: verification, error } = await supabase
      .from("weekly_lesson_log_learner_verifications")
      .update({
        ...payload,
        updated_by: session.user.id,
      })
      .eq("id", existing.data.id)
      .select(`
        *,
        learner:students!weekly_lesson_log_learner_verifications_learner_id_fkey(id, first_name, last_name, student_number)
      `)
      .single();

    if (error) {
      throw new Error(`Failed to update learner verification: ${error.message}`);
    }

    return verification as LearnerVerification;
  } else {
    // Create
    const { data: verification, error } = await supabase
      .from("weekly_lesson_log_learner_verifications")
      .insert({
        organization_id: log.organization_id,
        lesson_log_id: logId,
        ...payload,
        learner_id: learnerId, // Override payload.learner_id if present
        created_by: session.user.id,
        updated_by: session.user.id,
      })
      .select(`
        *,
        learner:students!weekly_lesson_log_learner_verifications_learner_id_fkey(id, first_name, last_name, student_number)
      `)
      .single();

    if (error) {
      throw new Error(`Failed to create learner verification: ${error.message}`);
    }

    return verification as LearnerVerification;
  }
}
