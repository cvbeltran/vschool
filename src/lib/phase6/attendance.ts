/**
 * Phase 6 Attendance Data Access Layer
 * Pedagogy Operations - Attendance Sessions & Teacher Self-Attendance
 * 
 * All functions respect RLS policies and filter by organization_id unless super admin.
 * No computation fields - purely operational.
 */

import { supabase } from "@/lib/supabase/client";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Fetch teacher names from staff table and enrich attendance sessions
 */
async function enrichAttendanceSessionsWithTeacherNames(
  sessions: any[]
): Promise<AttendanceSession[]> {
  if (!sessions || sessions.length === 0) return sessions as AttendanceSession[];

  // Collect unique teacher IDs
  const teacherIds = [...new Set(sessions.map((s) => s.teacher_id))].filter(
    Boolean
  );

  if (teacherIds.length === 0) return sessions as AttendanceSession[];

  // Fetch staff records for these teacher IDs
  const { data: staffData } = await supabase
    .from("staff")
    .select("user_id, first_name, last_name")
    .in("user_id", teacherIds);

  // Create a map of user_id -> staff info
  const staffMap = new Map(
    (staffData || []).map((staff) => [
      staff.user_id,
      { id: staff.user_id, first_name: staff.first_name, last_name: staff.last_name },
    ])
  );

  // Enrich sessions with teacher info
  return sessions.map((session) => ({
    ...session,
    teacher: staffMap.get(session.teacher_id) || {
      id: session.teacher_id,
      first_name: null,
      last_name: null,
    },
  })) as AttendanceSession[];
}

/**
 * Fetch teacher names from staff table and enrich teacher attendance records
 */
async function enrichTeacherAttendanceWithTeacherNames(
  records: any[]
): Promise<TeacherAttendance[]> {
  if (!records || records.length === 0) return records as TeacherAttendance[];

  // Collect unique teacher IDs
  const teacherIds = [...new Set(records.map((r) => r.teacher_id))].filter(
    Boolean
  );

  if (teacherIds.length === 0) return records as TeacherAttendance[];

  // Fetch staff records for these teacher IDs
  const { data: staffData } = await supabase
    .from("staff")
    .select("user_id, first_name, last_name")
    .in("user_id", teacherIds);

  // Create a map of user_id -> staff info
  const staffMap = new Map(
    (staffData || []).map((staff) => [
      staff.user_id,
      { id: staff.user_id, first_name: staff.first_name, last_name: staff.last_name },
    ])
  );

  // Enrich records with teacher info
  return records.map((record) => ({
    ...record,
    teacher: staffMap.get(record.teacher_id) || {
      id: record.teacher_id,
      first_name: null,
      last_name: null,
    },
  })) as TeacherAttendance[];
}

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
  experience?: {
    id: string;
    name: string;
    experience_type: string | null;
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
      teacher_profile:profiles!attendance_sessions_teacher_id_fkey(id),
      syllabus:syllabi(id, name),
      experience:experiences(id, name, experience_type)
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
/**
 * Get attendance summary counts for a session
 */
export async function getAttendanceSessionSummary(sessionId: string): Promise<{
  present: number;
  absent: number;
  late: number;
  missing: number;
  total: number;
}> {
  const { data: records } = await supabase
    .from("attendance_records")
    .select("status")
    .eq("session_id", sessionId)
    .is("archived_at", null);

  const present = records?.filter((r) => r.status === "present").length || 0;
  const absent = records?.filter((r) => r.status === "absent").length || 0;
  const late = records?.filter((r) => r.status === "late").length || 0;
  const total = records?.length || 0;

  // Note: "missing" would require knowing expected learners, which we'll calculate in the UI
  return { present, absent, late, missing: 0, total };
}

export async function getAttendanceSession(
  id: string
): Promise<AttendanceSession | null> {
  const { data, error } = await supabase
    .from("attendance_sessions")
    .select(`
      *,
      teacher_profile:profiles!attendance_sessions_teacher_id_fkey(id),
      syllabus:syllabi(id, name),
      experience:experiences(id, name, experience_type)
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

  const enriched = await enrichAttendanceSessionsWithTeacherNames([data]);
  return enriched[0] || null;
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

  // Use the database function to create the attendance session (bypasses RLS)
  // The function will parse the date and time strings
  const rpcParams = {
    organization_id_param: payload.organization_id,
    school_id_param: payload.school_id ?? null,
    teacher_id_param: payload.teacher_id,
    session_date_param: payload.session_date,
    session_time_param: payload.session_time ?? null,
    syllabus_id_param: payload.syllabus_id ?? null,
    lesson_log_id_param: payload.lesson_log_id ?? null,
    experience_id_param: payload.experience_id ?? null,
    description_param: payload.description ?? null,
    user_id_param: session.user.id,
  };

  const { data: sessionId, error: rpcError } = await supabase.rpc("create_attendance_session", rpcParams);

  if (rpcError) {
    console.error("RPC Error details:", {
      message: rpcError.message,
      details: rpcError.details,
      hint: rpcError.hint,
      code: rpcError.code,
    });
    throw new Error(`Failed to create attendance session: ${rpcError.message}`);
  }

  if (!sessionId) {
    throw new Error("Failed to create attendance session: Permission denied or invalid data");
  }

  // Fetch the created session
  const { data: attendanceSession, error } = await supabase
    .from("attendance_sessions")
    .select(`
      *,
      teacher_profile:profiles!attendance_sessions_teacher_id_fkey(id),
      syllabus:syllabi(id, name)
    `)
    .eq("id", sessionId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch created attendance session: ${error.message}`);
  }

  const enriched = await enrichAttendanceSessionsWithTeacherNames([attendanceSession]);
  return enriched[0];
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
      teacher_profile:profiles!attendance_sessions_teacher_id_fkey(id),
      syllabus:syllabi(id, name)
    `)
    .single();

  if (error) {
    throw new Error(`Failed to update attendance session: ${error.message}`);
  }

  const enriched = await enrichAttendanceSessionsWithTeacherNames([attendanceSession]);
  return enriched[0];
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

  // Use the database function to create/update the attendance record (bypasses RLS)
  const rpcParams = {
    organization_id_param: attendanceSession.organization_id,
    school_id_param: attendanceSession.school_id ?? null,
    session_id_param: sessionId,
    learner_id_param: learnerId,
    status_param: status,
    notes_param: notes ?? null,
    user_id_param: session.user.id,
    existing_record_id_param: existing.data?.id ?? null,
  };

  const { data: recordId, error: rpcError } = await supabase.rpc("upsert_attendance_record", rpcParams);

  if (rpcError) {
    console.error("RPC Error details:", {
      message: rpcError.message,
      details: rpcError.details,
      hint: rpcError.hint,
      code: rpcError.code,
    });
    throw new Error(`Failed to create/update attendance record: ${rpcError.message}`);
  }

  if (!recordId) {
    throw new Error("Failed to create/update attendance record: Permission denied or invalid data");
  }

  // Fetch the created/updated record
  const { data: record, error } = await supabase
    .from("attendance_records")
    .select(`
      *,
      learner:students!attendance_records_learner_id_fkey(id, first_name, last_name, student_number)
    `)
    .eq("id", recordId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch attendance record: ${error.message}`);
  }

  return record as AttendanceRecord;
}

/**
 * List student's own attendance records
 * Students can view their own attendance records across all sessions
 */
export async function listMyStudentAttendance(
  filters?: {
    session_date_from?: string;
    session_date_to?: string;
    status?: "present" | "absent" | "late";
  }
): Promise<AttendanceRecord[]> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("No active session");
  }

  // Get student ID from email match
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user?.email) {
    throw new Error("User email not found");
  }

  // Get organization_id from profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", session.user.id)
    .single();

  if (!profile) {
    throw new Error("Profile not found");
  }

  // Find student by email
  const { data: student } = await supabase
    .from("students")
    .select("id")
    .eq("primary_email", user.user.email)
    .eq("organization_id", profile.organization_id)
    .maybeSingle();

  if (!student) {
    throw new Error("Student ID not found. Please ensure your account is linked to a student record.");
  }

  // First, get session IDs filtered by date if needed
  let sessionIds: string[] | null = null;
  if (filters?.session_date_from || filters?.session_date_to) {
    let sessionQuery = supabase
      .from("attendance_sessions")
      .select("id")
      .eq("organization_id", profile.organization_id)
      .is("archived_at", null);

    if (filters?.session_date_from) {
      sessionQuery = sessionQuery.gte("session_date", filters.session_date_from);
    }
    if (filters?.session_date_to) {
      sessionQuery = sessionQuery.lte("session_date", filters.session_date_to);
    }

    const { data: sessions } = await sessionQuery;
    sessionIds = sessions?.map((s) => s.id) || [];
    if (sessionIds.length === 0) {
      // No sessions match the date filter, return empty array
      return [];
    }
  }

  // Build query for attendance records
  let query = supabase
    .from("attendance_records")
    .select(`
      *,
      learner:students!attendance_records_learner_id_fkey(id, first_name, last_name, student_number),
      session:attendance_sessions!attendance_records_session_id_fkey(id, session_date, session_time, description)
    `)
    .eq("learner_id", student.id)
    .is("archived_at", null);

  if (sessionIds) {
    query = query.in("session_id", sessionIds);
  }

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  query = query.order("created_at", { ascending: false });

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to list student attendance: ${error.message}`);
  }

  return (data || []) as AttendanceRecord[];
}

/**
 * Archive attendance record (soft delete)
 */
export async function archiveAttendanceRecord(id: string): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("No active session");
  }

  const { error } = await supabase
    .from("attendance_records")
    .update({
      archived_at: new Date().toISOString(),
      updated_by: session.user.id,
    })
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to archive attendance record: ${error.message}`);
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
      teacher_profile:profiles!teacher_attendance_teacher_id_fkey(id)
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

  const records = (data || []) as any[];
  return await enrichTeacherAttendanceWithTeacherNames(records);
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

  // Use the database function to create the teacher attendance record (bypasses RLS)
  const rpcParams = {
    organization_id_param: payload.organization_id,
    school_id_param: payload.school_id ?? null,
    teacher_id_param: session.user.id, // Always use the current user's ID
    attendance_date_param: payload.attendance_date,
    status_param: payload.status,
    notes_param: payload.notes ?? null,
    session_id_param: payload.session_id ?? null,
    experience_id_param: payload.experience_id ?? null,
    user_id_param: session.user.id,
  };

  const { data: recordId, error: rpcError } = await supabase.rpc("create_teacher_attendance", rpcParams);

  if (rpcError) {
    console.error("RPC Error details:", {
      message: rpcError.message,
      details: rpcError.details,
      hint: rpcError.hint,
      code: rpcError.code,
    });
    throw new Error(`Failed to create teacher attendance: ${rpcError.message}`);
  }

  if (!recordId) {
    throw new Error("Failed to create teacher attendance: Permission denied or invalid data");
  }

  // Fetch the created record
  const { data: teacherAttendance, error } = await supabase
    .from("teacher_attendance")
    .select(`
      *,
      teacher_profile:profiles!teacher_attendance_teacher_id_fkey(id)
    `)
    .eq("id", recordId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch created teacher attendance: ${error.message}`);
  }

  const enriched = await enrichTeacherAttendanceWithTeacherNames([teacherAttendance]);
  return enriched[0];
}

/**
 * Update teacher self-attendance record
 */
export async function updateMyTeacherAttendance(
  id: string,
  payload: {
    attendance_date?: string;
    status?: "present" | "absent" | "late";
    notes?: string | null;
    session_id?: string | null;
    experience_id?: string | null;
  }
): Promise<TeacherAttendance> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("No active session");
  }

  const { data: teacherAttendance, error } = await supabase
    .from("teacher_attendance")
    .update({
      ...payload,
      updated_by: session.user.id,
    })
    .eq("id", id)
    .eq("teacher_id", session.user.id) // Ensure user can only update their own attendance
    .is("archived_at", null)
    .select(`
      *,
      teacher_profile:profiles!teacher_attendance_teacher_id_fkey(id)
    `)
    .single();

  if (error) {
    throw new Error(`Failed to update teacher attendance: ${error.message}`);
  }

  const enriched = await enrichTeacherAttendanceWithTeacherNames([teacherAttendance]);
  return enriched[0];
}

/**
 * Archive teacher self-attendance record (soft delete)
 */
export async function archiveMyTeacherAttendance(id: string): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("No active session");
  }

  const { error } = await supabase
    .from("teacher_attendance")
    .update({
      archived_at: new Date().toISOString(),
      updated_by: session.user.id,
    })
    .eq("id", id)
    .eq("teacher_id", session.user.id); // Ensure user can only archive their own attendance

  if (error) {
    throw new Error(`Failed to archive teacher attendance: ${error.message}`);
  }
}
