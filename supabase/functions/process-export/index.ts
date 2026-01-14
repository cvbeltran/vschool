// Supabase Edge Function: Process Export Job
// Created: 2024
// Description: Processes export_jobs by generating files and uploading to storage
// Enforces Phase 5 boundaries: read-only consumption of Phase 4 grade records

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import {
  generatePDF,
  generateCSV,
  generateExcel,
  ExportData,
} from "./lib/export-generators.ts";
import type { ExportJob, ExportParameters, Profile } from "./types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Initialize Supabase client with service role (for admin operations)
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const { export_job_id } = await req.json();

    if (!export_job_id) {
      return new Response(
        JSON.stringify({ error: "Missing export_job_id" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get export job record
    const { data: exportJob, error: jobError } = await supabase
      .from("export_jobs")
      .select("*")
      .eq("id", export_job_id)
      .single();

    if (jobError || !exportJob) {
      return new Response(
        JSON.stringify({ error: "Export job not found", details: jobError }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate export job status
    if (exportJob.status !== "pending") {
      return new Response(
        JSON.stringify({
          error: `Export job is not pending (current status: ${exportJob.status})`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get requester profile to validate role
    const { data: requesterProfile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role, organization_id, is_super_admin")
      .eq("id", exportJob.requested_by)
      .single();

    if (profileError || !requesterProfile) {
      return new Response(
        JSON.stringify({ error: "Requester profile not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate role: admin/principal can generate all exports, registrar can only generate compliance_export
    const allowedRoles = ["admin", "principal"];
    const isRegistrar = requesterProfile.role === "registrar";
    const isSuperAdmin = requesterProfile.is_super_admin === true;

    if (
      !isSuperAdmin &&
      !allowedRoles.includes(requesterProfile.role) &&
      !(isRegistrar && exportJob.export_type === "compliance_export")
    ) {
      return new Response(
        JSON.stringify({
          error: "Insufficient permissions to generate this export type",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate organization scope
    if (
      !isSuperAdmin &&
      requesterProfile.organization_id !== exportJob.organization_id
    ) {
      return new Response(
        JSON.stringify({
          error: "Cannot access export job from another organization",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Update export job status to 'processing'
    const { error: updateError } = await supabase
      .from("export_jobs")
      .update({
        status: "processing",
        started_at: new Date().toISOString(),
      })
      .eq("id", export_job_id);

    if (updateError) {
      return new Response(
        JSON.stringify({
          error: "Failed to update export job status",
          details: updateError,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Generate export file based on export_type
    let fileBuffer: Uint8Array;
    let fileName: string;
    let contentType: string;

    try {
      const exportParams: ExportParameters = exportJob.export_parameters || {};

      // Fetch data based on export type
      let exportData: ExportData = {};

      switch (exportJob.export_type) {
        case "transcript":
        case "report_card": {
          // Read Phase 4 student grades (read-only)
          const { data: studentGrades, error: gradesError } = await supabase
            .from("student_grades")
            .select(`
              *,
              students:student_id (id, first_name, last_name, student_number, lrn),
              school_years:school_year_id (id, name, start_date, end_date),
              programs:program_id (id, name),
              sections:section_id (id, name),
              grading_scales:grade_value (grade_value, grade_label)
            `)
            .eq("organization_id", exportJob.organization_id)
            .in("status", ["confirmed", "overridden"])
            .in("student_id", exportParams.student_ids || [])
            .eq("school_year_id", exportParams.school_year_id || "")
            .eq("term_period", exportParams.term_period || "");

          if (gradesError) {
            throw new Error(
              `Failed to fetch student grades: ${gradesError.message}`
            );
          }

          if (!studentGrades || studentGrades.length === 0) {
            throw new Error("No confirmed grades found for selected scope");
          }

          exportData.studentGrades = studentGrades;

          // Generate PDF
          const pdfResult = generatePDF(
            exportJob.export_type === "transcript" ? "Transcript" : "Report Card",
            exportData,
            exportParams
          );
          fileBuffer = pdfResult.fileBuffer;
          fileName = pdfResult.fileName.replace(
            /_\d+\.pdf$/,
            `_${exportJob.id}.pdf`
          );
          contentType = pdfResult.contentType;
          break;
        }

        case "compliance_export": {
          // Read finalized transcript records
          const { data: transcriptRecords, error: transcriptError } =
            await supabase
              .from("transcript_records")
              .select(`
                *,
                students:student_id (id, first_name, last_name, student_number, lrn),
                school_years:school_year_id (id, name)
              `)
              .eq("organization_id", exportJob.organization_id)
              .eq("transcript_status", "finalized")
              .eq("school_year_id", exportParams.school_year_id || "")
              .eq("term_period", exportParams.term_period || "");

          if (transcriptError) {
            throw new Error(
              `Failed to fetch transcript records: ${transcriptError.message}`
            );
          }

          if (!transcriptRecords || transcriptRecords.length === 0) {
            throw new Error(
              "No finalized transcript records found for selected scope"
            );
          }

          exportData.transcriptRecords = transcriptRecords;

          // Generate CSV or Excel
          const format = exportParams.format || "csv";
          let result;
          if (format === "excel") {
            result = generateExcel(exportData, exportParams);
          } else {
            result = generateCSV(exportData, exportParams);
          }
          fileBuffer = result.fileBuffer;
          fileName = result.fileName.replace(
            /_\d+\.(csv|xlsx)$/,
            `_${exportJob.id}.${format === "excel" ? "xlsx" : "csv"}`
          );
          contentType = result.contentType;
          break;
        }

        default:
          throw new Error(`Unsupported export type: ${exportJob.export_type}`);
      }
    } catch (generationError) {
      // Update export job with failure
      await supabase
        .from("export_jobs")
        .update({
          status: "failed",
          error_message: generationError.message,
          completed_at: new Date().toISOString(),
        })
        .eq("id", export_job_id);

      return new Response(
        JSON.stringify({
          error: "Export generation failed",
          details: generationError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Upload file to storage bucket
    const storagePath = `${exportJob.organization_id}/${exportJob.school_id || "null"}/${export_job_id}/${fileName}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("exports")
      .upload(storagePath, fileBuffer, {
        contentType,
        upsert: false,
      });

    if (uploadError) {
      // Update export job with failure
      await supabase
        .from("export_jobs")
        .update({
          status: "failed",
          error_message: `Storage upload failed: ${uploadError.message}`,
          completed_at: new Date().toISOString(),
        })
        .eq("id", export_job_id);

      return new Response(
        JSON.stringify({
          error: "Failed to upload export file",
          details: uploadError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Update export job with success
    const { error: finalUpdateError } = await supabase
      .from("export_jobs")
      .update({
        status: "completed",
        file_path: storagePath,
        file_size_bytes: fileBuffer.length,
        completed_at: new Date().toISOString(),
      })
      .eq("id", export_job_id);

    if (finalUpdateError) {
      console.error("Failed to update export job completion:", finalUpdateError);
      // File is uploaded but job update failed - this is a partial failure
    }

    return new Response(
      JSON.stringify({
        success: true,
        export_job_id,
        file_path: storagePath,
        file_size_bytes: fileBuffer.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

