import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { listSnapshotRuns } from "@/lib/mastery";
import { logError } from "@/lib/logger";

/**
 * Helper to verify access and get user profile
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

  // Get user profile
  const { data: profile, error: profileError } = await supabaseServer
    .from("profiles")
    .select("role, organization_id, is_super_admin")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return { user: null, profile: null, error: "User profile not found" };
  }

  return { user, profile, error: null };
}

/**
 * GET /api/mastery/runs
 * List snapshot runs with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const { user, profile, error: authError } = await verifyAccess(request);
    if (authError || !user || !profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const organizationId = profile.is_super_admin
      ? searchParams.get("organization_id")
      : profile.organization_id;

    const filters = {
      schoolId: searchParams.get("school_id"),
      scopeType: searchParams.get("scope_type") as
        | "experience"
        | "syllabus"
        | "program"
        | "section"
        | null,
      scopeId: searchParams.get("scope_id"),
      schoolYearId: searchParams.get("school_year_id"),
    };

    // Remove null/undefined filters
    const cleanFilters = Object.fromEntries(
      Object.entries(filters).filter(([_, v]) => v != null)
    );

    const runs = await listSnapshotRuns(organizationId, cleanFilters);

    return NextResponse.json({ runs });
  } catch (error: any) {
    logError("Error in GET /api/mastery/runs", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch snapshot runs" },
      { status: 500 }
    );
  }
}
