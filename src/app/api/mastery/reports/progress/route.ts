import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getStudentProgressReport } from "@/lib/mastery";
import { logError } from "@/lib/logger";

/**
 * GET /api/mastery/reports/progress
 * Get Student Progress Report for a snapshot run
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
    // Teachers/Admins can access reports for students in their scope
    if (profile.role === "student" && studentId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Create an authenticated Supabase client using the user's JWT token
    // This ensures RLS policies are enforced correctly
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const { createClient } = await import("@supabase/supabase-js");
    const authenticatedClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    const report = await getStudentProgressReport(
      studentId,
      snapshotRunId,
      profile.organization_id,
      authenticatedClient
    );

    if (!report) {
      // Add more detailed error logging
      console.error("[GET /api/mastery/reports/progress] Report not found", {
        studentId,
        snapshotRunId,
        organizationId: profile.organization_id,
      });
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    return NextResponse.json(report);
  } catch (error) {
    logError("Error fetching student progress report", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
