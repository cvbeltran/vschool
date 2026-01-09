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
 * GET /api/admin/users
 * Fetch all users with organization info (super admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await verifySuperAdmin(request);
    if (error || !user) {
      const status = error === "Unauthorized" ? 401 : error === "Forbidden: Super admin access required" ? 403 : 404;
      return NextResponse.json({ error }, { status });
    }

    // Fetch users with organization info
    const { data: users, error: usersError } = await supabaseServer
      .from("profiles")
      .select(`
        id,
        email,
        first_name,
        last_name,
        role,
        is_super_admin,
        organization_id,
        created_at,
        organizations (
          id,
          name
        )
      `)
      .order("created_at", { ascending: false });

    if (usersError) {
      throw usersError;
    }

    // Fetch last login times (from auth.users metadata if available)
    const usersWithLastLogin = await Promise.all(
      (users || []).map(async (userProfile: any) => {
        const { data: authUser } = await supabaseServer.auth.admin.getUserById(userProfile.id);
        return {
          ...userProfile,
          last_login: authUser?.user?.last_sign_in_at || null,
          organization_name: userProfile.organizations?.name || null,
        };
      })
    );

    return NextResponse.json(usersWithLastLogin);
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/users
 * Update user (role, organization, super admin status) (super admin only)
 */
export async function PUT(request: NextRequest) {
  try {
    const { user, error } = await verifySuperAdmin(request);
    if (error || !user) {
      const status = error === "Unauthorized" ? 401 : error === "Forbidden: Super admin access required" ? 403 : 404;
      return NextResponse.json({ error }, { status });
    }

    const body = await request.json();
    const { userId, role, organization_id, is_super_admin } = body;

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    // Update profile
    const updateData: any = {};
    if (role !== undefined) updateData.role = role;
    if (organization_id !== undefined) updateData.organization_id = organization_id;
    if (is_super_admin !== undefined) updateData.is_super_admin = is_super_admin;

    const { data: updatedUser, error: updateError } = await supabaseServer
      .from("profiles")
      .update(updateData)
      .eq("id", userId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating user:", updateError);
      return NextResponse.json(
        { error: updateError.message || "Failed to update user" },
        { status: 400 }
      );
    }

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/users
 * Delete user (super admin only)
 */
export async function DELETE(request: NextRequest) {
  try {
    const { user, error } = await verifySuperAdmin(request);
    if (error || !user) {
      const status = error === "Unauthorized" ? 401 : error === "Forbidden: Super admin access required" ? 403 : 404;
      return NextResponse.json({ error }, { status });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    // Prevent deleting yourself
    if (userId === user.id) {
      return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
    }

    // Delete user (cascade will handle related records)
    const { error: deleteError } = await supabaseServer.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error("Error deleting user:", deleteError);
      return NextResponse.json(
        { error: deleteError.message || "Failed to delete user" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
