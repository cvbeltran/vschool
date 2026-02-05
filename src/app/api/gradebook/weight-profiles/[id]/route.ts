import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { logError } from "@/lib/logger";

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
 * DELETE /api/gradebook/weight-profiles/[id]
 * Soft delete (archive) a weight profile by setting archived_at
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
    
    // Check if profile exists and user has access
    const { data: weightProfile, error: profileError } = await supabaseServer
      .from("gradebook_weight_profiles")
      .select("id, organization_id, scheme_id")
      .eq("id", id)
      .single();

    if (profileError || !weightProfile) {
      return NextResponse.json({ error: "Weight profile not found" }, { status: 404 });
    }

    // Check organization access
    if (weightProfile.organization_id !== profile.organization_id && profile.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // First, soft delete (archive) all component weights associated with this profile
    const { error: weightsError } = await supabaseServer
      .from("gradebook_component_weights")
      .update({ archived_at: new Date().toISOString() })
      .eq("profile_id", id)
      .is("archived_at", null);

    if (weightsError) {
      throw new Error(`Failed to archive component weights: ${weightsError.message}`);
    }

    // Then soft delete (archive) the profile itself
    const { error: deleteError } = await supabaseServer
      .from("gradebook_weight_profiles")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", id)
      .is("archived_at", null);

    if (deleteError) {
      throw new Error(`Failed to archive weight profile: ${deleteError.message}`);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    logError("gradebook_weight_profiles_archive", error, {
      message: error.message,
    });
    return NextResponse.json(
      { error: error.message || "Failed to archive weight profile" },
      { status: 500 }
    );
  }
}
