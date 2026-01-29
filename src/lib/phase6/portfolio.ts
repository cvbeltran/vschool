/**
 * Phase 6 Portfolio Data Access Layer
 * Pedagogy Operations - Student Portfolio Management
 * 
 * All functions respect RLS policies and filter by organization_id unless super admin.
 * No computation fields - purely operational.
 */

import { supabase } from "@/lib/supabase/client";
import { createAuditLog } from "@/lib/audit";

// ============================================================================
// Types
// ============================================================================

export interface PortfolioArtifactAttachment {
  name: string;
  url: string;
  mime?: string | null;
  size?: number | null;
}

export interface PortfolioArtifact {
  id: string;
  organization_id: string;
  school_id: string | null;
  student_id: string;
  artifact_type: "upload" | "link" | "text";
  title: string;
  description: string | null;
  file_url: string | null;
  text_content: string | null;
  visibility: "internal" | "private" | "shared";
  occurred_on: string | null;
  evidence_type: string | null;
  attachments: PortfolioArtifactAttachment[] | null;
  source: "student_upload" | "staff_added" | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  archived_at: string | null;
  // Joined fields
  student?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    student_number: string | null;
  };
}

export interface PortfolioArtifactTag {
  id: string;
  organization_id: string;
  artifact_id: string;
  tag_type: "competency" | "domain" | "experience";
  competency_id: string | null;
  domain_id: string | null;
  experience_id: string | null;
  created_at: string;
  created_by: string | null;
  archived_at: string | null;
  // Joined fields
  competency?: {
    id: string;
    name: string;
  };
  domain?: {
    id: string;
    name: string;
  };
  experience?: {
    id: string;
    name: string;
  };
}

export interface PortfolioArtifactLink {
  id: string;
  organization_id: string;
  artifact_id: string;
  observation_id: string | null;
  experience_id: string | null;
  created_at: string;
  created_by: string | null;
  archived_at: string | null;
  // Joined fields (read-only references)
  observation?: {
    id: string;
    notes: string | null;
    observed_at: string;
  };
  experience?: {
    id: string;
    name: string;
  };
}

export interface ListMyPortfolioArtifactsFilters {
  artifact_type?: "upload" | "link" | "text";
  visibility?: "internal" | "private" | "shared";
  search?: string;
  tag_type?: "competency" | "domain" | "experience";
  tag_id?: string;
}

export interface CreateMyPortfolioArtifactPayload {
  organization_id: string;
  school_id?: string | null;
  artifact_type: "upload" | "link" | "text";
  title: string;
  description?: string | null;
  file_url?: string | null;
  text_content?: string | null;
  visibility?: "internal" | "private" | "shared";
  occurred_on?: string | null;
  evidence_type?: string | null;
  attachments?: PortfolioArtifactAttachment[] | null;
  source?: "student_upload" | "staff_added" | null;
}

export interface UpdateMyPortfolioArtifactPayload {
  title?: string;
  description?: string | null;
  file_url?: string | null;
  text_content?: string | null;
  visibility?: "internal" | "private" | "shared";
  occurred_on?: string | null;
  evidence_type?: string | null;
  attachments?: PortfolioArtifactAttachment[] | null;
}

// Scoped portfolio operations
export type PortfolioScope = "self" | "student";

export interface ListPortfolioItemsParams {
  scope: PortfolioScope;
  studentId?: string;
  filters?: ListMyPortfolioArtifactsFilters;
}

export interface CreatePortfolioItemParams {
  scope: PortfolioScope;
  studentId?: string;
  payload: CreateMyPortfolioArtifactPayload;
}

export interface UpdatePortfolioItemParams {
  scope: PortfolioScope;
  studentId?: string;
  itemId: string;
  patch: UpdateMyPortfolioArtifactPayload;
}

export interface DeletePortfolioItemParams {
  scope: PortfolioScope;
  studentId?: string;
  itemId: string;
}

export interface AddArtifactTagPayload {
  tag_type: "competency" | "domain" | "experience";
  competency_id?: string | null;
  domain_id?: string | null;
  experience_id?: string | null;
}

export interface LinkArtifactPayload {
  observation_id?: string | null;
  experience_id?: string | null;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get student_id based on scope
 * - scope="self": derive from session user mapping
 * - scope="student": require studentId param
 */
async function getStudentIdForScope(
  scope: PortfolioScope,
  studentId?: string
): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("No active session");
  }

  if (scope === "self") {
    // Ignore any passed studentId and derive from session
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, organization_id")
      .eq("id", session.user.id)
      .single();

    if (!profile) {
      throw new Error("Profile not found");
    }

    // Match student by email
    const { data: user } = await supabase.auth.getUser();
    if (user?.user?.email && profile.organization_id) {
      const { data: student } = await supabase
        .from("students")
        .select("id")
        .eq("primary_email", user.user.email)
        .eq("organization_id", profile.organization_id)
        .maybeSingle();
      if (student) {
        return student.id;
      }
    }

    throw new Error("Student ID not found. Please ensure your account is linked to a student record.");
  } else if (scope === "student") {
    // Require studentId param
    if (!studentId) {
      throw new Error("studentId is required when scope='student'");
    }
    return studentId;
  } else {
    throw new Error(`Invalid scope: ${scope}. Must be "self" or "student"`);
  }
}

// ============================================================================
// Portfolio Artifacts CRUD - Scoped Functions
// ============================================================================

/**
 * List portfolio items with explicit scope
 */
export async function listPortfolioItems(
  params: ListPortfolioItemsParams
): Promise<PortfolioArtifact[]> {
  const studentId = await getStudentIdForScope(params.scope, params.studentId);
  const filters = params.filters || {};

  let query = supabase
    .from("portfolio_artifacts")
    .select(`
      *,
      student:students!portfolio_artifacts_student_id_fkey(id, first_name, last_name, student_number)
    `)
    .eq("student_id", studentId)
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  if (filters.artifact_type) {
    query = query.eq("artifact_type", filters.artifact_type);
  }

  if (filters.visibility) {
    query = query.eq("visibility", filters.visibility);
  }

  if (filters.search) {
    query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to list portfolio artifacts: ${error.message}`);
  }

  // Parse attachments if they're strings
  const parsedData = (data || []).map((item: any) => {
    if (item.attachments && typeof item.attachments === 'string') {
      try {
        item.attachments = JSON.parse(item.attachments);
      } catch {
        item.attachments = null;
      }
    }
    return item;
  });

  // Filter by tags if provided
  if (filters.tag_type && filters.tag_id) {
    const { data: tags } = await supabase
      .from("portfolio_artifact_tags")
      .select("artifact_id, competency_id, domain_id, experience_id")
      .eq("tag_type", filters.tag_type)
      .is("archived_at", null);

    if (filters.tag_type === "competency") {
      const filtered = parsedData.filter((artifact) =>
        tags?.some((tag) => tag.artifact_id === artifact.id && tag.competency_id === filters.tag_id)
      );
      return filtered as PortfolioArtifact[];
    } else if (filters.tag_type === "domain") {
      const filtered = parsedData.filter((artifact) =>
        tags?.some((tag) => tag.artifact_id === artifact.id && tag.domain_id === filters.tag_id)
      );
      return filtered as PortfolioArtifact[];
    } else if (filters.tag_type === "experience") {
      const filtered = parsedData.filter((artifact) =>
        tags?.some((tag) => tag.artifact_id === artifact.id && tag.experience_id === filters.tag_id)
      );
      return filtered as PortfolioArtifact[];
    }
  }

  return parsedData as PortfolioArtifact[];
}

/**
 * Create portfolio item with explicit scope
 */
export async function createPortfolioItem(
  params: CreatePortfolioItemParams
): Promise<PortfolioArtifact> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("No active session");
  }

  const studentId = await getStudentIdForScope(params.scope, params.studentId);

  // Get school_id from profile if not provided
  let schoolId = params.payload.school_id;
  if (!schoolId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("school_id")
      .eq("id", session.user.id)
      .single();
    schoolId = profile?.school_id || null;
  }

  // Set source based on scope
  const source = params.scope === "self" ? "student_upload" : "staff_added";
  
  // Set default visibility based on source
  const visibility = params.payload.visibility || (params.scope === "self" ? "private" : "internal");

  const { data: artifact, error } = await supabase
    .from("portfolio_artifacts")
    .insert({
      ...params.payload,
      student_id: studentId,
      school_id: schoolId,
      visibility,
      source,
      occurred_on: params.payload.occurred_on || null,
      evidence_type: params.payload.evidence_type || null,
      attachments: params.payload.attachments || null,
      created_by: session.user.id,
      updated_by: session.user.id,
    })
    .select(`
      *,
      student:students!portfolio_artifacts_student_id_fkey(id, first_name, last_name, student_number)
    `)
    .single();

  if (error) {
    throw new Error(`Failed to create portfolio artifact: ${error.message}`);
  }

  const artifactData = artifact as any;

  // Create audit log
  await createAuditLog({
    organization_id: params.payload.organization_id,
    school_id: schoolId || null,
    actor_id: session.user.id,
    action: "create",
    entity_type: "portfolio_artifact",
    entity_id: artifactData.id,
    after: artifactData,
  });

  return artifactData as PortfolioArtifact;
}

/**
 * Update portfolio item with explicit scope
 */
export async function updatePortfolioItem(
  params: UpdatePortfolioItemParams
): Promise<PortfolioArtifact> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("No active session");
  }

  // Get existing for audit log
  const { data: existing } = await supabase
    .from("portfolio_artifacts")
    .select("*")
    .eq("id", params.itemId)
    .is("archived_at", null)
    .single();

  if (!existing) {
    throw new Error("Portfolio artifact not found");
  }

  const { data: artifact, error } = await supabase
    .from("portfolio_artifacts")
    .update({
      ...params.patch,
      updated_by: session.user.id,
    })
    .eq("id", params.itemId)
    .is("archived_at", null)
    .select(`
      *,
      student:students!portfolio_artifacts_student_id_fkey(id, first_name, last_name, student_number)
    `)
    .single();

  if (error) {
    throw new Error(`Failed to update portfolio artifact: ${error.message}`);
  }

  const artifactData = artifact as any;

  // Create audit log
  await createAuditLog({
    organization_id: existing.organization_id,
    school_id: existing.school_id || null,
    actor_id: session.user.id,
    action: "update",
    entity_type: "portfolio_artifact",
    entity_id: params.itemId,
    before: existing,
    after: artifactData,
  });

  return artifactData as PortfolioArtifact;
}

/**
 * Delete portfolio item with explicit scope
 */
export async function deletePortfolioItem(
  params: DeletePortfolioItemParams
): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("No active session");
  }

  // Get existing for audit log
  const { data: existing } = await supabase
    .from("portfolio_artifacts")
    .select("*")
    .eq("id", params.itemId)
    .is("archived_at", null)
    .single();

  if (!existing) {
    throw new Error("Portfolio artifact not found");
  }

  const { error } = await supabase
    .from("portfolio_artifacts")
    .update({
      archived_at: new Date().toISOString(),
      updated_by: session.user.id,
    })
    .eq("id", params.itemId);

  if (error) {
    throw new Error(`Failed to archive portfolio artifact: ${error.message}`);
  }

  // Create audit log
  await createAuditLog({
    organization_id: existing.organization_id,
    school_id: existing.school_id || null,
    actor_id: session.user.id,
    action: "delete",
    entity_type: "portfolio_artifact",
    entity_id: params.itemId,
    before: existing,
    after: { ...existing, archived_at: new Date().toISOString() },
  });
}

// ============================================================================
// Portfolio Artifacts CRUD - Legacy "My" Functions (backward compatibility)
// ============================================================================

/**
 * List my portfolio artifacts (for current student)
 * @deprecated Use listPortfolioItems({ scope: "self", filters }) instead
 */
export async function listMyPortfolioArtifacts(
  filters?: ListMyPortfolioArtifactsFilters
): Promise<PortfolioArtifact[]> {
  return listPortfolioItems({ scope: "self", filters });
}

/**
 * Get a single portfolio artifact by ID (for admins - allows access to any artifact in organization)
 */
export async function getPortfolioArtifactById(
  id: string
): Promise<PortfolioArtifact | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("No active session");
  }

  const { data, error } = await supabase
    .from("portfolio_artifacts")
    .select(`
      *,
      student:students!portfolio_artifacts_student_id_fkey(id, first_name, last_name, student_number)
    `)
    .eq("id", id)
    .is("archived_at", null)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(`Failed to get portfolio artifact: ${error.message}`);
  }

  // Parse attachments if they're strings
  const artifactData = data as any;
  if (artifactData.attachments && typeof artifactData.attachments === 'string') {
    try {
      artifactData.attachments = JSON.parse(artifactData.attachments);
    } catch {
      artifactData.attachments = null;
    }
  }

  return artifactData as PortfolioArtifact;
}

/**
 * Get a single portfolio artifact by ID (for students - only own artifacts)
 */
export async function getMyPortfolioArtifact(
  id: string
): Promise<PortfolioArtifact | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("No active session");
  }

  // Get organization_id from profile and match student by email
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, organization_id")
    .eq("id", session.user.id)
    .single();

  if (!profile) {
    throw new Error("Profile not found");
  }

  // Match student by email (profiles table doesn't have student_id column)
  let studentId: string | null = null;
  const { data: user } = await supabase.auth.getUser();
  if (user?.user?.email && profile.organization_id) {
    const { data: student } = await supabase
      .from("students")
      .select("id")
      .eq("primary_email", user.user.email)
      .eq("organization_id", profile.organization_id)
      .maybeSingle();
    if (student) {
      studentId = student.id;
    }
  }

  if (!studentId) {
    throw new Error("Student ID not found. Please ensure your account is linked to a student record.");
  }

  const { data, error } = await supabase
    .from("portfolio_artifacts")
    .select(`
      *,
      student:students!portfolio_artifacts_student_id_fkey(id, first_name, last_name, student_number)
    `)
    .eq("id", id)
    .eq("student_id", studentId)
    .is("archived_at", null)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(`Failed to get portfolio artifact: ${error.message}`);
  }

  return data as PortfolioArtifact;
}

/**
 * Create a new portfolio artifact
 * @deprecated Use createPortfolioItem({ scope: "self", payload }) instead
 */
export async function createMyPortfolioArtifact(
  payload: CreateMyPortfolioArtifactPayload
): Promise<PortfolioArtifact> {
  return createPortfolioItem({ scope: "self", payload });
}

/**
 * Update a portfolio artifact
 * @deprecated Use updatePortfolioItem({ scope: "self", itemId, patch }) instead
 */
export async function updateMyPortfolioArtifact(
  id: string,
  payload: UpdateMyPortfolioArtifactPayload
): Promise<PortfolioArtifact> {
  return updatePortfolioItem({ scope: "self", itemId: id, patch: payload });
}

/**
 * Archive a portfolio artifact (soft delete)
 * @deprecated Use deletePortfolioItem({ scope: "self", itemId }) instead
 */
export async function archiveMyPortfolioArtifact(id: string): Promise<void> {
  return deletePortfolioItem({ scope: "self", itemId: id });
}

// ============================================================================
// Portfolio Tags
// ============================================================================

/**
 * List tags for a portfolio artifact
 */
export async function listPortfolioArtifactTags(
  artifactId: string
): Promise<PortfolioArtifactTag[]> {
  const { data, error } = await supabase
    .from("portfolio_artifact_tags")
    .select(`
      *,
      competency:competencies(id, name),
      domain:domains(id, name),
      experience:experiences(id, name)
    `)
    .eq("artifact_id", artifactId)
    .is("archived_at", null)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to list portfolio artifact tags: ${error.message}`);
  }

  return (data || []) as PortfolioArtifactTag[];
}

/**
 * Add a tag to a portfolio artifact
 * Works for both self-scoped (student) and admin/teacher-scoped operations
 */
export async function addArtifactTag(
  artifactId: string,
  payload: AddArtifactTagPayload
): Promise<PortfolioArtifactTag> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("No active session");
  }

  // Validate payload
  if (!payload.tag_type || !["competency", "domain", "experience"].includes(payload.tag_type)) {
    throw new Error(`Invalid tag_type: ${payload.tag_type}. Must be one of: competency, domain, experience`);
  }

  // Validate that the correct ID is provided based on tag_type
  if (payload.tag_type === "competency" && !payload.competency_id) {
    throw new Error("competency_id is required when tag_type is 'competency'");
  }
  if (payload.tag_type === "domain" && !payload.domain_id) {
    throw new Error("domain_id is required when tag_type is 'domain'");
  }
  if (payload.tag_type === "experience" && !payload.experience_id) {
    throw new Error("experience_id is required when tag_type is 'experience'");
  }

  // Get artifact directly (RLS will enforce permissions)
  const { data: artifact, error: artifactError } = await supabase
    .from("portfolio_artifacts")
    .select("id, organization_id, school_id")
    .eq("id", artifactId)
    .is("archived_at", null)
    .single();

  if (artifactError || !artifact) {
    throw new Error("Portfolio artifact not found");
  }

  // Build insert payload ensuring only the correct fields are set
  const insertPayload: any = {
    organization_id: artifact.organization_id,
    artifact_id: artifactId,
    tag_type: payload.tag_type,
    created_by: session.user.id,
  };

  // Set the appropriate ID field based on tag_type, and ensure others are null
  if (payload.tag_type === "competency") {
    insertPayload.competency_id = payload.competency_id;
    insertPayload.domain_id = null;
    insertPayload.experience_id = null;
  } else if (payload.tag_type === "domain") {
    insertPayload.domain_id = payload.domain_id;
    insertPayload.competency_id = null;
    insertPayload.experience_id = null;
  } else if (payload.tag_type === "experience") {
    insertPayload.experience_id = payload.experience_id;
    insertPayload.competency_id = null;
    insertPayload.domain_id = null;
  }

  const { data: tag, error } = await supabase
    .from("portfolio_artifact_tags")
    .insert(insertPayload)
    .select(`
      *,
      competency:competencies(id, name),
      domain:domains(id, name),
      experience:experiences(id, name)
    `)
    .single();

  if (error) {
    throw new Error(`Failed to add artifact tag: ${error.message}`);
  }

  // Create audit log
  await createAuditLog({
    organization_id: artifact.organization_id,
    school_id: artifact.school_id || null,
    actor_id: session.user.id,
    action: "create",
    entity_type: "portfolio_artifact_tag",
    entity_id: tag.id,
    after: tag,
  });

  return tag as PortfolioArtifactTag;
}

/**
 * Remove a tag from a portfolio artifact
 */
export async function removeArtifactTag(tagId: string): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("No active session");
  }

  const { error } = await supabase
    .from("portfolio_artifact_tags")
    .update({
      archived_at: new Date().toISOString(),
    })
    .eq("id", tagId)
    .is("archived_at", null);

  if (error) {
    throw new Error(`Failed to remove artifact tag: ${error.message}`);
  }
}

// ============================================================================
// Portfolio Links (to Phase 2 observations/experiences)
// ============================================================================

/**
 * List links for a portfolio artifact
 */
export async function listPortfolioArtifactLinks(
  artifactId: string
): Promise<PortfolioArtifactLink[]> {
  const { data, error } = await supabase
    .from("portfolio_artifact_links")
    .select(`
      *,
      observation:observations(id, notes, observed_at),
      experience:experiences(id, name)
    `)
    .eq("artifact_id", artifactId)
    .is("archived_at", null)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to list portfolio artifact links: ${error.message}`);
  }

  return (data || []) as PortfolioArtifactLink[];
}

/**
 * Link artifact to observation or experience (read-only reference)
 */
export async function linkArtifactToObservationOrExperience(
  artifactId: string,
  payload: LinkArtifactPayload
): Promise<PortfolioArtifactLink> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("No active session");
  }

  // Get artifact directly (RLS will enforce permissions)
  const { data: artifact, error: artifactError } = await supabase
    .from("portfolio_artifacts")
    .select("id, organization_id, school_id")
    .eq("id", artifactId)
    .is("archived_at", null)
    .single();

  if (artifactError || !artifact) {
    throw new Error("Portfolio artifact not found");
  }

  const { data: link, error } = await supabase
    .from("portfolio_artifact_links")
    .insert({
      organization_id: artifact.organization_id,
      artifact_id: artifactId,
      ...payload,
      created_by: session.user.id,
    })
    .select(`
      *,
      observation:observations(id, notes, observed_at),
      experience:experiences(id, name)
    `)
    .single();

  if (error) {
    throw new Error(`Failed to link artifact: ${error.message}`);
  }

  return link as PortfolioArtifactLink;
}
