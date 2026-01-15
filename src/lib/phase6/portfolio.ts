/**
 * Phase 6 Portfolio Data Access Layer
 * Pedagogy Operations - Student Portfolio Management
 * 
 * All functions respect RLS policies and filter by organization_id unless super admin.
 * No computation fields - purely operational.
 */

import { supabase } from "@/lib/supabase/client";

// ============================================================================
// Types
// ============================================================================

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
}

export interface UpdateMyPortfolioArtifactPayload {
  title?: string;
  description?: string | null;
  file_url?: string | null;
  text_content?: string | null;
  visibility?: "internal" | "private" | "shared";
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
// Portfolio Artifacts CRUD
// ============================================================================

/**
 * List my portfolio artifacts (for current student)
 */
export async function listMyPortfolioArtifacts(
  filters?: ListMyPortfolioArtifactsFilters
): Promise<PortfolioArtifact[]> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("No active session");
  }

  // Get student_id from profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", session.user.id)
    .single();

  if (!profile) {
    throw new Error("Profile not found");
  }

  // Check if user is a student (simplified - in real app, check role)
  // For now, assume student_id matches profile.id
  const studentId = profile.id;

  let query = supabase
    .from("portfolio_artifacts")
    .select(`
      *,
      student:students!portfolio_artifacts_student_id_fkey(id, first_name, last_name, student_number)
    `)
    .eq("student_id", studentId)
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  if (filters?.artifact_type) {
    query = query.eq("artifact_type", filters.artifact_type);
  }

  if (filters?.visibility) {
    query = query.eq("visibility", filters.visibility);
  }

  if (filters?.search) {
    query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to list portfolio artifacts: ${error.message}`);
  }

  // Filter by tags if provided
  if (filters?.tag_type && filters?.tag_id) {
    const { data: tags } = await supabase
      .from("portfolio_artifact_tags")
      .select("artifact_id, competency_id, domain_id, experience_id")
      .eq("tag_type", filters.tag_type)
      .is("archived_at", null);

    if (filters.tag_type === "competency") {
      const filtered = (data || []).filter((artifact) =>
        tags?.some((tag) => tag.artifact_id === artifact.id && tag.competency_id === filters.tag_id)
      );
      return filtered as PortfolioArtifact[];
    } else if (filters.tag_type === "domain") {
      const filtered = (data || []).filter((artifact) =>
        tags?.some((tag) => tag.artifact_id === artifact.id && tag.domain_id === filters.tag_id)
      );
      return filtered as PortfolioArtifact[];
    } else if (filters.tag_type === "experience") {
      const filtered = (data || []).filter((artifact) =>
        tags?.some((tag) => tag.artifact_id === artifact.id && tag.experience_id === filters.tag_id)
      );
      return filtered as PortfolioArtifact[];
    }
  }

  return (data || []) as PortfolioArtifact[];
}

/**
 * Get a single portfolio artifact by ID
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

  // Get student_id from profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", session.user.id)
    .single();

  if (!profile) {
    throw new Error("Profile not found");
  }

  const studentId = profile.id;

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
 */
export async function createMyPortfolioArtifact(
  payload: CreateMyPortfolioArtifactPayload
): Promise<PortfolioArtifact> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("No active session");
  }

  // Get student_id from profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", session.user.id)
    .single();

  if (!profile) {
    throw new Error("Profile not found");
  }

  const studentId = profile.id;

  const { data: artifact, error } = await supabase
    .from("portfolio_artifacts")
    .insert({
      ...payload,
      student_id: studentId,
      visibility: payload.visibility || "internal",
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

  return artifact as PortfolioArtifact;
}

/**
 * Update a portfolio artifact
 */
export async function updateMyPortfolioArtifact(
  id: string,
  payload: UpdateMyPortfolioArtifactPayload
): Promise<PortfolioArtifact> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("No active session");
  }

  const { data: artifact, error } = await supabase
    .from("portfolio_artifacts")
    .update({
      ...payload,
      updated_by: session.user.id,
    })
    .eq("id", id)
    .is("archived_at", null)
    .select(`
      *,
      student:students!portfolio_artifacts_student_id_fkey(id, first_name, last_name, student_number)
    `)
    .single();

  if (error) {
    throw new Error(`Failed to update portfolio artifact: ${error.message}`);
  }

  return artifact as PortfolioArtifact;
}

/**
 * Archive a portfolio artifact (soft delete)
 */
export async function archiveMyPortfolioArtifact(id: string): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("No active session");
  }

  const { error } = await supabase
    .from("portfolio_artifacts")
    .update({
      archived_at: new Date().toISOString(),
      updated_by: session.user.id,
    })
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to archive portfolio artifact: ${error.message}`);
  }
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

  // Get organization_id from artifact
  const artifact = await getMyPortfolioArtifact(artifactId);
  if (!artifact) {
    throw new Error("Portfolio artifact not found");
  }

  const { data: tag, error } = await supabase
    .from("portfolio_artifact_tags")
    .insert({
      organization_id: artifact.organization_id,
      artifact_id: artifactId,
      ...payload,
      created_by: session.user.id,
    })
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

  // Get organization_id from artifact
  const artifact = await getMyPortfolioArtifact(artifactId);
  if (!artifact) {
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
