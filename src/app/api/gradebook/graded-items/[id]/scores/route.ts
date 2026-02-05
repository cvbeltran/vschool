import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { listGradedScores, bulkUpsertGradedScores } from "@/lib/gradebook";
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
 * GET /api/gradebook/graded-items/[id]/scores
 * List scores for a graded item
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, profile, error: authError } = await verifyAccess(request);
    if (authError || !user || !profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    
    // Use server-side client to bypass RLS issues
    // First, get the scores without the join
    const { data: scoresData, error: scoresError } = await supabaseServer
      .from("gradebook_graded_scores")
      .select(`
        id,
        organization_id,
        graded_item_id,
        student_id,
        points_earned,
        status,
        entered_at,
        created_at,
        updated_at,
        archived_at
      `)
      .eq("graded_item_id", id)
      .is("archived_at", null);

    if (scoresError) {
      throw new Error(`Failed to list graded scores: ${scoresError.message}`);
    }
    if (!scoresData || scoresData.length === 0) {
      return NextResponse.json({ scores: [] });
    }

    // Get unique student IDs
    const studentIds = [...new Set(scoresData.map((s: any) => s.student_id))];

    // Fetch students separately
    const { data: studentsData, error: studentsError } = await supabaseServer
      .from("students")
      .select("id, first_name, last_name, student_number")
      .in("id", studentIds);

    if (studentsError) {
      throw new Error(`Failed to fetch students: ${studentsError.message}`);
    }

    // Create a map of student data
    const studentMap = new Map((studentsData || []).map((s: any) => [s.id, s]));

    // Combine scores with student data
    const combinedScores = (scoresData || []).map((score: any) => ({
      ...score,
      entered_by: null,
      created_by: null,
      updated_by: null,
      student: studentMap.get(score.student_id) || null,
    }));

    // Sort by student last_name
    const sorted = combinedScores.sort((a: any, b: any) => {
      const aLastName = a.student?.last_name || "";
      const bLastName = b.student?.last_name || "";
      return aLastName.localeCompare(bLastName);
    });

    return NextResponse.json({ scores: sorted });
  } catch (error: any) {
    logError("gradebook_graded_scores_list", error, { message: error.message });
    return NextResponse.json(
      { error: error.message || "Failed to list scores" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/gradebook/graded-items/[id]/scores
 * Bulk upsert scores for a graded item
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, profile, error: authError } = await verifyAccess(request);
    if (authError || !user || !profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admin/registrar/teacher can enter scores
    if (!["admin", "principal", "registrar", "teacher", "mentor"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const scoresToSave = body.scores;

    if (!Array.isArray(scoresToSave)) {
      return NextResponse.json(
        { error: "Missing required field: scores (array)" },
        { status: 400 }
      );
    }

    // Get graded item to verify access
    const { data: item } = await supabaseServer
      .from("gradebook_graded_items")
      .select("section_id, section_subject_offering_id, max_points, organization_id")
      .eq("id", id)
      .single();

    if (!item) {
      return NextResponse.json({ error: "Graded item not found" }, { status: 404 });
    }

    // Verify teacher has access to section or offering
    if (profile.role === "teacher" || profile.role === "mentor") {
      // First, find the staff record for this user
      const { data: staffRecord } = await supabaseServer
        .from("staff")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!staffRecord) {
        return NextResponse.json(
          { error: "Staff record not found for this user" },
          { status: 403 }
        );
      }

      let hasAccess = false;

      // Check offering assignment first (preferred for new workflows)
      if (item.section_subject_offering_id) {
        const { data: subjectTeacher } = await supabaseServer
          .from("section_subject_teachers")
          .select("id")
          .eq("section_subject_offering_id", item.section_subject_offering_id)
          .eq("staff_id", staffRecord.id)
          .is("end_date", null)
          .is("archived_at", null)
          .single();

        if (subjectTeacher) {
          hasAccess = true;
        }
      }

      // Fallback to section assignment (legacy)
      if (!hasAccess && item.section_id) {
        const { data: sectionTeacher } = await supabaseServer
          .from("section_teachers")
          .select("id")
          .eq("section_id", item.section_id)
          .eq("staff_id", staffRecord.id)
          .is("end_date", null)
          .is("archived_at", null)
          .single();

        if (sectionTeacher) {
          hasAccess = true;
        }
      }

      if (!hasAccess) {
        return NextResponse.json(
          { error: "You do not have access to this graded item" },
          { status: 403 }
        );
      }
    }

    // Validate scores
    for (const score of scoresToSave) {
      if (score.points_earned !== null && score.points_earned > item.max_points) {
        return NextResponse.json(
          {
            error: `Points earned (${score.points_earned}) cannot exceed max points (${item.max_points})`,
          },
          { status: 400 }
        );
      }
    }

    // Prepare scores for upsert
    const scoresToUpsert = scoresToSave.map((s: any) => ({
      organization_id: item.organization_id,
      graded_item_id: id,
      student_id: s.student_id,
      points_earned: s.points_earned !== null ? parseFloat(s.points_earned) : null,
      status: s.status || "present",
      entered_by: user.id,
    }));

    // Use server-side implementation to avoid RLS issues
    // Get existing scores for this item
    const { data: existing } = await supabaseServer
      .from("gradebook_graded_scores")
      .select("id, student_id")
      .eq("graded_item_id", id)
      .is("archived_at", null);

    const existingMap = new Map((existing || []).map((s: any) => [s.student_id, s.id]));

    const toUpdate: Array<{ id: string; data: any }> = [];
    const toInsert: any[] = [];

    for (const score of scoresToUpsert) {
      const existingId = existingMap.get(score.student_id);
      if (existingId) {
        toUpdate.push({
          id: existingId,
          data: {
            points_earned: score.points_earned,
            status: score.status || "present",
            entered_by: score.entered_by,
            entered_at: new Date().toISOString(),
          },
        });
      } else {
        toInsert.push({
          ...score,
          status: score.status || "present",
          entered_at: new Date().toISOString(),
        });
      }
    }

    // Update existing
    for (const update of toUpdate) {
      await supabaseServer
        .from("gradebook_graded_scores")
        .update(update.data)
        .eq("id", update.id);
    }

    // Insert new
    if (toInsert.length > 0) {
      await supabaseServer.from("gradebook_graded_scores").insert(toInsert);
    }

    // Return all scores using the same logic as GET
    const { data: scoresData } = await supabaseServer
      .from("gradebook_graded_scores")
      .select(`
        id,
        organization_id,
        graded_item_id,
        student_id,
        points_earned,
        status,
        entered_at,
        created_at,
        updated_at,
        archived_at
      `)
      .eq("graded_item_id", id)
      .is("archived_at", null);

    if (!scoresData || scoresData.length === 0) {
      return NextResponse.json({ scores: [] });
    }

    // Get unique student IDs
    const studentIds = [...new Set(scoresData.map((s: any) => s.student_id))];

    // Fetch students separately
    const { data: studentsData } = await supabaseServer
      .from("students")
      .select("id, first_name, last_name, student_number")
      .in("id", studentIds);

    // Create a map of student data
    const studentMap = new Map((studentsData || []).map((s: any) => [s.id, s]));

    // Combine scores with student data
    const combinedScores = (scoresData || []).map((score: any) => ({
      ...score,
      entered_by: null,
      created_by: null,
      updated_by: null,
      student: studentMap.get(score.student_id) || null,
    }));

    // Sort by student last_name
    const sorted = combinedScores.sort((a: any, b: any) => {
      const aLastName = a.student?.last_name || "";
      const bLastName = b.student?.last_name || "";
      return aLastName.localeCompare(bLastName);
    });

    return NextResponse.json({ scores: sorted });
  } catch (error: any) {
    logError("gradebook_graded_scores_bulk", error, { message: error.message });
    return NextResponse.json(
      { error: error.message || "Failed to upsert scores" },
      { status: 500 }
    );
  }
}
