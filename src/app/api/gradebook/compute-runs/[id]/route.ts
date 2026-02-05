import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { logError } from "@/lib/logger";

/**
 * Helper to verify access
 */
async function verifyAccess(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    return { user: null, profile: null, error: "Unauthorized" };
  }

  const token = authHeader.replace("Bearer ", "");
  if (!token) {
    return { user: null, profile: null, error: "Unauthorized" };
  }

  const { data: { user }, error: authError } = await supabaseServer.auth.getUser(token);

  if (authError || !user) {
    return { user: null, profile: null, error: "Unauthorized" };
  }

  const { data: profile, error: profileError } = await supabaseServer
    .from("profiles")
    .select("role, organization_id")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return { user: null, profile: null, error: "User profile not found" };
  }

  return { user, profile, error: null };
}

/**
 * GET /api/gradebook/compute-runs/[id]
 * Get compute run details with computed grades
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, profile, error: authError } = await verifyAccess(request);
    if (authError || !user || !profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    
    // Use server-side client to bypass RLS
    const { data: run, error: runError } = await supabaseServer
      .from("gradebook_compute_runs")
      .select(`
        *,
        scheme:gradebook_schemes(*),
        section:sections(id, name, code)
      `)
      .eq("id", id)
      .is("archived_at", null)
      .single();

    if (runError || !run) {
      return NextResponse.json({ error: "Compute run not found" }, { status: 404 });
    }

    // Check organization access
    if (run.organization_id !== profile.organization_id && profile.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch computed grades using server-side client
    const { data: gradesData, error: gradesError } = await supabaseServer
      .from("gradebook_computed_grades")
      .select(`
        *,
        student:students(id, first_name, last_name, student_number)
      `)
      .eq("compute_run_id", id);

    if (gradesError) {
      throw new Error(`Failed to list computed grades: ${gradesError.message}`);
    }

    // Sort by student last_name manually since Supabase doesn't support nested ordering
    const computedGrades = (gradesData || []).sort((a: any, b: any) => {
      const aLastName = a.student?.last_name || "";
      const bLastName = b.student?.last_name || "";
      return aLastName.localeCompare(bLastName);
    });

    return NextResponse.json({
      run,
      computedGrades,
    });
  } catch (error: any) {
    logError("gradebook_compute_runs_get", error, {
      message: error.message,
    });
    return NextResponse.json(
      { error: error.message || "Failed to get compute run" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/gradebook/compute-runs/[id]
 * Update a compute run and re-run computation
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, profile, error: authError } = await verifyAccess(request);
    if (authError || !user || !profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admin/registrar/teacher can update compute runs
    if (!["admin", "principal", "registrar", "teacher", "mentor"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const {
      section_id,
      section_subject_offering_id,
      school_year_id,
      term_period,
      scheme_id,
      weight_profile_id,
      transmutation_table_id,
    } = body;

    // Check if run exists and user has access
    const { data: existingRun, error: runError } = await supabaseServer
      .from("gradebook_compute_runs")
      .select("id, organization_id, status")
      .eq("id", id)
      .is("archived_at", null)
      .single();

    if (runError || !existingRun) {
      return NextResponse.json({ error: "Compute run not found" }, { status: 404 });
    }

    // Check organization access
    if (existingRun.organization_id !== profile.organization_id && profile.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Require at least one of section_id or section_subject_offering_id
    if ((!section_id && !section_subject_offering_id) || !school_year_id || !term_period || !scheme_id) {
      return NextResponse.json(
        { error: "Missing required fields: (section_id OR section_subject_offering_id), school_year_id, term_period, scheme_id" },
        { status: 400 }
      );
    }

    // Resolve section_id from offering if only offering_id is provided
    let resolvedSectionId = section_id || null;
    if (!resolvedSectionId && section_subject_offering_id) {
      const { data: offering } = await supabaseServer
        .from("section_subject_offerings")
        .select("section_id")
        .eq("id", section_subject_offering_id)
        .single();

      if (!offering) {
        return NextResponse.json(
          { error: "Section subject offering not found" },
          { status: 400 }
        );
      }

      resolvedSectionId = offering.section_id;
    }

    if (!resolvedSectionId) {
      return NextResponse.json(
        { error: "Could not resolve section_id from provided parameters" },
        { status: 400 }
      );
    }

    // Get published scheme version
    const { data: scheme, error: schemeError } = await supabaseServer
      .from("gradebook_schemes")
      .select("id, version, scheme_type")
      .eq("id", scheme_id)
      .not("published_at", "is", null)
      .is("archived_at", null)
      .single();

    if (schemeError || !scheme) {
      return NextResponse.json(
        { error: "Published scheme not found" },
        { status: 400 }
      );
    }

    // Resolve weight profile from section's primary_classification if not provided
    let resolvedWeightProfileId = weight_profile_id || null;
    let classificationMetadata: {
      classification_used: string | null;
      classification_source: string | null;
      is_fallback: boolean;
    } | null = null;

    if (!resolvedWeightProfileId) {
      const { resolveWeightProfileFromSection } = await import("@/lib/gradebook");
      const resolution = await resolveWeightProfileFromSection(
        resolvedSectionId,
        scheme_id,
        supabaseServer
      );

      if (resolution.error && !resolution.weight_profile_id) {
        return NextResponse.json(
          { error: resolution.error },
          { status: 400 }
        );
      }

      resolvedWeightProfileId = resolution.weight_profile_id;
      classificationMetadata = {
        classification_used: resolution.classification_used,
        classification_source: resolution.classification_source,
        is_fallback: resolution.is_fallback,
      };
    }

    // Get transmutation version if DepEd or CHED
    let transmutationVersion: number | null = null;
    if (scheme.scheme_type === "deped_k12" || scheme.scheme_type === "ched_hei") {
      if (!transmutation_table_id) {
        return NextResponse.json(
          { error: `Transmutation table is required for ${scheme.scheme_type === "deped_k12" ? "DepEd K-12" : "CHED"} schemes` },
          { status: 400 }
        );
      }

      const { data: table, error: tableError } = await supabaseServer
        .from("gradebook_transmutation_tables")
        .select("id, version")
        .eq("id", transmutation_table_id)
        .is("archived_at", null)
        .single();

      if (tableError || !table) {
        return NextResponse.json(
          { error: "Transmutation table not found" },
          { status: 400 }
        );
      }

      transmutationVersion = table.version;
    }

    // Delete existing computed grades
    const { error: deleteGradesError } = await supabaseServer
      .from("gradebook_computed_grades")
      .delete()
      .eq("compute_run_id", id);

    if (deleteGradesError) {
      console.error("Error deleting computed grades:", deleteGradesError);
      // Continue anyway - we'll recompute
    }

    // Update compute run
    const { data: updatedRun, error: updateError } = await supabaseServer
      .from("gradebook_compute_runs")
      .update({
        section_id: resolvedSectionId,
        section_subject_offering_id: section_subject_offering_id || null,
        school_year_id,
        term_period,
        scheme_id,
        scheme_version: scheme.version,
        weight_profile_id: resolvedWeightProfileId,
        transmutation_table_id: transmutation_table_id || null,
        transmutation_version: transmutationVersion,
        as_of: new Date().toISOString(),
        run_by: user.id,
        status: "created",
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select(`
        *,
        scheme:gradebook_schemes(*),
        section:sections(id, name, code, primary_classification, classification_source)
      `)
      .single();

    if (updateError || !updatedRun) {
      throw new Error(`Failed to update compute run: ${updateError?.message || "Unknown error"}`);
    }

    // Re-run computation
    const { computeGradesForRun } = await import("@/lib/gradebook");
    const result = await computeGradesForRun(
      id,
      updatedRun,
      supabaseServer,
      classificationMetadata || undefined
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Computation failed", run: updatedRun },
        { status: 500 }
      );
    }

    return NextResponse.json({
      run: updatedRun,
      computedGrades: result.computedGrades,
      classification: classificationMetadata,
    });
  } catch (error: any) {
    logError("gradebook_compute_runs_update", error, {
      message: error.message,
    });
    return NextResponse.json(
      { error: error.message || "Failed to update compute run" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/gradebook/compute-runs/[id]
 * Delete (archive) a compute run
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, profile, error: authError } = await verifyAccess(request);
    if (authError || !user || !profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    
    // Check if run exists and user has access
    const { data: run, error: runError } = await supabaseServer
      .from("gradebook_compute_runs")
      .select("id, organization_id")
      .eq("id", id)
      .single();

    if (runError || !run) {
      return NextResponse.json({ error: "Compute run not found" }, { status: 404 });
    }

    // Check organization access
    if (run.organization_id !== profile.organization_id && profile.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Archive the compute run (soft delete)
    const { error: deleteError } = await supabaseServer
      .from("gradebook_compute_runs")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", id);

    if (deleteError) {
      throw new Error(`Failed to delete compute run: ${deleteError.message}`);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    logError("gradebook_compute_runs_delete", error, {
      message: error.message,
    });
    return NextResponse.json(
      { error: error.message || "Failed to delete compute run" },
      { status: 500 }
    );
  }
}