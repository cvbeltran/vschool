import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { listSnapshotRuns } from "@/lib/mastery";
import { logError } from "@/lib/logger";
import { createClient } from "@supabase/supabase-js";

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

    // Debug logging
    console.log("[GET /api/mastery/runs] Request params:", {
      userId: user.id,
      profileRole: profile.role,
      isSuperAdmin: profile.is_super_admin,
      organizationId,
      filters: cleanFilters,
    });

    // Create an authenticated Supabase client using the user's JWT token
    // This ensures RLS policies are enforced correctly
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const authenticatedClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    const runs = await listSnapshotRuns(organizationId, cleanFilters, authenticatedClient);

    console.log("[GET /api/mastery/runs] Response:", {
      runsCount: runs.length,
      runIds: runs.map((r) => r.id),
    });

    return NextResponse.json({ runs });
  } catch (error: any) {
    logError("Error in GET /api/mastery/runs", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch snapshot runs" },
      { status: 500 }
    );
  }
}
