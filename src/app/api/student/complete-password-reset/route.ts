import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * API route to complete password reset for students
 * Called after student updates their password via auth.updateUser()
 * Updates must_reset_password = false and last_login_at = now()
 */
export async function POST(request: NextRequest) {
  try {
    // Get authenticated user from request
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Verify user is a student
    const { data: profile } = await supabaseServer
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "student") {
      return NextResponse.json(
        { error: "Forbidden: Student access required" },
        { status: 403 }
      );
    }

    // Update students table: set must_reset_password = false and last_login_at = now()
    const { error: updateError } = await supabaseServer
      .from("students")
      .update({
        must_reset_password: false,
        last_login_at: new Date().toISOString(),
      })
      .eq("profile_id", user.id);

    if (updateError) {
      console.error("Error updating student record:", updateError);
      return NextResponse.json(
        { error: "Failed to update student record" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Error in complete password reset:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
