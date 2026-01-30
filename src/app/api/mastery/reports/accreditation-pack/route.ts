import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getAccreditationPack } from "@/lib/mastery";
import { logError } from "@/lib/logger";

/**
 * GET /api/mastery/reports/accreditation-pack
 * Get Accreditation Pack for a snapshot run
 * 
 * Query params:
 * - snapshot_run_id: string (required)
 * - student_ids: string[] (optional, comma-separated)
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

    // Only admins/principals can access accreditation packs
    const allowedRoles = ["admin", "principal", "registrar"];
    if (!allowedRoles.includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const snapshotRunId = searchParams.get("snapshot_run_id");
    const studentIdsParam = searchParams.get("student_ids");

    if (!snapshotRunId) {
      return NextResponse.json(
        { error: "snapshot_run_id is required" },
        { status: 400 }
      );
    }

    const studentIds = studentIdsParam
      ? studentIdsParam.split(",").filter(Boolean)
      : undefined;

    const supabase = supabaseServer;
    const accreditationPack = await getAccreditationPack(
      snapshotRunId,
      profile.organization_id,
      studentIds,
      supabase
    );

    if (!accreditationPack) {
      return NextResponse.json({ error: "Accreditation pack not found" }, { status: 404 });
    }

    return NextResponse.json(accreditationPack);
  } catch (error) {
    logError("Error fetching accreditation pack", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
