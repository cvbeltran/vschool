/**
 * Phase 6 Syllabus Data Access Layer
 * Pedagogy Operations - Syllabus Management
 * 
 * All functions respect RLS policies and filter by organization_id unless super admin.
 * No computation fields - purely operational.
 */

import { supabase } from "@/lib/supabase/client";

// ============================================================================
// Types
// ============================================================================

export interface Syllabus {
  id: string;
  organization_id: string;
  school_id: string | null;
  syllabus_template_id: string | null;
  name: string;
  description: string | null;
  program_id: string | null;
  subject: string | null;
  experience_id: string | null;
  status: "draft" | "published" | "archived";
  version_number: number;
  parent_syllabus_id: string | null;
  published_at: string | null;
  published_by: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  archived_at: string | null;
  // Joined fields
  program?: {
    id: string;
    name: string;
  };
  experience?: {
    id: string;
    name: string;
  };
}

export interface SyllabusTemplate {
  id: string;
  organization_id: string;
  school_id: string | null;
  name: string;
  description: string | null;
  program_id: string | null;
  subject: string | null;
  experience_id: string | null;
  status: "draft" | "published" | "archived";
  version_number: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  archived_at: string | null;
}

export interface SyllabusContributor {
  id: string;
  organization_id: string;
  syllabus_id: string;
  teacher_id: string;
  role: "lead" | "contributor";
  permissions: "read" | "edit";
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
    email: string | null;
  };
}

export interface SyllabusWeek {
  id: string;
  organization_id: string;
  syllabus_id: string;
  week_number: number;
  week_start_date: string | null;
  week_end_date: string | null;
  objectives: string[];
  activities: string[];
  verification_method: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  archived_at: string | null;
}

export interface ListSyllabiFilters {
  program_id?: string;
  subject?: string;
  status?: "draft" | "published" | "archived";
  search?: string;
  school_id?: string;
}

export interface CreateSyllabusPayload {
  organization_id: string;
  school_id?: string | null;
  syllabus_template_id?: string | null;
  name: string;
  description?: string | null;
  program_id?: string | null;
  subject?: string | null;
  experience_id?: string | null;
  status?: "draft" | "published";
}

export interface UpdateSyllabusPayload {
  name?: string;
  description?: string | null;
  program_id?: string | null;
  subject?: string | null;
  experience_id?: string | null;
  status?: "draft" | "published" | "archived";
}

export interface ManageContributorPayload {
  teacher_id: string;
  role?: "lead" | "contributor";
  permissions?: "read" | "edit";
}

export interface UpsertSyllabusWeekPayload {
  week_number: number;
  week_start_date?: string | null;
  week_end_date?: string | null;
  objectives: string[];
  activities: string[];
  verification_method?: string | null;
}

// ============================================================================
// Syllabus CRUD
// ============================================================================

/**
 * List syllabi with optional filters
 */
export async function listSyllabi(
  filters?: ListSyllabiFilters
): Promise<Syllabus[]> {
  let query = supabase
    .from("syllabi")
    .select(`
      *,
      program:programs(id, name),
      experience:experiences(id, name)
    `)
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  if (filters?.program_id) {
    query = query.eq("program_id", filters.program_id);
  }

  if (filters?.subject) {
    query = query.ilike("subject", `%${filters.subject}%`);
  }

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  if (filters?.search) {
    query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
  }

  if (filters?.school_id) {
    query = query.eq("school_id", filters.school_id);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to list syllabi: ${error.message}`);
  }

  return (data || []) as Syllabus[];
}

/**
 * Get a single syllabus by ID
 */
export async function getSyllabus(id: string): Promise<Syllabus | null> {
  const { data, error } = await supabase
    .from("syllabi")
    .select(`
      *,
      program:programs(id, name),
      experience:experiences(id, name)
    `)
    .eq("id", id)
    .is("archived_at", null)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(`Failed to get syllabus: ${error.message}`);
  }

  // Ensure versioning fields have defaults if columns don't exist
  const syllabus = data as any;
  return {
    ...syllabus,
    version_number: syllabus.version_number ?? 1,
    parent_syllabus_id: syllabus.parent_syllabus_id ?? null,
    published_at: syllabus.published_at ?? null,
    published_by: syllabus.published_by ?? null,
  } as Syllabus;
}

/**
 * Create a new syllabus
 */
export async function createSyllabus(
  payload: CreateSyllabusPayload
): Promise<Syllabus> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("No active session");
  }

  const { data: syllabus, error } = await supabase
    .from("syllabi")
    .insert({
      ...payload,
      status: payload.status || "draft",
      created_by: session.user.id,
      updated_by: session.user.id,
    })
    .select(`
      *,
      program:programs(id, name),
      experience:experiences(id, name)
    `)
    .single();

  if (error) {
    throw new Error(`Failed to create syllabus: ${error.message}`);
  }

  // Automatically add creator as lead contributor
  try {
    await supabase
      .from("syllabus_contributors")
      .insert({
        organization_id: payload.organization_id,
        syllabus_id: syllabus.id,
        teacher_id: session.user.id,
        role: "lead",
        permissions: "edit",
        created_by: session.user.id,
        updated_by: session.user.id,
      });
  } catch (contributorError: any) {
    // Log but don't fail - contributor might already exist or RLS might prevent it
    // The created_by check in can_edit_syllabus should still allow editing
    console.warn("Failed to add creator as lead contributor:", contributorError);
  }

  return syllabus as Syllabus;
}

/**
 * Update a syllabus
 */
export async function updateSyllabus(
  id: string,
  payload: UpdateSyllabusPayload
): Promise<Syllabus> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("No active session");
  }

  const { data: syllabus, error } = await supabase
    .from("syllabi")
    .update({
      ...payload,
      updated_by: session.user.id,
    })
    .eq("id", id)
    .is("archived_at", null)
    .select(`
      *,
      program:programs(id, name),
      experience:experiences(id, name)
    `)
    .single();

  if (error) {
    throw new Error(`Failed to update syllabus: ${error.message}`);
  }

  return syllabus as Syllabus;
}

/**
 * Publish a syllabus (set status to published)
 */
export async function publishSyllabus(id: string): Promise<Syllabus> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("No active session");
  }

  const updateData: any = {
    status: "published",
    updated_by: session.user.id,
  };

  // Only include published_at/published_by if columns exist
  // Try to update with versioning fields first
  try {
    updateData.published_at = new Date().toISOString();
    updateData.published_by = session.user.id;
  } catch (err) {
    // Columns might not exist - that's okay, just update status
  }

  const { data: syllabus, error } = await supabase
    .from("syllabi")
    .update(updateData)
    .eq("id", id)
    .is("archived_at", null)
    .select(`
      *,
      program:programs(id, name),
      experience:experiences(id, name)
    `)
    .single();

  if (error) {
    // If error is about missing columns, try without versioning fields
    if (error.message.includes("published_at") || error.message.includes("published_by")) {
      const { data: syllabusRetry, error: retryError } = await supabase
        .from("syllabi")
        .update({
          status: "published",
          updated_by: session.user.id,
        })
        .eq("id", id)
        .is("archived_at", null)
        .select(`
          *,
          program:programs(id, name),
          experience:experiences(id, name)
        `)
        .single();

      if (retryError) {
        throw new Error(`Failed to publish syllabus: ${retryError.message}`);
      }

      const syllabusData = syllabusRetry as any;
      return {
        ...syllabusData,
        version_number: syllabusData.version_number ?? 1,
        parent_syllabus_id: syllabusData.parent_syllabus_id ?? null,
        published_at: null,
        published_by: null,
      } as Syllabus;
    }
    throw new Error(`Failed to publish syllabus: ${error.message}`);
  }

  // Ensure versioning fields have defaults
  const syllabusData = syllabus as any;
  return {
    ...syllabusData,
    version_number: syllabusData.version_number ?? 1,
    parent_syllabus_id: syllabusData.parent_syllabus_id ?? null,
    published_at: syllabusData.published_at ?? null,
    published_by: syllabusData.published_by ?? null,
  } as Syllabus;
}

/**
 * Archive a syllabus (soft delete)
 */
export async function archiveSyllabus(id: string): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("No active session");
  }

  const { error } = await supabase
    .from("syllabi")
    .update({
      archived_at: new Date().toISOString(),
      updated_by: session.user.id,
    })
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to archive syllabus: ${error.message}`);
  }
}

/**
 * Create a revision (copy) of a published syllabus
 * Creates a new draft syllabus with incremented version number
 */
export async function createSyllabusRevision(
  parentSyllabusId: string
): Promise<Syllabus> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("No active session");
  }

  // Get parent syllabus
  const parentSyllabus = await getSyllabus(parentSyllabusId);
  if (!parentSyllabus) {
    throw new Error("Parent syllabus not found");
  }

  if (parentSyllabus.status !== "published") {
    throw new Error("Can only create revisions of published syllabi");
  }

  // Check if versioning columns exist
  const hasVersioning = parentSyllabus.version_number !== undefined;

  let nextVersion = 1;
  if (hasVersioning) {
    try {
      // Get next version number
      const { data: versions } = await supabase
        .from("syllabi")
        .select("version_number")
        .or(`id.eq.${parentSyllabusId},parent_syllabus_id.eq.${parentSyllabusId}`)
        .is("archived_at", null)
        .order("version_number", { ascending: false })
        .limit(1);

      nextVersion =
        versions && versions.length > 0
          ? (versions[0].version_number || 1) + 1
          : (parentSyllabus.version_number || 1) + 1;
    } catch (err: any) {
      // If columns don't exist, default to version 2
      nextVersion = 2;
    }
  } else {
    // Versioning not enabled - use version 2 as default
    nextVersion = 2;
  }

  // Create new draft revision
  const insertData: any = {
    organization_id: parentSyllabus.organization_id,
    school_id: parentSyllabus.school_id,
    syllabus_template_id: parentSyllabus.syllabus_template_id,
    name: parentSyllabus.name,
    description: parentSyllabus.description,
    program_id: parentSyllabus.program_id,
    subject: parentSyllabus.subject,
    experience_id: parentSyllabus.experience_id,
    status: "draft",
    created_by: session.user.id,
    updated_by: session.user.id,
  };

  // Only include versioning fields if columns exist
  if (hasVersioning) {
    insertData.version_number = nextVersion;
    insertData.parent_syllabus_id = parentSyllabusId;
  }

  const { data: revision, error: createError } = await supabase
    .from("syllabi")
    .insert(insertData)
    .select(`
      *,
      program:programs(id, name),
      experience:experiences(id, name)
    `)
    .single();

  if (createError) {
    throw new Error(`Failed to create revision: ${createError.message}`);
  }

  // Add creator as lead contributor
  try {
    await supabase
      .from("syllabus_contributors")
      .insert({
        organization_id: parentSyllabus.organization_id,
        syllabus_id: revision.id,
        teacher_id: session.user.id,
        role: "lead",
        permissions: "edit",
        created_by: session.user.id,
        updated_by: session.user.id,
      });
  } catch (creatorError: any) {
    console.warn("Failed to add creator as lead contributor:", creatorError);
  }

  // Copy contributors from parent
  const contributors = await listSyllabusContributors(parentSyllabusId);
  for (const contributor of contributors) {
    // Skip if it's the creator (already added above)
    if (contributor.teacher_id === session.user.id) {
      continue;
    }
    try {
      await manageContributors(revision.id, "add", {
        teacher_id: contributor.teacher_id,
        role: contributor.role,
        permissions: contributor.permissions,
      });
    } catch (err: any) {
      console.warn(`Failed to copy contributor:`, err);
      // Continue with other contributors
    }
  }

  // Ensure versioning fields have defaults
  const revisionWithDefaults = revision as any;
  return {
    ...revisionWithDefaults,
    version_number: revisionWithDefaults.version_number ?? nextVersion,
    parent_syllabus_id: revisionWithDefaults.parent_syllabus_id ?? (hasVersioning ? parentSyllabusId : null),
    published_at: revisionWithDefaults.published_at ?? null,
    published_by: revisionWithDefaults.published_by ?? null,
  } as Syllabus;

  // Copy weeks
  const weeks = await listSyllabusWeeks(parentSyllabusId);
  for (const week of weeks) {
    try {
      await upsertSyllabusWeek(revision.id, {
        week_number: week.week_number,
        week_start_date: week.week_start_date,
        week_end_date: week.week_end_date,
        objectives: week.objectives,
        activities: week.activities,
        verification_method: week.verification_method,
      });
    } catch (err: any) {
      console.warn(`Failed to copy week ${week.week_number}:`, err);
      // Continue with other weeks
    }
  }

  return revision as Syllabus;
}

/**
 * List revisions (versions) of a syllabus
 */
export async function listSyllabusRevisions(
  syllabusId: string
): Promise<Syllabus[]> {
  // Get the root syllabus (find parent if this is a revision)
  const syllabus = await getSyllabus(syllabusId);
  if (!syllabus) {
    return [];
  }

  // Check if versioning columns exist by trying a simple query
  // If columns don't exist, return just the current syllabus
  try {
    const rootId = (syllabus as any).parent_syllabus_id || syllabus.id;

    // Try to query with versioning fields
    const { data, error } = await supabase
      .from("syllabi")
      .select(`
        *,
        program:programs(id, name),
        experience:experiences(id, name)
      `)
      .or(`id.eq.${rootId},parent_syllabus_id.eq.${rootId}`)
      .is("archived_at", null)
      .order("version_number", { ascending: true });

    if (error) {
      // If error is about missing column, return just current syllabus
      if (
        error.message.includes("parent_syllabus_id") ||
        error.message.includes("version_number") ||
        error.message.includes("does not exist")
      ) {
        return [syllabus];
      }
      throw new Error(`Failed to list revisions: ${error.message}`);
    }

    // Ensure versioning fields have defaults
    return (data || []).map((item: any) => ({
      ...item,
      version_number: item.version_number ?? 1,
      parent_syllabus_id: item.parent_syllabus_id ?? null,
      published_at: item.published_at ?? null,
      published_by: item.published_by ?? null,
    })) as Syllabus[];
  } catch (err: any) {
    // If column doesn't exist, return just the current syllabus
    if (
      err.message?.includes("parent_syllabus_id") ||
      err.message?.includes("version_number") ||
      err.message?.includes("does not exist")
    ) {
      return [syllabus];
    }
    throw err;
  }
}

// ============================================================================
// Syllabus Contributors
// ============================================================================

/**
 * List contributors for a syllabus
 */
export async function listSyllabusContributors(
  syllabusId: string
): Promise<SyllabusContributor[]> {
  const { data, error } = await supabase
    .from("syllabus_contributors")
    .select("*")
    .eq("syllabus_id", syllabusId)
    .is("archived_at", null)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to list contributors: ${error.message}`);
  }

  // Fetch teacher names from staff table
  const contributors = (data || []) as SyllabusContributor[];
  const teacherIds = contributors.map((c) => c.teacher_id);

  if (teacherIds.length > 0) {
    const { data: staffData } = await supabase
      .from("staff")
      .select("user_id, first_name, last_name, email_address")
      .in("user_id", teacherIds);

    // Create a map of user_id to staff info
    const staffMap = new Map(
      (staffData || []).map((staff: any) => [
        staff.user_id,
        {
          id: staff.user_id,
          first_name: staff.first_name,
          last_name: staff.last_name,
          email: staff.email_address,
        },
      ])
    );

    // Attach teacher info to contributors
    contributors.forEach((contributor) => {
      const staffInfo = staffMap.get(contributor.teacher_id);
      if (staffInfo) {
        contributor.teacher = staffInfo;
      } else {
        // Fallback: just use ID if no staff record found
        contributor.teacher = {
          id: contributor.teacher_id,
          first_name: null,
          last_name: null,
          email: null,
        };
      }
    });
  }

  return contributors;
}

/**
 * Manage contributors (add/update/remove)
 */
export async function manageContributors(
  syllabusId: string,
  action: "add" | "update" | "remove",
  payload: ManageContributorPayload
): Promise<SyllabusContributor | void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("No active session");
  }

  if (action === "remove") {
    const { error } = await supabase
      .from("syllabus_contributors")
      .update({
        archived_at: new Date().toISOString(),
        updated_by: session.user.id,
      })
      .eq("syllabus_id", syllabusId)
      .eq("teacher_id", payload.teacher_id)
      .is("archived_at", null);

    if (error) {
      throw new Error(`Failed to remove contributor: ${error.message}`);
    }
    return;
  }

  if (action === "add") {
    // Get organization_id from syllabus
    const syllabus = await getSyllabus(syllabusId);
    if (!syllabus) {
      throw new Error("Syllabus not found");
    }

    const { data: contributor, error } = await supabase
      .from("syllabus_contributors")
      .insert({
        organization_id: syllabus.organization_id,
        syllabus_id: syllabusId,
        teacher_id: payload.teacher_id,
        role: payload.role || "contributor",
        permissions: payload.permissions || "read",
        created_by: session.user.id,
        updated_by: session.user.id,
      })
      .select("*")
      .single();

    if (error) {
      throw new Error(`Failed to add contributor: ${error.message}`);
    }

    // Fetch teacher info from staff table
    const { data: staffData } = await supabase
      .from("staff")
      .select("user_id, first_name, last_name, email_address")
      .eq("user_id", payload.teacher_id)
      .single();

    const contributorWithTeacher = contributor as SyllabusContributor;
    if (staffData) {
      contributorWithTeacher.teacher = {
        id: staffData.user_id,
        first_name: staffData.first_name,
        last_name: staffData.last_name,
        email: staffData.email_address,
      };
    } else {
      contributorWithTeacher.teacher = {
        id: payload.teacher_id,
        first_name: null,
        last_name: null,
        email: null,
      };
    }

    return contributorWithTeacher;
  }

  // Update
  const { data: contributor, error } = await supabase
    .from("syllabus_contributors")
    .update({
      role: payload.role,
      permissions: payload.permissions,
      updated_by: session.user.id,
    })
    .eq("syllabus_id", syllabusId)
    .eq("teacher_id", payload.teacher_id)
    .is("archived_at", null)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to update contributor: ${error.message}`);
  }

  // Fetch teacher info from staff table
  const { data: staffData } = await supabase
    .from("staff")
    .select("user_id, first_name, last_name, email_address")
    .eq("user_id", payload.teacher_id)
    .single();

  const contributorWithTeacher = contributor as SyllabusContributor;
  if (staffData) {
    contributorWithTeacher.teacher = {
      id: staffData.user_id,
      first_name: staffData.first_name,
      last_name: staffData.last_name,
      email: staffData.email_address,
    };
  } else {
    contributorWithTeacher.teacher = {
      id: payload.teacher_id,
      first_name: null,
      last_name: null,
      email: null,
    };
  }

  return contributorWithTeacher;
}

// ============================================================================
// Syllabus Weeks
// ============================================================================

/**
 * List weeks for a syllabus
 */
export async function listSyllabusWeeks(
  syllabusId: string
): Promise<SyllabusWeek[]> {
  const { data, error } = await supabase
    .from("syllabus_weeks")
    .select("*")
    .eq("syllabus_id", syllabusId)
    .is("archived_at", null)
    .order("week_number", { ascending: true });

  if (error) {
    throw new Error(`Failed to list syllabus weeks: ${error.message}`);
  }

  return (data || []) as SyllabusWeek[];
}

/**
 * Upsert a syllabus week (create or update)
 */
export async function upsertSyllabusWeek(
  syllabusId: string,
  payload: UpsertSyllabusWeekPayload
): Promise<SyllabusWeek> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("No active session");
  }

  // Get organization_id from syllabus
  const syllabus = await getSyllabus(syllabusId);
  if (!syllabus) {
    throw new Error("Syllabus not found");
  }

  // Check if week exists
  const existing = await supabase
    .from("syllabus_weeks")
    .select("id")
    .eq("syllabus_id", syllabusId)
    .eq("week_number", payload.week_number)
    .is("archived_at", null)
    .single();

  if (existing.data) {
    // Update
    const { data: week, error } = await supabase
      .from("syllabus_weeks")
      .update({
        ...payload,
        updated_by: session.user.id,
      })
      .eq("id", existing.data.id)
      .select("*")
      .single();

    if (error) {
      throw new Error(`Failed to update syllabus week: ${error.message}`);
    }

    return week as SyllabusWeek;
  } else {
    // Create
    const { data: week, error } = await supabase
      .from("syllabus_weeks")
      .insert({
        organization_id: syllabus.organization_id,
        syllabus_id: syllabusId,
        ...payload,
        created_by: session.user.id,
        updated_by: session.user.id,
      })
      .select("*")
      .single();

    if (error) {
      throw new Error(`Failed to create syllabus week: ${error.message}`);
    }

    return week as SyllabusWeek;
  }
}
