/**
 * Phase 6 Operations Data Access Layer
 * Pedagogy Operations - Batches, Sections, Attendance, Portfolio
 * 
 * All functions respect RLS policies and filter by organization_id/school_id.
 * All mutations create audit log entries.
 */

import { supabase } from "@/lib/supabase/client";
import { createAuditLog } from "@/lib/audit";

// ============================================================================
// Types - Batches
// ============================================================================

export interface Batch {
  id: string;
  organization_id: string;
  school_id?: string | null;
  program_id?: string | null;
  level_id?: string | null;
  year_id?: string | null;
  code: string;
  name: string;
  status: string | null;
  start_term_id?: string | null;
  end_term_id?: string | null;
  notes?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateBatchPayload {
  organization_id: string;
  school_id?: string | null;
  program_id?: string | null;
  level_id?: string | null;
  year_id?: string | null;
  code: string;
  name: string;
  status?: string | null;
  start_term_id?: string | null;
  end_term_id?: string | null;
  notes?: string | null;
  start_date?: string | null;
  end_date?: string | null;
}

export interface UpdateBatchPayload {
  code?: string;
  name?: string;
  status?: string | null;
  program_id?: string | null;
  level_id?: string | null;
  year_id?: string | null;
  start_term_id?: string | null;
  end_term_id?: string | null;
  notes?: string | null;
  start_date?: string | null;
  end_date?: string | null;
}

export interface ListBatchesFilters {
  program_id?: string;
  level_id?: string;
  year_id?: string;
  status?: string;
  school_id?: string;
  search?: string;
}

// ============================================================================
// Types - Sections
// ============================================================================

export interface Section {
  id: string;
  organization_id: string;
  school_id: string;
  program_id: string;
  batch_id: string | null;
  level_id?: string | null;
  year_id?: string | null;
  code: string;
  name: string;
  capacity: number | null;
  adviser_staff_id?: string | null;
  status: string | null;
  is_active: boolean;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreateSectionPayload {
  organization_id: string;
  school_id: string;
  program_id: string;
  batch_id: string;
  level_id?: string | null;
  year_id?: string | null;
  code: string;
  name: string;
  capacity?: number | null;
  adviser_staff_id?: string | null;
  status?: string | null;
}

export interface UpdateSectionPayload {
  code?: string;
  name?: string;
  capacity?: number | null;
  adviser_staff_id?: string | null;
  status?: string | null;
  batch_id?: string;
  level_id?: string | null;
  year_id?: string | null;
}

export interface ListSectionsFilters {
  batch_id?: string;
  program_id?: string;
  level_id?: string;
  year_id?: string;
  status?: string;
  school_id?: string;
  search?: string;
}

// ============================================================================
// Types - Section Students
// ============================================================================

export interface SectionStudent {
  id: string;
  organization_id: string;
  school_id: string;
  section_id: string;
  student_id: string;
  start_date: string;
  end_date?: string | null;
  status: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  student?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    student_number: string | null;
  };
}

export interface AddStudentToSectionPayload {
  organization_id: string;
  school_id: string;
  section_id: string;
  student_id: string;
  start_date: string;
  end_date?: string | null;
  status?: string | null;
}

// ============================================================================
// Batches CRUD
// ============================================================================

/**
 * List batches with optional filters
 */
export async function listBatches(
  filters?: ListBatchesFilters
): Promise<Batch[]> {
  let query = supabase
    .from("batches")
    .select("*")
    .order("created_at", { ascending: false });

  if (filters?.program_id) {
    query = query.eq("program_id", filters.program_id);
  }

  if (filters?.level_id) {
    query = query.eq("level_id", filters.level_id);
  }

  if (filters?.year_id) {
    query = query.eq("year_id", filters.year_id);
  }

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  if (filters?.school_id) {
    query = query.eq("school_id", filters.school_id);
  }

  if (filters?.search) {
    query = query.or(`name.ilike.%${filters.search}%,code.ilike.%${filters.search}%`);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to list batches: ${error.message}`);
  }

  return (data || []) as Batch[];
}

/**
 * Get a single batch by ID
 */
export async function getBatch(id: string): Promise<Batch | null> {
  const { data, error } = await supabase
    .from("batches")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(`Failed to get batch: ${error.message}`);
  }

  return data as Batch;
}

/**
 * Create a new batch
 */
export async function createBatch(
  payload: CreateBatchPayload
): Promise<Batch> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("No active session");
  }

  // Insert batch (only include fields that exist in schema)
  const insertData: any = {
    organization_id: payload.organization_id,
    name: payload.name,
    status: payload.status || null,
    start_date: payload.start_date || null,
    end_date: payload.end_date || null,
  };

  // Add optional fields if they exist in schema
  // Note: These fields may need to be added via migration
  if (payload.school_id !== undefined) {
    insertData.school_id = payload.school_id;
  }
  if (payload.program_id !== undefined) {
    insertData.program_id = payload.program_id;
  }
  if (payload.code !== undefined) {
    insertData.code = payload.code;
  }
  if (payload.notes !== undefined) {
    insertData.notes = payload.notes;
  }

  const { data: batch, error } = await supabase
    .from("batches")
    .insert(insertData)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create batch: ${error.message}`);
  }

  // Create audit log
  await createAuditLog({
    organization_id: payload.organization_id,
    school_id: payload.school_id || null,
    actor_id: session.user.id,
    action: "create",
    entity_type: "batch",
    entity_id: batch.id,
    after: batch,
  });

  return batch as Batch;
}

/**
 * Update a batch
 */
export async function updateBatch(
  id: string,
  payload: UpdateBatchPayload
): Promise<Batch> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("No active session");
  }

  // Get existing batch for audit log
  const existing = await getBatch(id);
  if (!existing) {
    throw new Error("Batch not found");
  }

  // Build update data
  const updateData: any = {};
  if (payload.name !== undefined) updateData.name = payload.name;
  if (payload.status !== undefined) updateData.status = payload.status;
  if (payload.start_date !== undefined) updateData.start_date = payload.start_date;
  if (payload.end_date !== undefined) updateData.end_date = payload.end_date;
  if (payload.code !== undefined) updateData.code = payload.code;
  if (payload.notes !== undefined) updateData.notes = payload.notes;
  if (payload.program_id !== undefined) updateData.program_id = payload.program_id;

  const { data: batch, error } = await supabase
    .from("batches")
    .update(updateData)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to update batch: ${error.message}`);
  }

  // Create audit log
  await createAuditLog({
    organization_id: existing.organization_id,
    school_id: existing.school_id || null,
    actor_id: session.user.id,
    action: "update",
    entity_type: "batch",
    entity_id: id,
    before: existing,
    after: batch,
  });

  return batch as Batch;
}

/**
 * Archive a batch (soft delete by setting status to 'archived')
 */
export async function archiveBatch(id: string): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("No active session");
  }

  const existing = await getBatch(id);
  if (!existing) {
    throw new Error("Batch not found");
  }

  const { data: batch, error } = await supabase
    .from("batches")
    .update({ status: "archived" })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to archive batch: ${error.message}`);
  }

  // Create audit log
  await createAuditLog({
    organization_id: existing.organization_id,
    school_id: existing.school_id || null,
    actor_id: session.user.id,
    action: "delete",
    entity_type: "batch",
    entity_id: id,
    before: existing,
    after: batch,
  });
}

// ============================================================================
// Sections CRUD
// ============================================================================

/**
 * List sections with optional filters
 */
export async function listSections(
  filters?: ListSectionsFilters
): Promise<Section[]> {
  let query = supabase
    .from("sections")
    .select("*")
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (filters?.batch_id) {
    query = query.eq("batch_id", filters.batch_id);
  }

  if (filters?.program_id) {
    query = query.eq("program_id", filters.program_id);
  }

  if (filters?.level_id) {
    query = query.eq("level_id", filters.level_id);
  }

  if (filters?.year_id) {
    query = query.eq("year_id", filters.year_id);
  }

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  if (filters?.school_id) {
    query = query.eq("school_id", filters.school_id);
  }

  if (filters?.search) {
    query = query.or(`name.ilike.%${filters.search}%,code.ilike.%${filters.search}%`);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to list sections: ${error.message}`);
  }

  return (data || []) as Section[];
}

/**
 * Get a single section by ID
 */
export async function getSection(id: string): Promise<Section | null> {
  const { data, error } = await supabase
    .from("sections")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(`Failed to get section: ${error.message}`);
  }

  return data as Section;
}

/**
 * Create a new section
 */
export async function createSection(
  payload: CreateSectionPayload
): Promise<Section> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("No active session");
  }

  const insertData: any = {
    organization_id: payload.organization_id,
    school_id: payload.school_id,
    program_id: payload.program_id,
    code: payload.code,
    name: payload.name,
    is_active: true,
  };

  // Add optional fields if they exist in schema
  if (payload.batch_id !== undefined) {
    insertData.batch_id = payload.batch_id;
  }
  if (payload.capacity !== undefined) {
    insertData.capacity = payload.capacity;
  }
  if (payload.adviser_staff_id !== undefined) {
    insertData.adviser_staff_id = payload.adviser_staff_id;
  }
  if (payload.status !== undefined) {
    insertData.status = payload.status;
  }

  const { data: section, error } = await supabase
    .from("sections")
    .insert(insertData)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create section: ${error.message}`);
  }

  // Create audit log
  await createAuditLog({
    organization_id: payload.organization_id,
    school_id: payload.school_id,
    actor_id: session.user.id,
    action: "create",
    entity_type: "section",
    entity_id: section.id,
    after: section,
  });

  return section as Section;
}

/**
 * Update a section
 */
export async function updateSection(
  id: string,
  payload: UpdateSectionPayload
): Promise<Section> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("No active session");
  }

  const existing = await getSection(id);
  if (!existing) {
    throw new Error("Section not found");
  }

  const updateData: any = {};
  if (payload.code !== undefined) updateData.code = payload.code;
  if (payload.name !== undefined) updateData.name = payload.name;
  if (payload.capacity !== undefined) updateData.capacity = payload.capacity;
  if (payload.adviser_staff_id !== undefined) updateData.adviser_staff_id = payload.adviser_staff_id;
  if (payload.status !== undefined) updateData.status = payload.status;
  if (payload.batch_id !== undefined) updateData.batch_id = payload.batch_id;

  const { data: section, error } = await supabase
    .from("sections")
    .update(updateData)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to update section: ${error.message}`);
  }

  // Create audit log
  await createAuditLog({
    organization_id: existing.organization_id,
    school_id: existing.school_id,
    actor_id: session.user.id,
    action: "update",
    entity_type: "section",
    entity_id: id,
    before: existing,
    after: section,
  });

  return section as Section;
}

/**
 * Archive a section (soft delete by setting is_active to false)
 */
export async function archiveSection(id: string): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("No active session");
  }

  const existing = await getSection(id);
  if (!existing) {
    throw new Error("Section not found");
  }

  const { data: section, error } = await supabase
    .from("sections")
    .update({ is_active: false, status: "archived" })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to archive section: ${error.message}`);
  }

  // Create audit log
  await createAuditLog({
    organization_id: existing.organization_id,
    school_id: existing.school_id,
    actor_id: session.user.id,
    action: "delete",
    entity_type: "section",
    entity_id: id,
    before: existing,
    after: section,
  });
}

// ============================================================================
// Section Students Management
// ============================================================================

/**
 * List students in a section
 */
export async function listSectionStudents(
  sectionId: string
): Promise<SectionStudent[]> {
  // Use section_students table for Phase 6 operational grouping
  // Only show active students (status = 'active' AND end_date IS NULL)
  const { data, error } = await supabase
    .from("section_students")
    .select(`
      *,
      student:students!section_students_student_id_fkey(id, first_name, last_name, student_number)
    `)
    .eq("section_id", sectionId)
    .eq("status", "active")
    .is("end_date", null)
    .order("created_at", { ascending: true });

  if (error) {
    console.warn("Failed to list section students:", error);
    return [];
  }

  return (data || []) as SectionStudent[];
}

/**
 * Add a student to a section
 */
export async function addStudentToSection(
  payload: AddStudentToSectionPayload
): Promise<SectionStudent> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("No active session");
  }

  // Use section_students table for Phase 6 operational grouping
  const { data: sectionStudent, error } = await supabase
    .from("section_students")
    .insert({
      organization_id: payload.organization_id,
      school_id: payload.school_id,
      section_id: payload.section_id,
      student_id: payload.student_id,
      start_date: payload.start_date,
      end_date: payload.end_date || null,
      status: payload.status || "active",
    })
    .select(`
      *,
      student:students!section_students_student_id_fkey(id, first_name, last_name, student_number)
    `)
    .single();

  if (error) {
    throw new Error(`Failed to add student to section: ${error.message}`);
  }

  // Create audit log
  await createAuditLog({
    organization_id: payload.organization_id,
    school_id: payload.school_id,
    actor_id: session.user.id,
    action: "create",
    entity_type: "section_student",
    entity_id: sectionStudent.id,
    after: sectionStudent,
  });

  return sectionStudent as SectionStudent;
}

/**
 * Remove a student from a section
 */
export async function removeStudentFromSection(
  sectionStudentId: string
): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("No active session");
  }

  // Get existing section_student for audit log
  const { data: existing } = await supabase
    .from("section_students")
    .select("*")
    .eq("id", sectionStudentId)
    .single();

  if (!existing) {
    throw new Error("Section student membership not found");
  }

  // Soft delete by setting end_date to today and status to inactive
  const { data: sectionStudent, error } = await supabase
    .from("section_students")
    .update({
      end_date: new Date().toISOString().split("T")[0],
      status: "inactive",
    })
    .eq("id", sectionStudentId)
    .select("*")
    .single();

  if (error) {
    console.error("Error updating section_students:", error);
    // Provide more detailed error message for RLS issues
    if (error.code === "42501" || error.message?.includes("policy") || error.message?.includes("permission")) {
      throw new Error(`Permission denied: Unable to remove student. Please ensure RLS policies are properly configured. ${error.message}`);
    }
    throw new Error(`Failed to remove student from section: ${error.message}`);
  }

  if (!sectionStudent) {
    throw new Error("Failed to remove student: Update completed but no data returned");
  }

  // Create audit log
  await createAuditLog({
    organization_id: existing.organization_id,
    school_id: existing.school_id,
    actor_id: session.user.id,
    action: "delete",
    entity_type: "section_student",
    entity_id: sectionStudentId,
    before: existing,
    after: sectionStudent,
  });
}

// ============================================================================
// Types - Attendance Sessions
// ============================================================================

export interface AttendanceSession {
  id: string;
  organization_id: string;
  school_id: string | null;
  section_id: string;
  term_id: string | null;
  school_year_id?: string | null;
  session_date: string;
  session_type: "daily" | "period" | "event";
  period_id?: string | null;
  generated_from_meeting_id?: string | null;
  notes?: string | null;
  created_by: string;
  created_at: string;
  status: string | null;
  // Joined fields
  section?: {
    id: string;
    name: string;
    code: string;
  };
}

export interface CreateAttendanceSessionPayload {
  organization_id: string;
  school_id?: string | null;
  section_id: string;
  term_id?: string | null;
  school_year_id?: string | null;
  session_date: string;
  session_type: "daily" | "period" | "event";
  period_id?: string | null;
  notes?: string | null;
}

export interface UpdateAttendanceSessionPayload {
  session_date?: string;
  session_type?: "daily" | "period" | "event";
  period_id?: string | null;
  notes?: string | null;
  term_id?: string | null;
  status?: string | null;
}

// ============================================================================
// Types - Attendance Records
// ============================================================================

export interface AttendanceRecord {
  id: string;
  organization_id: string;
  school_id: string | null;
  attendance_session_id: string;
  student_id: string;
  status: "present" | "absent" | "late" | "excused";
  reason?: string | null;
  marked_by: string;
  marked_at: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  student?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    student_number: string | null;
  };
}

export interface BulkUpdateAttendanceRecordsPayload {
  session_id: string;
  records: Array<{
    student_id: string;
    status: "present" | "absent" | "late" | "excused";
    reason?: string | null;
  }>;
}

// ============================================================================
// Attendance Sessions CRUD
// ============================================================================

/**
 * List attendance sessions
 */
export async function listAttendanceSessions(
  filters?: {
    section_id?: string;
    term_id?: string;
    session_date?: string;
    school_id?: string;
  }
): Promise<AttendanceSession[]> {
  let query = supabase
    .from("attendance_sessions")
    .select(`
      *,
      section:sections(id, name, code)
    `)
    .order("session_date", { ascending: false });

  if (filters?.section_id) {
    query = query.eq("section_id", filters.section_id);
  }

  if (filters?.term_id) {
    query = query.eq("term_id", filters.term_id);
  }

  if (filters?.session_date) {
    query = query.eq("session_date", filters.session_date);
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
      section:sections(id, name, code)
    `)
    .eq("id", id)
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

  // Get section to get school_id
  const section = await getSection(payload.section_id);
  if (!section) {
    throw new Error("Section not found");
  }

  const insertData: any = {
    organization_id: payload.organization_id,
    school_id: payload.school_id || section.school_id,
    section_id: payload.section_id,
    session_date: payload.session_date,
    session_type: payload.session_type,
    created_by: session.user.id,
    status: "draft",
  };

  if (payload.term_id !== undefined) {
    insertData.term_id = payload.term_id;
  }
  if (payload.school_year_id !== undefined) {
    insertData.school_year_id = payload.school_year_id;
  }
  if (payload.period_id !== undefined) {
    insertData.period_id = payload.period_id;
  }
  if (payload.notes !== undefined) {
    insertData.notes = payload.notes;
  }

  const { data: attendanceSession, error } = await supabase
    .from("attendance_sessions")
    .insert(insertData)
    .select(`
      *,
      section:sections(id, name, code)
    `)
    .single();

  if (error) {
    throw new Error(`Failed to create attendance session: ${error.message}`);
  }

  // Create audit log
  await createAuditLog({
    organization_id: payload.organization_id,
    school_id: payload.school_id || section.school_id,
    actor_id: session.user.id,
    action: "create",
    entity_type: "attendance_session",
    entity_id: attendanceSession.id,
    after: attendanceSession,
  });

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

  const existing = await getAttendanceSession(id);
  if (!existing) {
    throw new Error("Attendance session not found");
  }

  const updateData: any = {};
  if (payload.session_date !== undefined) updateData.session_date = payload.session_date;
  if (payload.session_type !== undefined) updateData.session_type = payload.session_type;
  if (payload.period_id !== undefined) updateData.period_id = payload.period_id;
  if (payload.notes !== undefined) updateData.notes = payload.notes;
  if (payload.term_id !== undefined) updateData.term_id = payload.term_id;
  if (payload.status !== undefined) updateData.status = payload.status;

  const { data: attendanceSession, error } = await supabase
    .from("attendance_sessions")
    .update(updateData)
    .eq("id", id)
    .select(`
      *,
      section:sections(id, name, code)
    `)
    .single();

  if (error) {
    throw new Error(`Failed to update attendance session: ${error.message}`);
  }

  // Create audit log
  await createAuditLog({
    organization_id: existing.organization_id,
    school_id: existing.school_id || null,
    actor_id: session.user.id,
    action: "update",
    entity_type: "attendance_session",
    entity_id: id,
    before: existing,
    after: attendanceSession,
  });

  return attendanceSession as AttendanceSession;
}

/**
 * Post attendance session - generate records for all active students in section
 */
export async function postAttendanceSession(
  sessionId: string
): Promise<AttendanceRecord[]> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("No active session");
  }

  const attendanceSession = await getAttendanceSession(sessionId);
  if (!attendanceSession) {
    throw new Error("Attendance session not found");
  }

  // Get all active students in the section
  const students = await listSectionStudents(attendanceSession.section_id);

  // Get existing records to avoid duplicates
  const { data: existingRecords } = await supabase
    .from("attendance_records")
    .select("student_id")
    .eq("attendance_session_id", sessionId)
    .is("archived_at", null);

  const existingStudentIds = new Set(
    (existingRecords || []).map((r) => r.student_id)
  );

  // Create records for students that don't have records yet
  const recordsToCreate = students
    .filter((s) => !existingStudentIds.has(s.student_id))
    .map((s) => ({
      organization_id: attendanceSession.organization_id,
      school_id: attendanceSession.school_id,
      attendance_session_id: sessionId,
      student_id: s.student_id,
      status: "present" as const,
      reason: null,
      marked_by: session.user.id,
      marked_at: new Date().toISOString(),
    }));

  if (recordsToCreate.length === 0) {
    return [];
  }

  const { data: records, error } = await supabase
    .from("attendance_records")
    .insert(recordsToCreate)
    .select(`
      *,
      student:students!attendance_records_student_id_fkey(id, first_name, last_name, student_number)
    `);

  if (error) {
    throw new Error(`Failed to post attendance session: ${error.message}`);
  }

  // Create audit log for bulk creation
  await createAuditLog({
    organization_id: attendanceSession.organization_id,
    school_id: attendanceSession.school_id || null,
    actor_id: session.user.id,
    action: "create",
    entity_type: "attendance_records",
    entity_id: sessionId,
    after: { count: records.length, records: records.map((r) => r.id) },
    event_data: { session_id: sessionId, student_count: records.length },
  });

  // Update session status to "posted"
  await updateAttendanceSession(sessionId, { status: "posted" });

  return (records || []) as AttendanceRecord[];
}

/**
 * Bulk update attendance records
 */
export async function bulkUpdateAttendanceRecords(
  payload: BulkUpdateAttendanceRecordsPayload
): Promise<AttendanceRecord[]> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("No active session");
  }

  const attendanceSession = await getAttendanceSession(payload.session_id);
  if (!attendanceSession) {
    throw new Error("Attendance session not found");
  }

  // Update each record
  const updatedRecords: AttendanceRecord[] = [];
  const markedAt = new Date().toISOString();

  for (const record of payload.records) {
    // Check if record exists
    const { data: existing } = await supabase
      .from("attendance_records")
      .select("*")
      .eq("attendance_session_id", payload.session_id)
      .eq("student_id", record.student_id)
      .is("archived_at", null)
      .maybeSingle();

    if (existing) {
      // Update existing
      const { data: updated, error } = await supabase
        .from("attendance_records")
        .update({
          status: record.status,
          reason: record.reason || null,
          marked_by: session.user.id,
          marked_at: markedAt,
        })
        .eq("id", existing.id)
        .select(`
          *,
          student:students!attendance_records_student_id_fkey(id, first_name, last_name, student_number)
        `)
        .single();

      if (error) {
        console.error(`Failed to update attendance record for student ${record.student_id}:`, error);
        continue;
      }

      // Create audit log
      await createAuditLog({
        organization_id: attendanceSession.organization_id,
        school_id: attendanceSession.school_id || null,
        actor_id: session.user.id,
        action: "update",
        entity_type: "attendance_record",
        entity_id: existing.id,
        before: existing,
        after: updated,
      });

      updatedRecords.push(updated as AttendanceRecord);
    } else {
      // Create new
      const { data: created, error } = await supabase
        .from("attendance_records")
        .insert({
          organization_id: attendanceSession.organization_id,
          school_id: attendanceSession.school_id,
          attendance_session_id: payload.session_id,
          student_id: record.student_id,
          status: record.status,
          reason: record.reason || null,
          marked_by: session.user.id,
          marked_at: markedAt,
        })
        .select(`
          *,
          student:students!attendance_records_student_id_fkey(id, first_name, last_name, student_number)
        `)
        .single();

      if (error) {
        console.error(`Failed to create attendance record for student ${record.student_id}:`, error);
        continue;
      }

      // Create audit log
      await createAuditLog({
        organization_id: attendanceSession.organization_id,
        school_id: attendanceSession.school_id || null,
        actor_id: session.user.id,
        action: "create",
        entity_type: "attendance_record",
        entity_id: created.id,
        after: created,
      });

      updatedRecords.push(created as AttendanceRecord);
    }
  }

  return updatedRecords;
}

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
      student:students!attendance_records_student_id_fkey(id, first_name, last_name, student_number)
    `)
    .eq("attendance_session_id", sessionId)
    .is("archived_at", null)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to list attendance records: ${error.message}`);
  }

  return (data || []) as AttendanceRecord[];
}

// ============================================================================
// Generate Attendance Sessions from Schedule
// ============================================================================

export interface GenerateAttendanceSessionsPayload {
  organization_id: string;
  school_id: string;
  section_id?: string; // Optional: specific section, or generate for all sections in batch
  school_year_id: string;
  start_date: string; // ISO date string
  end_date: string; // ISO date string
}

export interface GenerateAttendanceSessionsResult {
  created: number;
  skipped: number;
  sessions: AttendanceSession[];
}

/**
 * Generate attendance sessions from section meetings for a date range
 * Idempotent: will not create duplicate sessions
 */
export async function generateAttendanceSessionsFromSchedule(
  payload: GenerateAttendanceSessionsPayload
): Promise<GenerateAttendanceSessionsResult> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("No active session");
  }

  // Import scheduling functions
  const { listSectionMeetings } = await import("./scheduling");

  // Get sections to process
  let sectionIds: string[] = [];
  if (payload.section_id) {
    sectionIds = [payload.section_id];
  } else {
    // Get all sections for the school (or filter by batch if needed)
    const { data: sections } = await supabase
      .from("sections")
      .select("id")
      .eq("school_id", payload.school_id)
      .eq("is_active", true)
      .is("archived_at", null);
    sectionIds = (sections || []).map((s) => s.id);
  }

  const createdSessions: AttendanceSession[] = [];
  let skippedCount = 0;

  // Process each section
  for (const sectionId of sectionIds) {
    const section = await getSection(sectionId);
    if (!section) continue;

    // Get all active meetings for this section and school_year
    const meetings = await listSectionMeetings({
      section_id: sectionId,
      school_year_id: payload.school_year_id,
      status: "active",
    });

    // Process each meeting
    for (const meeting of meetings) {
      // Check if meeting is effective for the date range
      const startDate = new Date(payload.start_date);
      const endDate = new Date(payload.end_date);
      
      if (meeting.effective_start_date) {
        const effectiveStart = new Date(meeting.effective_start_date);
        if (endDate < effectiveStart) continue;
      }
      
      if (meeting.effective_end_date) {
        const effectiveEnd = new Date(meeting.effective_end_date);
        if (startDate > effectiveEnd) continue;
      }

      // Generate sessions for each day in the range that matches days_of_week
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const dayOfWeek = currentDate.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
        // Convert to our format: 1=Monday, 7=Sunday
        const dayNumber = dayOfWeek === 0 ? 7 : dayOfWeek;

        if (meeting.days_of_week.includes(dayNumber)) {
          const sessionDate = currentDate.toISOString().split("T")[0];

          // Check if session already exists (idempotency check)
          const { data: existing } = await supabase
            .from("attendance_sessions")
            .select("id")
            .eq("school_id", payload.school_id)
            .eq("section_id", sectionId)
            .eq("session_date", sessionDate)
            .eq("session_type", "period")
            .eq("period_id", meeting.period_id || "")
            .is("archived_at", null)
            .maybeSingle();

          if (existing) {
            skippedCount++;
          } else {
            // Create new session
            const sessionPayload: CreateAttendanceSessionPayload = {
              organization_id: payload.organization_id,
              school_id: payload.school_id,
              section_id: sectionId,
              school_year_id: payload.school_year_id,
              session_date: sessionDate,
              session_type: "period",
              period_id: meeting.period_id,
              notes: `Generated from schedule: ${meeting.section?.name || section.name}`,
            };

            try {
              const newSession = await createAttendanceSession(sessionPayload);
              
              // Update to set generated_from_meeting_id
              await supabase
                .from("attendance_sessions")
                .update({ generated_from_meeting_id: meeting.id })
                .eq("id", newSession.id);

              createdSessions.push({
                ...newSession,
                generated_from_meeting_id: meeting.id,
              } as AttendanceSession);
            } catch (error: any) {
              // If unique constraint violation, skip (idempotency)
              if (error.message?.includes("unique") || error.message?.includes("duplicate")) {
                skippedCount++;
              } else {
                throw error;
              }
            }
          }
        }

        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }
  }

  return {
    created: createdSessions.length,
    skipped: skippedCount,
    sessions: createdSessions,
  };
}