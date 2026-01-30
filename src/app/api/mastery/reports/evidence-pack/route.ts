import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getEvidencePackForSnapshot } from "@/lib/mastery";
import { logError } from "@/lib/logger";

/**
 * GET /api/mastery/reports/evidence-pack
 * Get Evidence Pack for a snapshot run
 * 
 * Query params:
 * - student_id: string (required)
 * - snapshot_run_id: string (required)
 * - domain_id: string (optional)
 * - competency_id: string (optional)
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
    const domainId = searchParams.get("domain_id") || undefined;
    const competencyId = searchParams.get("competency_id") || undefined;

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
    const evidencePack = await getEvidencePackForSnapshot(
      studentId,
      snapshotRunId,
      profile.organization_id,
      {
        domainId,
        competencyId,
      },
      supabase
    );

    return NextResponse.json(evidencePack);
  } catch (error) {
    logError("Error fetching evidence pack", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
