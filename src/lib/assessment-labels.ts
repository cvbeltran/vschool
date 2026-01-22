/**
 * Phase 6.5 Assessment Labels Data Access Layer
 * Assessment & Judgment Layer - Label Sets & Labels Management
 * 
 * All functions respect RLS policies and filter by organization_id unless super admin.
 * No computation fields - purely qualitative labels.
 * 
 * Role-based access control:
 *   - Admins/Principals: Full CRUD on label sets and labels
 *   - Teachers: Read-only access to label sets and labels
 *   - Registrars: Read-only access
 */

import { supabase } from "@/lib/supabase/client";

// ============================================================================
// Types
// ============================================================================

export interface AssessmentLabelSet {
  id: string;
  organization_id: string;
  school_id: string | null;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  archived_at: string | null;
}

export interface AssessmentLabel {
  id: string;
  organization_id: string;
  label_set_id: string;
  label_text: string;
  description: string | null;
  display_order: number | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  archived_at: string | null;
  // Joined fields
  label_set?: {
    id: string;
    name: string;
  };
}

export interface CreateLabelSetPayload {
  name: string;
  description?: string | null;
  school_id?: string | null;
  is_active?: boolean;
}

export interface UpdateLabelSetPayload {
  name?: string;
  description?: string | null;
  is_active?: boolean;
}

export interface CreateLabelPayload {
  label_text: string;
  description?: string | null;
  display_order?: number | null;
}

export interface UpdateLabelPayload {
  label_text?: string;
  description?: string | null;
  display_order?: number | null;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get current user's organization_id and school_id from session
 */
async function getCurrentUserContext() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("No active session");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, school_id")
    .eq("id", session.user.id)
    .single();

  return {
    userId: session.user.id,
    organizationId: profile?.organization_id,
    schoolId: profile?.school_id,
  };
}

// ============================================================================
// Label Set CRUD
// ============================================================================

/**
 * List all label sets
 */
export async function listLabelSets(): Promise<AssessmentLabelSet[]> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("No active session");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, is_super_admin")
    .eq("id", session.user.id)
    .single();

  if (!profile) {
    throw new Error("Profile not found");
  }

  let query = supabase
    .from("assessment_label_sets")
    .select("*")
    .is("archived_at", null)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (!profile.is_super_admin && profile.organization_id) {
    query = query.eq("organization_id", profile.organization_id);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to list label sets: ${error.message}`);
  }

  return (data || []) as AssessmentLabelSet[];
}

/**
 * Get single label set by ID
 */
export async function getLabelSet(id: string): Promise<AssessmentLabelSet | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("No active session");
  }

  const { data, error } = await supabase
    .from("assessment_label_sets")
    .select("*")
    .eq("id", id)
    .is("archived_at", null)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(`Failed to get label set: ${error.message}`);
  }

  return data as AssessmentLabelSet;
}

/**
 * Create new label set (admin only)
 */
export async function createLabelSet(
  payload: CreateLabelSetPayload,
  organizationId?: string | null
): Promise<AssessmentLabelSet> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("No active session");
  }

  // Use provided organizationId or get from context
  let orgId = organizationId;
  if (!orgId) {
    const context = await getCurrentUserContext();
    orgId = context.organizationId;
  }

  if (!orgId) {
    throw new Error("Organization context required");
  }

  // Get school_id from context if not provided
  const context = await getCurrentUserContext();
  const schoolId = payload.school_id || context.schoolId || null;

  const { data, error } = await supabase
    .from("assessment_label_sets")
    .insert({
      organization_id: orgId,
      school_id: schoolId,
      name: payload.name,
      description: payload.description || null,
      is_active: payload.is_active !== undefined ? payload.is_active : true,
      created_by: session.user.id,
      updated_by: session.user.id,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create label set: ${error.message}`);
  }

  return data as AssessmentLabelSet;
}

/**
 * Update label set (admin only)
 */
export async function updateLabelSet(
  id: string,
  payload: UpdateLabelSetPayload
): Promise<AssessmentLabelSet> {
  const context = await getCurrentUserContext();

  const { data, error } = await supabase
    .from("assessment_label_sets")
    .update({
      ...payload,
      updated_by: context.userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update label set: ${error.message}`);
  }

  return data as AssessmentLabelSet;
}

/**
 * Archive label set (soft delete)
 */
export async function archiveLabelSet(id: string): Promise<void> {
  const context = await getCurrentUserContext();

  const { error } = await supabase
    .from("assessment_label_sets")
    .update({
      archived_at: new Date().toISOString(),
      updated_by: context.userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to archive label set: ${error.message}`);
  }
}

// ============================================================================
// Label CRUD
// ============================================================================

/**
 * List labels for a label set
 */
export async function listLabels(labelSetId: string): Promise<AssessmentLabel[]> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("No active session");
  }

  const { data, error } = await supabase
    .from("assessment_labels")
    .select(`
      *,
      label_set:assessment_label_sets!inner(id, name)
    `)
    .eq("label_set_id", labelSetId)
    .is("archived_at", null)
    .order("display_order", { ascending: true, nullsFirst: false })
    .order("label_text", { ascending: true });

  if (error) {
    throw new Error(`Failed to list labels: ${error.message}`);
  }

  return (data || []) as AssessmentLabel[];
}

/**
 * Create new label (admin only)
 */
export async function createLabel(
  labelSetId: string,
  payload: CreateLabelPayload,
  organizationId?: string | null
): Promise<AssessmentLabel> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("No active session");
  }

  // Get label set to get organization_id
  const labelSet = await getLabelSet(labelSetId);
  if (!labelSet) {
    throw new Error("Label set not found");
  }

  // Use provided organizationId or get from label set
  const orgId = organizationId || labelSet.organization_id;
  if (!orgId) {
    throw new Error("Organization context required");
  }

  const { data, error } = await supabase
    .from("assessment_labels")
    .insert({
      organization_id: orgId,
      label_set_id: labelSetId,
      label_text: payload.label_text,
      description: payload.description || null,
      display_order: payload.display_order || null,
      created_by: session.user.id,
      updated_by: session.user.id,
    })
    .select(`
      *,
      label_set:assessment_label_sets!inner(id, name)
    `)
    .single();

  if (error) {
    throw new Error(`Failed to create label: ${error.message}`);
  }

  return data as AssessmentLabel;
}

/**
 * Update label (admin only)
 */
export async function updateLabel(
  id: string,
  payload: UpdateLabelPayload
): Promise<AssessmentLabel> {
  const context = await getCurrentUserContext();

  const { data, error } = await supabase
    .from("assessment_labels")
    .update({
      ...payload,
      updated_by: context.userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select(`
      *,
      label_set:assessment_label_sets!inner(id, name)
    `)
    .single();

  if (error) {
    throw new Error(`Failed to update label: ${error.message}`);
  }

  return data as AssessmentLabel;
}

/**
 * Archive label (soft delete)
 */
export async function archiveLabel(id: string): Promise<void> {
  const context = await getCurrentUserContext();

  const { error } = await supabase
    .from("assessment_labels")
    .update({
      archived_at: new Date().toISOString(),
      updated_by: context.userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to archive label: ${error.message}`);
  }
}

