/**
 * Phase 5 External ID Mappings Data Access Layer
 * External Interfaces & Operational Scaling
 * 
 * All functions respect RLS policies and filter by organization_id unless super admin.
 */

import { supabase } from "@/lib/supabase/client";

// ============================================================================
// Types
// ============================================================================

export interface ExternalIdMapping {
  id: string;
  organization_id: string;
  entity_type: "student" | "school" | "program" | "section" | "school_year" | "staff";
  internal_id: string;
  external_system: string;
  external_id: string;
  external_id_display_name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  archived_at: string | null;
}

// ============================================================================
// External ID Mappings
// ============================================================================

/**
 * List external ID mappings for an organization
 */
export async function listExternalIdMappings(
  organizationId: string | null,
  filters?: {
    entity_type?: string;
    external_system?: string;
    is_active?: boolean;
  }
): Promise<ExternalIdMapping[]> {
  let query = supabase
    .from("external_id_mappings")
    .select("*")
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  if (filters?.entity_type) {
    query = query.eq("entity_type", filters.entity_type);
  }

  if (filters?.external_system) {
    query = query.eq("external_system", filters.external_system);
  }

  if (filters?.is_active !== undefined) {
    query = query.eq("is_active", filters.is_active);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to list external ID mappings: ${error.message}`);
  }

  return (data || []) as ExternalIdMapping[];
}

/**
 * Get a single external ID mapping by ID
 */
export async function getExternalIdMapping(
  id: string
): Promise<ExternalIdMapping | null> {
  const { data, error } = await supabase
    .from("external_id_mappings")
    .select("*")
    .eq("id", id)
    .is("archived_at", null)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(`Failed to get external ID mapping: ${error.message}`);
  }

  return data as ExternalIdMapping;
}

/**
 * Create a new external ID mapping
 */
export async function createExternalIdMapping(
  data: {
    organization_id: string;
    entity_type: "student" | "school" | "program" | "section" | "school_year" | "staff";
    internal_id: string;
    external_system: string;
    external_id: string;
    external_id_display_name?: string | null;
    is_active?: boolean;
    created_by: string;
  }
): Promise<ExternalIdMapping> {
  const { data: mapping, error } = await supabase
    .from("external_id_mappings")
    .insert({
      ...data,
      is_active: data.is_active ?? true,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create external ID mapping: ${error.message}`);
  }

  return mapping as ExternalIdMapping;
}

/**
 * Update an external ID mapping
 */
export async function updateExternalIdMapping(
  id: string,
  data: {
    external_id?: string;
    external_id_display_name?: string | null;
    is_active?: boolean;
    updated_by: string;
  }
): Promise<ExternalIdMapping> {
  const { data: mapping, error } = await supabase
    .from("external_id_mappings")
    .update(data)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update external ID mapping: ${error.message}`);
  }

  return mapping as ExternalIdMapping;
}

/**
 * Archive an external ID mapping (soft delete)
 */
export async function archiveExternalIdMapping(
  id: string
): Promise<void> {
  const { error } = await supabase
    .from("external_id_mappings")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to archive external ID mapping: ${error.message}`);
  }
}

/**
 * Get entity name by type and ID (helper for display)
 */
export async function getEntityName(
  entityType: string,
  entityId: string,
  organizationId: string | null
): Promise<string | null> {
  let query;
  let nameField: string;

  switch (entityType) {
    case "student":
      query = supabase.from("students").select("first_name, last_name, student_number");
      nameField = "student";
      break;
    case "school":
      query = supabase.from("schools").select("name");
      nameField = "name";
      break;
    case "program":
      query = supabase.from("programs").select("name");
      nameField = "name";
      break;
    case "section":
      query = supabase.from("sections").select("name");
      nameField = "name";
      break;
    case "school_year":
      query = supabase.from("school_years").select("year_label");
      nameField = "year_label";
      break;
    case "staff":
      query = supabase.from("staff").select("first_name, last_name");
      nameField = "staff";
      break;
    default:
      return null;
  }

  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  const { data, error } = await query.eq("id", entityId).single();

  if (error || !data) {
    return null;
  }

  if (entityType === "student" || entityType === "staff") {
    const firstName = (data as any).first_name || "";
    const lastName = (data as any).last_name || "";
    const number = (data as any).student_number || "";
    const name = `${firstName} ${lastName}`.trim();
    return name || number || entityId;
  }

  return (data as any)[nameField] || entityId;
}
