/**
 * Phase 5 Export Jobs Data Access Layer
 * External Interfaces & Operational Scaling
 * 
 * All functions respect RLS policies and filter by organization_id unless super admin.
 * Export jobs are append-only audit trail.
 */

import { supabase } from "@/lib/supabase/client";

// ============================================================================
// Types
// ============================================================================

export interface ExportJob {
  id: string;
  organization_id: string;
  school_id: string | null;
  requested_by: string;
  export_type: "transcript" | "report_card" | "compliance_export";
  export_parameters: Record<string, any>;
  status: "pending" | "processing" | "completed" | "failed";
  file_path: string | null;
  file_size_bytes: number | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  // Joined fields (optional, may not be present in all queries)
  requested_by_profile?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
  } | null;
}

export interface ExportParameters {
  student_ids?: string[];
  school_year_id?: string;
  term_period?: string;
  program_id?: string;
  section_id?: string;
  template_id?: string;
  include_external_ids?: boolean;
  include_grade_entries?: boolean;
  format?: "pdf" | "csv" | "excel";
  [key: string]: any;
}

// ============================================================================
// Export Jobs
// ============================================================================

/**
 * List export jobs for an organization
 */
export async function listExportJobs(
  organizationId: string | null,
  filters?: {
    export_type?: string;
    status?: string;
    requested_by?: string;
    date_from?: string;
    date_to?: string;
  },
  pagination?: {
    page?: number;
    pageSize?: number;
  }
): Promise<{ data: ExportJob[]; count: number }> {
  let query = supabase
    .from("export_jobs")
    .select("*", { count: "exact" })
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  if (filters?.export_type) {
    query = query.eq("export_type", filters.export_type);
  }

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  if (filters?.requested_by) {
    query = query.eq("requested_by", filters.requested_by);
  }

  if (filters?.date_from) {
    query = query.gte("created_at", filters.date_from);
  }

  if (filters?.date_to) {
    query = query.lte("created_at", filters.date_to);
  }

  if (pagination) {
    const page = pagination.page || 1;
    const pageSize = pagination.pageSize || 50;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);
  }

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Failed to list export jobs: ${error.message}`);
  }

  return {
    data: (data || []) as ExportJob[],
    count: count || 0,
  };
}

/**
 * Get a single export job by ID
 */
export async function getExportJob(id: string): Promise<ExportJob | null> {
  const { data, error } = await supabase
    .from("export_jobs")
    .select(`
      *,
      requested_by_profile:profiles!export_jobs_requested_by_fkey(
        id,
        first_name,
        last_name,
        email
      )
    `)
    .eq("id", id)
    .is("archived_at", null)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(`Failed to get export job: ${error.message}`);
  }

  return data as ExportJob;
}

/**
 * Create a new export job
 */
export async function createExportJob(
  data: {
    organization_id: string;
    school_id?: string | null;
    requested_by: string;
    export_type: "transcript" | "report_card" | "compliance_export";
    export_parameters: ExportParameters;
  }
): Promise<ExportJob> {
  const { data: job, error } = await supabase
    .from("export_jobs")
    .insert({
      ...data,
      status: "pending",
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create export job: ${error.message}`);
  }

  return job as ExportJob;
}

/**
 * Trigger export processing via Edge Function
 * Note: This is non-blocking - if the Edge Function is not deployed or fails,
 * the export job will remain in 'pending' status and can be processed later.
 */
export async function processExportJob(exportJobId: string): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    console.warn("Supabase URL not configured - skipping Edge Function call");
    return;
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    // Don't throw - just log and return
    console.warn("No active session - skipping Edge Function call");
    return;
  }

  try {
    const { data, error } = await supabase.functions.invoke("process-export", {
      body: { export_job_id: exportJobId },
    });

    if (error) {
      // Log error but don't throw - export job is created successfully
      // It can be processed later via manual trigger or cron job
      console.warn("Edge Function returned error:", error);
      console.info(
        `Export job ${exportJobId} created successfully. ` +
        `Processing failed but job is in 'pending' status and can be processed manually.`
      );
      return;
    }

    console.log("Export job processing triggered successfully:", data);
  } catch (err: any) {
    // Catch all errors including FunctionsFetchError, network errors, function not found, etc.
    // Suppress the error from propagating - export job creation succeeded
    const errorMessage = err?.message || err?.toString() || "Unknown error";
    const errorName = err?.name || "Error";
    
    console.warn(`Edge Function invocation failed (${errorName}):`, errorMessage);
    console.info(
      `Export job ${exportJobId} created successfully. ` +
      `Edge Function 'process-export' is not available or not deployed. ` +
      `The job is in 'pending' status and can be processed manually from the export history page.`
    );
    
    // Explicitly return to prevent any error from propagating
    return;
  }
}

/**
 * Download export file from storage
 */
export async function downloadExportFile(filePath: string): Promise<Blob> {
  const { data, error } = await supabase.storage
    .from("exports")
    .download(filePath);

  if (error) {
    throw new Error(`Failed to download export file: ${error.message}`);
  }

  if (!data) {
    throw new Error("Export file not found");
  }

  return data;
}

/**
 * Get signed URL for export file download
 */
export async function getExportFileUrl(
  filePath: string,
  expiresIn: number = 3600
): Promise<string> {
  const { data, error } = await supabase.storage
    .from("exports")
    .createSignedUrl(filePath, expiresIn);

  if (error) {
    throw new Error(`Failed to create signed URL: ${error.message}`);
  }

  if (!data?.signedUrl) {
    throw new Error("Failed to generate download URL");
  }

  return data.signedUrl;
}

/**
 * Regenerate export (create new export job with same parameters)
 */
export async function regenerateExport(
  originalJobId: string
): Promise<ExportJob> {
  const originalJob = await getExportJob(originalJobId);
  if (!originalJob) {
    throw new Error("Original export job not found");
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("No active session");
  }

  return createExportJob({
    organization_id: originalJob.organization_id,
    school_id: originalJob.school_id,
    requested_by: session.user.id,
    export_type: originalJob.export_type,
    export_parameters: originalJob.export_parameters,
  });
}
