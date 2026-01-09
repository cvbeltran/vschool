import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * Helper to verify super admin access
 */
async function verifySuperAdmin(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    return { user: null, error: "Unauthorized" };
  }

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabaseServer.auth.getUser(token);

  if (authError || !user) {
    return { user: null, error: "Unauthorized" };
  }

  // Check if user is super admin
  const { data: profile, error: profileError } = await supabaseServer
    .from("profiles")
    .select("is_super_admin")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return { user: null, error: "User profile not found" };
  }

  if (!profile.is_super_admin) {
    return { user: null, error: "Forbidden: Super admin access required" };
  }

  return { user, error: null };
}

/**
 * GET /api/admin/stats
 * Fetch system-wide statistics (super admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await verifySuperAdmin(request);
    if (error || !user) {
      const status = error === "Unauthorized" ? 401 : error === "Forbidden: Super admin access required" ? 403 : 404;
      return NextResponse.json({ error }, { status });
    }

    // Fetch statistics
    const [orgsResult, usersResult, studentsResult, schoolsResult, staffResult, activeOrgsResult] = await Promise.all([
      supabaseServer.from("organizations").select("id", { count: "exact", head: true }),
      supabaseServer.from("profiles").select("id", { count: "exact", head: true }),
      supabaseServer.from("students").select("id", { count: "exact", head: true }),
      supabaseServer.from("schools").select("id", { count: "exact", head: true }),
      supabaseServer.from("staff").select("id", { count: "exact", head: true }),
      supabaseServer.from("organizations").select("id", { count: "exact", head: true }).eq("is_active", true),
    ]);

    return NextResponse.json({
      totalOrganizations: orgsResult.count || 0,
      totalUsers: usersResult.count || 0,
      totalStudents: studentsResult.count || 0,
      totalSchools: schoolsResult.count || 0,
      totalStaff: staffResult.count || 0,
      activeOrganizations: activeOrgsResult.count || 0,
      inactiveOrganizations: (orgsResult.count || 0) - (activeOrgsResult.count || 0),
    });
  } catch (error) {
    console.error("Error fetching admin stats:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
