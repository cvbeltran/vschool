import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getTermSummaryMastery } from "@/lib/mastery";
import { logError } from "@/lib/logger";

/**
 * GET /api/mastery/reports/term-summary
 * Get Term Summary Mastery for a snapshot run
 * 
 * Query params:
 * - student_id: string (required)
 * - snapshot_run_id: string (required)
 */
export async function GET(request: NextRequest) {
  try {
    // Extract JWT token from Authorization header
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabaseServer
      .from("profiles")
      .select("role, organization_id")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    }

    const searchParams = request.nextUrl.searchParams;
    const studentId = searchParams.get("student_id");
    const snapshotRunId = searchParams.get("snapshot_run_id");

    if (!studentId || !snapshotRunId) {
      return NextResponse.json(
        { error: "student_id and snapshot_run_id are required" },
        { status: 400 }
      );
    }

    // Check access: Students can only access their own reports
    if (profile.role === "student" && studentId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = supabaseServer;
    const summary = await getTermSummaryMastery(
      studentId,
      snapshotRunId,
      profile.organization_id,
      supabase
    );

    if (!summary) {
      return NextResponse.json({ error: "Summary not found" }, { status: 404 });
    }

    return NextResponse.json(summary);
  } catch (error) {
    logError("Error fetching term summary", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
