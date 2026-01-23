/**
 * Phase 6.1 Scheduling Foundations
 * CRUD operations for periods, rooms, section_teachers, section_meetings
 * Includes conflict detection for section_meetings
 */

import { supabase } from "@/lib/supabase/client";
import { createAuditLog } from "@/lib/audit";

// ============================================================================
// Types - Periods
// ============================================================================

export interface Period {
  id: string;
  organization_id: string;
  school_id: string;
  school_year_id: string;
  name: string;
  start_time: string;
  end_time: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  archived_at: string | null;
}

export interface CreatePeriodPayload {
  organization_id: string;
  school_id: string;
  school_year_id: string;
  name: string;
  start_time: string;
  end_time: string;
  sort_order?: number;
}

export interface UpdatePeriodPayload {
  name?: string;
  start_time?: string;
  end_time?: string;
  sort_order?: number;
}

// ============================================================================
// Types - Rooms
// ============================================================================

export interface Room {
  id: string;
  organization_id: string;
  school_id: string;
  code: string;
  name: string;
  capacity: number | null;
  status: "active" | "maintenance" | "inactive";
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  archived_at: string | null;
}

export interface CreateRoomPayload {
  organization_id: string;
  school_id: string;
  code: string;
  name: string;
  capacity?: number | null;
  status?: "active" | "maintenance" | "inactive";
}

export interface UpdateRoomPayload {
  code?: string;
  name?: string;
  capacity?: number | null;
  status?: "active" | "maintenance" | "inactive";
}

// ============================================================================
// Types - Section Teachers
// ============================================================================

export interface SectionTeacher {
  id: string;
  organization_id: string;
  school_id: string;
  section_id: string;
  staff_id: string;
  role: "primary" | "co";
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  archived_at: string | null;
  // Joined fields
  staff?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
  };
  section?: {
    id: string;
    name: string;
    code: string;
  };
}

export interface CreateSectionTeacherPayload {
  organization_id: string;
  school_id: string;
  section_id: string;
  staff_id: string;
  role?: "primary" | "co";
  start_date?: string | null;
  end_date?: string | null;
}

export interface UpdateSectionTeacherPayload {
  role?: "primary" | "co";
  start_date?: string | null;
  end_date?: string | null;
}

// ============================================================================
// Types - Section Meetings
// ============================================================================

export interface SectionMeeting {
  id: string;
  organization_id: string;
  school_id: string;
  section_id: string;
  school_year_id: string;
  days_of_week: number[]; // 1=Monday, 7=Sunday
  start_time: string;
  end_time: string;
  period_id: string | null;
  room_id: string | null;
  effective_start_date: string | null;
  effective_end_date: string | null;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  archived_at: string | null;
  // Joined fields
  section?: {
    id: string;
    name: string;
    code: string;
  };
  period?: {
    id: string;
    name: string;
  };
  room?: {
    id: string;
    code: string;
    name: string;
  };
}

export interface CreateSectionMeetingPayload {
  organization_id: string;
  school_id: string;
  section_id: string;
  school_year_id: string;
  days_of_week: number[];
  start_time: string;
  end_time: string;
  period_id?: string | null;
  room_id?: string | null;
  effective_start_date?: string | null;
  effective_end_date?: string | null;
  status?: "active" | "inactive";
}

export interface UpdateSectionMeetingPayload {
  days_of_week?: number[];
  start_time?: string;
  end_time?: string;
  period_id?: string | null;
  room_id?: string | null;
  effective_start_date?: string | null;
  effective_end_date?: string | null;
  status?: "active" | "inactive";
}

export interface MeetingConflict {
  type: "teacher" | "room";
  entity_id: string;
  entity_label: string;
  conflicting_meeting_id: string;
  section_name: string;
  time_window: string;
}

// ============================================================================
// Periods CRUD
// ============================================================================

export async function listPeriods(filters?: {
  school_id?: string;
  school_year_id?: string;
}): Promise<Period[]> {
  let query = supabase
    .from("periods")
    .select("*")
    .is("archived_at", null)
    .order("sort_order", { ascending: true })
    .order("start_time", { ascending: true });

  if (filters?.school_id) {
    query = query.eq("school_id", filters.school_id);
  }

  if (filters?.school_year_id) {
    query = query.eq("school_year_id", filters.school_year_id);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to list periods: ${error.message}`);
  }

  return (data || []) as Period[];
}

export async function getPeriod(id: string): Promise<Period | null> {
  const { data, error } = await supabase
    .from("periods")
    .select("*")
    .eq("id", id)
    .is("archived_at", null)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(`Failed to get period: ${error.message}`);
  }

  return data as Period;
}

export async function createPeriod(
  payload: CreatePeriodPayload
): Promise<Period> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("No active session");
  }

  const insertData: any = {
    ...payload,
    sort_order: payload.sort_order ?? 0,
    created_by: session.user.id,
    updated_by: session.user.id,
  };

  const { data: period, error } = await supabase
    .from("periods")
    .insert(insertData)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create period: ${error.message}`);
  }

  // Create audit log
  await createAuditLog({
    organization_id: payload.organization_id,
    school_id: payload.school_id,
    actor_id: session.user.id,
    action: "create",
    entity_type: "period",
    entity_id: period.id,
    after: period,
  });

  return period as Period;
}

export async function updatePeriod(
  id: string,
  payload: UpdatePeriodPayload
): Promise<Period> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("No active session");
  }

  const existing = await getPeriod(id);
  if (!existing) {
    throw new Error("Period not found");
  }

  const updateData: any = {
    ...payload,
    updated_by: session.user.id,
  };

  const { data: period, error } = await supabase
    .from("periods")
    .update(updateData)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to update period: ${error.message}`);
  }

  // Create audit log
  await createAuditLog({
    organization_id: existing.organization_id,
    school_id: existing.school_id,
    actor_id: session.user.id,
    action: "update",
    entity_type: "period",
    entity_id: id,
    before: existing,
    after: period,
  });

  return period as Period;
}

export async function deletePeriod(id: string): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("No active session");
  }

  const existing = await getPeriod(id);
  if (!existing) {
    throw new Error("Period not found");
  }

  const { data: period, error } = await supabase
    .from("periods")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to delete period: ${error.message}`);
  }

  // Create audit log
  await createAuditLog({
    organization_id: existing.organization_id,
    school_id: existing.school_id,
    actor_id: session.user.id,
    action: "delete",
    entity_type: "period",
    entity_id: id,
    before: existing,
    after: period,
  });
}

// ============================================================================
// Rooms CRUD
// ============================================================================

export async function listRooms(filters?: {
  school_id?: string;
  status?: "active" | "maintenance" | "inactive";
}): Promise<Room[]> {
  let query = supabase
    .from("rooms")
    .select("*")
    .is("archived_at", null)
    .order("code", { ascending: true });

  if (filters?.school_id) {
    query = query.eq("school_id", filters.school_id);
  }

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to list rooms: ${error.message}`);
  }

  return (data || []) as Room[];
}

export async function getRoom(id: string): Promise<Room | null> {
  const { data, error } = await supabase
    .from("rooms")
    .select("*")
    .eq("id", id)
    .is("archived_at", null)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(`Failed to get room: ${error.message}`);
  }

  return data as Room;
}

export async function createRoom(payload: CreateRoomPayload): Promise<Room> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("No active session");
  }

  const insertData: any = {
    ...payload,
    status: payload.status ?? "active",
    created_by: session.user.id,
    updated_by: session.user.id,
  };

  const { data: room, error } = await supabase
    .from("rooms")
    .insert(insertData)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create room: ${error.message}`);
  }

  // Create audit log
  await createAuditLog({
    organization_id: payload.organization_id,
    school_id: payload.school_id,
    actor_id: session.user.id,
    action: "create",
    entity_type: "room",
    entity_id: room.id,
    after: room,
  });

  return room as Room;
}

export async function updateRoom(
  id: string,
  payload: UpdateRoomPayload
): Promise<Room> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("No active session");
  }

  const existing = await getRoom(id);
  if (!existing) {
    throw new Error("Room not found");
  }

  const updateData: any = {
    ...payload,
    updated_by: session.user.id,
  };

  const { data: room, error } = await supabase
    .from("rooms")
    .update(updateData)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to update room: ${error.message}`);
  }

  // Create audit log
  await createAuditLog({
    organization_id: existing.organization_id,
    school_id: existing.school_id,
    actor_id: session.user.id,
    action: "update",
    entity_type: "room",
    entity_id: id,
    before: existing,
    after: room,
  });

  return room as Room;
}

export async function deleteRoom(id: string): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("No active session");
  }

  const existing = await getRoom(id);
  if (!existing) {
    throw new Error("Room not found");
  }

  const { data: room, error } = await supabase
    .from("rooms")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to delete room: ${error.message}`);
  }

  // Create audit log
  await createAuditLog({
    organization_id: existing.organization_id,
    school_id: existing.school_id,
    actor_id: session.user.id,
    action: "delete",
    entity_type: "room",
    entity_id: id,
    before: existing,
    after: room,
  });
}

// ============================================================================
// Section Teachers CRUD
// ============================================================================

export async function listSectionTeachers(filters?: {
  section_id?: string;
  staff_id?: string;
  school_id?: string;
}): Promise<SectionTeacher[]> {
  let query = supabase
    .from("section_teachers")
    .select(
      `
      *,
      staff:staff(id, first_name, last_name),
      section:sections(id, name, code)
    `
    )
    .is("archived_at", null)
    .order("role", { ascending: true })
    .order("created_at", { ascending: true });

  if (filters?.section_id) {
    query = query.eq("section_id", filters.section_id);
  }

  if (filters?.staff_id) {
    query = query.eq("staff_id", filters.staff_id);
  }

  if (filters?.school_id) {
    query = query.eq("school_id", filters.school_id);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to list section teachers: ${error.message}`);
  }

  return (data || []) as SectionTeacher[];
}

export async function getSectionTeacher(
  id: string
): Promise<SectionTeacher | null> {
  const { data, error } = await supabase
    .from("section_teachers")
    .select(
      `
      *,
      staff:staff(id, first_name, last_name),
      section:sections(id, name, code)
    `
    )
    .eq("id", id)
    .is("archived_at", null)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(`Failed to get section teacher: ${error.message}`);
  }

  return data as SectionTeacher;
}

export async function createSectionTeacher(
  payload: CreateSectionTeacherPayload
): Promise<SectionTeacher> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("No active session");
  }

  const insertData: any = {
    ...payload,
    role: payload.role ?? "primary",
    created_by: session.user.id,
    updated_by: session.user.id,
  };

  const { data: sectionTeacher, error } = await supabase
    .from("section_teachers")
    .insert(insertData)
    .select(
      `
      *,
      staff:staff(id, first_name, last_name),
      section:sections(id, name, code)
    `
    )
    .single();

  if (error) {
    throw new Error(`Failed to create section teacher: ${error.message}`);
  }

  // Create audit log
  await createAuditLog({
    organization_id: payload.organization_id,
    school_id: payload.school_id,
    actor_id: session.user.id,
    action: "create",
    entity_type: "section_teacher",
    entity_id: sectionTeacher.id,
    after: sectionTeacher,
  });

  return sectionTeacher as SectionTeacher;
}

export async function updateSectionTeacher(
  id: string,
  payload: UpdateSectionTeacherPayload
): Promise<SectionTeacher> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("No active session");
  }

  const existing = await getSectionTeacher(id);
  if (!existing) {
    throw new Error("Section teacher not found");
  }

  const updateData: any = {
    ...payload,
    updated_by: session.user.id,
  };

  const { data: sectionTeacher, error } = await supabase
    .from("section_teachers")
    .update(updateData)
    .eq("id", id)
    .select(
      `
      *,
      staff:staff(id, first_name, last_name),
      section:sections(id, name, code)
    `
    )
    .single();

  if (error) {
    throw new Error(`Failed to update section teacher: ${error.message}`);
  }

  // Create audit log
  await createAuditLog({
    organization_id: existing.organization_id,
    school_id: existing.school_id,
    actor_id: session.user.id,
    action: "update",
    entity_type: "section_teacher",
    entity_id: id,
    before: existing,
    after: sectionTeacher,
  });

  return sectionTeacher as SectionTeacher;
}

export async function deleteSectionTeacher(id: string): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("No active session");
  }

  const existing = await getSectionTeacher(id);
  if (!existing) {
    throw new Error("Section teacher not found");
  }

  const { data: sectionTeacher, error } = await supabase
    .from("section_teachers")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to delete section teacher: ${error.message}`);
  }

  // Create audit log
  await createAuditLog({
    organization_id: existing.organization_id,
    school_id: existing.school_id,
    actor_id: session.user.id,
    action: "delete",
    entity_type: "section_teacher",
    entity_id: id,
    before: existing,
    after: sectionTeacher,
  });
}

// ============================================================================
// Section Meetings CRUD + Conflict Detection
// ============================================================================

export async function listSectionMeetings(filters?: {
  section_id?: string;
  school_year_id?: string;
  school_id?: string;
  status?: "active" | "inactive";
}): Promise<SectionMeeting[]> {
  let query = supabase
    .from("section_meetings")
    .select(
      `
      *,
      section:sections(id, name, code),
      period:periods(id, name),
      room:rooms(id, code, name)
    `
    )
    .is("archived_at", null)
    .order("days_of_week", { ascending: true })
    .order("start_time", { ascending: true });

  if (filters?.section_id) {
    query = query.eq("section_id", filters.section_id);
  }

  if (filters?.school_year_id) {
    query = query.eq("school_year_id", filters.school_year_id);
  }

  if (filters?.school_id) {
    query = query.eq("school_id", filters.school_id);
  }

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to list section meetings: ${error.message}`);
  }

  return (data || []) as SectionMeeting[];
}

export async function getSectionMeeting(
  id: string
): Promise<SectionMeeting | null> {
  const { data, error } = await supabase
    .from("section_meetings")
    .select(
      `
      *,
      section:sections(id, name, code),
      period:periods(id, name),
      room:rooms(id, code, name)
    `
    )
    .eq("id", id)
    .is("archived_at", null)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(`Failed to get section meeting: ${error.message}`);
  }

  return data as SectionMeeting;
}

/**
 * Check for conflicts when creating/updating a section meeting
 * Returns array of conflicts (teacher overlaps, room overlaps)
 */
export async function checkMeetingConflicts(
  payload: CreateSectionMeetingPayload | UpdateSectionMeetingPayload,
  excludeMeetingId?: string
): Promise<MeetingConflict[]> {
  const conflicts: MeetingConflict[] = [];

  // Get the actual meeting data (if updating, fetch existing)
  let meeting: SectionMeeting | null = null;
  if (excludeMeetingId) {
    meeting = await getSectionMeeting(excludeMeetingId);
  }

  const daysOfWeek = payload.days_of_week || meeting?.days_of_week || [];
  const startTime = payload.start_time || meeting?.start_time || "";
  const endTime = payload.end_time || meeting?.end_time || "";
  const sectionId = excludeMeetingId
    ? meeting?.section_id
    : (payload as CreateSectionMeetingPayload).section_id;
  const schoolYearId =
    payload.school_year_id || meeting?.school_year_id || "";
  const roomId = payload.room_id !== undefined ? payload.room_id : meeting?.room_id;

  if (!sectionId || !schoolYearId || !startTime || !endTime) {
    return conflicts; // Incomplete data, skip conflict check
  }

  // Get all teachers assigned to this section
  const sectionTeachers = await listSectionTeachers({ section_id: sectionId });

  // Get all other meetings in the same school_year that overlap
  const allMeetings = await listSectionMeetings({
    school_year_id: schoolYearId,
    status: "active",
  });

  // Check each day of week for overlaps
  for (const day of daysOfWeek) {
    // Find overlapping meetings on the same day
    const overlappingMeetings = allMeetings.filter((otherMeeting) => {
      // Skip self
      if (excludeMeetingId && otherMeeting.id === excludeMeetingId) {
        return false;
      }

      // Check if same day
      if (!otherMeeting.days_of_week.includes(day)) {
        return false;
      }

      // Check time overlap: startA < endB AND startB < endA
      const otherStart = otherMeeting.start_time;
      const otherEnd = otherMeeting.end_time;

      if (startTime < otherEnd && otherStart < endTime) {
        return true;
      }

      return false;
    });

    // Check teacher conflicts
    for (const overlappingMeeting of overlappingMeetings) {
      // Get teachers for the overlapping meeting's section
      const otherSectionTeachers = await listSectionTeachers({
        section_id: overlappingMeeting.section_id,
      });

      // Check if any teacher is assigned to both sections
      for (const st of sectionTeachers) {
        if (
          otherSectionTeachers.some((ost) => ost.staff_id === st.staff_id)
        ) {
          const staff = st.staff;
          const staffName = staff
            ? `${staff.first_name || ""} ${staff.last_name || ""}`.trim()
            : "Unknown";
          const section = overlappingMeeting.section;
          const sectionName = section?.name || "Unknown";

          conflicts.push({
            type: "teacher",
            entity_id: st.staff_id,
            entity_label: staffName,
            conflicting_meeting_id: overlappingMeeting.id,
            section_name: sectionName,
            time_window: `${startTime}-${endTime}`,
          });
        }
      }
    }

    // Check room conflicts
    if (roomId) {
      for (const overlappingMeeting of overlappingMeetings) {
        if (overlappingMeeting.room_id === roomId) {
          const room = overlappingMeeting.room;
          const roomName = room ? `${room.code} - ${room.name}` : "Unknown";
          const section = overlappingMeeting.section;
          const sectionName = section?.name || "Unknown";

          conflicts.push({
            type: "room",
            entity_id: roomId,
            entity_label: roomName,
            conflicting_meeting_id: overlappingMeeting.id,
            section_name: sectionName,
            time_window: `${startTime}-${endTime}`,
          });
        }
      }
    }
  }

  // Deduplicate conflicts
  const uniqueConflicts = conflicts.filter(
    (conflict, index, self) =>
      index ===
      self.findIndex(
        (c) =>
          c.type === conflict.type &&
          c.entity_id === conflict.entity_id &&
          c.conflicting_meeting_id === conflict.conflicting_meeting_id
      )
  );

  return uniqueConflicts;
}

export async function createSectionMeeting(
  payload: CreateSectionMeetingPayload
): Promise<SectionMeeting> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("No active session");
  }

  const insertData: any = {
    ...payload,
    status: payload.status ?? "active",
    created_by: session.user.id,
    updated_by: session.user.id,
  };

  const { data: sectionMeeting, error } = await supabase
    .from("section_meetings")
    .insert(insertData)
    .select(
      `
      *,
      section:sections(id, name, code),
      period:periods(id, name),
      room:rooms(id, code, name)
    `
    )
    .single();

  if (error) {
    throw new Error(`Failed to create section meeting: ${error.message}`);
  }

  // Create audit log
  await createAuditLog({
    organization_id: payload.organization_id,
    school_id: payload.school_id,
    actor_id: session.user.id,
    action: "create",
    entity_type: "section_meeting",
    entity_id: sectionMeeting.id,
    after: sectionMeeting,
  });

  return sectionMeeting as SectionMeeting;
}

export async function updateSectionMeeting(
  id: string,
  payload: UpdateSectionMeetingPayload
): Promise<SectionMeeting> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("No active session");
  }

  const existing = await getSectionMeeting(id);
  if (!existing) {
    throw new Error("Section meeting not found");
  }

  const updateData: any = {
    ...payload,
    updated_by: session.user.id,
  };

  const { data: sectionMeeting, error } = await supabase
    .from("section_meetings")
    .update(updateData)
    .eq("id", id)
    .select(
      `
      *,
      section:sections(id, name, code),
      period:periods(id, name),
      room:rooms(id, code, name)
    `
    )
    .single();

  if (error) {
    throw new Error(`Failed to update section meeting: ${error.message}`);
  }

  // Create audit log
  await createAuditLog({
    organization_id: existing.organization_id,
    school_id: existing.school_id,
    actor_id: session.user.id,
    action: "update",
    entity_type: "section_meeting",
    entity_id: id,
    before: existing,
    after: sectionMeeting,
  });

  return sectionMeeting as SectionMeeting;
}

export async function deleteSectionMeeting(id: string): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("No active session");
  }

  const existing = await getSectionMeeting(id);
  if (!existing) {
    throw new Error("Section meeting not found");
  }

  const { data: sectionMeeting, error } = await supabase
    .from("section_meetings")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to delete section meeting: ${error.message}`);
  }

  // Create audit log
  await createAuditLog({
    organization_id: existing.organization_id,
    school_id: existing.school_id,
    actor_id: session.user.id,
    action: "delete",
    entity_type: "section_meeting",
    entity_id: id,
    before: existing,
    after: sectionMeeting,
  });
}
