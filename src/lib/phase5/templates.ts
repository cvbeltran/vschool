/**
 * Phase 5 Export Templates Data Access Layer
 * External Interfaces & Operational Scaling
 * 
 * All functions respect RLS policies and filter by organization_id unless super admin.
 */

import { supabase } from "@/lib/supabase/client";

// ============================================================================
// Types
// ============================================================================

export interface ExportTemplate {
  id: string;
  organization_id: string;
  school_id: string | null;
  template_name: string;
  template_type: "transcript" | "report_card" | "compliance_export";
  template_config: Record<string, any>;
  export_format: "pdf" | "csv" | "excel";
  is_active: boolean;
  version: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  archived_at: string | null;
}

// ============================================================================
// Export Templates
// ============================================================================

/**
 * List export templates for an organization
 */
export async function listExportTemplates(
  organizationId: string | null,
  filters?: {
    template_type?: string;
    export_format?: string;
    is_active?: boolean;
  }
): Promise<ExportTemplate[]> {
  let query = supabase
    .from("export_templates")
    .select("*")
    .is("archived_at", null)
    .order("template_name", { ascending: true });

  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  if (filters?.template_type) {
    query = query.eq("template_type", filters.template_type);
  }

  if (filters?.export_format) {
    query = query.eq("export_format", filters.export_format);
  }

  if (filters?.is_active !== undefined) {
    query = query.eq("is_active", filters.is_active);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to list export templates: ${error.message}`);
  }

  return (data || []) as ExportTemplate[];
}

/**
 * Get a single export template by ID
 */
export async function getExportTemplate(
  id: string
): Promise<ExportTemplate | null> {
  const { data, error } = await supabase
    .from("export_templates")
    .select("*")
    .eq("id", id)
    .is("archived_at", null)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(`Failed to get export template: ${error.message}`);
  }

  return data as ExportTemplate;
}

/**
 * Create a new export template
 */
export async function createExportTemplate(
  data: {
    organization_id: string;
    school_id?: string | null;
    template_name: string;
    template_type: "transcript" | "report_card" | "compliance_export";
    template_config: Record<string, any>;
    export_format: "pdf" | "csv" | "excel";
    is_active?: boolean;
    created_by: string;
  }
): Promise<ExportTemplate> {
  const { data: template, error } = await supabase
    .from("export_templates")
    .insert({
      ...data,
      is_active: data.is_active ?? true,
      version: 1,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create export template: ${error.message}`);
  }

  return template as ExportTemplate;
}

/**
 * Update an export template
 */
export async function updateExportTemplate(
  id: string,
  data: {
    template_name?: string;
    template_config?: Record<string, any>;
    export_format?: "pdf" | "csv" | "excel";
    is_active?: boolean;
    updated_by: string;
  }
): Promise<ExportTemplate> {
  const existing = await getExportTemplate(id);
  if (!existing) {
    throw new Error("Export template not found");
  }

  const updateData: any = { ...data };
  if (data.template_config && JSON.stringify(data.template_config) !== JSON.stringify(existing.template_config)) {
    // Increment version if config changed
    updateData.version = existing.version + 1;
  }

  const { data: template, error } = await supabase
    .from("export_templates")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update export template: ${error.message}`);
  }

  return template as ExportTemplate;
}

/**
 * Archive an export template (soft delete)
 */
export async function archiveExportTemplate(
  id: string
): Promise<void> {
  const { error } = await supabase
    .from("export_templates")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to archive export template: ${error.message}`);
  }
}
