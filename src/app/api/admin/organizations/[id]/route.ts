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
 * GET /api/admin/organizations/[id]
 * Get organization details (super admin only)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await verifySuperAdmin(request);
    if (error || !user) {
      const status = error === "Unauthorized" ? 401 : error === "Forbidden: Super admin access required" ? 403 : 404;
      return NextResponse.json({ error }, { status });
    }

    const { id } = await params;

    // Fetch organization with statistics
    const { data: organization, error: orgError } = await supabaseServer
      .from("organizations")
      .select("*")
      .eq("id", id)
      .single();

    if (orgError || !organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Fetch statistics
    const [usersResult, studentsResult, schoolsResult, staffResult] = await Promise.all([
      supabaseServer
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", id),
      supabaseServer
        .from("students")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", id),
      supabaseServer
        .from("schools")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", id),
      supabaseServer
        .from("staff")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", id),
    ]);

    return NextResponse.json({
      ...organization,
      user_count: usersResult.count || 0,
      student_count: studentsResult.count || 0,
      school_count: schoolsResult.count || 0,
      staff_count: staffResult.count || 0,
    });
  } catch (error) {
    console.error("Error fetching organization:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/organizations/[id]
 * Update organization (super admin only)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await verifySuperAdmin(request);
    if (error || !user) {
      const status = error === "Unauthorized" ? 401 : error === "Forbidden: Super admin access required" ? 403 : 404;
      return NextResponse.json({ error }, { status });
    }

    const { id } = await params;
    const body = await request.json();

    // Update organization
    const { data: updatedOrg, error: updateError } = await supabaseServer
      .from("organizations")
      .update(body)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating organization:", updateError);
      return NextResponse.json(
        { error: updateError.message || "Failed to update organization" },
        { status: 400 }
      );
    }

    return NextResponse.json(updatedOrg);
  } catch (error) {
    console.error("Error updating organization:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/organizations/[id]
 * Delete organization (super admin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await verifySuperAdmin(request);
    if (error || !user) {
      const status = error === "Unauthorized" ? 401 : error === "Forbidden: Super admin access required" ? 403 : 404;
      return NextResponse.json({ error }, { status });
    }

    const { id } = await params;

    // Delete organization (cascade will handle related records)
    const { error: deleteError } = await supabaseServer
      .from("organizations")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Error deleting organization:", deleteError);
      return NextResponse.json(
        { error: deleteError.message || "Failed to delete organization" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting organization:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
