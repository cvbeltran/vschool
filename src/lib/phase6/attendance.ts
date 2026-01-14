/**
 * Phase 6 Attendance Data Access Layer
 * Pedagogy Operations - Attendance Sessions & Teacher Self-Attendance
 * 
 * All functions respect RLS policies and filter by organization_id unless super admin.
 * No computation fields - purely operational.
 */

import { supabase } from "@/lib/supabase/client";

// ============================================================================
// Types
// ============================================================================

export interface AttendanceSession {
  id: string;
  organization_id: string;
  school_id: string | null;
  teacher_id: string;
  session_date: string;
  session_time: string | null;
  syllabus_id: string | null;
  lesson_log_id: string | null;
  experience_id: string | null;
  description: string | null;
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

export interface AttendanceRecord {
  id: string;
  organization_id: string;
  school_id: string | null;
  session_id: string;
  learner_id: string;
  status: "present" | "absent" | "late";
  notes: string | null;
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

export interface TeacherAttendance {
  id: string;
  organization_id: string;
  school_id: string | null;
  teacher_id: string;
  attendance_date: string;
  status: "present" | "absent" | "late";
  notes: string | null;
  session_id: string | null;
  experience_id: string | null;
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
}

export interface ListAttendanceSessionsFilters {
  teacher_id?: string;
  session_date_from?: string;
  session_date_to?: string;
  syllabus_id?: string;
  lesson_log_id?: string;
  experience_id?: string;
  search?: string;
  school_id?: string;
}

export interface CreateAttendanceSessionPayload {
  organization_id: string;
  school_id?: string | null;
  teacher_id: string;
  session_date: string;
  session_time?: string | null;
  syllabus_id?: string | null;
  lesson_log_id?: string | null;
  experience_id?: string | null;
  description?: string | null;
}

export interface UpdateAttendanceSessionPayload {
  session_date?: string;
  session_time?: string | null;
  syllabus_id?: string | null;
  lesson_log_id?: string | null;
  experience_id?: string | null;
  description?: string | null;
}

export interface UpsertAttendanceRecordPayload {
  learner_id: string;
  status: "present" | "absent" | "late";
  notes?: string | null;
}

export interface ListMyTeacherAttendanceFilters {
  attendance_date_from?: string;
  attendance_date_to?: string;
  status?: "present" | "absent" | "late";
  school_id?: string;
}

export interface CreateMyTeacherAttendancePayload {
  organization_id: string;
  school_id?: string | null;
  attendance_date: string;
  status: "present" | "absent" | "late";
  notes?: string | null;
  session_id?: string | null;
  experience_id?: string | null;
}

// ============================================================================
// Attendance Sessions CRUD
// ============================================================================

/**
 * List attendance sessions with optional filters
 */
export async function listAttendanceSessions(
  filters?: ListAttendanceSessionsFilters
): Promise<AttendanceSession[]> {
  let query = supabase
    .from("attendance_sessions")
    .select(`
      *,
      teacher:profiles!attendance_sessions_teacher_id_fkey(id, first_name, last_name),
      syllabus:syllabi(id, name)
    `)
    .is("archived_at", null)
    .order("session_date", { ascending: false });

  if (filters?.teacher_id) {
    query = query.eq("teacher_id", filters.teacher_id);
  }

  if (filters?.session_date_from) {
    query = query.gte("session_date", filters.session_date_from);
  }

  if (filters?.session_date_to) {
    query = query.lte("session_date", filters.session_date_to);
  }

  if (filters?.syllabus_id) {
    query = query.eq("syllabus_id", filters.syllabus_id);
  }

  if (filters?.lesson_log_id) {
    query = query.eq("lesson_log_id", filters.lesson_log_id);
  }

  if (filters?.experience_id) {
    query = query.eq("experience_id", filters.experience_id);
  }

  if (filters?.search) {
    query = query.ilike("description", `%${filters.search}%`);
  }

  if (filters?.school_id) {
    query = query.eq("school_id", filters.school_id);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to list attendance sessions: ${error.message}`);
  }

  return (data || []) as AttendanceSession[];
}

/**
 * Get a single attendance session by ID
 */
export async function getAttendanceSession(
  id: string
): Promise<AttendanceSession | null> {
  const { data, error } = await supabase
    .from("attendance_sessions")
    .select(`
      *,
      teacher:profiles!attendance_sessions_teacher_id_fkey(id, first_name, last_name),
      syllabus:syllabi(id, name)
    `)
    .eq("id", id)
    .is("archived_at", null)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(`Failed to get attendance session: ${error.message}`);
  }

  return data as AttendanceSession;
}

/**
 * Create a new attendance session
 */
export async function createAttendanceSession(
  payload: CreateAttendanceSessionPayload
): Promise<AttendanceSession> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("No active session");
  }

  const { data: attendanceSession, error } = await supabase
    .from("attendance_sessions")
    .insert({
      ...payload,
      created_by: session.user.id,
      updated_by: session.user.id,
    })
    .select(`
      *,
      teacher:profiles!attendance_sessions_teacher_id_fkey(id, first_name, last_name),
      syllabus:syllabi(id, name)
    `)
    .single();

  if (error) {
    throw new Error(`Failed to create attendance session: ${error.message}`);
  }

  return attendanceSession as AttendanceSession;
}

/**
 * Update an attendance session
 */
export async function updateAttendanceSession(
  id: string,
  payload: UpdateAttendanceSessionPayload
): Promise<AttendanceSession> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("No active session");
  }

  const { data: attendanceSession, error } = await supabase
    .from("attendance_sessions")
    .update({
      ...payload,
      updated_by: session.user.id,
    })
    .eq("id", id)
    .is("archived_at", null)
    .select(`
      *,
      teacher:profiles!attendance_sessions_teacher_id_fkey(id, first_name, last_name),
      syllabus:syllabi(id, name)
    `)
    .single();

  if (error) {
    throw new Error(`Failed to update attendance session: ${error.message}`);
  }

  return attendanceSession as AttendanceSession;
}

/**
 * Archive an attendance session (soft delete)
 */
export async function archiveAttendanceSession(id: string): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("No active session");
  }

  const { error } = await supabase
    .from("attendance_sessions")
    .update({
      archived_at: new Date().toISOString(),
      updated_by: session.user.id,
    })
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to archive attendance session: ${error.message}`);
  }
}

// ============================================================================
// Attendance Records
// ============================================================================

/**
 * List attendance records for a session
 */
export async function listAttendanceRecords(
  sessionId: string
): Promise<AttendanceRecord[]> {
  const { data, error } = await supabase
    .from("attendance_records")
    .select(`
      *,
      learner:students!attendance_records_learner_id_fkey(id, first_name, last_name, student_number)
    `)
    .eq("session_id", sessionId)
    .is("archived_at", null)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to list attendance records: ${error.message}`);
  }

  return (data || []) as AttendanceRecord[];
}

/**
 * Upsert attendance record (create or update)
 */
export async function upsertAttendanceRecord(
  sessionId: string,
  learnerId: string,
  status: "present" | "absent" | "late",
  notes?: string | null
): Promise<AttendanceRecord> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("No active session");
  }

  // Get organization_id and school_id from session
  const attendanceSession = await getAttendanceSession(sessionId);
  if (!attendanceSession) {
    throw new Error("Attendance session not found");
  }

  // Check if record exists
  const existing = await supabase
    .from("attendance_records")
    .select("id")
    .eq("session_id", sessionId)
    .eq("learner_id", learnerId)
    .is("archived_at", null)
    .single();

  if (existing.data) {
    // Update
    const { data: record, error } = await supabase
      .from("attendance_records")
      .update({
        status,
        notes: notes || null,
        updated_by: session.user.id,
      })
      .eq("id", existing.data.id)
      .select(`
        *,
        learner:students!attendance_records_learner_id_fkey(id, first_name, last_name, student_number)
      `)
      .single();

    if (error) {
      throw new Error(`Failed to update attendance record: ${error.message}`);
    }

    return record as AttendanceRecord;
  } else {
    // Create
    const { data: record, error } = await supabase
      .from("attendance_records")
      .insert({
        organization_id: attendanceSession.organization_id,
        school_id: attendanceSession.school_id,
        session_id: sessionId,
        learner_id: learnerId,
        status,
        notes: notes || null,
        created_by: session.user.id,
        updated_by: session.user.id,
      })
      .select(`
        *,
        learner:students!attendance_records_learner_id_fkey(id, first_name, last_name, student_number)
      `)
      .single();

    if (error) {
      throw new Error(`Failed to create attendance record: ${error.message}`);
    }

    return record as AttendanceRecord;
  }
}

// ============================================================================
// Teacher Self-Attendance
// ============================================================================

/**
 * List teacher self-attendance records
 */
export async function listMyTeacherAttendance(
  filters?: ListMyTeacherAttendanceFilters
): Promise<TeacherAttendance[]> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("No active session");
  }

  let query = supabase
    .from("teacher_attendance")
    .select(`
      *,
      teacher:profiles!teacher_attendance_teacher_id_fkey(id, first_name, last_name)
    `)
    .eq("teacher_id", session.user.id)
    .is("archived_at", null)
    .order("attendance_date", { ascending: false });

  if (filters?.attendance_date_from) {
    query = query.gte("attendance_date", filters.attendance_date_from);
  }

  if (filters?.attendance_date_to) {
    query = query.lte("attendance_date", filters.attendance_date_to);
  }

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  if (filters?.school_id) {
    query = query.eq("school_id", filters.school_id);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to list teacher attendance: ${error.message}`);
  }

  return (data || []) as TeacherAttendance[];
}

/**
 * Create teacher self-attendance record
 */
export async function createMyTeacherAttendance(
  payload: CreateMyTeacherAttendancePayload
): Promise<TeacherAttendance> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("No active session");
  }

  const { data: teacherAttendance, error } = await supabase
    .from("teacher_attendance")
    .insert({
      ...payload,
      teacher_id: session.user.id,
      created_by: session.user.id,
      updated_by: session.user.id,
    })
    .select(`
      *,
      teacher:profiles!teacher_attendance_teacher_id_fkey(id, first_name, last_name)
    `)
    .single();

  if (error) {
    throw new Error(`Failed to create teacher attendance: ${error.message}`);
  }

  return teacherAttendance as TeacherAttendance;
}
