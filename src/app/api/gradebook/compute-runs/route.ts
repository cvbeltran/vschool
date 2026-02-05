import { NextRequest, NextResponse } from "next/server";
import { supabaseServer, getAuthenticatedUser } from "@/lib/supabase/server";
import {
  listComputeRuns,
  createComputeRun,
  computeGradesForRun,
} from "@/lib/gradebook";
import { logError } from "@/lib/logger";

/**
 * Helper to verify access and get user profile
 */
async function verifyAccess(request: NextRequest) {
  // Use the helper function that handles token extraction correctly
  const { user, error: authError } = await getAuthenticatedUser(request as unknown as Request);

  if (authError || !user) {
    console.error("[gradebook/compute-runs] Authentication failed:", authError);
    return { user: null, profile: null, error: "Unauthorized" };
  }

  // Get user profile using service role client (bypasses RLS)
  const { data: profile, error: profileError } = await supabaseServer
    .from("profiles")
    .select("role, organization_id")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    console.error("[gradebook/compute-runs] Profile fetch failed:", profileError?.message || "No profile");
    return { user: null, profile: null, error: "User profile not found" };
  }

  return { user, profile, error: null };
}

/**
 * GET /api/gradebook/compute-runs
 * List compute runs with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const { user, profile, error: authError } = await verifyAccess(request);
    if (authError || !user || !profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const sectionId = searchParams.get("section_id");
    const termPeriod = searchParams.get("term_period");
    const status = searchParams.get("status");

    // Use server-side client to bypass RLS (same as detail route)
    let query = supabaseServer
      .from("gradebook_compute_runs")
      .select(`
        *,
        scheme:gradebook_schemes(*),
        section:sections(id, name, code)
      `)
      .eq("organization_id", profile.organization_id)
      .is("archived_at", null)
      .order("created_at", { ascending: false });

    if (sectionId) {
      query = query.eq("section_id", sectionId);
    }

    if (termPeriod) {
      query = query.eq("term_period", termPeriod);
    }

    if (status) {
      query = query.eq("status", status);
    }

    const { data: runs, error: queryError } = await query;

    if (queryError) {
      console.error(`[gradebook/compute-runs] Query error:`, queryError);
      throw new Error(`Failed to list compute runs: ${queryError.message}`);
    }

    console.log(`[gradebook/compute-runs] Found ${runs?.length || 0} runs for organization ${profile.organization_id}`);
    if (runs && runs.length > 0) {
      console.log(`[gradebook/compute-runs] Run IDs:`, runs.map((r: any) => r.id));
    }

    return NextResponse.json({ runs: runs || [] });
  } catch (error: any) {
    logError("gradebook_compute_runs_list", error, {
      message: error.message,
    });
    return NextResponse.json(
      { error: error.message || "Failed to list compute runs" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/gradebook/compute-runs
 * Create a compute run and execute computation
 */
export async function POST(request: NextRequest) {
  try {
    const { user, profile, error: authError } = await verifyAccess(request);
    if (authError || !user || !profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admin/registrar/teacher can create compute runs
    if (!["admin", "principal", "registrar", "teacher", "mentor"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const {
      section_id, // Legacy support
      section_subject_offering_id, // Preferred for new workflows
      school_year_id,
      term_period,
      scheme_id,
      weight_profile_id, // Optional - will be auto-resolved if not provided
      transmutation_table_id,
    } = body;

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

      // Warn if using fallback
      if (resolution.is_fallback) {
        console.warn(
          `[gradebook/compute-runs] Using fallback classification for section ${resolvedSectionId}: ${resolution.classification_used} (source: ${resolution.classification_source})`
        );
      }
    }

    // Get published scheme version
    const { data: scheme } = await supabaseServer
      .from("gradebook_schemes")
      .select("id, version, scheme_type")
      .eq("id", scheme_id)
      .not("published_at", "is", null)
      .is("archived_at", null)
      .single();

    if (!scheme) {
      return NextResponse.json(
        { error: "Scheme not found or not published" },
        { status: 400 }
      );
    }

    // Validate transmutation table for DepEd and CHED schemes
    if ((scheme.scheme_type === "deped_k12" || scheme.scheme_type === "ched_hei") && !transmutation_table_id) {
      return NextResponse.json(
        { error: `Transmutation table is required for ${scheme.scheme_type === "deped_k12" ? "DepEd K-12" : "CHED"} schemes` },
        { status: 400 }
      );
    }

    // Get transmutation version if DepEd or CHED (allow both published and unpublished)
    let transmutationVersion: number | null = null;
    if ((scheme.scheme_type === "deped_k12" || scheme.scheme_type === "ched_hei") && transmutation_table_id) {
      const { data: table } = await supabaseServer
        .from("gradebook_transmutation_tables")
        .select("version, published_at")
        .eq("id", transmutation_table_id)
        .is("archived_at", null)
        .single();

      if (!table) {
        return NextResponse.json(
          { error: "Transmutation table not found" },
          { status: 400 }
        );
      }

      transmutationVersion = table.version;
      
      // Warn if table is not published (but allow it)
      if (!table.published_at) {
        console.warn(`[gradebook/compute-runs] Using unpublished transmutation table ${transmutation_table_id}`);
      }
    }

    // Create compute run using server-side client to bypass RLS
    const { data: run, error: createError } = await supabaseServer
      .from("gradebook_compute_runs")
      .insert([{
        organization_id: profile.organization_id,
        school_id: null, // Profiles don't have school_id, get from section if needed
        section_id: resolvedSectionId, // Always include section_id for backwards compatibility
        section_subject_offering_id: section_subject_offering_id || null, // Include offering_id if provided
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
      }])
      .select(`
        *,
        scheme:gradebook_schemes(*),
        section:sections(id, name, code, primary_classification, classification_source)
      `)
      .single();

    if (createError || !run) {
      throw new Error(`Failed to create compute run: ${createError?.message || "Unknown error"}`);
    }

    // Execute computation (synchronous for MVP)
    // Pass the run object and supabaseServer to avoid RLS issues
    // Also pass classification metadata for storage in breakdown
    const result = await computeGradesForRun(
      run.id,
      run,
      supabaseServer,
      classificationMetadata || undefined
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Computation failed", run },
        { status: 500 }
      );
    }

    return NextResponse.json({
      run,
      computedGrades: result.computedGrades,
      classification: classificationMetadata, // Include classification info in response
    });
  } catch (error: any) {
    logError("gradebook_compute_runs_create", error, {
      message: error.message,
    });
    return NextResponse.json(
      { error: error.message || "Failed to create compute run" },
      { status: 500 }
    );
  }
}
